import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { probeClang } from '../analysis/clang-provider.js';
import type { CandidateView, HostMessage, WebviewState } from '../shared/messages.js';
import { CodeTrailCodeLensProvider } from './code-lens-provider.js';
import { toTrailView } from './discovery-view.js';
import { IndexCoordinator } from './index-coordinator.js';
import { loadSnapshot, saveSnapshot } from './snapshot-store.js';
import { resolveWorkspaceSource } from './source-navigation.js';
import { resolveIndexedSymbol } from './symbol-shortcuts.js';
import { buildWebviewHtml, TrailPanelController, type WebviewPort } from './trail-panel.js';

const graphBudget = { nodesMax: 40, edgesMax: 80, depthMax: 4, timeMsMax: 100 } as const;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CodeTrailCommands implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private panelController: TrailPanelController | undefined;
  private clangStatus: 'available' | 'unavailable' = 'unavailable';
  private lastQuery = '';
  private readonly codeLensProvider: CodeTrailCodeLensProvider;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coordinator: IndexCoordinator,
  ) {
    this.codeLensProvider = new CodeTrailCodeLensProvider(() => this.coordinator.getCurrentIndex());
  }

  register(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('codetrail.indexWorkspace', () => this.indexWorkspace()),
      vscode.commands.registerCommand('codetrail.askQuestion', () => this.showQuestion()),
      vscode.commands.registerCommand('codetrail.explainSymbol', () => this.discoverSymbolLinks()),
      vscode.commands.registerCommand('codetrail.discoverSymbolLinks', () => this.discoverSymbolLinks()),
      vscode.commands.registerCommand('codetrail.discoverNode', (nodeId: string, label?: string) =>
        this.discoverNode(nodeId, label),
      ),
      vscode.commands.registerCommand('codetrail.openSource', (path: string, lineStart: number, lineEnd: number) =>
        this.openSource(path, lineStart, lineEnd),
      ),
      vscode.languages.registerCodeLensProvider({ language: 'c', scheme: 'file' }, this.codeLensProvider),
      this.codeLensProvider,
      this,
    );
  }

  async restore(): Promise<void> {
    const result = await loadSnapshot(this.snapshotPath());
    if (result.status === 'ready') {
      this.coordinator.restoreIndex(result.index);
      this.codeLensProvider.refresh();
      await this.setState({
        kind: 'ready',
        filesIndexed: result.index.filesIndexed,
        warningCount: result.index.warnings.length,
        clangStatus: this.clangStatus,
      });
    }
  }

  dispose(): void {
    this.panelController?.dispose();
    this.panelController = undefined;
    this.panel?.dispose();
    this.panel = undefined;
    void this.coordinator.dispose();
  }

  private snapshotPath(): string {
    const storage = this.context.storageUri ?? this.context.globalStorageUri;
    return join(storage.fsPath, 'workspace-index.json.gz');
  }

  private ensurePanel(): TrailPanelController {
    if (this.panel && this.panelController) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return this.panelController;
    }
    const distUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist');
    this.panel = vscode.window.createWebviewPanel('codetrail.trail', 'CodeTrail', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [distUri],
    });
    const webview = this.panel.webview;
    const html = buildWebviewHtml({
      cspSource: webview.cspSource,
      nonce: randomBytes(18).toString('base64url'),
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'webview.js')).toString(),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'styles.css')).toString(),
    });
    const port: WebviewPort = {
      get html(): string {
        return webview.html;
      },
      set html(value: string) {
        webview.html = value;
      },
      async postMessage(message): Promise<boolean> {
        return webview.postMessage(message);
      },
      onDidReceiveMessage(listener) {
        return webview.onDidReceiveMessage(listener);
      },
    };
    this.panelController = new TrailPanelController(port, html, (message) => {
      void this.handleMessage(message);
    });
    this.panel.onDidDispose(() => {
      this.panelController?.dispose();
      this.panelController = undefined;
      this.panel = undefined;
    });
    return this.panelController;
  }

  private async setState(state: WebviewState): Promise<void> {
    await this.ensurePanel().setState(state);
  }

  private async handleMessage(message: HostMessage): Promise<void> {
    if (message.kind === 'ask') {
      await this.ask(message.query);
    } else if (message.kind === 'select-candidate') {
      await this.discoverNode(message.nodeId);
    } else if (message.kind === 'open-source') {
      await this.openSource(message.path, message.lineStart, message.lineEnd);
    } else {
      await this.indexWorkspace();
    }
  }

  private async showQuestion(): Promise<void> {
    try {
      const index = this.coordinator.getCurrentIndex();
      await this.setState({
        kind: 'ready',
        filesIndexed: index.filesIndexed,
        warningCount: index.warnings.length,
        clangStatus: this.clangStatus,
      });
    } catch {
      await this.setState({ kind: 'welcome' });
    }
  }

  private async indexWorkspace(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      await this.showError('Open a C workspace before indexing with CodeTrail.');
      return;
    }
    await this.setState({ kind: 'indexing', message: 'Parsing C structure and scheduler relationships…', percent: 10 });
    try {
      const configuration = vscode.workspace.getConfiguration('codetrail');
      const filesMax = configuration.get<number>('filesMax', 2_000);
      const index = await this.coordinator.startIndex({
        rootPath: folder.uri.fsPath,
        parserWasmPath: vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'tree-sitter.wasm').fsPath,
        languageWasmPath: vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'tree-sitter-c.wasm').fsPath,
        limits: { filesMax, fileBytesMax: 2 * 1024 * 1024, totalBytesMax: 250 * 1024 * 1024 },
      });
      const clang = await probeClang('clang');
      this.clangStatus = clang.status;
      this.codeLensProvider.refresh();
      await saveSnapshot(this.snapshotPath(), index);
      await this.setState({
        kind: 'ready',
        filesIndexed: index.filesIndexed,
        warningCount: index.warnings.length,
        clangStatus: this.clangStatus,
      });
    } catch (error) {
      await this.showError(messageFrom(error));
    }
  }

  private async ask(query: string): Promise<void> {
    try {
      this.lastQuery = query;
      const index = this.coordinator.getCurrentIndex();
      const result = await this.coordinator.search(query, 8);
      const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
      const candidates: CandidateView[] = [];
      for (const candidate of result.candidates) {
        const node = nodesById.get(candidate.nodeId);
        if (node) {
          candidates.push({
            nodeId: node.id,
            name: node.name,
            kind: node.kind,
            path: node.path,
            lineStart: node.range.lineStart,
            score: candidate.score,
            reasons: candidate.reasons,
          });
        }
      }
      if (candidates.length === 0) {
        await this.setState({
          kind: 'empty',
          query,
          message: 'No matching symbol or relationship.',
        });
        return;
      }
      await this.setState({ kind: 'candidates', query, candidates });
    } catch (error) {
      await this.showError(messageFrom(error));
    }
  }

  async discoverNode(nodeId: string, explicitQuery?: string): Promise<void> {
    try {
      const index = this.coordinator.getCurrentIndex();
      const discovery = await this.coordinator.discover(nodeId, graphBudget);
      const query = explicitQuery || this.lastQuery || index.nodes.find((node) => node.id === nodeId)?.name || 'Selected symbol';
      this.lastQuery = query;
      await this.setState({ kind: 'discovery', query, discovery: toTrailView(discovery, index) });
    } catch (error) {
      await this.showError(messageFrom(error));
    }
  }

  private async discoverSymbolLinks(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const range = editor?.document.getWordRangeAtPosition(editor.selection.active);
    const symbol = range ? editor?.document.getText(range) ?? '' : '';
    if (!editor || symbol.length === 0) {
      await this.showQuestion();
      return;
    }
    try {
      const resolution = resolveIndexedSymbol(this.coordinator.getCurrentIndex(), symbol, editor.document.uri.fsPath);
      if (resolution.status === 'found') {
        await this.discoverNode(resolution.node.id, resolution.node.name);
      } else {
        await this.ask(symbol);
      }
    } catch {
      await this.showQuestion();
    }
  }

  private async openSource(path: string, lineStart: number, lineEnd: number): Promise<void> {
    try {
      const index = this.coordinator.getCurrentIndex();
      const absolutePath = resolveWorkspaceSource(index.rootPath, path);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One, true);
      const selection = new vscode.Selection(lineStart - 1, 0, Math.max(lineStart - 1, lineEnd - 1), 0);
      editor.selection = selection;
      editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch (error) {
      await this.showError(messageFrom(error));
    }
  }

  private async showError(message: string): Promise<void> {
    await this.setState({ kind: 'error', message });
    void vscode.window.showErrorMessage(`CodeTrail: ${message}`);
  }
}
