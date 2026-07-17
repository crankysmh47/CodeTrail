import { Worker } from 'node:worker_threads';
import * as vscode from 'vscode';
import { CodeTrailCommands } from './commands.js';
import { IndexCoordinator } from './index-coordinator.js';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workerPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'analysis-worker.cjs').fsPath;
  const coordinator = new IndexCoordinator(() => new Worker(workerPath));
  const commands = new CodeTrailCommands(context, coordinator);
  commands.register();
  await commands.restore();
}

export function deactivate(): void {}
