"""R7 PWA upgrade regression: offline cold start, failed staging and old/new shell coherence."""
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

def require(value, why):
    if not value:
        raise AssertionError(why)

def shell_names(page):
    return page.evaluate("async () => (await caches.keys()).filter(n => n.startsWith('tmt-shell-'))")

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--evidence', type=Path, required=True)
    args = p.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)
    results = []
    with served_site() as (url, app):
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 390, 'height': 844},
                                          is_mobile=True, has_touch=True, service_workers='allow')
            page = context.new_page()
            try:
                page.goto(url + '?academy=training', wait_until='networkidle')
                page.evaluate("() => navigator.serviceWorker.ready")
                page.reload(wait_until='networkidle')
                page.wait_for_function("navigator.serviceWorker.controller !== null")
                old = shell_names(page)
                require(len(old) == 1, 'initial complete shell required')
                manifest = page.evaluate("""async () => {
                  const r=await fetch('./public/manifest.webmanifest');
                  return r.json();
                }""")
                require(manifest['display'] == 'standalone' and
                        manifest['start_url'] == '../' and manifest['scope'] == '../',
                        'Pages-relative install manifest invalid')
                require(len(manifest['icons']) >= 2, 'install icons incomplete')
                # Cache must include all 34 real tile faces and be usable in a cold tab.
                context.set_offline(True)
                cold = context.new_page()
                cold.goto(url + '?academy=training', wait_until='domcontentloaded')
                cold.locator('#hand button').first.wait_for()
                require(cold.locator('#hand button').count() == 17, 'cold offline entry not usable')
                tiles = cold.evaluate("""async () => {
                   const items=await Promise.all(Array.from({length:34},(_,i)=>
                     fetch('./public/tiles/'+i+'.svg')));
                   return items.every(r=>r.ok && r.headers.get('content-type')?.includes('svg'));
                }""")
                require(tiles, '34 offline tile faces not available')
                cold.screenshot(path=str(args.evidence / 'cold-offline.png'), full_page=True)
                cold.close()
                context.set_offline(False)
                results.append({'case': 'cold-offline-34-svg', 'status': 'PASS'})

                # Delete just one asset from the old cache, keeping origin online:
                # old controller MUST fail closed, never download a possibly newer JS.
                integrity = page.evaluate("""async () => {
                   const name=(await caches.keys()).find(x=>x.startsWith('tmt-shell-'));
                   const c=await caches.open(name);
                   const u=new URL('./src/core/efficiency.js',location.href).href;
                   const saved=await c.match(u);
                   if(!saved) return false;
                   await c.delete(u);
                   let failed=false;
                   try { await fetch(u); } catch(e) { failed=true; }
                   await c.put(u,saved);
                   return failed;
                }""")
                require(integrity, 'old controller fell back to network on missing shell JS')
                results.append({'case': 'missing-old-js-fails-closed', 'status': 'PASS'})

                sw = app / 'sw.js'
                missing = app / 'src/academy-ui/academy.css'
                original_sw = sw.read_text(encoding='utf-8')
                match = re.search(r"const CACHE_VERSION = '([^']+)'", original_sw)
                require(match, 'SW version marker not found')
                version = match.group(1)
                previous_css = missing.read_bytes()
                missing.unlink()
                sw.write_text(original_sw.replace(version, version + '-broken'), encoding='utf-8')
                # A failed install must not delete the old working cache.
                page.evaluate("""async () => {
                  const reg=await navigator.serviceWorker.getRegistration();
                  window.__r7InstallFailed=false;
                  reg.addEventListener('updatefound',()=>{
                    const worker=reg.installing;
                    worker?.addEventListener('statechange',()=>{
                      if(worker.state==='redundant') window.__r7InstallFailed=true;
                    });
                  }, {once:true});
                  await reg.update();
                }""")
                page.wait_for_function("window.__r7InstallFailed === true", timeout=30000)
                require(shell_names(page) == old, 'failed update leaked staging cache or removed old cache')
                require(page.locator('#hand button').count() == 17,
                        'failed update broke still-open training')
                missing.write_bytes(previous_css)
                results.append({'case': 'broken-release-staging-rollback', 'status': 'PASS'})
                page.screenshot(path=str(args.evidence / 'old-client-after-broken-update.png'), full_page=True)

                core = app / 'src/core/efficiency.js'
                old_core = core.read_text(encoding='utf-8')
                css = app / 'style.css'
                old_css = css.read_text(encoding='utf-8')
                core.write_text(old_core + '\n// r7-upgrade-js-byte-marker\n', encoding='utf-8')
                css.write_text(old_css + '\n/* r7-upgrade-css-byte-marker */\n', encoding='utf-8')
                sw.write_text(original_sw.replace(version, version + '-upgraded'), encoding='utf-8')
                page.evaluate("""async () => {
                  const reg=await navigator.serviceWorker.getRegistration();
                  await reg.update();
                }""")
                page.locator('#update-app:visible').wait_for(timeout=30000)
                # No automatic swap while a page is open. User must opt in.
                require(shell_names(page) == [old[0], 'tmt-shell-' + version + '-upgraded'],
                        'old/new caches were not staged side by side')
                with page.expect_navigation(wait_until='domcontentloaded', timeout=30000):
                    page.locator('#update-app').click()
                page.wait_for_function("navigator.serviceWorker.controller !== null")
                new_names = shell_names(page)
                require(new_names == ['tmt-shell-' + version + '-upgraded'],
                        f'new release should have only one shell: {new_names}')
                latest = page.evaluate("""async () => {
                  const name=(await caches.keys()).find(n=>n.startsWith('tmt-shell-'));
                  const cache=await caches.open(name);
                  const core=await (await cache.match(new URL('./src/core/efficiency.js',location.href))).text();
                  const css=await (await cache.match(new URL('./style.css',location.href))).text();
                  return {js:core.includes('r7-upgrade-js-byte-marker'),
                          css:css.includes('r7-upgrade-css-byte-marker')};
                }""")
                require(latest['js'] and latest['css'], 'new JS/CSS not cached together')
                require(page.locator('#hand button').count() == 17, 'post-upgrade app unusable')
                results.append({'case': 'explicit-upgrade-atomic-js-css', 'status': 'PASS'})
                page.screenshot(path=str(args.evidence / 'upgraded-new-client.png'), full_page=True)
            except Exception as e:
                results.append({'case': 'failure', 'status': 'FAIL', 'reason': str(e)})
                page.screenshot(path=str(args.evidence / 'pwa-failure.png'), full_page=True)
                raise
            finally:
                (args.evidence / 'upgrade-results.json').write_text(json.dumps({
                    'engine': 'Chromium Playwright', 'real-installed-ios-android': 'NOT_RUN',
                    'results': results}, ensure_ascii=False, indent=2), encoding='utf-8')
                context.close()
                browser.close()

if __name__ == '__main__':
    main()
