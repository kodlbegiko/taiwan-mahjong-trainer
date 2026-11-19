"""Fixture-only 12-step Academy learning loop: does not claim AI6 composed HEAD."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
from _release_site import served_site

def check(ok, message):
    if not ok:raise AssertionError(message)

def exercise(page):
    page.locator('#go-lessons').click()
    check(page.locator('.academy-lesson-pick').count()==20,'missing five-level/20 lesson fixture')
    check(page.locator('.academy-level').count()==5,'missing 5 levels')
    page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-01"]').click()
    page.locator('[data-live-action="begin-lesson"]').click()
    check(page.locator('#academy-question').is_visible(),'no QuestionPublic player')
    check(page.locator('.academy-live-hand .tile-face-image').count()==17,'not 17 original SVGs')
    check(page.locator('.academy-choice-grid .tile-face-image').count()==17,'not 17 discard options')
    check('answerKey' not in page.locator('#academy-root').inner_text(),'answer key revealed before grading')
    page.locator('[data-live-action="choose"]').first.click()
    check(page.locator('[aria-pressed="true"][data-live-action="choose"]').count()>=1,'choice not visibly selected')
    page.locator('[data-live-action="submit"]').click()
    check(page.locator('#academy-grade').is_visible(),'no grading feedback')
    check(page.locator('.academy-success').is_visible(),'durable source/profile success missing')
    saved=page.evaluate("""() => ({
       archive:JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')),
       links:JSON.parse(localStorage.getItem('tw-mahjong-master-academy:ui-links:v1'))
    })""")
    check(len(saved['archive']['records'])==1,'canonical v3 record not saved')
    check(saved['archive']['records'][0]['schemaVersion']==3,'legacy schema modified')
    check(saved['links']['links'][0]['questionId']=='ui-fixture-q-1','lesson link missing')
    return saved

def run(out):
    out.mkdir(parents=True,exist_ok=True)
    with served_site() as (url,_):
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
            page=context.new_page()
            page.goto(url+'tests/browser/academy-loop-fixture.html',wait_until='networkidle')
            check('Fixture-only' in page.locator('body').inner_text(),'test provider must self-disclose fixture')
            check(page.locator('#academy-root').is_visible(),'Today not launched')
            page.screenshot(path=str(out/'academy-fixture-390-today.png'),full_page=True)
            saved=exercise(page)
            page.screenshot(path=str(out/'academy-fixture-390-grade.png'),full_page=True)
            page.locator('#go-growth').click()
            check('1' in page.locator('.academy-data-table').inner_text(),'ability evidence not recalculated')
            check('未校準' in page.locator('#academy-root').inner_text(),'calibration label missing')
            check('ReviewPlan' in page.locator('#academy-root').inner_text(),'review not updated')
            page.screenshot(path=str(out/'academy-fixture-390-growth.png'),full_page=True)
            page.reload(wait_until='networkidle')
            page.locator('#go-lessons').click()
            check('進度 1/1' in page.locator('#academy-root').inner_text(),'lesson progress did not restore from durable record')
            check(page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-02"]').is_visible(),'next lesson unavailable')
            page.locator('#toggle-quota').click()
            page.locator('[data-live-action="select-lesson"][data-lesson="academy-l1-02"]').click()
            page.locator('[data-live-action="begin-lesson"]').click()
            page.locator('[data-live-action="choose"]').first.click()
            page.locator('[data-live-action="submit"]').click()
            check('未證實永久保存' in page.locator('#academy-root').inner_text(),'quota-denied incorrectly shown as durable')
            check(not page.locator('.academy-success').is_visible(),'quota-denied claimed success')
            archive=page.evaluate("JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3'))")
            check(len(archive['records'])==1,'failed write corrupted previous archive')
            page.screenshot(path=str(out/'academy-fixture-390-storage-failure.png'),full_page=True)
            for width in [320,375,390,430,768,1440]:
                page.set_viewport_size({'width':width,'height':844})
                check(page.evaluate('document.body.scrollWidth <= window.innerWidth + 1'),str(width)+'px horizontal overflow')
            desk=browser.new_context(viewport={'width':1440,'height':900})
            desktop=desk.new_page()
            desktop.goto(url+'tests/browser/academy-loop-fixture.html')
            desktop.locator('#go-lessons').focus()
            desktop.locator('#go-lessons').press('Enter')
            check(desktop.locator('.academy-level').count()==5,'keyboard nav failed')
            desktop.screenshot(path=str(out/'academy-fixture-1440-lessons.png'),full_page=True)
            desk.close();context.close();browser.close()
            print(json.dumps({'kind':'FIXTURE_ONLY','today':'PASS','lessons':'PASS',
              'question_public':'PASS','canonical_v3_fixture_scorer':'PASS',
              'durable_link':'PASS','profile_view':'PASS','review_plan':'PASS',
              'reload':'PASS','storage_failure':'PASS','responsive':'PASS',
              'keyboard':'PASS','real_combined_AI6':'NOT_RUN'},ensure_ascii=False))
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',type=Path,required=True)
    run(parser.parse_args().screenshots)
