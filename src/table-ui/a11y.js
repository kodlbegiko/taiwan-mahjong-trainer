/* R7.1: focus continuity only; never dispatch or authorize a game action. */
const root = document.querySelector('#full-table-root');
const keys = [
  'data-pick-action', 'data-submit-action', 'data-clear-selection',
  'data-confirm-action', 'data-cancel-action', 'data-confirm-new', 'data-cancel-new',
  'data-continue-bots', 'data-start-new', 'data-replay-next', 'data-replay-prev',
  'data-replay-first', 'data-replay-jump', 'data-daily-submit', 'data-daily-start',
  'data-daily-resume',
];
let lastFocus = null;
let keyboardPick = null;
const find = (attr, value) => Array.from(root.querySelectorAll('button, select'))
  .find(el => el.hasAttribute(attr) && el.getAttribute(attr) === value && !el.disabled);
const lostFocus = () => [document.body, document.documentElement].includes(document.activeElement);

if (root) {
  document.addEventListener('focusin', event => {
    const el = event.target.closest?.('button, select');
    if (!el || !root.contains(el)) { lastFocus = null; return; }
    const attr = keys.find(key => el.hasAttribute(key));
    lastFocus = attr ? { el, attr, value: el.getAttribute(attr), route: document.body.dataset.tableView } : null;
  });
  // A keyboard or assistive-technology native click has detail=0. Record only
  // the real, enabled hand button BEFORE main.js performs the synchronous draw.
  // Pointer selection keeps the controller's normal confirm-button focus.
  root.addEventListener('click', event => {
    const el = event.target.closest?.('button[data-pick-action]:not(:disabled)');
    if (event.detail !== 0 || !el || !root.contains(el)) { keyboardPick = null; return; }
    const intent = { el, id: el.dataset.pickAction, route: document.body.dataset.tableView };
    keyboardPick = intent;
    setTimeout(() => { if (keyboardPick === intent) keyboardPick = null; }, 0);
  }, true);

  new MutationObserver(() => {
    if (root.hidden) { keyboardPick = lastFocus = null; return; }
    const route = document.body.dataset.tableView;
    const intent = keyboardPick;
    if (intent && intent.route === route && !intent.el.isConnected) {
      keyboardPick = null;
      const tile = find('data-pick-action', intent.id);
      const active = document.activeElement;
      // Controller explicitly focuses the discard-confirm button after draw.
      // For keyboard selection only, restore the *same* action's new tile.
      // Never override declaration/restart confirmation or other intentional focus.
      const matchingConfirm = active?.matches('[data-submit-action]') &&
        active.getAttribute('data-submit-action') === intent.id;
      if (tile && (lostFocus() || matchingConfirm)) {
        tile.focus({ preventScroll: true });
        return;
      }
    }
    const expected = lastFocus;
    if (!expected || expected.route !== route) { lastFocus = null; return; }
    if (expected.el.isConnected || !lostFocus()) return;
    const same = find(expected.attr, expected.value);
    const next = same ??
      root.querySelector('.table-actions button:not(:disabled), .table-hand button:not(:disabled), .table-replay-controls button:not(:disabled), .table-empty button:not(:disabled), #table-heading');
    lastFocus = null;
    next?.focus({ preventScroll: true });
  }).observe(root, { childList: true, subtree: false });
}
