"""Real Chromium acceptance: V0.2 modes, v3 storage, a11y controls, offline shell.

Run from repository root after `pip install playwright` and
`python -m playwright install chromium`:
    python tests/browser-v02-ui.py --screenshots /tmp/tmt-ui-shots

This test serves a *copy* of the checkout under /taiwan-mahjong-trainer/
to reproduce GitHub Pages subpath scope and to safely simulate a SW version bump.
"""
import argparse
import re
import json
import os
from pathlib import Path
import shutil
import socket
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def available_port():
    with closing(socket.socket()) as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def wait_questions(page, mode, size):
    page.locator(f'[data-mode="{mode}"]').click()
    page.wait_for_function('(n) => document.querySelectorAll("#hand .tile").length === n', arg=size)
    check(page.locator('#hand .tile').count() == size, f'{mode} has {size} tiles')


def result_record(page):
    return page.evaluate('''() => {
      const a = JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'));
      return { archive: a, record: a.records[a.records.length - 1] };
    }''')


def check_dimensions(page, width):
    metrics = page.evaluate('''() => ({ width:innerWidth, doc:document.documentElement.scrollWidth,
        buttons:[...document.querySelectorAll('#hand button')].map(b => ({
          w:b.getBoundingClientRect().width, h:b.getBoundingClientRect().height,
          x:b.getBoundingClientRect().x, right:b.getBoundingClientRect().right
        })) })''')
    check(metrics['doc'] <= width + 2, f'horizontal overflow at {width}: {metrics}')
    for button in metrics['buttons']:
        check(button['w'] >= 35 and button['h'] >= 44, f'tile too small at {width}: {button}')
        check(button['x'] >= -1 and button['right'] <= width + 1, 'tile not fully visible')


def exercise_flow(browser, base, width, shots):
    context = browser.new_context(viewport={'width': width, 'height': 860}, is_mobile=width == 390,
                                  has_touch=width == 390, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='domcontentloaded')
    page.locator('#hand button').first.wait_for()
    check(page.locator('#hand button').count() == 17, 'discard not 17')
    check_dimensions(page, width)
    page.screenshot(path=str(shots / f'{width}-discard-question.png'), full_page=True)
    first = page.locator('#hand button').first
    first.focus()
    first.press('ArrowRight')
    check(page.evaluate('document.activeElement.dataset.index') == '1', 'ArrowRight focus')
    page.keyboard.press('Home')
    check(page.evaluate('document.activeElement.dataset.index') == '0', 'Home focus')
    page.keyboard.press('End')
    check(page.evaluate('document.activeElement.dataset.index') == '16', 'End focus')
    page.keyboard.press('ArrowLeft')
    check(page.evaluate('document.activeElement.dataset.index') == '15', 'ArrowLeft focus')
    page.keyboard.press('Enter')
    page.locator('#answer:visible').wait_for()
    check(page.locator('#explanation-panel:visible').count() == 1, 'explanation not exposed')
    page.locator('#explanation-details summary').click()
    check(page.locator('#explanation-advanced').is_visible(), 'advanced explanation not visible')
    saved = result_record(page)
    check(saved['archive']['schemaVersion'] == 3, 'archive not v3')
    check(saved['record']['exerciseSnapshot']['schemaVersion'] == 3, 'exercise not v3')
    check(saved['record']['scoringVersion'] == 'efficiency-v2', 'wrong scoring version')
    check(page.locator('#chosen-shanten').inner_text() == str(saved['record']['answerMetadata']['chosenShanten']), 'shown shanten != record')
    page.screenshot(path=str(shots / f'{width}-discard-result.png'), full_page=True)
    page.reload(wait_until='domcontentloaded')
    page.locator('#hand button').first.wait_for()
    check(int(page.locator('#stat-total').inner_text()) >= 1, 'v3 history not restored')
    check(page.locator('#history-list details').count() >= 1, 'history details absent')
    page.locator('#next').count()  # next is hidden after refresh; use mode to generate new exercise

    wait_questions(page, 'tenpai', 16)
    check(page.locator('#wait-options button[data-wait]').count() == 34, 'wait choices should have 34 tiles')
    check_dimensions(page, width)
    available = page.locator('#wait-options button:not([disabled])').first
    available.focus()
    available.press('Space')
    check(available.get_attribute('aria-pressed') == 'true', 'space should toggle selection')
    available.press('Home')
    available.press('End')
    page.locator('#submit-waits').click()
    page.locator('#wait-answer:visible').wait_for()
    saved = result_record(page)
    check(saved['record']['taskType'] == 'tenpai', 'tenpai mode not persisted')
    check(isinstance(saved['record']['chosen'], list), 'wait answer must be list')
    page.screenshot(path=str(shots / f'{width}-tenpai-result.png'), full_page=True)
    wait_questions(page, 'multi_wait', 16)
    page.locator('#wait-options button:not([disabled])').first.click()
    page.locator('#submit-waits').click()
    page.locator('#wait-answer:visible').wait_for()
    saved = result_record(page)
    check(saved['record']['taskType'] == 'multi_wait', 'multi-wait mode not persisted')
    check(len(saved['record']['answerMetadata']['expectedTiles']) >= 2, 'not multi wait')
    check(len(saved['archive']['records']) >= 3, 'all modes not persisted')
    page.screenshot(path=str(shots / f'{width}-multi-wait-result.png'), full_page=True)
    check(not errors, 'JS page errors: ' + str(errors))
    context.close()


