"""Reproducible UI acceptance in real Chromium layout without network navigation.

Run: python tests/browser-acceptance.py --screenshots /tmp/tmt-screenshots
Requires: Python Playwright + Chromium. Test harness injects ES module source and
uses a deterministic localStorage shim because this sandbox denies all browser
navigation, including localhost. This is NOT an HTTP/Pages/offline E2E test.
"""
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
CSS = (ROOT / 'style.css').read_text(encoding='utf-8')
MODULES = ['src/tiles.js', 'src/shanten.js', 'src/practice.js', 'src/app.js']


def bundled_app():
    result = []
    for module in MODULES:
        src = (ROOT / module).read_text(encoding='utf-8')
        src = re.sub(r'^import[^\n]+;\s*', '', src, flags=re.MULTILINE)
        src = re.sub(r'^export\s+', '', src, flags=re.MULTILINE)
        result.append(src)
    return '\n'.join(result)


def boot(browser, width, store=None, blocked=False):
    page = browser.new_page(viewport={'width': width, 'height': 844}, device_scale_factor=1)
    page.set_default_timeout(30000)
    html = re.sub(r'<link[^>]+>', '', HTML)
    html = re.sub(r'<script type="module"[^>]*></script>', '', html)
    page.set_content(html, wait_until='domcontentloaded')
    page.add_style_tag(content=CSS)
    page.evaluate('''({data,blocked}) => {
        window.__store = new Map(Object.entries(data));
        Object.defineProperty(window,'localStorage',{configurable:true, value:{
          getItem(key){if(blocked) throw new DOMException('Blocked','SecurityError'); return window.__store.get(key)??null;},
          setItem(key,value){if(blocked) throw new DOMException('Blocked','SecurityError'); window.__store.set(key,String(value));},
          removeItem(key){if(blocked) throw new DOMException('Blocked','SecurityError');window.__store.delete(key);}
        }});
        window.confirm = () => true;
    }''', {'data': store or {}, 'blocked': blocked})
    page.add_script_tag(content=bundled_app())
    page.locator('#hand button').first.wait_for(state='visible')
    return page


def verify_layout(page, width):
    assert page.locator('#hand button').count() == 17, f'not 17 tiles at {width}px'
    sizes = page.locator('#hand button').evaluate_all('''tiles => tiles.map(t => {let r=t.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})''')
    assert all(0 <= r['x'] and r['x'] + r['w'] <= width + 1 for r in sizes), f'tile outside viewport at {width}px'
    assert all(r['h'] >= 44 for r in sizes), f'small tile height at {width}px'
    if width == 390:
        assert all(r['w'] >= 44 for r in sizes), f'small tile width at {width}px'
        assert len(set(round(r['y']) for r in sizes)) == 3, 'mobile must show 17 tiles across three rows'
    metrics = page.evaluate('''() => ({doc:document.documentElement.scrollWidth, width:innerWidth,
       surface:document.querySelector('.table-surface').scrollWidth,
       surfaceClient:document.querySelector('.table-surface').clientWidth})''')
    assert metrics['doc'] <= metrics['width'] + 1, f'page horizontal overflow {metrics}'
    if width <= 390:
        assert metrics['surface'] <= metrics['surfaceClient'] + 1, f'hand scrolling unexpectedly at {width}px'
    return metrics


def verify_keyboard(page, width):
    hand = page.locator('#hand button')
    hand.nth(0).focus()
    hand.nth(0).press('End')
    assert hand.nth(16).evaluate('(el) => el === document.activeElement'), 'End failed'
    hand.nth(16).press('Home')
    assert hand.nth(0).evaluate('(el) => el === document.activeElement'), 'Home failed'
    hand.nth(0).press('ArrowRight')
    assert hand.nth(1).evaluate('(el) => el === document.activeElement'), 'ArrowRight failed'
    hand.nth(1).press('ArrowLeft')
    assert hand.nth(0).evaluate('(el) => el === document.activeElement'), 'ArrowLeft failed'
    if width == 390:
        hand.nth(0).press('ArrowDown')
        assert hand.nth(6).evaluate('(el) => el === document.activeElement'), 'ArrowDown failed on six-column grid'
        hand.nth(6).press('ArrowUp')
        assert hand.nth(0).evaluate('(el) => el === document.activeElement'), 'ArrowUp failed'
    hand.nth(0).press('Tab')
    assert hand.nth(1).evaluate('(el) => el === document.activeElement'), 'Tab failed'


