import { describe, expect, it } from 'vitest';
import { buildWebviewHtml } from './trail-panel.js';

describe('trail panel HTML', () => {
  it('should enforce a nonce-based content security policy and external assets', () => {
    const html = buildWebviewHtml({
      cspSource: 'vscode-webview:',
      nonce: 'fixed-nonce',
      scriptUri: 'vscode-resource:/webview.js',
      styleUri: 'vscode-resource:/styles.css',
    });

    expect(html).toContain("script-src 'nonce-fixed-nonce'");
    expect(html).toContain('src="vscode-resource:/webview.js"');
    expect(html).toContain('href="vscode-resource:/styles.css"');
    expect(html).not.toContain('<script>');
  });
});
