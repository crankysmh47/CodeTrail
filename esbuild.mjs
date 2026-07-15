import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import packageMetadata from './package.json' with { type: 'json' };

const outdir = 'dist';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await Promise.all([
  esbuild.build({
    entryPoints: ['src/extension/extension.ts'],
    bundle: true,
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: `${outdir}/extension.cjs`,
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ['src/mcp/stdio.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: `${outdir}/mcp-server.cjs`,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
    define: { __CODETRAIL_VERSION__: JSON.stringify(packageMetadata.version) },
  }),
  esbuild.build({
    entryPoints: ['src/evaluation/mcp-evaluation-cli.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: `${outdir}/mcp-evaluation.cjs`,
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ['src/evaluation/linux-evaluation-cli.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: `${outdir}/linux-evaluation.cjs`,
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ['src/worker/analysis-worker.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: `${outdir}/analysis-worker.cjs`,
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outfile: `${outdir}/webview.js`,
    sourcemap: true,
  }),
]);

const parserWasm = fileURLToPath(import.meta.resolve('web-tree-sitter/tree-sitter.wasm'));
const cWasm = fileURLToPath(import.meta.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm'));
await Promise.all([
  copyFile(parserWasm, `${outdir}/tree-sitter.wasm`),
  copyFile(cWasm, `${outdir}/tree-sitter-c.wasm`),
  copyFile('src/webview/styles.css', `${outdir}/styles.css`),
]);
