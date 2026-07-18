// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { HostMessage, WebviewState } from '../shared/messages.js';
import { renderApp } from './main.js';

let messages: HostMessage[];

beforeEach(() => {
  document.body.replaceChildren();
  messages = [];
});

function render(state: WebviewState): HTMLElement {
  const root = document.createElement('main');
  document.body.append(root);
  renderApp(root, state, (message) => messages.push(message));
  return root;
}

describe('CodeTrail webview', () => {
  it('should render a compact persistent code search toolbar', () => {
    render({ kind: 'ready', filesIndexed: 42, warningCount: 0, clangStatus: 'unavailable' });
    const input = document.querySelector<HTMLInputElement>('[name="search"]');
    if (!input) {
      throw new Error('Expected the search input');
    }
    input.value = 'schedule';

    document.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(document.querySelector('h1')?.textContent).toBe('CodeTrail');
    expect(document.body.textContent).not.toContain('Follow the code that matters');
    expect(document.querySelector('label')?.textContent).toBe('Search');
    expect(input.placeholder).toBe('Search symbols, files, or relationships');
    expect(document.querySelector('button[type="submit"]')?.textContent).toBe('Search');
    expect(document.body.textContent).not.toContain('Question');
    expect(document.body.textContent).not.toContain('Ask');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('42 C files');
    expect(messages).toStrictEqual([{ kind: 'ask', query: 'schedule' }]);
  });

  it('should render dense candidate rows and focus the first result', () => {
    render({
      kind: 'candidates',
      query: 'fair scheduler',
      candidates: [
        {
          nodeId: 'pick-next',
          name: 'pick_next_task_fair',
          kind: 'function',
          path: 'kernel/sched/fair.c',
          lineStart: 15,
          score: 154,
          reasons: ['symbol: pick, next, task, fair', 'relationship source: calls'],
        },
      ],
    });

    const first = document.querySelector<HTMLButtonElement>('[data-action="select-candidate"]');
    first?.click();

    expect(document.activeElement).toBe(first);
    expect(document.body.textContent).toContain('1 result');
    expect(document.body.textContent).toContain('kernel/sched/fair.c:15');
    expect(messages).toStrictEqual([{ kind: 'select-candidate', nodeId: 'pick-next' }]);
  });

  it('should show the file route before within-file symbol paths', () => {
    render({
      kind: 'discovery',
      query: 'pick_next_task_fair',
      discovery: {
        title: 'Trail from pick_next_task_fair',
        disclaimer: 'Static reading order; not a runtime trace.',
        warnings: [],
        fileLinks: [
          {
            sourcePath: 'kernel/sched/sched.h',
            targetPath: 'kernel/sched/fair.c',
            relationship: 'registers',
            confidence: 'inferred',
            reason: 'pick_task registers pick_next_task_fair',
            evidenceCount: 1,
            lineStart: 10,
            lineEnd: 12,
          },
        ],
        fileSections: [
          { path: 'kernel/sched/sched.h', steps: [] },
          {
            path: 'kernel/sched/fair.c',
            steps: [
              {
                order: 1,
                nodeId: 'pick-next',
                name: 'pick_next_task_fair',
                nodeKind: 'function',
                path: 'kernel/sched/fair.c',
                lineStart: 15,
                lineEnd: 18,
                confidence: 'confirmed',
                edgeKind: 'entry-point',
                reason: 'Selected entry point.',
                signature: 'pick_next_task_fair(struct rq *rq)',
              },
            ],
          },
        ],
        steps: [],
      },
    });

    const sectionTitles = [...document.querySelectorAll('section > h2')].map((node) => node.textContent);
    document.querySelector<HTMLButtonElement>('.file-link [data-action="open-source"]')?.click();

    expect(sectionTitles).toStrictEqual(['File route', 'Within files']);
    expect(document.body.textContent).toContain('sched.h');
    expect(document.body.textContent).toContain('registers');
    expect(document.body.textContent).toContain('inferred');
    expect(document.body.textContent).toContain('Static reading order; not a runtime trace.');
    expect(messages).toStrictEqual([
      { kind: 'open-source', path: 'kernel/sched/sched.h', lineStart: 10, lineEnd: 12 },
    ]);
  });

  it('should preserve the search input while result content changes', () => {
    const root = render({ kind: 'ready', filesIndexed: 42, warningCount: 0, clangStatus: 'unavailable' });
    const input = root.querySelector<HTMLInputElement>('[name="search"]');
    if (!input) {
      throw new Error('Expected the search input');
    }
    input.value = 'schedule';

    renderApp(root, { kind: 'indexing', message: 'Parsing C structure', percent: 40 }, (message) => messages.push(message));

    expect(root.querySelector('[name="search"]')).toBe(input);
    expect(input.value).toBe('schedule');
  });

  it('should keep recovery actions visible for welcome, indexing, and empty results', () => {
    const root = render({ kind: 'welcome' });
    root.querySelector<HTMLButtonElement>('[data-action="reindex"]')?.click();
    expect(document.body.textContent).toContain('Index this workspace');
    expect(messages).toStrictEqual([{ kind: 'reindex' }]);

    renderApp(root, { kind: 'indexing', message: 'Parsing C structure', percent: 40 }, (message) => messages.push(message));
    expect(document.querySelector('progress')?.getAttribute('value')).toBe('40');

    renderApp(root, { kind: 'empty', query: 'unknown subsystem', message: 'No matching symbol or relationship.' }, (message) => messages.push(message));
    expect(document.body.textContent).toContain('No matching symbol or relationship.');
    expect(document.querySelector<HTMLInputElement>('[name="search"]')?.value).toBe('unknown subsystem');
  });
});
