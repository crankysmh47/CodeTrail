import type {
  ExtensionMessage,
  FileLinkView,
  HostMessage,
  TrailStepView,
  WebviewState,
} from '../shared/messages.js';

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

let appShell: { search: HTMLInputElement; content: HTMLElement } | undefined;

function initShell(root: HTMLElement, post: PostMessage): void {
  if (appShell && root.contains(appShell.search)) return;
  root.replaceChildren();

  const header = element('header', 'product-header');
  header.append(element('h1', '', 'CodeTrail'));
  header.append(element('p', 'product-context', 'Local C relationship explorer'));
  root.append(header);

  const form = element('form', 'question-form');
  const label = element('label', 'visually-hidden', 'Search');
  label.htmlFor = 'search';
  const input = element('input');
  input.id = 'search';
  input.name = 'search';
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Search symbols, files, or relationships';
  input.autocomplete = 'off';
  const submit = element('button', 'primary-button', 'Search');
  submit.type = 'submit';
  form.append(label, input, submit, renderReindexButton(post));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length > 0) {
      post({ kind: 'ask', query });
    }
  });
  root.append(form);

  const content = element('div', 'app-content');
  root.append(content);

  appShell = { search: input, content };
}

function renderReindexButton(post: PostMessage, text = 'Reindex'): HTMLButtonElement {
  const button = element('button', 'secondary-button', text);
  button.type = 'button';
  button.dataset.action = 'reindex';
  button.addEventListener('click', () => post({ kind: 'reindex' }));
  return button;
}

function renderReady(root: HTMLElement, state: Extract<WebviewState, { kind: 'ready' }>): void {
  const warningSummary = state.warningCount === 1 ? '1 warning' : `${state.warningCount} warnings`;
  const status = element(
    'p',
    'workspace-status',
    `${state.filesIndexed} C files · ${warningSummary} · Clang ${state.clangStatus}`,
  );
  status.role = 'status';
  root.append(status);
}

function renderCandidateResults(
  root: HTMLElement,
  state: Extract<WebviewState, { kind: 'candidates' }>,
  post: PostMessage,
): void {
  const resultCount = state.candidates.length;
  root.append(element('p', 'result-summary', `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`));
  const list = element('ol', 'candidate-list');
  let firstButton: HTMLButtonElement | undefined;
  for (const candidate of state.candidates) {
    const item = element('li', 'candidate-item');
    const button = element('button', 'candidate-row');
    button.type = 'button';
    button.dataset.action = 'select-candidate';
    button.append(element('span', 'candidate-name', candidate.name));
    button.append(element('span', 'candidate-location', `${candidate.path}:${candidate.lineStart}`));
    button.append(element('span', 'candidate-reasons', candidate.reasons.join(' · ')));
    button.addEventListener('click', () => post({ kind: 'select-candidate', nodeId: candidate.nodeId }));
    firstButton ??= button;
    item.append(button);
    list.append(item);
  }
  root.append(list);
  firstButton?.focus();
}

function renderFileLink(link: FileLinkView, post: PostMessage): HTMLLIElement {
  const item = element('li', 'file-link');
  const route = element('p', 'file-route');
  route.append(element('code', '', link.sourcePath));
  route.append(element('span', 'route-arrow', '→'));
  route.append(element('code', '', link.targetPath));
  
  const source = element('div', 'source-row');
  source.append(element('span', 'source-location', `Evidence line ${link.lineStart}`));
  const button = element('button', 'text-button', 'Open');
  button.type = 'button';
  button.dataset.action = 'open-source';
  button.addEventListener('click', () => {
    post({ kind: 'open-source', path: link.sourcePath, lineStart: link.lineStart, lineEnd: link.lineEnd });
  });
  source.append(button);

  const meta = element('p', 'link-meta', `${link.relationship} · ${link.confidence} · ${link.evidenceCount} evidence`);
  item.append(route, meta, element('p', 'relationship-reason', link.reason), source);
  return item;
}

