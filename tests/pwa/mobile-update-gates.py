"""R7 PWA upgrade regression: offline cold start, failed staging and old/new shell coherence."""
import argparse
import importlib.util
import json
import re
import sys
from time import monotonic
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'browser'))
from _release_site import served_site

def require(value, why):
    if not value:
        raise AssertionError(why)

def wait_resolved_true(page, predicate, *, label, timeout=30000):
    # Evaluate awaits the Promise and returns its resolved value. Never
    # advance a lifecycle gate on a truthy Promise or JSHandle.
    deadline=monotonic()+timeout/1000
    last=None
    polls=0
    while monotonic()<deadline:
        polls+=1
        last=page.evaluate(predicate)
        if last is True:
            print('WAIT_RESOLVED',label,polls,flush=True)
            return
        page.wait_for_timeout(100)
    raise AssertionError(f'{label}: timeout after {polls} polls, last={last!r}')


def quiesce_registration(page):
    wait_resolved_true(page, """async()=>{
      const reg=await navigator.serviceWorker.getRegistration();
      return !!reg && !reg.installing && !reg.waiting &&
        reg.active===navigator.serviceWorker.controller &&
        reg.active?.state==='activated';
    }""",label='registration-quiescent')


def shell_names(page):
    return page.evaluate("async () => (await caches.keys()).filter(n => n.startsWith('tmt-shell-'))")

def cache_snapshot(page):
    return page.evaluate("""async () => {
      const names=await caches.keys(), entries={};
      for(const name of names){
        const cache=await caches.open(name);
        const requests=await cache.keys();
        entries[name]=[];
        for(const request of requests){
          const response=await cache.match(request);
          const bytes=await response.arrayBuffer();
          const hash=await crypto.subtle.digest('SHA-256',bytes);
          entries[name].push([request.url,Array.from(new Uint8Array(hash), b=>b.toString(16).padStart(2,'0')).join('')]);
        }
        entries[name].sort((a,b)=>a[0].localeCompare(b[0]));
      }
      return {names,entries,controller:navigator.serviceWorker.controller?.state};
    }""")


def install_observer(page):
    page.evaluate("""async () => {
      const reg=await navigator.serviceWorker.getRegistration();
      if(window.__r7Observer)reg.removeEventListener('updatefound',window.__r7Observer);
      const events=[];
      window.__r7Events=events;
      window.__r7OldController=navigator.serviceWorker.controller;
      const seen=new WeakSet();
      const observe=worker=>{
        if(!worker||worker===window.__r7OldController||seen.has(worker))return;
        seen.add(worker);
        const record=()=>{
          const state=worker.state, at=performance.timeOrigin+performance.now();
          const item={state,at,controllerUnchanged:navigator.serviceWorker.controller===window.__r7OldController};
          events.push(item);
          caches.keys().then(names=>{item.names=names;});
        };
        worker.addEventListener('statechange',record);
        record();
      };
      window.__r7Observer=()=>{observe(reg.installing);observe(reg.waiting);};
      reg.addEventListener('updatefound',window.__r7Observer);
      window.__r7Observer();
    }""")


def reject_update(page, peer, before, label, evidence):
    install_observer(page)
    page.evaluate("""async () => {
      const reg=await navigator.serviceWorker.getRegistration();
      await reg.update();
    }""")
    # Do not poll for cache deletion: at the failed worker's redundant event,
    # the install waitUntil transaction must already have cleaned its staging.
    page.wait_for_function("window.__r7Events.some(e=>e.state==='redundant')", timeout=30000)
    # Capture names immediately at redundant, before expensive hashing.
    immediate_names=shell_names(page)
    after=cache_snapshot(page)
    evidence.append({'case':label,'before':before,'after':after,'immediateNames':immediate_names,
                     'states':page.evaluate('window.__r7Events')})
    print(label, 'before=', before['names'], 'after=', after['names'], flush=True)
    require(immediate_names == [n for n in before['names'] if n.startswith('tmt-shell-')],
            'failed update leaked staging cache or removed old cache')
    require(after['entries']==before['entries'], label+' changed old/unrelated cached bytes')
    require(page.evaluate('navigator.serviceWorker.controller===window.__r7OldController'),
            label+' replaced active controller')
    require(peer.evaluate('navigator.serviceWorker.controller!==null'), 'peer lost controller')
    require(page.locator('#hand button').count()==17 and peer.locator('#hand button').count()==17,
            label+' broke an existing tab')
    # Separate candidates only after the registration itself is quiescent;
    # the strict immediate rollback assertion above is deliberately not polled.
    quiesce_registration(page)


