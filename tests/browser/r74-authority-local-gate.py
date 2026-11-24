"""Local-only authority UI acceptance: normal fresh start and verified archived-prefix continuation.
The fixture restores an actual Rules state at action boundary 29, not a fake score or deck mutation.
This is not a full random authority match, nor public HTTPS/physical-device certification.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

ROOT=Path(__file__).resolve().parents[2]
FIXTURE=ROOT/'tests/replay/fixtures/r73-authoritative-robbery-archive.json'
LEGACY='tw-mahjong-master-academy:full-table:r3:v1'
AUTHORITY='tw-mahjong-master-academy:full-table:authority-experiment:v1'
PROFILE='tw16-authoritative-scoring@experimental-v1'

def require(ok,msg):
    if not ok: raise AssertionError(msg)

def open_table(page,url):
    page.goto(url,wait_until='networkidle')
    page.locator('[data-table-nav="play"]').click()
    page.locator('#full-table-root:not([hidden])').wait_for()

def terminal(page,dest,label,expected):
    summary=page.locator('[data-authoritative-settlement]')
    summary.wait_for(timeout=45000)
    require(page.locator('[data-authority-unavailable]').count()==0,'Authority DTO refused')
    text=summary.inner_text()
    require('搶槓胡' in text and 'rob-added-kong' in text and '實驗台數：7' in text,'Incorrect settlement rendering')
    require('四家分數變化：' in text and '平台變動：0' in text,'Incomplete accounting')
    require('-7' in text and ' 7' in text,'Missing actual expected transfer')
    require(page.locator('[data-pick-action],[data-submit-action]').count()==0,'Terminal legal actions exposed')
    actual=page.evaluate("""key=>{
      const checkpoint=JSON.parse(localStorage.getItem(key));
      const r=checkpoint.gameState.extensions.tw16.result;
      return {delta:r.delta,settlement:r.settlement,seq:checkpoint.gameState.revision};
    }""",AUTHORITY)
    require(actual['delta']==expected['delta'] and actual['settlement']==expected['settlement'] and actual['seq']==32,'Actual persisted result differs from verified fixture')
    page.screenshot(path=str(dest/(label+'-settlement.png')),full_page=True)
    page.locator('[data-table-nav="replay"]').click()
    page.locator('.table-replay').wait_for(timeout=45000)
    jump=page.locator('[data-replay-jump]')
    require(jump.locator('option').last.inner_text().strip()=='#32','Wrong terminal frame')
    jump.select_option(label='#32')
    page.locator('.table-replay [data-authoritative-settlement]').wait_for(timeout=45000)
    require('事件 32 / 32' in page.locator('.table-replay').inner_text(),'Wrong terminal event')
    require('無合法選項' in page.locator('.table-replay').inner_text(),'Terminal options not empty')
    require(page.locator('[data-authority-unavailable]').count()==0,'Replay authority DTO refused')
    require(page.locator('.table-replay [data-authoritative-settlement]').inner_text()==text,'Replay settlement differs from live')
    page.screenshot(path=str(dest/(label+'-replay.png')),full_page=True)
    return text

def run(dest):
    fixture=json.loads(FIXTURE.read_text())
    expected={'delta':fixture['expectedScores'],'settlement':fixture['archive']['events'][-1]['turnEvent']['payload']['settlement']}
    cases=[]
    with served_site(fresh_sw=True) as (url,tree),sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(service_workers='allow')
        try:
            page=ctx.new_page()
            open_table(page,url)
            require(PROFILE not in page.locator('#table-profile option').evaluate_all('els=>els.map(e=>e.value)'),'Default table exposed authority')
            page.locator('[data-start-new]').click()
            page.locator('.table-version').wait_for()
            legacy=page.evaluate('key=>localStorage.getItem(key)',LEGACY)
            require(bool(legacy),'Legacy game not saved')
            open_table(page,url+'?qa=authority')
            require(page.locator('#table-profile option').evaluate_all('els=>els.map(e=>e.value)')==[PROFILE],'Explicit opt-in profile mismatch')
            page.locator('#table-fixed-seed').fill('r74-authority-browser')
            page.locator('[data-start-new]').click()
            page.locator('.table-version').wait_for()
            require(page.evaluate('key=>localStorage.getItem(key)',LEGACY)==legacy,'Authority start modified legacy')
            raw=page.evaluate('key=>localStorage.getItem(key)',AUTHORITY)
            require(raw and json.loads(raw)['gameState']['ruleRef']['profileId']=='tw16-authoritative-scoring','Real fresh authority start missing')
            cases.append({'case':'fresh-opt-in-start-and-legacy-isolation','status':'PASS'})
            page.screenshot(path=str(dest/'fresh-authority.png'),full_page=True)
            # A separately verified archival action boundary; never replace
            # a score, inject an arbitrary LegalAction or bypass a confirmation.
            page.evaluate("""async ({archive,key})=>{
              const R=await import('./src/rules/index.js');
              const S=await import('./src/scoring/index.js');
              const I=await import('./src/replay/internal.js');
              const opts={settlementRuntime:R.createSettlementRuntime(S)};
              const state=I.replayStateAt(archive,29,opts);
              R.validateGameState(state,opts);
              const v=R.createPlayerView(state,0,state.revision,opts);
              if(v.legalActions.length!==1||v.legalActions[0].kind!=='pass')throw Error('Invalid fixture action boundary');
              localStorage.setItem(key,JSON.stringify({version:1,gameState:state,botCheckpoint:{paused:false},botDifficulty:'Intermediate'}));
            }""",{'archive':fixture['archive'],'key':AUTHORITY})
            open_table(page,url+'?qa=authority')
            page.locator('[data-robbery-window]').wait_for()
            action=page.locator('[data-submit-action]')
            require(action.count()==1 and ':pass:' in action.get_attribute('data-submit-action'),'Wrong Rules-issued pass')
            action.click()
            page.locator('[data-confirm-action]').click()
            online=terminal(page,dest,'online',expected)
            settled=page.evaluate('key=>localStorage.getItem(key)',AUTHORITY)
            require(page.evaluate('key=>localStorage.getItem(key)',LEGACY)==legacy,'Authority settlement changed legacy')
            cases.append({'case':'verified-prefix-real-pass-authority-settlement-replay','status':'PASS'})
            page.evaluate('() => navigator.serviceWorker.ready')
            page.close()
            ctx.set_offline(True)
            cold=ctx.new_page()
            open_table(cold,url+'?qa=authority')
            require(terminal(cold,dest,'cold-offline',expected)==online,'Offline settlement mismatch')
            require(cold.evaluate('key=>localStorage.getItem(key)',AUTHORITY)==settled,'Cold offline rewrote checkpoint')
            require(cold.evaluate('key=>localStorage.getItem(key)',LEGACY)==legacy,'Cold offline changed legacy')
            cases.append({'case':'cold-offline-authority-checkpoint-replay-parity','status':'PASS'})
            cold.close()
        finally:
            ctx.close();browser.close()
    return cases

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--evidence',type=Path,required=True)
    a=p.parse_args()
    a.evidence.mkdir(parents=True,exist_ok=True)
    report={'release':False,'fixtureContinuation':True,'fullRandomMatch':False,'physicalDevice':'NOT_RUN'}
    try:
        report['cases']=run(a.evidence);report['status']='PASS'
    except Exception as e:
        report['status']='FAIL';report['error']=str(e);raise
    finally:
        (a.evidence/'authority-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
