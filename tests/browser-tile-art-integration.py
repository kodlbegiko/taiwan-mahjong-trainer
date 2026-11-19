"""Real Chromium tile-art gate: 4 viewports, 34 SVGs, modes, PWA offline/update.
Run from repo root with Playwright 1.56 and installed Google Chrome.
Evidence is a synthetic Chromium viewport, never real iOS/Android/A11Y hardware.
"""
import argparse
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import shutil
import tempfile
from threading import Thread
from xml.etree import ElementTree as ET
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LEGACY_KEY = 'tw-mahjong-trainer:session:v1'
ARCHIVE_KEY = 'tw-mahjong-trainer:archive:v3'


def check(value, reason):
    if not value:
        raise AssertionError(reason)


@contextmanager
def deployed_copy():
    with tempfile.TemporaryDirectory(prefix='tmt-art-') as work:
        site = Path(work) / 'taiwan-mahjong-trainer'
        shutil.copytree(ROOT, site, ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__'))
        class Quiet(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=work, **kwargs)
            def log_message(self, *args): pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Quiet)
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield 'http://127.0.0.1:' + str(server.server_address[1]) + '/taiwan-mahjong-trainer/', site
        finally:
            server.shutdown()
            server.server_close()


def loaded_images(page, selector, expected):
    images = page.locator(selector)
    page.wait_for_function("""([s, total]) => {
      const imgs = [...document.querySelectorAll(s)];
      return imgs.length === total && imgs.every(i => i.complete && i.naturalWidth > 0 && i.naturalHeight > 0);
    }""", arg=[selector, expected], timeout=30000)
    check(images.count() == expected, 'wrong SVG image count: ' + selector)


def no_overflow_and_tappable(page, width, selector):
    info = page.evaluate("""selector => ({
      inner: innerWidth, scroll: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll(selector)].map(el => {
        const r=el.getBoundingClientRect();
        return {x:r.x, right:r.right, width:r.width, height:r.height,
                display:getComputedStyle(el).display};
      })
    })""", selector)
    check(info['scroll'] <= width + 2, 'document horizontal overflow: ' + str(width) + ' ' + str(info))
    for b in info['buttons']:
        check(b['width'] >= 34 and b['height'] >= 44, 'unusable tile hitbox: ' + str(width) + ' ' + str(b))
        check(b['x'] >= -2 and b['right'] <= width + 2, 'tile clipped outside viewport: ' + str(b))


