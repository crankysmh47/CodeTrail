// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { HostMessage, WebviewState } from '../shared/messages.js';
import { renderApp } from './main.js';

let messages: HostMessage[];

beforeEach(() => {
  document.body.replaceChildren();
  messages = [];
});

describe('CodeTrail webview', () => {
  it('should render a focused question flow and send the submitted question', () => {
    const root = document.createElement('main');
    document.body.append(root);
    renderApp(root, { kind: 'ready', filesIndexed: 42, warningCount: 0, clangStatus: 'unavailable' }, (message) =>
      messages.push(message),
    );

    const input = document.querySelector<HTMLInputElement>('[name="question"]')!;
    input.value = 'How does the fair scheduler choose the next task?';
    document.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(document.querySelector('h1')?.textContent).toBe('Follow the code that matters');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('42 C files indexed');
    expect(messages).toStrictEqual([{ kind: 'ask', query: 'How does the fair scheduler choose the next task?' }]);
  });

  it('should render numbered evidence cards with confidence and source actions', () => {
    const state: WebviewState = {
      kind: 'trail',
      trail: {
        title: 'How fair scheduling chooses a task',
        disclaimer: 'Static reading order; not a runtime trace.',
        warnings: ['Traversal reached the 40-node budget.'],
        steps: [
          {
            order: 1,
            nodeId: 'pick-next',
            name: 'pick_next_task_fair',
            nodeKind: 'function',
            path: 'kernel/sched/fair.c',
            lineStart: 10,
            lineEnd: 18,
            confidence: 'confirmed',
            edgeKind: 'calls',
            reason: 'Direct call evidence.',
            signature: 'pick_next_task_fair(struct rq *rq)',
          },
        ],
      },
    };
    const root = document.createElement('main');
    document.body.append(root);

    renderApp(root, state, (message) => messages.push(message));
    document.querySelector<HTMLButtonElement>('[data-action="open-source"]')!.click();

    expect(document.querySelector('h1')?.textContent).toBe(state.trail.title);
    expect(document.querySelector('.step-number')?.textContent).toBe('01');
    expect(document.querySelector('.confidence')?.textContent).toBe('confirmed');
    expect(document.body.textContent).toContain('Direct call evidence.');
    expect(document.body.textContent).toContain('Static reading order; not a runtime trace.');
    expect(document.body.textContent).toContain('Traversal reached the 40-node budget.');
    expect(messages).toStrictEqual([
      { kind: 'open-source', path: 'kernel/sched/fair.c', lineStart: 10, lineEnd: 18 },
    ]);
  });
});
