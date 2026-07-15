import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const bundlePath = fileURLToPath(new URL('../dist/package-verifier.cjs', import.meta.url));
const child = spawn(process.execPath, [bundlePath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: true,
  shell: false,
});

child.once('error', (error) => {
  process.stderr.write(`Could not start the CodeTrail package verifier: ${error.message}\n`);
  process.exitCode = 1;
});

child.once('close', (exitCode) => {
  process.exitCode = exitCode ?? 1;
});