def three_modes(browser, base, width, shots):
    ctx = browser.new_context(viewport={'width': width, 'height': 900},
                              is_mobile=(width <= 390), has_touch=(width <= 390),
                              device_scale_factor=1)
    p = ctx.new_page()
    faults = []
    p.on('pageerror', lambda e: faults.append(str(e)))
    p.goto(base, wait_until='domcontentloaded')
    loaded_images(p, '#hand img.tile-face-image', 17)
    check(p.locator('#hand button[data-tile]').count() == 17, 'missing discard buttons')
    no_overflow_and_tappable(p, width, '#hand button')
    css = p.locator('#hand img.tile-face-image').first.evaluate("""img => ({
      position:getComputedStyle(img).position, fit:getComputedStyle(img).objectFit,
      pointer:getComputedStyle(img).pointerEvents,
      w:img.getBoundingClientRect().width, parent:img.parentElement.getBoundingClientRect().width
    })""")
    check(css['position'] == 'absolute' and css['fit'] == 'contain' and css['pointer'] == 'none'
          and css['w'] <= css['parent'], 'renderer/CSS contract mismatch: ' + str(css))
    p.screenshot(path=str(shots / f'{width}-discard-question.png'), full_page=True)

    first = p.locator('#hand button').first
    first.focus()
    first.press('ArrowRight')
    check(p.evaluate('document.activeElement.dataset.index') == '1', 'ArrowRight navigation')
    p.keyboard.press('Home')
    check(p.evaluate('document.activeElement.dataset.index') == '0', 'Home navigation')
    p.keyboard.press('End')
    check(p.evaluate('document.activeElement.dataset.index') == '16', 'End navigation')
    p.keyboard.press('Enter')
    p.locator('#answer:visible').wait_for(timeout=25000)
    loaded_images(p, '#hand img.tile-face-image', 17)
    check(p.locator('#hand .tile.picked').count() == 1, 'picked tile lost')
    check(p.locator('#explanation-panel:visible').count() == 1, 'explanation missing')
    p.screenshot(path=str(shots / f'{width}-discard-result.png'), full_page=True)

    p.locator('[data-mode="tenpai"]').click()
    loaded_images(p, '#hand img.tile-face-image', 16)
    loaded_images(p, '#wait-options img.tile-face-image', 34)
    no_overflow_and_tappable(p, width, '#wait-options button')
    available = p.locator('#wait-options button:not([disabled])').first
    available.focus()
    available.press('Space')
    check(available.get_attribute('aria-pressed') == 'true', 'wait selection ARIA state')
    available.press('Home')
    available.press('End')
    p.screenshot(path=str(shots / f'{width}-tenpai-question.png'), full_page=True)
    p.locator('#submit-waits').click()
    p.locator('#wait-answer:visible').wait_for()
    loaded_images(p, '#wait-options img.tile-face-image', 34)
    p.screenshot(path=str(shots / f'{width}-tenpai-result.png'), full_page=True)

    p.locator('[data-mode="multi_wait"]').click()
    loaded_images(p, '#hand img.tile-face-image', 16)
    loaded_images(p, '#wait-options img.tile-face-image', 34)
    no_overflow_and_tappable(p, width, '#wait-options button')
    p.locator('#wait-options button:not([disabled])').first.click()
    p.locator('#submit-waits').click()
    p.locator('#wait-answer:visible').wait_for()
    records = p.evaluate("""() => {
      const archive=JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'));
      return {version:archive.schemaVersion, records:archive.records.map(r => ({type:r.taskType, scoring:r.scoringVersion}))};
    }""")
    check(records['version'] == 3 and len(records['records']) >= 3, 'v3 history not saved')
    check(set(r['type'] for r in records['records']) == {'discard', 'tenpai', 'multi_wait'}, 'mode persistence mismatch')
    check(all(r['scoring'] == 'efficiency-v2' for r in records['records']), 'scoring version mutated')
    p.screenshot(path=str(shots / f'{width}-multi-wait-result.png'), full_page=True)
    p.reload()
    loaded_images(p, '#hand img.tile-face-image', 17)
    check(int(p.locator('#stat-total').inner_text()) >= 3, 'history did not persist after reload')
    check(not faults, 'browser JavaScript exception: ' + str(faults))
    ctx.close()
    print(f'PASS {width}px: 17 hand / 34 options / keyboard / ARIA / 3 modes / persisted v3 / no SVG failures / no horizontal overflow')


def gallery(browser, base, shots):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 1000})
    p = ctx.new_page()
    p.goto(base + 'docs/tiles-preview.html')
    imgs = p.locator('.tiles img')
    check(imgs.count() == 34, 'gallery must contain every tile ID')
    for idx in range(34):
        img = p.locator('.tiles img[src="../public/tiles/' + str(idx) + '.svg"]')
        check(img.count() == 1, 'gallery mapping missing ' + str(idx))
        img.scroll_into_view_if_needed()
        img.evaluate("""img => {img.loading = 'eager'}""")
    loaded_images(p, '.tiles img', 34)
    p.evaluate('window.scrollTo(0,0)')
    p.screenshot(path=str(shots/'1440-all-34-tile-faces.png'), full_page=True)
    ctx.close()
    print('PASS 34/34 gallery HTTP SVG loaded')


