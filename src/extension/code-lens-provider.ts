import * as vscode from 'vscode';
import type { WorkspaceIndex } from '../core/contracts.js';
import { indexedFunctionsForDocument } from './symbol-shortcuts.js';

export class CodeTrailCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  constructor(private readonly getIndex: () => WorkspaceIndex) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    let index: WorkspaceIndex;
    try {
      index = this.getIndex();
    } catch {
      return [];
    }
    return indexedFunctionsForDocument(index, document.uri.fsPath).map((entry) => {
      const line = Math.max(0, entry.lineStart - 1);
      return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
        title: 'CodeTrail: discover links',
        command: 'codetrail.discoverNode',
        arguments: [entry.nodeId],
      });
    });
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
