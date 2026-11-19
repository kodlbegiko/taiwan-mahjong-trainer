"""REAL composed Academy E2E. NO fixture page or injected fake façade.
Uses actual src/integration/master-academy-facade.js -> Learning/Adaptive.
Chrome emulation is not physical iPhone/Android or VoiceOver/TalkBack.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

V3 = 'tw-mahjong-trainer:archive:v3'
V1 = 'tw-mahjong-trainer:session:v1'
SIDECAR = 'tw-mahjong-master-academy:state:v1'
OLD_UI = 'tw-mahjong-master-academy:ui-links:v1'

def check(condition, message):
    if not condition:
        raise AssertionError(message)

def live_ready(page):
    page.locator('#academy-navigation [data-academy-nav="lessons"]').click()
    page.wait_for_function(
        "() => document.querySelectorAll('[data-live-action=\"select-lesson\"]').length === 20",
        timeout=45000,
    )
    check(page.locator('.academy-level').count() == 5, 'not 5 true Academy levels')
    check('正式來源載入失敗' not in page.locator('#academy-root').inner_text(), 'failed to mount public facade')

def take(page,root,name):
    page.screenshot(path=str(root/name),full_page=True)

def complete_real_lesson_question(page,root,label):
    live_ready(page)
    page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-01"]').click()
    page.locator('[data-live-action="begin-lesson"]').click()
    player=page.locator('#academy-question')
    check(player.is_visible(), 'real QuestionPublic not rendered')
    check(player.get_attribute('data-lesson-id') == 'academy-l1-01', 'incorrect official lesson')
    check(page.locator('.academy-live-hand .tile-face-image').count() == 17,'17 authentic SVG tile faces missing')
    check(page.locator('.academy-choice-grid .tile-face-image').count() == 17,'17 legal tile buttons missing')
    q_before=player.inner_text()
    check('answerKey' not in q_before and 'sourceSnapshot' not in q_before, 'private answer projected to UI')
    take(page,root,f'{label}-answering.png')
    page.locator('[data-live-action="choose"]').first.click()
    check(page.locator('.academy-choice[aria-pressed="true"]').count() >= 1, 'answer click not selected')
    page.locator('[data-live-action="submit"]').click()
    page.locator('#academy-grade').wait_for(timeout=45000)
    check(page.locator('.academy-success').is_visible(),
          'official v3 + provenance + ability/review were not all durably confirmed: ' +
          page.locator('#academy-root').inner_text()[-1200:])
    take(page,root,f'{label}-graded.png')
    result=page.evaluate("""() => ({
      v1: localStorage.getItem('tw-mahjong-trainer:session:v1'),
      v3raw: localStorage.getItem('tw-mahjong-trainer:archive:v3'),
      adaptiveRaw: localStorage.getItem('tw-mahjong-master-academy:state:v1'),
      oldUi: localStorage.getItem('tw-mahjong-master-academy:ui-links:v1')
    })""")
    check(result['oldUi'] is None,'production incorrectly wrote obsolete UI progress key')
    check(result['v3raw'] and result['adaptiveRaw'],'missing durable archives')
    v3=json.loads(result['v3raw'])
    adaptive=json.loads(result['adaptiveRaw'])
    check(len(v3['records'])==1 and v3['records'][0]['schemaVersion']==3,'canonical v3 changed or missing')
    check(len(adaptive['provenanceLinks'])==1,'no official sidecar provenance')
    check(len(adaptive['pendingProvenance'])==0,'unfinished write-ahead provenance')
    link=adaptive['provenanceLinks'][0]
    check(link['academyQuestionRef']['questionId']=='academy-q-001','incorrect Academy question')
    check(link['underlyingExerciseId']==v3['records'][0]['exerciseId'],'wrong Exercise ID link')
    check(adaptive['abilityProfile'] is not None,'ability profile missing')
    check(adaptive['reviewPlan'] is not None,'review plan missing')
    check(any(i['questionId']=='academy-q-001' for i in adaptive['reviewPlan']['items']),
          'ReviewPlan does not retain true Academy question ID')
    page.reload(wait_until='networkidle')
    live_ready(page)
    page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-01"]').click()
    check('進度 1/' in page.locator('#academy-root').inner_text(),'lesson completion not reconstructed from provenance')
    now=page.evaluate("""async () => {
      const m=await import('./src/integration/master-academy-facade.js');
      const f=m.createMasterAcademyFacade(localStorage);
      const time=new Date(Date.now()+40*86400000).toISOString();
      const dash=f.getDashboard({asOf:time});
      const item=dash.reviewPlan.items.find(i=>i.questionId==='academy-q-001');
      const resolved=f.resolveReviewQuestion(item);
      return {resolved,links:f.getProvenanceLinks(),profile:dash.profile,reviewCount:dash.reviewPlan.items.length};
    }""")
    check(now['resolved']['available'] is True,'original official review question cannot be replayed')
    check(now['resolved']['lesson']['lessonId']=='academy-l1-01','replay failed to return the original lesson')
    check(now['resolved']['question']['questionId']=='academy-q-001','review returned a different question')
    check(len(now['links'])==1,'reload lost provenance')
    check(len({r['kind']+':'+r['id'] for skill in now['profile']['skills'] for r in skill['evidenceRefs']})==1,'public ability evidence is not unique')
    check(page.evaluate("""() => localStorage.getItem('tw-mahjong-trainer:archive:v3')""")==result['v3raw'],
          'rebuild rewrote the original v3 bytes')
    check(page.evaluate("""() => localStorage.getItem('tw-mahjong-trainer:session:v1')""")==result['v1'],
          'rebuild rewrote v1 bytes')
    take(page,root,f'{label}-reload.png')
    return result

def run(out):
    out.mkdir(parents=True,exist_ok=True)
    with served_site() as (base,_):
      with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        results={}
        for label,width,height,mobile in [('mobile-390',390,844,True),('desktop-1440',1440,900,False)]:
          ctx=browser.new_context(viewport={'width':width,'height':height},
                                  device_scale_factor=3 if mobile else 1,
                                  is_mobile=mobile,has_touch=mobile,
                                  service_workers='allow')
          page=ctx.new_page()
          page.goto(base,wait_until='networkidle')
          original=json.dumps([{'grade':'perfect','seconds':4,'date':'2026-11-01T00:00:00.000Z','difficulty':'beginner'}])
          page.evaluate("(s) => localStorage.setItem('tw-mahjong-trainer:session:v1',s)",original)
          data=complete_real_lesson_question(page,out,label)
          check(data['v1']==original,'legacy v1 was overwritten')
          # No fake UI link may serve as a second source of progress.
          check(page.evaluate("""() => localStorage.getItem('tw-mahjong-master-academy:ui-links:v1')""") is None,
                'UI link key became a competing progress source')
          if not mobile:
            page.evaluate("""async () => {
              await navigator.serviceWorker.ready;
              if(!navigator.serviceWorker.controller) await new Promise(r => setTimeout(r,300));
            }""")
            page.wait_for_function("() => Boolean(navigator.serviceWorker.controller)",timeout=15000)
            ctx.set_offline(True)
            nextpage=ctx.new_page()
            nextpage.goto(base,wait_until='domcontentloaded',timeout=30000)
            live_ready(nextpage)
            nextpage.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-01"]').click()
            check('進度 1/' in nextpage.locator('#academy-root').inner_text(),
                  'offline new tab did not read verified Academy sidecar')
            check(nextpage.locator('.academy-lesson-pick').count()==20,'offline LessonPublic import missing')
            take(nextpage,out,'desktop-offline-new-tab.png')
            ctx.set_offline(False)
          results[label]={'official_20_lessons':True,'formal_v3':True,'adaptive_provenance':True,
                          'curriculum_reload':True,'review_replay':True,'legacy_v1_v3_unchanged':True}
          ctx.close()
        # Fail-closed quota case on a fresh browser profile.
        ctx=browser.new_context(viewport={'width':390,'height':844})
        page=ctx.new_page()
        page.goto(base,wait_until='networkidle')
        live_ready(page)
        page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-01"]').click()
        page.locator('[data-live-action="begin-lesson"]').click()
        page.evaluate("""() => {
          const orig=Storage.prototype.setItem;
          Storage.prototype.setItem=function(k,v){
            if(k==='tw-mahjong-master-academy:state:v1')throw new DOMException('Quota','QuotaExceededError');
            return orig.call(this,k,v);
          };
        }""")
        page.locator('[data-live-action="choose"]').first.click()
        page.locator('[data-live-action="submit"]').click()
        check(not page.locator('.academy-success').is_visible(),'quota failure falsely marked completed')
        check(page.evaluate("""() => JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')||'{"records":[]}').records.length""")==0,
              'write-ahead quota failure wrote an orphan formal v3 record')
        take(page,out,'mobile-390-quota-fail-closed.png')
        results['quota']={'scored_as_durable':False,'legacy_record_written':False}
        ctx.close()
        browser.close()
        (out/'combined-academy-e2e.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        print('PASS REAL COMBINED ACADEMY '+json.dumps(results))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',default='academy-combined-evidence')
    args=parser.parse_args()
    run(Path(args.screenshots))