def offline_and_upgrade(browser, base, site, shots):
    ctx = browser.new_context(viewport={'width': 390, 'height': 850},
                              is_mobile=True, has_touch=True)
    p = ctx.new_page()
    p.goto(base)
    p.locator('#hand button').first.wait_for()
    p.wait_for_function('Boolean(navigator.serviceWorker?.controller)', timeout=30000)
    p.reload()
    loaded_images(p, '#hand img.tile-face-image', 17)
    raw_legacy = json.dumps([{'grade':'perfect','seconds':2.7,'difficulty':'beginner','date':'2026-11-01T00:00:00.000Z'}])
    p.evaluate('(v) => localStorage.setItem("tw-mahjong-trainer:session:v1", v)', raw_legacy)
    p.reload()
    loaded_images(p, '#hand img.tile-face-image', 17)
    p.locator('#hand button').first.click()
    p.locator('#answer:visible').wait_for()
    records_before = p.evaluate("""() => JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')).records.length""")
    check(records_before >= 1, 'cannot persist before update')
    snap = p.evaluate("""async () => {
      const keys=(await caches.keys()).filter(k => k.startsWith('tmt-shell-'));
      const cache=await caches.open(keys[0]);
      const paths=(await cache.keys()).map(req => new URL(req.url).pathname);
      const missing=[];
      const base=new URL('./', location.href);
      for(let id=0; id<34; id++) {
        const u=new URL('./public/tiles/'+id+'.svg',base);
        const res=await cache.match(u);
        if(!res || !(await res.text()).includes('<svg')) missing.push(id);
      }
      return {keys, missing, paths, module:!!(await cache.match(new URL('./src/tile-visuals.js',base)))};
    }""")
    check(len(snap['keys']) == 1 and not snap['missing'] and snap['module'],
          'incomplete offline atomic tile cache: ' + str(snap))

    ctx.set_offline(True)
    cold = ctx.new_page()
    cold.goto(base, wait_until='domcontentloaded')
    loaded_images(cold, '#hand img.tile-face-image', 17)
    cold.locator('[data-mode="tenpai"]').click()
    loaded_images(cold, '#hand img.tile-face-image', 16)
    loaded_images(cold, '#wait-options img.tile-face-image', 34)
    cold.locator('#wait-options button:not([disabled])').first.click()
    cold.locator('#submit-waits').click()
    cold.locator('#wait-answer:visible').wait_for()
    cold.screenshot(path=str(shots/'390-offline-34-svg.png'), full_page=True)
    cold.close()
    ctx.set_offline(False)

    sw = site/'sw.js'
    original_sw = sw.read_text()
    match = re.search(r"const CACHE_VERSION = '([^']+)'", original_sw)
    check(match is not None, 'cache version missing')
    sw.write_text(original_sw.replace(match.group(0), "const CACHE_VERSION = '" + match.group(1) + "-upgrade-probe'"))
    svg = site/'public/tiles/9.svg'
    before=svg.read_text()
    svg.write_text(before.replace('</svg>', '<!-- tile-asset-version-probe --></svg>'))
    engine=site/'src/core/efficiency.js'
    engine.write_text(engine.read_text() + '\n// core-release-probe\n')

    p.evaluate('''async () => { const registration=await navigator.serviceWorker.ready; await registration.update(); }''')
    p.locator('#update-app:visible').wait_for(timeout=30000)
    with p.expect_navigation(wait_until='domcontentloaded', timeout=30000):
        p.locator('#update-app').click()
    p.wait_for_function("""async () => (await caches.keys()).filter(k=>k.startsWith('tmt-shell-')).length === 1""", timeout=30000)
    upgraded = p.evaluate("""async () => {
      const k=(await caches.keys()).find(x=>x.startsWith('tmt-shell-'));
      const c=await caches.open(k);
      const a=await (await c.match(new URL('./public/tiles/9.svg',location.href))).text();
      const b=await (await c.match(new URL('./src/core/efficiency.js',location.href))).text();
      return {k, art:a.includes('tile-asset-version-probe'), core:b.includes('core-release-probe'),
        legacy:localStorage.getItem('tw-mahjong-trainer:session:v1'),
        records:JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')).records.length};
    }""")
    check('upgrade-probe' in upgraded['k'] and upgraded['art'] and upgraded['core'], 'stale art or engine after SW update: ' + str(upgraded))
    check(upgraded['legacy'] == raw_legacy and upgraded['records'] >= records_before, 'training data lost on SW upgrade')
    ctx.set_offline(True)
    p.reload()
    loaded_images(p, '#hand img.tile-face-image', 17)
    p.locator('[data-mode="multi_wait"]').click()
    loaded_images(p, '#wait-options img.tile-face-image', 34)
    ctx.close()
    print('PASS offline: 34/34 SVG + renderer module + cold tab + answer + SW upgrade + engine/art byte freshness + v1/v3 preserved')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots', default='/tmp/tmt-tile-art')
    args=parser.parse_args()
    shots=Path(args.screenshots)
    shots.mkdir(parents=True,exist_ok=True)
    for i in range(34):
        ET.parse(ROOT / 'public/tiles' / f'{i}.svg')
    print('PASS 34/34 Python XML parser validation')
    with deployed_copy() as (base, site):
        with sync_playwright() as play:
            browser=play.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            try:
                gallery(browser, base, shots)
                for width in (1440, 768, 390, 320):
                    three_modes(browser, base, width, shots)
                offline_and_upgrade(browser, base, site, shots)
            finally:
                browser.close()
    print('PASS complete tile-art integration QA')


if __name__=='__main__':
    main()