def legacy_and_corruption(browser, base):
    context = browser.new_context()
    page = context.new_page()
    page.goto(base)
    legacy = json.dumps([{'grade':'perfect','seconds':2.2,'difficulty':'beginner','date':'2026-11-01T00:00:00.000Z'}])
    page.evaluate('(v) => localStorage.setItem("tw-mahjong-trainer:session:v1", v)', legacy)
    page.reload()
    page.locator('#hand button').first.click()
    page.locator('#answer:visible').wait_for()
    check(page.evaluate('localStorage.getItem("tw-mahjong-trainer:session:v1")') == legacy, 'legacy overwritten')
    check(result_record(page)['archive']['legacySessions'][0]['grade'] == 'perfect', 'legacy not migrated to v3')
    check(int(page.locator('#stat-total').inner_text()) == 2, 'combined stats invalid')
    context.close()

    context = browser.new_context()
    page = context.new_page()
    page.goto(base)
    page.evaluate('localStorage.setItem("tw-mahjong-trainer:archive:v3", "{bad")')
    page.reload()
    check(page.locator('#storage-status').is_visible(), 'corrupt archive warning absent')
    page.locator('#hand button').first.click()
    page.locator('#answer:visible').wait_for()
    check(page.evaluate('localStorage.getItem("tw-mahjong-trainer:archive:v3")') == '{bad', 'corrupt v3 overwritten')
    context.close()

    context = browser.new_context()
    context.add_init_script('''(() => {
       Storage.prototype.setItem = function() { throw new DOMException('blocked', 'QuotaExceededError'); };
    })()''')
    page = context.new_page()
    page.goto(base)
    page.locator('#hand button').first.click()
    page.locator('#answer:visible').wait_for()
    check(page.locator('#storage-status').is_visible(), 'quota warning absent')
    context.close()


def offline_and_update(browser, base, app_dir):
    context = browser.new_context()
    page = context.new_page()
    page.goto(base)
    page.wait_for_function('Boolean(navigator.serviceWorker?.controller)', timeout=20000)
    page.reload()
    page.locator('#hand button').first.wait_for()
    is_cached = page.evaluate('''async () => {
      const r = await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      const cache = await caches.open(keys.find(k => k.startsWith('tmt-shell-')));
      return !!(await cache.match(new URL('./src/core/efficiency.js', location.href)));
    }''')
    check(is_cached, 'core engine not cached')
    context.set_offline(True)
    page.reload(wait_until='domcontentloaded')
    page.locator('#hand button').first.wait_for()
    page.locator('#hand button').first.click()
    page.locator('#explanation-panel:visible').wait_for()
    wait_questions(page, 'multi_wait', 16)
    page.locator('#wait-options button:not([disabled])').first.click()
    page.locator('#submit-waits').click()
    page.locator('#wait-answer:visible').wait_for()
    check(len(result_record(page)['archive']['records']) == 2, 'offline records not saved')
    context.set_offline(False)

    # Simulate a new deployment with a different atomic cache id.
    sw = app_dir / 'sw.js'
    engine = app_dir / 'src/core/efficiency.js'
    engine.write_text(engine.read_text() + '\n// release-r2-asset-probe\n')
    old = sw.read_text()
    match = re.search(r"const CACHE_VERSION = '([^']+)'", old)
    check(match is not None, 'Service Worker version is missing')
    sw.write_text(old.replace(match.group(0), "const CACHE_VERSION = '" + match.group(1) + "-update-probe'"))
    page.evaluate('''async () => { const r = await navigator.serviceWorker.ready; await r.update(); }''')
    page.locator('#update-app:visible').wait_for(timeout=20000)
    # The application intentionally reloads on a worker version switch.
    # Wait for that navigation rather than evaluating during its teardown.
    with page.expect_navigation(wait_until='domcontentloaded', timeout=20000):
        page.locator('#update-app').click()
    page.wait_for_function('''async () => (await caches.keys()).filter(k => k.startsWith('tmt-shell-')).length === 1''', timeout=20000)
    keys = page.evaluate('''async () => await caches.keys()''')
    check(any('update-probe' in key for key in keys), f'old worker cache not replaced: {keys}')
    updated_engine = page.evaluate('''async () => {
      const cache = await caches.open((await caches.keys()).find(k => k.startsWith('tmt-shell-')));
      const response = await cache.match(new URL('./src/core/efficiency.js', location.href));
      return response?.text();
    }''')
    check('release-r2-asset-probe' in updated_engine, 'new worker retained stale core algorithm bytes')
    context.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', default='/tmp/tmt-v02-browser')
    args = parser.parse_args()
    screenshots = Path(args.screenshots)
    screenshots.mkdir(parents=True, exist_ok=True)
    base_dir = screenshots.parent / 'served-site'
    app_dir = base_dir / 'taiwan-mahjong-trainer'
    if base_dir.exists(): shutil.rmtree(base_dir)
    shutil.copytree(ROOT, app_dir, ignore=shutil.ignore_patterns('.git','node_modules','__pycache__','*.png.b64.txt'))
    port = available_port()
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw): super().__init__(*a, directory=str(base_dir), **kw)
        def log_message(self, *_): pass
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{port}/taiwan-mahjong-trainer/'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            for width in [1440, 390]:
                exercise_flow(browser, url, width, screenshots)
                print(f'PASS {width}px discard / tenpai / multi_wait / keyboard / history')
            legacy_and_corruption(browser, url)
            print('PASS legacy v1 / corrupt v3 / blocked storage')
            offline_and_update(browser, url, app_dir)
            print('PASS subpath worker / offline reload / offline training / atomic update')
            browser.close()
    finally:
        server.shutdown()
    print('Screenshots:', screenshots)


if __name__ == '__main__':
    main()
