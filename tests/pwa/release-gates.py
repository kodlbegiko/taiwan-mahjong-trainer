"""Independent PWA release gates: real HTTP, offline *new tab*, cache isolation,
record persistence across offline reload and update, and atomic deployment changes.
Does not merely check sw.js or manifest existence.
"""
import argparse
from pathlib import Path
import re
import sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'browser'))
from _release_site import served_site, archive

def require(ok, why):
    if not ok:
        raise AssertionError(why)

def wait_control(page):
    page.wait_for_function('Boolean(navigator.serviceWorker?.controller)', timeout=30000)

def cache_snapshot(page):
    return page.evaluate("""async () => {
      const names = await caches.keys();
      const shells = names.filter(name => name.startsWith('tmt-shell-'));
      const contents = {};
      for (const name of shells) {
        const cache = await caches.open(name);
        contents[name] = (await cache.keys()).map(r => new URL(r.url).pathname).sort();
      }
      const reg = await navigator.serviceWorker.ready;
      return { names, shells, contents, scope:reg.scope, worker:reg.active?.scriptURL };
    }""")

def run(browser, url, app_dir, output):
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True,has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_function('navigator.serviceWorker?.ready !== undefined')
    page.evaluate('() => navigator.serviceWorker.ready')
    page.reload(wait_until='domcontentloaded')
    wait_control(page)
    snap = cache_snapshot(page)
    require(len(snap['shells']) == 1, f'exactly one atomic shell cache required: {snap}')
    require(snap['scope'].endswith('/taiwan-mahjong-trainer/'), f'wrong SW Pages scope: {snap}')
    require(snap['worker'].endswith('/taiwan-mahjong-trainer/sw.js'), f'wrong worker URL: {snap}')
    paths = list(snap['contents'].values())[0]
    required = [
       '/taiwan-mahjong-trainer/index.html', '/taiwan-mahjong-trainer/style.css',
       '/taiwan-mahjong-trainer/src/app.js', '/taiwan-mahjong-trainer/src/shanten.js',
       '/taiwan-mahjong-trainer/src/core/efficiency.js',
       '/taiwan-mahjong-trainer/src/analysis/explain.js',
       '/taiwan-mahjong-trainer/src/training/exercises.js',
       '/taiwan-mahjong-trainer/src/training/records.js',
       '/taiwan-mahjong-trainer/src/storage/archive.js',
       '/taiwan-mahjong-trainer/public/manifest.webmanifest',
       '/taiwan-mahjong-trainer/public/icons/icon-192.png',
       '/taiwan-mahjong-trainer/public/icons/icon-512.png',
    ]
    require(all(path in paths for path in required), f'precache missing essential assets: {set(required)-set(paths)}')
    manifest = page.evaluate("""async () => {
      const link = document.querySelector('link[rel="manifest"]');
      const response = await fetch(link.href);
      return { url:link.href,ok:response.ok,manifest:await response.json() };
    }""")
    require(manifest['ok'] and manifest['manifest']['display']=='standalone', 'manifest fetch/standalone invalid')
    require(manifest['manifest']['start_url'] == '../' and manifest['manifest']['scope'] == '../',
            'manifest URL not relocatable for GitHub Pages subpath')
    page.evaluate("""async () => {
      const cache = await caches.open('external-site-cache-not-owned-by-tmt');
      await cache.put('/release-gate-unrelated', new Response('preserve'));
    }""")
    # Offline must open even a *new browser tab*, not merely an already loaded DOM.
    context.set_offline(True)
    offline_tab = context.new_page()
    offline_tab.goto(url, wait_until='domcontentloaded')
    offline_tab.locator('#hand button').first.wait_for()
    require(offline_tab.locator('#hand button').count()==17, 'offline fresh-tab app not usable')
    require(offline_tab.locator('#hand').evaluate('(e)=>getComputedStyle(e).display') != 'none',
            'offline CSS not applied')
    offline_tab.locator('[data-mode="tenpai"]').click()
    offline_tab.locator('#wait-options button:not([disabled])').first.click()
    offline_tab.locator('#submit-waits').click()
    offline_tab.locator('#wait-answer:visible').wait_for()
    require(len(archive(offline_tab)['records'])==1, 'offline attempt not saved')
    offline_tab.screenshot(path=str(output/'offline-new-tab-answer.png'), full_page=True)
    offline_tab.reload(wait_until='domcontentloaded')
    offline_tab.locator('#hand button').first.wait_for()
    require(len(archive(offline_tab)['records']) == 1, 'offline reload lost stored record')
    require(offline_tab.locator('#stat-total').inner_text() == '1', 'offline progress summary lost')
    context.set_offline(False)
    offline_tab.close()
    print('PASS offline: SW scope + all essential cache + fresh tab + real answer + reload + storage')

    # Release update: the shell must replace old module bytes and preserve unrelated
    # caches/DecisionRecords; changed code is ONLY the temporary served copy.
    sw = app_dir/'sw.js'
    core = app_dir/'src/core/efficiency.js'
    old_sw = sw.read_text(encoding='utf-8')
    match = re.search(r"const CACHE_VERSION = '([^']+)'", old_sw)
    require(match, 'cannot identify versioned SW cache (fail closed)')
    old_version = match.group(1)
    new_version = old_version + '-release-gate-update'
    sw.write_text(old_sw.replace(old_version, new_version), encoding='utf-8')
    core.write_text(core.read_text(encoding='utf-8')+'\n// release-gate-new-core-byte-probe\n',encoding='utf-8')
    # Force a checked SW update: still serving the same old user document.
    page.evaluate('() => navigator.serviceWorker.getRegistration().then(r => r.update())')
    page.locator('#update-app:visible').wait_for(timeout=25000)
    with page.expect_navigation(wait_until='domcontentloaded',timeout=25000):
        page.locator('#update-app').click()
    wait_control(page)
    page.wait_for_function("""async () => {
      const keys=await caches.keys();
      return keys.filter(k=>k.startsWith('tmt-shell-')).length===1 &&
        keys.some(k=>k.includes('-release-gate-update'));
    }""",timeout=25000)
    after = cache_snapshot(page)
    require(len(after['shells'])==1 and new_version in after['shells'][0],
            f'SW did not activate new shell: {after}')
    require('external-site-cache-not-owned-by-tmt' in after['names'],
            'SW deleted an unrelated origin cache')
    loaded = page.evaluate("""async () => {
      const names=(await caches.keys()).filter(n=>n.startsWith('tmt-shell-'));
      const response=await (await caches.open(names[0])).match(new URL('./src/core/efficiency.js',location.href));
      return response ? response.text() : null;
    }""")
    require('release-gate-new-core-byte-probe' in (loaded or ''),
            'updated cache still contains old algorithm bytes')
    require(len(archive(page)['records']) == 1,
            'PWA upgrade lost saved training records')
    page.screenshot(path=str(output/'pwa-after-update.png'), full_page=True)
    require(not errors, f'uncaught JavaScript errors: {errors}')
    print('PASS PWA update: unique new cache / core byte freshness / preserve unrelated cache + v3 record')
    context.close()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',type=Path,required=True)
    args=parser.parse_args()
    args.screenshots.mkdir(parents=True,exist_ok=True)
    with served_site() as (url, app_dir):
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
            try:
                run(browser,url,app_dir,args.screenshots)
            finally:
                browser.close()

if __name__=='__main__':
    main()
