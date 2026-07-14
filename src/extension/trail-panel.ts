import { hostMessageSchema, type HostMessage, type WebviewState } from '../shared/messages.js';

export type WebviewHtmlInput = Readonly<{
  cspSource: string;
  nonce: string;
  scriptUri: string;
  styleUri: string;
}>;

export function buildWebviewHtml(input: WebviewHtmlInput): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${input.cspSource}; script-src 'nonce-${input.nonce}';">
  <link rel="stylesheet" href="${input.styleUri}">
  <title>CodeTrail</title>
</head>
<body>
  <main id="app" class="app"></main>
  <script nonce="${input.nonce}" src="${input.scriptUri}"></script>
</body>
</html>`;
}

export type MessageSubscription = Readonly<{ dispose(): void }>;
export type WebviewPort = {
  html: string;
  postMessage(message: Readonly<{ kind: 'state'; state: WebviewState }>): Promise<boolean>;
  onDidReceiveMessage(listener: (message: unknown) => void): MessageSubscription;
};

export class TrailPanelController {
  private readonly subscription: MessageSubscription;

  constructor(
    private readonly webview: WebviewPort,
    html: string,
    private readonly onMessage: (message: HostMessage) => void,
  ) {
    webview.html = html;
    this.subscription = webview.onDidReceiveMessage((message) => {
      const parsed = hostMessageSchema.safeParse(message);
      if (parsed.success) {
        this.onMessage(parsed.data);
      }
    });
  }

  async setState(state: WebviewState): Promise<void> {
    await this.webview.postMessage({ kind: 'state', state });
  }

  dispose(): void {
    this.subscription.dispose();
  }
}
