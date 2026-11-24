"""R7.3 exact-origin Chromium QA: legitimate UI, no injected state/decks/RNG.

Public mode runs the *deployed checkout's* existing full_round driver.
Seeded mode uses the new explicit QA setup input, never writes game storage.
Every completed attempt is persisted immediately; failures retain trace/diagnostics.
"""
import argparse
from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
from urllib.parse import urljoin, urlsplit
from playwright.sync_api import sync_playwright

def require(ok,msg):
    if not ok:
        raise AssertionError(msg)

def exact_assets(ctx,root,url,sha):
    actual=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
    require(actual==sha,'Reference checkout does not match claimed deployed SHA')
    names=subprocess.check_output(['git','-C',str(root),'ls-files','-z'],text=True).split('\0')
    paths=[p for p in names if p in ('index.html','style.css','sw.js') or
           (p.startswith('src/') and p.endswith(('.js','.mjs','.css')))]
    require('sw.js' in paths and 'src/table-ui/table.css' in paths,'Asset inventory incomplete')
    hashes={}
    for p in paths:
        response=ctx.request.get(urljoin(url,p),timeout=30000)
        require(response.status==200 and urlsplit(response.url).netloc==urlsplit(url).netloc,
                'Asset HTTP/origin mismatch: '+p)
        received=hashlib.sha256(response.body()).hexdigest()
        expected=hashlib.sha256((root/p).read_bytes()).hexdigest()
        require(received==expected,'Asset bytes differ: '+p)
        hashes[p]=received
    return hashes

def settlement(page):
    s=page.locator('.table-round-summary').inner_text()
    kind=re.search(r'結果：\s*(win|exhaustive-draw)(?=\s|$)',s)
    scores=re.search(r'四家分數變化：([^\n]+)',s)
    winner=re.search(r'勝方：([^\n]+)',s)
    events=re.search(r'牌局事件數：(\d+)',s)
    require(kind and scores and winner and events,'Incomplete authoritative Rules result')
    ds=[int(re.search(r'([-+]?\d+)\s*$',x).group(1)) for x in scores.group(1).split(' / ')]
    require(len(ds)==4 and sum(ds)==0,'Non-conserving settlement')
    require((kind.group(1)=='win')==(winner.group(1).strip() not in ('流局／無','無','')),
            'Terminal winner mismatch')
    return {'outcome':'WIN' if kind.group(1)=='win' else 'DRAW','scoreDelta':ds,
            'winner':winner.group(1).strip(),'eventCount':int(events.group(1)),'summary':s}

def final_replay(page,expected,dest):
    page.locator('[data-table-nav="replay"]').click()
    page.wait_for_selector('.table-replay',timeout=45000)
    jump=page.locator('[data-replay-jump]')
    options=jump.locator('option').all_text_contents()
    count=len(options)
    require(count>=2,'Replay has no event boundaries')
    target='#'+str(expected['eventCount'])
    require(options[-1].strip()==target,'Final Replay boundary differs from Rules terminal event: '+repr(options[-5:]))
    jump.select_option(label=target)
    try:
        page.wait_for_function("""n=>{
          const root=document.querySelector('#full-table-root');
          return !!root?.querySelector('[role=alert]') ||
            root?.querySelector('.table-replay')?.innerText.includes('事件 '+n+' / '+n);
        }""",arg=expected['eventCount'],timeout=45000)
    except Exception as exc:
        (dest/'replay-terminal-diagnostic.json').write_text(json.dumps({
            'expectedEventCount':expected['eventCount'],'lastBoundaries':options[-5:],
            'rootText':page.locator('#full-table-root').inner_text()[-3000:],
        },ensure_ascii=False,indent=2),encoding='utf-8')
        raise AssertionError('Terminal Replay did not render; see replay-terminal-diagnostic.json') from exc
    alert=page.locator('#full-table-root [role=alert]')
    require(alert.count()==0,'Replay rejected terminal frame: '+(alert.first.inner_text() if alert.count() else ''))
    require(page.locator('.table-replay').inner_text().find('無合法選項')>=0,'Settled Replay has legal actions')
    page.screenshot(path=str(dest/'replay-final.png'),full_page=True)
    return count

def offline_roundtrip(ctx,page,url,result,shared,dest):
    shared['daily_roundtrip'](page,dest)
    page.goto(url,wait_until='networkidle',timeout=45000)
    page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=45000)
    page.close()
    ctx.set_offline(True)
    try:
        cold=ctx.new_page()
        cold.goto(url,wait_until='domcontentloaded',timeout=45000)
        cold.locator('[data-table-nav="play"]').click()
        cold.wait_for_selector('.table-round-summary',timeout=45000)
        require(settlement(cold)==result,'Offline settlement differs from online')
        cold.screenshot(path=str(dest/'offline-settlement.png'),full_page=True)
        final_replay(cold,result,dest)
        cold.locator('[data-table-nav="daily"]').click()
        cold.wait_for_function("""() => document.body.dataset.tableView==='daily' &&
          [...document.querySelectorAll('#full-table-root [role=status]')].some(n=>n.textContent.includes('日期 '))""",timeout=45000)
        cold.screenshot(path=str(dest/'offline-daily.png'),full_page=True)
        cold.close()
    finally:
        ctx.set_offline(False)

