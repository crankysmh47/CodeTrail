import type { ExtensionMessage, HostMessage, TrailStepView, WebviewState } from '../shared/messages.js';

type PostMessage = (message: HostMessage) => void;

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const value = document.createElement(name);
  value.className = className;
  value.textContent = text;
  return value;
}

function renderQuestion(root: HTMLElement, state: Extract<WebviewState, { kind: 'welcome' | 'ready' }>, post: PostMessage): void {
  const header = element('header', 'hero');
  header.append(element('p', 'eyebrow', 'CodeTrail · local static analysis'));
  header.append(element('h1', '', 'Follow the code that matters'));
  header.append(
    element('p', 'lede', 'Ask one concrete question. Get a bounded reading trail with source evidence and visible uncertainty.'),
  );
  const form = element('form', 'question-form');
  const label = element('label', '', 'Question');
  label.htmlFor = 'question';
  const input = element('input');
  input.id = 'question';
  input.name = 'question';
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'How does the fair scheduler choose the next task?';
  input.autocomplete = 'off';
  const button = element('button', 'primary', 'Build trail');
  button.type = 'submit';
  form.append(label, input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length > 0) {
      post({ kind: 'ask', query });
    }
  });
  const status = element('p', 'status');
  status.role = 'status';
  status.textContent = state.kind === 'ready'
    ? `${state.filesIndexed} C files indexed · Clang ${state.clangStatus}`
    : 'Index a C workspace to begin.';
  root.append(header, form, status);
  input.focus();
}

function renderStep(step: TrailStepView, post: PostMessage): HTMLLIElement {
  const item = element('li', 'trail-step');
  const number = element('span', 'step-number', String(step.order).padStart(2, '0'));
  const heading = element('h2', '', step.name);
  const kind = element('span', 'node-kind', step.nodeKind);
  const confidence = element('span', `confidence confidence-${step.confidence}`, step.confidence);
  const signature = element('code', 'signature', step.signature);
  const reason = element('p', 'reason', step.reason);
  const path = element('p', 'path', `${step.path}:${step.lineStart}`);
  const button = element('button', 'source-button', 'Open source');
  button.type = 'button';
  button.dataset.action = 'open-source';
  button.addEventListener('click', () => {
    post({ kind: 'open-source', path: step.path, lineStart: step.lineStart, lineEnd: step.lineEnd });
  });
  const meta = element('div', 'meta');
  meta.append(kind, confidence);
  const body = element('div', 'step-body');
  body.append(meta, heading, signature, reason, path, button);
  item.append(number, body);
  return item;
}

function renderTrail(root: HTMLElement, state: Extract<WebviewState, { kind: 'trail' }>, post: PostMessage): void {
  const header = element('header', 'trail-header');
  header.append(element('p', 'eyebrow', 'Evidence trail'));
  header.append(element('h1', '', state.trail.title));
  header.append(element('p', 'disclaimer', state.trail.disclaimer));
  root.append(header);
  for (const warning of state.trail.warnings) {
    const notice = element('p', 'warning', warning);
    notice.role = 'alert';
    root.append(notice);
  }
  const list = element('ol', 'trail');
  for (const step of state.trail.steps) {
    list.append(renderStep(step, post));
  }
  root.append(list);
}

function renderCandidates(root: HTMLElement, state: Extract<WebviewState, { kind: 'candidates' }>, post: PostMessage): void {
  root.append(element('p', 'eyebrow', 'Confirm the starting point'));
  root.append(element('h1', '', state.query));
  const list = element('ol', 'candidate-list');
  for (const candidate of state.candidates) {
    const item = element('li', 'candidate');
    item.append(element('h2', '', candidate.name));
    item.append(element('p', 'path', `${candidate.path}:${candidate.lineStart}`));
    item.append(element('p', 'reason', candidate.reasons.join(' · ')));
    const button = element('button', 'primary', 'Start here');
    button.type = 'button';
    button.addEventListener('click', () => post({ kind: 'select-candidate', nodeId: candidate.nodeId }));
    item.append(button);
    list.append(item);
  }
  root.append(list);
}

export function renderApp(root: HTMLElement, state: WebviewState, post: PostMessage): void {
  root.replaceChildren();
  if (state.kind === 'welcome' || state.kind === 'ready') {
    renderQuestion(root, state, post);
  } else if (state.kind === 'trail') {
    renderTrail(root, state, post);
  } else if (state.kind === 'candidates') {
    renderCandidates(root, state, post);
  } else {
    const heading = state.kind === 'indexing' ? 'Indexing workspace' : state.kind === 'partial' ? 'Partial index ready' : 'CodeTrail needs attention';
    root.append(element('h1', '', heading));
    root.append(element('p', state.kind === 'error' ? 'error' : 'status', state.message));
  }
}

type VsCodeApi = Readonly<{ postMessage(message: HostMessage): void }>;
type WebviewWindow = Window & typeof globalThis & { acquireVsCodeApi?: () => VsCodeApi };

const webviewWindow = window as WebviewWindow;
if (typeof webviewWindow.acquireVsCodeApi === 'function') {
  const api = webviewWindow.acquireVsCodeApi();
  const root = document.querySelector<HTMLElement>('#app');
  if (root) {
    renderApp(root, { kind: 'welcome' }, (message) => api.postMessage(message));
    window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
      if (event.data.kind === 'state') {
        renderApp(root, event.data.state, (message) => api.postMessage(message));
      }
    });
  }
}