def history_snapshot(page):
    # Evidence contains record IDs and hashes, not raw concealed hands or private answers.
    return page.evaluate("""async () => {
      const out={};
      for(const key of Object.keys(localStorage).sort()){
        if(key==='tw-mahjong-master-academy:full-table:r3:v1' ||
           key.startsWith('tw-mahjong-replay:')){
          const raw=localStorage.getItem(key);
          const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
          out[key]=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
        }
      }
      const archive=JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')||'{}');
      const sidecar=JSON.parse(localStorage.getItem('tw-mahjong-master-academy:state:v1')||'{}');
      return {hashes:out,canonical:(archive.records||[]).map(r=>r.id),
        links:(sidecar.provenanceLinks||[]).map(r=>r.recordRef?.id),
        sessions:(sidecar.trainingSessions||[]).flatMap(s=>(s.recordRefs||[]).map(r=>r.id))};
    }""")


def seed_real_history(page, folder):
    folder.mkdir(parents=True,exist_ok=True)
    spec=importlib.util.spec_from_file_location('r7_real_game',Path(__file__).resolve().parents[1]/'browser'/'full-table-ui-r3-gates.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.full_round(page,folder)
    module.daily_roundtrip(page,folder)
    snapshot=history_snapshot(page)
    require('tw-mahjong-master-academy:full-table:r3:v1' in snapshot['hashes'], 'real saved game missing')
    require(any(k.startswith('tw-mahjong-replay:archive:v1:') for k in snapshot['hashes']), 'real Replay archive missing')
    require(bool(snapshot['canonical'] and snapshot['links'] and snapshot['sessions']), 'real Daily record missing')
    return snapshot


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--evidence', type=Path, required=True)
    p.add_argument('--baseline-sw', type=Path, help='Historical rollback diagnostic only')
    p.add_argument('--with-game-history', action='store_true', help='Integrated real game + Daily data before update')
    args = p.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)
    results = []
    lifecycle = []
    cdp_events = []
    http_events = []
    faults = {}
    with served_site(fresh_sw=not bool(args.baseline_sw),faults=faults,update_http=http_events) as (url, app):
        if args.baseline_sw:
            (app / 'sw.js').write_bytes(args.baseline_sw.read_bytes())
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 390, 'height': 844},
                                          is_mobile=True, has_touch=True, service_workers='allow')
            page = context.new_page()
            context.tracing.start(screenshots=True, snapshots=True, sources=True)
            session = context.new_cdp_session(page)
            session.on('ServiceWorker.workerVersionUpdated', lambda event: cdp_events.append({'event':'version',**event}))
            session.on('ServiceWorker.workerErrorReported', lambda event: cdp_events.append({'event':'error',**event}))
            session.send('ServiceWorker.enable')
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
                # A new module deployed after installation is not part of the old
                # release. Even while online the controller must refuse its bytes.
                probe = app / 'src/r7-uncached-module-probe.js'
                probe.write_text('export const probe = true;', encoding='utf-8')
                try:
                    refused = page.evaluate("""async () => {
                      try { await fetch('./src/r7-uncached-module-probe.js'); return false; }
                      catch (error) { return true; }
                    }""")
                    require(refused, 'old shell accepted an unlisted runtime module')
                    results.append({'case': 'unlisted-runtime-module-fails-closed', 'status': 'PASS'})
                finally:
                    probe.unlink()


                sw = app / 'sw.js'
                missing = app / 'src/academy-ui/academy.css'
                original_sw = sw.read_text(encoding='utf-8')
                match = re.search(r"const CACHE_VERSION = '([^']+)'", original_sw)
                require(match, 'SW version marker not found')
                version = match.group(1)
                previous_css = missing.read_bytes()
                # Seed actual historical game/Replay/Daily before any update (candidate only).
                game_before = None
                if args.with_game_history:
                    game_before=seed_real_history(page,args.evidence / 'history-before')
                    page.goto(url + '?academy=training',wait_until='networkidle')
                # Open a second controlled document before publishing the failed update.
                peer = context.new_page()
                peer.goto(url + '?academy=training', wait_until='networkidle')
                peer.wait_for_function('navigator.serviceWorker.controller!==null')
                # Complete initial unchanged-script updates while the original bytes
                # are still published; do not open a tab after publishing a bad worker.
                peer.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
                page.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
                quiesce_registration(page)
                page.evaluate('() => { window.__r7WaitProbe=0; }')
                wait_resolved_true(page, 'async()=>{await Promise.resolve();return ++window.__r7WaitProbe===3;}',
                                   label='async-predicate-regression',timeout=5000)
                require(page.evaluate('window.__r7WaitProbe')==3,'async wait advanced before true')
                page.evaluate('delete window.__r7WaitProbe')
                page.evaluate("""async()=>{const c=await caches.open('r7-unrelated-cache');await c.put('./unrelated',new Response('keep'));}""")
                page.evaluate("localStorage.setItem('r7-upgrade-sentinel','preserve-me')")
                before=cache_snapshot(page)
                missing.unlink()
                sw.write_text(original_sw.replace(version, version + '-broken'), encoding='utf-8')
                reject_update(page, peer, before, 'http-404-rollback', lifecycle)
                require(shell_names(page) == old, 'failed update leaked staging cache or removed old cache')
                missing.write_bytes(previous_css)
                results.append({'case': 'broken-release-staging-rollback', 'status': 'PASS'})
                page.screenshot(path=str(args.evidence / 'old-client-after-broken-update.png'), full_page=True)
                if args.baseline_sw:
                    return

                # Same active cache version with changed SW bytes must never
                # open/overwrite/delete that cache. Inject faults only in served
                # candidate script (not production source or localStorage).
                fault_scripts = [
                    ('reused-version', original_sw + '\n// repeated same cache version\n'),
                    ('network-disconnect', original_sw.replace(version,version+'-network')),
                    ('truncated-http-body', original_sw.replace(version,version+'-truncated')),
                    ('cache-write-failure', original_sw.replace(version,version+'-quota') +
                     "\n{const put=Cache.prototype.put;let n=0;Cache.prototype.put=function(...args){if(++n===3)return Promise.reject(new DOMException('injected write failure','QuotaExceededError'));return put.apply(this,args);};}\n"),
                    ('repeat-broken-install', original_sw.replace(version,version+'-broken')+'\n// retry\n'),
                ]
                for name, script in fault_scripts:
                    if name=='repeat-broken-install': missing.unlink()
                    fault_path='/taiwan-mahjong-trainer/src/academy-ui/academy.css'
                    if name=='network-disconnect': faults[fault_path]='disconnect'
                    if name=='truncated-http-body': faults[fault_path]='truncated'
                    http_start=len(http_events)
                    try:
                        sw.write_text(script,encoding='utf-8')
                        reject_update(page, peer, before, name, lifecycle)
                        if name in ('network-disconnect','truncated-http-body'):
                            require(any(e.get('path')==fault_path and e.get('fault')==faults[fault_path]
                                        for e in http_events[http_start:]), 'real HTTP fault was not exercised')
                        results.append({'case':name,'status':'PASS'})
                    finally:
                        faults.pop(fault_path,None)
                        if not missing.exists(): missing.write_bytes(previous_css)

                core = app / 'src/core/efficiency.js'
                old_core = core.read_text(encoding='utf-8')
                css = app / 'style.css'
                old_css = css.read_text(encoding='utf-8')
                core.write_text(old_core + '\n// r7-upgrade-js-byte-marker\n', encoding='utf-8')
                css.write_text(old_css + '\n/* r7-upgrade-css-byte-marker */\n', encoding='utf-8')
                sw.write_text(original_sw.replace(version, version + '-upgraded'), encoding='utf-8')
                install_observer(page)
                # One explicit update per registration; the peer shares it.
                # Capture the current candidate even if updatefound was delivered
                # after installing changed to waiting.
                page.evaluate("""async () => {
                  const r=await navigator.serviceWorker.getRegistration();
                  await r.update();
                  window.__r7Observer();
                }""")
                wait_resolved_true(page, """async()=>{
                  const r=await navigator.serviceWorker.getRegistration();
                  window.__r7Observer();
                  return !!r.waiting && r.waiting.state==='installed' &&
                    r.active===window.__r7OldController &&
                    navigator.serviceWorker.controller===window.__r7OldController &&
                    window.__r7Events.some(e=>e.state==='installed');
                }""",label='candidate-installed-and-waiting')
                page.locator('#update-app:visible').wait_for(timeout=30000)
                lifecycle.append({'case':'successful-staging','before':before,'after':cache_snapshot(page),'states':page.evaluate('window.__r7Events')})
                # No automatic swap while a page is open. User must opt in.
                require(shell_names(page) == [old[0], 'tmt-shell-' + version + '-upgraded'],
                        'old/new caches were not staged side by side')
                with peer.expect_navigation(wait_until='domcontentloaded', timeout=30000):
                    with page.expect_navigation(wait_until='domcontentloaded', timeout=30000):
                        page.locator('#update-app').click()
                page.wait_for_function("navigator.serviceWorker.controller !== null")
                peer.wait_for_load_state('domcontentloaded')
                page.wait_for_function("navigator.serviceWorker.controller?.state==='activated'")
                peer.wait_for_function("navigator.serviceWorker.controller?.state==='activated'")
                quiesce_registration(page)
                quiesce_registration(peer)
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
                require(page.evaluate("localStorage.getItem('r7-upgrade-sentinel')")=='preserve-me', 'localStorage lost during upgrade')
                peer.locator('#hand button').first.wait_for()
                page.locator('#hand button').first.wait_for()
                require(peer.locator('#hand button').count()==17, 'peer unusable after activation')
                require(page.evaluate("async()=>!!(await caches.match(new URL('./unrelated',location.href),{cacheName:'r7-unrelated-cache'}))"), 'unrelated cache lost during activation')
                lifecycle.append({'case':'successful-activation','after':cache_snapshot(page),'peer':cache_snapshot(peer)})
                require(latest['js'] and latest['css'], 'new JS/CSS not cached together')
                require(page.locator('#hand button').count() == 17, 'post-upgrade app unusable')
                results.append({'case': 'explicit-upgrade-atomic-js-css', 'status': 'PASS'})
                page.screenshot(path=str(args.evidence / 'upgraded-new-client.png'), full_page=True)
                if game_before is not None:
                    context.set_offline(True)
                    page.locator('[data-table-nav="play"]').click()
                    page.locator('.table-round-summary').wait_for()
                    page.locator('[data-table-nav="replay"]').click()
                    page.locator('.table-replay').wait_for()
                    page.locator('[data-table-nav="daily"]').click()
                    page.wait_for_function("() => document.body.dataset.tableView==='daily' && !!document.querySelector('#full-table-root [data-daily-start],#full-table-root [data-daily-resume],#full-table-root [data-daily-submit]')")
                    game_after=history_snapshot(page)
                    lifecycle.append({'case':'real-game-replay-daily-after-upgrade','before':game_before,'after':game_after})
                    require(game_after['hashes']==game_before['hashes'],'historical game/Replay bytes changed after update')
                    for key in ('canonical','links','sessions'):
                        require(set(game_before[key]).issubset(game_after[key]), 'Daily history lost '+key)
                    results.append({'case':'real-game-replay-daily-after-upgrade','status':'PASS'})
                    page.screenshot(path=str(args.evidence / 'daily-after-offline-upgrade.png'),full_page=True)
                    context.set_offline(False)
            except Exception as e:
                results.append({'case': 'failure', 'status': 'FAIL', 'reason': str(e)})
                page.screenshot(path=str(args.evidence / 'pwa-failure.png'), full_page=True)
                raise
            finally:
                (args.evidence / 'upgrade-results.json').write_text(json.dumps({
                    'engine': 'Chromium Playwright', 'real-installed-ios-android': 'NOT_RUN',
                    'results': results}, ensure_ascii=False, indent=2), encoding='utf-8')
                (args.evidence / 'cache-lifecycle.json').write_text(json.dumps(lifecycle,indent=2),encoding='utf-8')
                (args.evidence / 'cdp-worker-lifecycle.json').write_text(json.dumps(cdp_events,indent=2),encoding='utf-8')
                (args.evidence / 'update-http.json').write_text(json.dumps(http_events,indent=2),encoding='utf-8')
                context.tracing.stop(path=str(args.evidence / 'pwa-update.trace.zip'))
                context.close()
                browser.close()

if __name__ == '__main__':
    main()