def run(args):
    root=Path(args.source_root).resolve()
    script=root/'tests/browser/full-table-ui-r3-gates.py'
    sys.path.insert(0,str(script.parent))
    shared=runpy.run_path(str(script),run_name='r73_shared')
    dest=Path(args.screenshots).resolve();dest.mkdir(parents=True,exist_ok=True)
    os.environ['PHASE3_REQUIRE_SINGLE_WINNER']='1'
    os.environ['PHASE3_R71_CLAIMS']='1'
    public=bool(args.url)
    if public:
        require(urlsplit(args.url).scheme=='https','Real HTTPS required')
        require(args.deployment_sha,'Exact deployment SHA required')
        if args.seeds or args.plans:
            require(args.deployment_sha!='793bbb1caeef79b94e0bb29bf2ea66b3f7c43f4d',
                    'R7.2 deployed UI has no seed field; select a new approved SHA')
    report={'gate':'r73-exact-origin','release':False,'mode':'public-https' if public else 'local-seeded',
      'testedSourceSHA':subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip(),
      'harnessSourceSHA':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
      'deploymentSourceSHA':args.deployment_sha if public else None,'matches':[],'assetSHA256':{},
      'physicalDevice':'NOT_RUN','errors':[]}
    levels=['Beginner','Intermediate','Advanced']
    require(not (args.seeds and args.plans),'Choose seeds or exact plans, not both')
    scripted=json.loads(Path(args.plans).read_text(encoding='utf-8')) if args.plans else None
    if scripted:
        require(scripted['sourceSHA']==report['testedSourceSHA'],'Discovery plan source mismatch')
    seeds=args.seeds.split(',') if args.seeds else []
    plans=[(p['difficulty'],p['seed'],p) for p in scripted['selected']] if scripted else ([(args.difficulty,s,None) for s in seeds] if seeds else [(levels[i%3],None,None) for i in range(args.max_matches)])
    seeded=bool(seeds or scripted)
    require(len(plans)>=1,'No match plan')
    def save():
        report['outcomes']=sorted({a['outcome'] for a in report['matches']})
        report['difficulties']=sorted({a['difficulty'] for a in report['matches']})
        report['observedHumanDeclarations']=sorted({h.split(' · ')[0] for a in report['matches'] for h in a['humanActions']})
        report['missingOutcomeStatus']={k:'PASS' if k in report['outcomes'] else 'NOT_OBSERVED' for k in ('WIN','DRAW')}
        (dest/'r73-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    save()
    cm=nullcontext((args.url,None)) if public else shared['served_site']()
    with cm as (base,_):
        url=base+('?' if '?' not in base else '&')+'qa=seeded' if seeded else base
        report['origin']=url
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
            for idx,(difficulty,seed,plan) in enumerate(plans):
                match=dest/('%02d-%s-%s'%(idx+1,difficulty,seed or 'random'))
                match.mkdir(exist_ok=True)
                os.environ['PHASE3_BOT_DIFFICULTY']=difficulty
                if seed: os.environ['PHASE3_FIXED_SEED']=seed
                else: os.environ.pop('PHASE3_FIXED_SEED',None)
                if plan: os.environ['PHASE3_ACTION_PLAN']=json.dumps(plan['actions'])
                else: os.environ.pop('PHASE3_ACTION_PLAN',None)
                ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,
                                        device_scale_factor=2,service_workers='allow')
                page=ctx.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                ctx.tracing.start(screenshots=True,snapshots=True,sources=True)
                try:
                    if public and idx==0:
                        report['assetSHA256']=exact_assets(ctx,root,url,args.deployment_sha);save()
                    response=page.goto(url,wait_until='networkidle',timeout=60000)
                    require(response and response.status==200,'Initial navigation failed')
                    if public: require(urlsplit(page.url).netloc==urlsplit(url).netloc and urlsplit(page.url).scheme=='https','Origin changed')
                    history=shared['full_round'](page,match)
                    page.locator('[data-table-nav="play"]').click()
                    result=settlement(page)
                    if plan:
                        for key in ('outcome','scoreDelta','eventCount'):
                            require(result[key]==plan[key],'Browser outcome differs from real deterministic discovery: '+key)
                    require(not errors,'Page errors: '+repr(errors))
                    entry={**result,'difficulty':difficulty,'seed':seed,'humanActions':history,
                           'pageErrors':errors,'replayFrameCount':final_replay(page,result,match),
                           'reload':'PASS','dailyOffline':'NOT_RUN',
                           'exactPlanVerified':bool(plan),
                           'humanActionKinds':sorted(set(a['kind'] for a in plan['actions'])) if plan else []}
                    report['matches'].append(entry);save()
                    if idx==0:
                        offline_roundtrip(ctx,page,url,result,shared,match)
                        entry['dailyOffline']='PASS';save()
                    require(not errors,'Page errors during Replay or Daily: '+repr(errors))
                    print('R73_MATCH '+json.dumps(entry,ensure_ascii=False),flush=True)
                except Exception as exc:
                    report['errors'].append({'difficulty':difficulty,'seed':seed,'error':str(exc)})
                    save()
                    try: page.screenshot(path=str(match/'failure.png'),full_page=True)
                    except Exception: pass
                    raise
                finally:
                    ctx.tracing.stop(path=str(match/'trace.zip'));ctx.close()
                if public and not seeded and len(report['difficulties'])==3 and len(report['outcomes'])==2: break
            browser.close()
    save()
    print('R73_ACCEPTANCE '+json.dumps(report,ensure_ascii=False),flush=True)
    if public and not seeded: require(set(report['difficulties'])==set(levels),'Not all difficulties finished')
    require(len(report['matches'])>=1 and not report['errors'],'Incomplete real games')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-root',default='.')
    parser.add_argument('--url')
    parser.add_argument('--deployment-sha')
    parser.add_argument('--screenshots',required=True)
    parser.add_argument('--max-matches',type=int,default=6)
    parser.add_argument('--difficulty',choices=['Beginner','Intermediate','Advanced'],default='Beginner')
    parser.add_argument('--seeds')
    parser.add_argument('--plans',help='Exact-source discovery JSON; actual UI must independently match every action')
    run(parser.parse_args())
