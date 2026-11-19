"""Independent Academy Chromium gates; captures 390px/1440px/offline evidence."""
from pathlib import Path
import argparse, json
from playwright.sync_api import sync_playwright
from _release_site import served_site

def require(value, reason):
    if not value: raise AssertionError(reason)

def run(output):
    output.mkdir(parents=True, exist_ok=True)
    with served_site() as (url, _):
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
            ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,
                                    is_mobile=True,has_touch=True,service_workers='allow')
            page=ctx.new_page()
            errors=[]
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(url,wait_until='networkidle')
            require(page.locator('#academy-navigation button').count()==6,'Academy navigation missing')
            require(page.locator('body').get_attribute('data-academy-page')=='today','Today not default')
            require(not page.locator('#practice').is_visible(),'old app overlaps Today')
            require(page.evaluate('document.body.scrollWidth <= innerWidth+1'),'390px overflow')
            page.screenshot(path=str(output/'academy-390-today.png'),full_page=True)
            page.locator('[data-action="launch"][data-mode="discard"]').first.click()
            require(page.locator('#hand button[data-tile]').count()==17,'canonical hand unavailable')
            require(page.locator('#hand .tile-face-image').count()==17,'SVG tile assets missing')
            page.locator('#hand button[data-tile]').first.click()
            require(page.locator('#answer').is_visible(),'canonical score not displayed')
            require(bool(page.locator('#explanation-summary').inner_text().strip()),'teaching missing')
            data=page.evaluate("JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'))")
            require(len(data['records'])==1,'v3 result not persisted')
            require(data['records'][0]['scoringVersion']=='efficiency-v2','non-canonical scorer')
            page.locator('[data-academy-nav="today"]').click()
            require('1 / 3' in page.locator('#academy-root').inner_text(),'Today progress stale')
            page.locator('[data-academy-nav="growth"]').click()
            require('完整 v3 作答' in page.locator('#academy-root').inner_text(),'growth source missing')
            page.locator('[data-academy-nav="lessons"]').click()
            require(page.locator('.academy-lesson-pick').count()==3,'lesson list missing')
            page.locator('.academy-lesson-pick').nth(1).click()
            require('聽牌與胡牌張辨識' in page.locator('.academy-lesson-detail').inner_text(),'lesson not selectable')
            page.locator('[data-academy-nav="strategy"]').click()
            require('Fixture-only' in page.locator('#academy-root').inner_text(),'fixture disclosure missing')
            require(page.locator('.academy-mini-hand .tile-face-image').count()==17,'PlayerView preview missing')
            require(page.locator('#academy-root [data-action="grade"]').count()==0,'unverified scoring enabled')
            page.locator('[data-academy-nav="simulation"]').click()
            require('未開放實戰模式' in page.locator('#academy-root').inner_text(),'fake bots enabled')
            page.reload(wait_until='networkidle')
            page.locator('[data-academy-nav="growth"]').click()
            require('1' in page.locator('.academy-metric').first.inner_text(),'storage recovery failed')
            page.screenshot(path=str(output/'academy-390-growth.png'),full_page=True)
            require(not errors,'page errors '+str(errors))
            # Seed historical score by calling the REAL canonical scorer and archive
            # serializer; no hard-coded answers or patched grading methods.
            page.evaluate("""async () => {
              const {createDecisionRecord}=await import('./src/training/records.js');
              const {exportTrainingJSON}=await import('./src/storage/archive.js');
              const current=JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'));
              const ex=current.exercises[0];
              const record=createDecisionRecord(ex,ex.answer.optimalTiles[0],{
                durationMs:1000,timestamp:'2026-11-01T10:00:00.000Z',attemptId:'replay-seeded-canonical'});
              current.records=[record];
              localStorage.setItem('tw-mahjong-trainer:archive:v3',exportTrainingJSON(current));
            }""")
            page.reload(wait_until='networkidle')
            require(page.locator('[data-action="review"]').count()>0,'due review missing')
            page.locator('[data-action="review"]').first.click()
            require(page.locator('#hand button[data-tile]').count()==17,'old exercise not replayed')
            page.locator('#hand button[data-tile]').first.click()
            data=page.evaluate("JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'))")
            require(len(data['records'])==2,'replayed answer not recorded')
            require(data['records'][0]['exerciseId']==data['records'][1]['exerciseId'],'replay exercise changed')
            # New-tab offline cold navigation under GitHub Pages /repo/ prefix.
            page.goto(url,wait_until='networkidle')
            page.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
            page.reload(wait_until='networkidle')
            page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=20000)
            ctx.set_offline(True)
            offline=ctx.new_page()
            offline.goto(url,wait_until='domcontentloaded')
            require(offline.locator('#academy-navigation button').count()==6,'offline Academy failed')
            offline.locator('[data-academy-nav="training"]').click()
            require(offline.locator('#hand button[data-tile]').count()==17,'offline v3 training failed')
            require(offline.locator('#hand .tile-face-image').count()==17,'offline SVG failed')
            offline.screenshot(path=str(output/'academy-390-offline.png'),full_page=True)
            ctx.set_offline(False)
            deskctx=browser.new_context(viewport={'width':1440,'height':900})
            desk=deskctx.new_page()
            desk.goto(url,wait_until='networkidle')
            desk.screenshot(path=str(output/'academy-1440-today.png'),full_page=True)
            desk.locator('[data-academy-nav="training"]').focus()
            require(desk.locator('[data-academy-nav="training"]').evaluate('(x)=>document.activeElement===x'),'keyboard focus lost')
            require(desk.locator('[data-academy-nav="training"]').get_attribute('aria-current')=='false','ARIA current incorrect')
            desk.locator('[data-academy-nav="training"]').press('Enter')
            require(desk.locator('#practice').is_visible(),'keyboard nav failed')
            for width in [320,375,430,768,1440]:
                desk.set_viewport_size({'width':width,'height':850})
                require(desk.evaluate('document.body.scrollWidth <= innerWidth+1'),str(width)+'px overflow')
            reduce=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
            reduced=reduce.new_page()
            reduced.goto(url)
            require(reduced.locator('#academy-navigation button').count()==6,'reduced-motion app missing')
            reduce.close(); deskctx.close(); ctx.close(); browser.close()
            print(json.dumps({'v3_scoring':'PASS','historical_replay':'PASS','fixture_only':'PASS',
                'courses':'PASS','390px':'PASS','1440px':'PASS','offline_PWA':'PASS',
                'keyboard_ARIA':'PASS','reduced_motion':'PASS',
                'evidence':[x.name for x in output.glob('*.png')]},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',type=Path,required=True)
    run(parser.parse_args().screenshots)