function renderStep(step: TrailStepView, post: PostMessage): HTMLLIElement {
  const item = element('li', 'trail-step');
  item.append(element('span', 'step-number', String(step.order).padStart(2, '0')));
  const body = element('div', 'step-body');
  body.append(element('h4', '', step.name));
  body.append(element('p', 'step-meta', `${step.nodeKind} · ${step.edgeKind} · ${step.confidence}`));
  body.append(element('code', 'signature', step.signature));
  body.append(element('p', 'relationship-reason', step.reason));
  const source = element('div', 'source-row');
  source.append(element('span', 'source-location', `${step.path}:${step.lineStart}`));
  const button = element('button', 'text-button', 'Open');
  button.type = 'button';
  button.dataset.action = 'open-source';
  button.addEventListener('click', () => {
    post({ kind: 'open-source', path: step.path, lineStart: step.lineStart, lineEnd: step.lineEnd });
  });
  source.append(button);
  body.append(source);
  item.append(body);
  return item;
}

function renderDiscovery(
  root: HTMLElement,
  state: Extract<WebviewState, { kind: 'discovery' }>,
  post: PostMessage,
): void {
  const summary = element('div', 'discovery-summary');
  summary.append(element('p', 'discovery-title', state.discovery.title));
  summary.append(element('p', 'disclaimer', state.discovery.disclaimer));
  root.append(summary);
  for (const warning of state.discovery.warnings) {
    const notice = element('p', 'warning', warning);
    notice.role = 'alert';
    root.append(notice);
  }

  const routeSection = element('section', 'discovery-section');
  routeSection.append(element('h2', '', 'File route'));
  if (state.discovery.fileLinks.length === 0) {
    const path = state.discovery.fileSections[0]?.path;
    routeSection.append(element('p', 'empty-note', path ? `This route stays within ${path}.` : 'No cross-file link found.'));
  } else {
    const list = element('ol', 'file-link-list');
    for (const link of state.discovery.fileLinks) {
      list.append(renderFileLink(link, post));
    }
    routeSection.append(list);
  }
  root.append(routeSection);

  const filesSection = element('section', 'discovery-section');
  filesSection.append(element('h2', '', 'Within files'));
  for (const file of state.discovery.fileSections) {
    const article = element('article', 'file-section');
    article.append(element('h3', '', file.path));
    if (file.steps.length === 0) {
      article.append(element('p', 'empty-note', 'Cross-file relationship only; no selected symbol step in this file.'));
    } else {
      const steps = element('ol', 'trail-list');
      for (const step of file.steps) {
        steps.append(renderStep(step, post));
      }
      article.append(steps);
    }
    filesSection.append(article);
  }
  root.append(filesSection);
}

function renderWelcome(root: HTMLElement, post: PostMessage): void {
  root.append(element('p', 'empty-note', 'Index the current C workspace to discover typed links between files and symbols.'));
  root.append(renderReindexButton(post, 'Index this workspace'));
}

function renderIndexing(root: HTMLElement, state: Extract<WebviewState, { kind: 'indexing' }>): void {
  root.append(element('p', 'workspace-status', state.message));
  const progress = element('progress', 'index-progress');
  progress.max = 100;
  progress.value = state.percent;
  progress.setAttribute('aria-label', 'Indexing progress');
  root.append(progress);
}

function renderEmpty(root: HTMLElement, state: Extract<WebviewState, { kind: 'empty' }>): void {
  root.append(element('p', 'empty-title', state.message));
  root.append(element('p', 'empty-note', 'Try a symbol, file, or relationship keyword such as sched, calls, registers, or dispatch.'));
}

function renderProblem(
  root: HTMLElement,
  state: Extract<WebviewState, { kind: 'partial' | 'error' }>,
  post: PostMessage,
): void {
  const message = element('p', state.kind === 'error' ? 'error' : 'warning', state.message);
  message.role = 'alert';
  root.append(message, renderReindexButton(post, state.kind === 'partial' ? 'Continue indexing' : 'Try indexing again'));
}

export function renderApp(root: HTMLElement, state: WebviewState, post: PostMessage): void {
  initShell(root, post);
  const { search, content } = appShell!;
  
  if ('query' in state && typeof state.query === 'string' && search.value !== state.query && document.activeElement !== search) {
    search.value = state.query;
  }
  
  content.replaceChildren();

  switch (state.kind) {
    case 'welcome': renderWelcome(content, post); break;
    case 'indexing': renderIndexing(content, state); break;
    case 'ready': renderReady(content, state); break;
    case 'candidates': renderCandidateResults(content, state, post); break;
    case 'discovery': renderDiscovery(content, state, post); break;
    case 'empty': renderEmpty(content, state); break;
    case 'partial':
    case 'error': renderProblem(content, state, post); break;
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
