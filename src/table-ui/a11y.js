/* R7 focus continuity for the public table. No Rules actions or state mutations. */
const root = document.querySelector('#full-table-root');
const keys = [
  'data-pick-action', 'data-submit-action', 'data-clear-selection',
  'data-continue-bots', 'data-start-new', 'data-replay-next',
  'data-replay-prev', 'data-replay-first', 'data-replay-jump',
  'data-daily-submit', 'data-daily-start', 'data-daily-resume',
];
let lastFocus = null;

if (root) {
  root.addEventListener('focusin', event => {
    const element = event.target.closest?.('button, select');
    if (!element || !root.contains(element)) {
      lastFocus = null;
      return;
    }
    const attr = keys.find(key => element.hasAttribute(key));
    lastFocus = attr
      ? { attr, value: element.getAttribute(attr), route: document.body.dataset.tableView }
      : null;
  });

  new MutationObserver(() => {
    const expected = lastFocus;
    if (!expected || root.hidden) return;
    if (document.body.dataset.tableView !== expected.route) {
      lastFocus = null;
      return;
    }
    // Only recover if a render removed the actual focused node.
    if (document.activeElement !== document.body &&
        document.activeElement !== document.documentElement) return;
    const all = Array.from(root.querySelectorAll('button, select'));
    const same = all.find(element =>
      element.hasAttribute(expected.attr) &&
      element.getAttribute(expected.attr) === expected.value &&
      !element.disabled);
    // The previous action may have completed. Prefer the next legal control;
    // otherwise announce the new view heading to keyboard users.
    const next = same ??
      root.querySelector('.table-actions button:not(:disabled), .table-hand button:not(:disabled), .table-replay-controls button:not(:disabled), .table-empty button:not(:disabled), #table-heading');
    lastFocus = null;
    next?.focus({ preventScroll: true });
  }).observe(root, { childList: true, subtree: false });
}