def verify_flow(page):
    page.locator('#hand button').first.click()
    assert page.locator('#answer').is_visible()
    assert page.locator('#next').is_visible()
    assert page.locator('#skip').is_hidden()
    assert page.locator('#answer-heading').evaluate('(el) => el === document.activeElement'), 'focus did not move to answer'
    assert page.locator('#rankings tr').count() >= 1
    assert page.locator('#chosen-tile').inner_text() not in ('', '—')
    assert page.locator('#best-tiles').inner_text() not in ('', '—')
    assert page.locator('#chosen-shanten').inner_text() != '—'
    assert page.locator('#best-shanten').inner_text() != '—'
    assert page.locator('#draw-details').inner_text().strip()
    assert page.locator('.explanation-slot .soon').inner_text() == '未開放'
    assert page.locator('#stat-total').inner_text() == '1'
    # UI uses exactly the chosen candidate's rank values, not its own copied arithmetic.
    chosen_row = page.locator('#rankings tr.chosen')
    assert chosen_row.count() == 1
    assert chosen_row.locator('td').nth(2).inner_text() == page.locator('#chosen-shanten').inner_text()
    assert chosen_row.locator('td').nth(3).inner_text() == page.locator('#chosen-kinds').inner_text()
    assert chosen_row.locator('td').nth(4).inner_text() == page.locator('#chosen-copies').inner_text()
    return page.evaluate('Object.fromEntries(window.__store)')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', type=Path, default=Path('screenshots'))
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    args = parser.parse_args()
    args.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=args.chromium, args=['--no-sandbox'])
        for width in [300, 390, 1440]:
            page = boot(browser, width)
            metrics = verify_layout(page, width)
            verify_keyboard(page, width)
            if width in [390, 1440]:
                page.screenshot(path=str(args.screenshots / f'{width}-question.png'), full_page=True)
            persisted = verify_flow(page)
            if width in [390, 1440]:
                page.screenshot(path=str(args.screenshots / f'{width}-result.png'), full_page=True)
            page.locator('#next-bottom').click()
            assert page.locator('#hand button').count() == 17
            assert page.locator('#answer').is_hidden()
            assert page.locator('#stat-total').inner_text() == '1'
            assert page.locator('#hand button').first.evaluate('(el) => el === document.activeElement')
            restored = boot(browser, width, store=persisted)
            assert restored.locator('#stat-total').inner_text() == '1', 'V0.1 session data not restored'
            restored.close()
            page.close()
            print(f'PASS {width}px: full hand, no page overflow, focus/keys, grading, next, mock storage restore; {metrics}')
        key = 'tw-mahjong-trainer:session:v1'
        corrupt = boot(browser, 390, store={key:'{{broken-json'})
        assert corrupt.locator('#storage-status').is_visible()
        verify_flow(corrupt)
        assert corrupt.evaluate('(key) => window.__store.get(key)', key) == '{{broken-json', 'corrupt record overwritten'
        corrupt.close()
        blocked = boot(browser, 390, blocked=True)
        assert blocked.locator('#storage-status').is_visible()
        assert '無法儲存到瀏覽器' in blocked.locator('#storage-status').inner_text()
        verify_flow(blocked)
        blocked.close()
        print('PASS corrupted/blocked localStorage simulation: safe in-memory fallback and original corrupt string preserved')
        browser.close()
    print('NOTE: Browser navigation is disabled by environment policy; HTTP navigation, native localStorage persistence and PWA offline are UNVERIFIED.')


if __name__ == '__main__':
    main()
