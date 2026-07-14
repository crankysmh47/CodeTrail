import { isAbsolute, relative, resolve } from 'node:path';

export function resolveWorkspaceSource(rootPath: string, workspaceRelativePath: string): string {
  if (isAbsolute(workspaceRelativePath)) {
    throw new Error('Source path must be relative to the indexed workspace.');
  }
  const absolutePath = resolve(rootPath, workspaceRelativePath);
  const relativePath = relative(rootPath, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..\\`) || relativePath.startsWith('../')) {
    throw new Error('Source path escapes the indexed workspace.');
  }
  return absolutePath;
}
