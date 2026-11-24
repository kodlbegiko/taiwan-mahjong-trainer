"""Independent R7 public HTTPS Chromium E2E. No GameState injections or fixtures.

Completes real human + three Bot games through visible controls on a public
Vercel deployment, checks settlement and Replay, and saves traces/screenshots.
This is separate from the exact-checkout localhost/browser acceptance.
"""
import argparse
import json
import os
import re
import runpy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = runpy.run_path(str(SCRIPT_DIR / 'full-table-ui-r3-gates.py'), run_name='r7_public_shared')
full_round = BASE['full_round']
require = BASE['require']

def parse_summary(text):
    outcome = re.search(r'結果：\s*(win|exhaustive-draw)(?=\s|$)', text, re.IGNORECASE | re.MULTILINE)
    require(outcome is not None, 'No authoritative WIN/DRAW outcome in UI settlement')
    scores = re.search(r'四家分數變化：([^\n]+)', text)
    require(scores is not None, 'Missing scoreDelta in authoritative settlement')
    vals = []
    for segment in scores.group(1).split(' / '):
        m = re.search(r'([-+]?\d+)\s*$', segment)
        require(m is not None, 'Invalid public scoreDelta segment: ' + segment)
        vals.append(int(m.group(1)))
    require(len(vals) == 4, 'Expected exact four-seat settlement')
    require(sum(vals) == 0, 'Non-zero-sum settlement: ' + str(vals))
    winner = re.search(r'勝方：([^\n]+)', text)
    require(winner is not None, 'Missing public winner status')
    kind='DRAW' if outcome.group(1).lower()=='exhaustive-draw' else 'WIN'
    if kind == 'WIN':
        require(winner.group(1).strip() not in ('流局／無', '無', ''),
                'WIN must include an actual winner')
    else:
        require(winner.group(1).strip() in ('流局／無', '無'),
                'DRAW must not claim a winner')
    return {'outcome':kind,'scoreDelta':vals,'winner':winner.group(1).strip()}

def run(url, folder, max_matches, source_sha, deployment_sha):
    parts=urlsplit(url)
    require(parts.scheme == 'https' and parts.hostname and not parts.username,
            'Public browser gate must use a real HTTPS origin')
    require(max_matches >= 1 and max_matches <= 12, 'Match count must stay within 1..12')
    folder.mkdir(parents=True,exist_ok=True)
    os.environ['PHASE3_REQUIRE_SINGLE_WINNER']='1'
    outcomes=set()
    attempts=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        for idx in range(max_matches):
            dest=folder / ('match-%02d' % (idx + 1))
            dest.mkdir(parents=True,exist_ok=True)
            ctx=browser.new_context(viewport={'width':390,'height':844},
                                    is_mobile=True,has_touch=True,device_scale_factor=3,
                                    service_workers='allow')
            page=ctx.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            ctx.tracing.start(screenshots=True,snapshots=True,sources=True)
            try:
                response=page.goto(url,wait_until='networkidle',timeout=45000)
                require(response and response.status==200,
                        'Live public origin did not return HTTP 200')
                require(page.url.startswith('https://'),
                        'Public navigation downgraded to non-HTTPS')
                history=full_round(page,dest)
                page.locator('[data-table-nav="play"]').click()
                summary=page.locator('.table-round-summary').inner_text()
                result=parse_summary(summary)
                require(not errors,'JavaScript page errors: '+repr(errors))
                result.update({'uiActions':len(history),
                               'humanActionHistogram':{h:history.count(h) for h in set(history)},
                               'pageErrors':errors,'http':response.status})
                attempts.append(result)
                outcomes.add(result['outcome'])
            finally:
                ctx.tracing.stop(path=str(dest/'public-https.trace.zip'))
                ctx.close()
            # Seek both naturally occurring terminal types with real UI;
            # never manipulate app RNG, GameState, rules, or Bot decisions.
            if len(outcomes)==2:
                break
        browser.close()
    require(attempts and all(x['outcome'] in ('WIN','DRAW') for x in attempts),
            'No complete authoritative public HTTPS UI match')
    report={
      'gate':'r7-public-https-real-ui','release':False,
      'testedSourceSHA':source_sha,'deploymentSourceSHA':deployment_sha,
      'publicOrigin':url,'testedAtUTC':datetime.now(timezone.utc).isoformat(),
      'browser':'GitHub Actions Ubuntu / Google Chrome via Playwright Python',
      'execution':'actual DOM clicks only; no injected GameState or private Bot state',
      'matches':attempts,'winObserved':'WIN' in outcomes,
      'drawObserved':'DRAW' in outcomes,
      'missingOutcomeStatus':{kind:'PASS' if kind in outcomes else 'NOT_OBSERVED'
                              for kind in ('WIN','DRAW')},
      'physicalDevice':'NOT_RUN',
      'proof':['per-match screenshots','per-match Playwright trace ZIP',
               'Rules UI scoreDelta zero sum','Replay after actual settlement']
    }
    (folder/'r7-public-acceptance.json').write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('R7_PUBLIC_HTTPS_ACCEPTANCE '+json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('--url',required=True)
    cli.add_argument('--screenshots',default='r7-public-https-evidence')
    cli.add_argument('--max-matches',type=int,default=4)
    cli.add_argument('--source-sha',default=os.getenv('GITHUB_SHA','UNKNOWN'))
    cli.add_argument('--deployment-sha',default=os.getenv('DEPLOYMENT_SOURCE_SHA','UNKNOWN'))
    opts=cli.parse_args()
    run(opts.url,Path(opts.screenshots),opts.max_matches,opts.source_sha,opts.deployment_sha)
