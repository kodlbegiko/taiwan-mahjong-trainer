"""Replay-owned browser gate for a combined R7.3 checkout.

Uses real browser localStorage, actual Rules/Scoring/Replay ES modules, frozen
synthetic archives and the production SW. This is NOT a human UI full-match
test, public HTTPS proof, or physical-device certification. No fake GameState
or mock scorer. No SKIP on missing runtime, missing cache entry or browser.
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/browser'))
from _release_site import served_site

FIXTURES = ROOT / 'tests/replay/fixtures'
RUNTIME = [
    'src/replay/index.js', 'src/replay/internal.js', 'src/replay/integrity.js',
    'src/rules/index.js', 'src/rules/scoring.js',
    'src/scoring/index.js', 'src/scoring/profiles.js', 'src/scoring/evaluate.js',
    'src/scoring/settlement.js', 'src/scoring/pre-settlement.js', 'src/scoring/adapter.js',
]
INDEX = 'tw-mahjong-replay:index:v1'
PREFIX = 'tw-mahjong-replay:archive:v1:'

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def cache_name(tree):
    match = re.search(r"const CACHE_VERSION\s*=\s*['\"]([^'\"]+)['\"]", (tree / 'sw.js').read_text())
    require(match, 'Cannot resolve actual SW cache generation')
    return 'tmt-shell-' + match.group(1)

def byte_manifest(tree):
    return {p: hashlib.sha256((tree / p).read_bytes()).hexdigest() for p in RUNTIME}

def copy_release(source, target):
    # Only mutate served_site's temporary copy, never the source checkout.
    shutil.rmtree(target)
    shutil.copytree(source, target, ignore=shutil.ignore_patterns(
        '.git', 'node_modules', '__pycache__', '.pytest_cache', '*.png.b64.txt'))

def ready(page, url):
    page.goto(url, wait_until='load')
    page.wait_for_function("async () => !!(await navigator.serviceWorker.getRegistration())?.active", timeout=30000)
    page.reload(wait_until='load')
    page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=20000)

def check_cache(page, generation, expected):
    actual = page.evaluate("""async ({generation, paths}) => {
      const names=await caches.keys();
      if(!names.includes(generation)) throw Error('Missing active release cache '+generation);
      const cache=await caches.open(generation), actual={};
      for(const path of paths){
        const response=await cache.match(new URL(path,location.href).href);
        if(!response || !response.ok) throw Error('Uncached Replay dependency '+path);
        const bytes=await response.arrayBuffer();
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        actual[path]=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      }
      return actual;
    }""", {'generation': generation, 'paths': list(expected)})
    require(actual == expected, 'Cached runtime bytes differ from checkout')
    # CacheStorage parity alone does not prove the page receives those bytes.
    # Check the controlled fetch path without bypassing its Service Worker.
    delivered = page.evaluate("""async paths => {
      if(!navigator.serviceWorker.controller) throw Error('Uncontrolled module client');
      const actual={};
      for(const path of paths){
        const response=await fetch(new URL(path,location.href),{cache:'no-store'});
        if(!response.ok)throw Error('Controlled module fetch failed '+path);
        const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
        actual[path]=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      }
      return actual;
    }""", list(expected))
    require(delivered == expected, 'Controlled fetch runtime differs from checkout: ' +
            repr([p for p in expected if delivered.get(p) != expected[p]]))

def seed_archive(page, fixture):
    # Seed only the committed synthetic archive, representing an existing user
    # record. No state injection into Rules/UI and no live user storage accessed.
    raw = json.dumps(fixture, ensure_ascii=False, separators=(',', ':'))
    key = PREFIX + fixture['manifest']['replayId']
    page.evaluate("""({key,raw,index}) => {
      localStorage.setItem(key,raw);
      localStorage.removeItem(index);
    }""", {'key': key, 'raw': raw, 'index': INDEX})
    return key, raw

def readback(page, fixture, key, raw, *, authoritative):
    args = {'key': key, 'raw': raw, 'index': INDEX,
            'id': fixture['manifest']['replayId'], 'authoritative': authoritative}
    result = page.evaluate("""async ({key,raw,index,id,authoritative}) => {
      const assert=(v,m)=>{if(!v)throw Error(m)};
      const Replay=await import('./src/replay/index.js');
      const Internal=await import('./src/replay/internal.js');
      const Hash=await import('./src/replay/integrity.js');
      const Rules=await import('./src/rules/index.js');
      const Scoring=await import('./src/scoring/index.js');
      assert(typeof Rules.createSettlementRuntime==='function','BLOCKED: authoritative Rules missing');
      assert(typeof Scoring.settlePreSettlement==='function','BLOCKED: authoritative Scoring missing');
      const runtime=Rules.createSettlementRuntime(Scoring), opts={settlementRuntime:runtime};
      const service=Replay.createReplayService({storage:localStorage,...opts});
      assert(localStorage.getItem(key)===raw,'Archive bytes changed before read');
      const archive=JSON.parse(raw), m=archive.manifest;
      const meta=service.recoverReplay(id,{viewerSeat:m.ownerSeat});
      assert(JSON.parse(localStorage.getItem(index)).includes(id),'Index recovery failed');
      assert(service.loadReplay(id).scoringVersion===m.scoringVersion,'Policy changed');
      const state=Internal.replayStateAt(archive,m.eventCount,opts);
      const historical=service.getReplayFrame(id,1,{viewerSeat:m.ownerSeat});
      const final=service.getReplayFrame(id,m.eventCount,{viewerSeat:m.ownerSeat,perspective:'postgame'});
      const score=state.extensions.tw16.result;
      assert(JSON.stringify(final.postgameDisclosure.outcome.delta)===JSON.stringify(state.round.scores),'Public delta mismatch');
      if(authoritative) assert(Internal.same(final.postgameDisclosure.outcome.settlement,score.settlement),'Public ledger mismatch');
      for(const data of [meta,historical,final]){
        const str=JSON.stringify(data);
        for(const field of ['authoritativeSettlement','scoringProfileSnapshot','evidenceEventIds','decomposition','initialSeed','fixtureDeck','winningTileId','rng','wall'])
          assert(!str.includes('"'+field+'"'),'Private field escaped: '+field);
        if(data.playerView)assert(data.playerView.opponents.every(p=>!Object.hasOwn(p,'concealed')),'Opponent hand escaped');
      }
      const computed=Internal.replayIntegrityHashes(m,archive.events,archive.decisions,state);
      if(m.integrity.sha256)assert(Internal.same(computed,m.integrity.sha256),'Golden SHA mismatch');
      else assert(!authoritative,'Authoritative SHA required');
      // Independent browser-native WebCrypto oracle (including lone surrogate).
      for(const input of ['', 'abc', '麻將🀄', String.fromCharCode(0xd800), 'x'.repeat(56), 'x'.repeat(1000)]){
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
        const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        assert(Hash.sha256Utf8(input)===hex,'WebCrypto parity mismatch');
      }
      service.saveReplay(state,{ownerSeat:m.ownerSeat,disclosurePolicy:m.disclosurePolicy});
      assert(localStorage.getItem(key)===raw,'Historical archive rewritten on save');
      return {scoringVersion:meta.scoringVersion,delta:score.delta,tai:score.tai,
        summary:authoritative?score.settlement:null,hash:computed,
        originalDigest:m.integrity.sha256??null,bytesPreserved:true};
    }""", args)
    return result

def update_worker(page, url, old_generation, new_generation):
    # Capture the old controller before publishing/acknowledging the update.
    # The application's update listener can also acknowledge a waiting worker.
    # Checking waiting and posting in separate Playwright calls races activation.
    page.evaluate("""async () => {
      const registration=await navigator.serviceWorker.getRegistration();
      if(!registration || !window.__replayOldController) throw Error('Missing old controller');
      window.__replayAcknowledged=null;
      await registration.update();
    }""")
    page.wait_for_function("""async () => {
      const r=await navigator.serviceWorker.getRegistration();
      if(!r) throw Error('Registration lost during upgrade');
      const waiting=r.waiting;
      if(waiting && waiting!==window.__replayAcknowledged){
        window.__replayAcknowledged=waiting;
        waiting.postMessage({type:'SKIP_WAITING'});
      }
      const controller=navigator.serviceWorker.controller;
      return !!controller && controller!==window.__replayOldController &&
        controller.state==='activated' && r.active===controller;
    }""", timeout=30000)
    page.wait_for_function("""async ({oldName,newName}) => {
      const names=await caches.keys();
      return names.includes(newName)&&!names.includes(oldName);
    }""", arg={'oldName': old_generation, 'newName': new_generation}, timeout=30000)
    # Do not import new modules in the pre-upgrade page. The application
    # performs its own controllerchange reload, which can race a test reload.
    # The caller opens a new document in the SAME browser context/storage.
    
def run(engine, previous_tree=None):
    old = json.loads((FIXTURES / 'r73-historical-win.json').read_text())
    new = json.loads((FIXTURES / 'r73-authoritative-robbery-archive.json').read_text())
    cases = [('legacy-fnv', old['legacyArchive'], False, old['expectedScores']),
             ('legacy-sha', old['shaArchive'], False, old['expectedScores']),
             ('authority-sha', new['archive'], True, new['expectedScores'])]
    expected = byte_manifest(ROOT)
    generation = cache_name(ROOT)
    results = []
    with sync_playwright() as pw:
        browser = getattr(pw, engine).launch(headless=True)
        try:
            for label, fixture, authority, scores in cases:
                with served_site(fresh_sw=True) as (url, tree):
                    context = browser.new_context(service_workers='allow')
                    try:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda err: errors.append(str(err)))
                        upgrade = previous_tree is not None and not authority
                        if upgrade:
                            previous_generation = cache_name(previous_tree)
                            require(previous_generation != generation, 'Upgrade must change actual cache generation')
                            copy_release(previous_tree, tree)
                            ready(page, url)
                            key, raw = seed_archive(page, fixture)
                            # Verify old runtime can read this exact old record,
                            # without requiring new authority/Scoring modules.
                            page.evaluate("""async ({id,key,raw}) => {
                              const Replay=await import('./src/replay/index.js');
                              const svc=Replay.createReplayService({storage:localStorage});
                              const meta=svc.loadReplay(id);
                              if(meta.scoringVersion!=='tw16-minimal-tai-v1'||localStorage.getItem(key)!==raw)
                                throw Error('Old runtime cannot read historical archive');
                            }""", {'id': fixture['manifest']['replayId'], 'key': key, 'raw': raw})
                            page.evaluate("""() => {
                              window.__replayOldController=navigator.serviceWorker.controller;
                              if(!window.__replayOldController)throw Error('Missing baseline controller');
                            }""")
                            copy_release(ROOT, tree)
                            update_worker(page, url, previous_generation, generation)
                            print(label, 'activated new generation; opening new controlled document', flush=True)
                            page.close()
                            page = context.new_page()
                            page.on('pageerror', lambda err: errors.append(str(err)))
                            ready(page, url)
                            require(page.evaluate('key=>localStorage.getItem(key)', key) == raw,
                                    'Upgrade changed archive bytes before new-document read')
                        else:
                            ready(page, url)
                            key, raw = seed_archive(page, fixture)
                        check_cache(page, generation, expected)
                        print(label, 'cache and controlled delivery byte parity PASS', flush=True)
                        online = readback(page, fixture, key, raw, authoritative=authority)
                        require(online['delta'] == scores, 'Frozen score mismatch')
                        print(label, 'online replay and original bytes PASS', flush=True)
                        page.reload(wait_until='load')
                        require(readback(page, fixture, key, raw, authoritative=authority) == online,
                                'Reload changed archive outcome')
                        page.close()
                        context.set_offline(True)
                        cold = context.new_page()
                        cold.on('pageerror', lambda err: errors.append(str(err)))
                        cold.goto(url, wait_until='load')
                        cold.wait_for_function('navigator.serviceWorker.controller!==null', timeout=20000)
                        check_cache(cold, generation, expected)
                        offline = readback(cold, fixture, key, raw, authoritative=authority)
                        require(offline == online, 'Cold offline archive/digest mismatch')
                        print(label, 'cold-offline replay parity PASS', flush=True)
                        require(not errors, 'Browser page errors: ' + repr(errors))
                        results.append({'case':label,'status':'PASS','upgrade':upgrade,
                                        'scoringVersion':online['scoringVersion'],
                                        'delta':online['delta'],'hash':online['hash'],
                                        'bytesPreserved':online['bytesPreserved']})
                    finally:
                        context.close()
        finally:
            browser.close()
    return {'engine':engine,'status':'PASS','cacheGeneration':generation,
            'previousTreeProvided':previous_tree is not None,
            'runtimeByteParity':True,'controlledDeliveryByteParity':True,'cases':results,
            'scope':'isolated localhost module/storage gate; not public HTTPS or UI full match'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine', choices=['chromium','firefox','webkit'], default='chromium')
    parser.add_argument('--previous-tree', type=Path,
                        help='Optional real prior checkout for old-to-new legacy archive SW upgrade; different cache generation required')
    parser.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    report = run(args.engine, args.previous_tree.resolve() if args.previous_tree else None)
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False))
