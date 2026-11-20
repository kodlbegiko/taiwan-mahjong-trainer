"""REAL R3 browser E2E contract. Fail closed when latest Phase3 modules are absent.
NOT part of legacy sandbox CI. AI6 must run on one merged source SHA and attach evidence.
No fixtures or fabricated Bot decisions are permitted.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

MAX_HUMAN_DECISIONS = 320

def require(value, message):
    if not value:
        raise AssertionError(message)

def open_game(page):
    page.locator('[data-table-nav="play"]').click()
    page.wait_for_selector('#table-profile')
    profiles=page.locator('#table-profile option').all_text_contents()
    require(any('tw16-configurable-table' in p for p in profiles),
            'BLOCKED: latest R3 Rules/Bot/Replay not actually integrated; no full E2E claim')
    page.locator('#full-table-root [data-start-new]').click()
    page.wait_for_selector('.table-hand', timeout=25000)

def make_human_decision(page):
    # Only click currently issued UI LegalAction controls. Never fabricate IDs.
    if page.locator('.table-round-summary').count():
        return 'settled'
    cont=page.locator('[data-continue-bots]:enabled')
    if cont.count():
        cont.click()
        return 'continue-bots'
    options=page.locator('.table-action-buttons [data-submit-action]:enabled')
    if options.count():
        labels=options.all_text_contents()
        preference=['胡牌','補花','摸牌','放棄宣告','明槓','暗槓','加槓','碰','吃']
        chosen=next((i for word in preference for i,label in enumerate(labels) if word in label),0)
        selected=options.nth(chosen)
        label=labels[chosen]
        selected.click()
        return label
    tile=page.locator('.table-hand button[data-pick-action]:enabled')
    if tile.count():
        tile.first.click()
        confirm=page.locator('.table-actions [data-submit-action]:enabled')
        require(confirm.count()==1,'discard selection has no formal confirmation')
        confirm.click()
        return 'discard'
    return 'waiting'

def full_round(page, folder):
    page.on('dialog', lambda dialog: dialog.accept())
    open_game(page)
    require('EXPERIMENTAL' in page.locator('#full-table-root').inner_text(),
            'experimental warning missing')
    require(page.locator('.table-opponent .table-hand').count()==0,
            'opponent concealed leaked')
    page.screenshot(path=str(folder/'table-390-real-r3.png'),full_page=True)
    history=[]
    for step in range(MAX_HUMAN_DECISIONS):
        page.wait_for_timeout(100)
        if page.locator('.table-round-summary').count():
            break
        label=make_human_decision(page)
        history.append(label)
        # Debounce: subsequent actions need a fresh Rules revision.
        page.wait_for_timeout(80)
        require(page.locator('body').evaluate(
            '(el)=>document.documentElement.scrollWidth<=innerWidth+1'),
            'horizontal overflow during game')
        if '未完成' in page.locator('#full-table-root').inner_text() and (
                page.locator('[role="alert"]').count()):
            raise AssertionError('Controller/R3 rejected action: '+
                                 page.locator('[role="alert"]').last.inner_text())
    else:
        raise AssertionError('No real terminal outcome after 320 UI decision steps: '+str(history[-20:]))
    result=page.locator('.table-round-summary').inner_text()
    require('tw16-minimal-tai-v1' in result,'experimental scoring policy missing')
    require('四家分數變化' in result,'authoritative zero-sum result missing')
    require('牌局事件數' in result,'round event count missing')
    require(any('discard'==h for h in history),'no real human discard exercised')
    require(any('放棄宣告' in h for h in history),
            'no real human PASS exercised; use an additional seeded round')
    page.screenshot(path=str(folder/'table-390-real-settled.png'),full_page=True)
    page.reload(wait_until='networkidle')
    page.locator('[data-table-nav="play"]').click()
    require(page.locator('.table-round-summary').count()==1,'R3 persisted result not restored')
    page.locator('[data-table-nav="replay"]').click()
    page.wait_for_selector('.table-replay',timeout=20000)
    require('當時你的手牌' in page.locator('.table-replay').inner_text(),
            'Replay failed to produce historical own-hand view')
    require('大師失誤分數' not in page.locator('.table-replay').inner_text(),
            'fake skill grading shown')
    page.locator('[data-replay-next]').click()
    require(page.locator('.table-replay').count()==1,'Replay next failed')
    page.locator('[data-replay-jump]').select_option('0')
    page.wait_for_selector('.table-replay',timeout=20000)
    require('事件 1 /' in page.locator('.table-replay').inner_text(),
            'Replay jump to historical event failed')
    page.screenshot(path=str(folder/'table-390-real-replay.png'),full_page=True)
    return history

def daily_roundtrip(page):
    page.locator('[data-table-nav="daily"]').click()
    page.wait_for_selector('#table-heading')
    if page.locator('[data-daily-start]').count():
        page.locator('[data-daily-start]').click()
    else:
        page.locator('[data-daily-resume]').click()
    page.wait_for_timeout(800)
    error=page.locator('#full-table-root [role="alert"]')
    require(error.count()==0,'Daily Controller not initialized: '+(
        error.first.inner_text() if error.count() else ''))
    before=page.locator('#full-table-root').inner_text()
    require('日期 ' in before and ' 題' in before,'Daily official DTO missing')
    if page.locator('[data-daily-submit]').count():
        page.locator('[name="daily-answer"]').first.check()
        page.locator('[data-daily-submit]').click()
        page.wait_for_timeout(1000)
        text=page.locator('#full-table-root').inner_text()
        require('上一題正式評分' in text or '完成訓練' in text,
                'Daily canonical grading was not durably recorded')
    page.reload(wait_until='networkidle')
    page.locator('[data-table-nav="daily"]').click()
    page.wait_for_timeout(700)
    require('日期 ' in page.locator('#full-table-root').inner_text(),
            'Daily session was not resumed from Adaptive authority')

def run(folder):
    folder.mkdir(parents=True,exist_ok=True)
    with served_site() as (url,_):
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
            for width in (320,390,1440):
                ctx=browser.new_context(
                    viewport={'width':width,'height':844 if width!=1440 else 900},
                    is_mobile=width!=1440,has_touch=width!=1440,
                    device_scale_factor=3 if width!=1440 else 1,
                    service_workers='allow')
                page=ctx.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url,wait_until='networkidle')
                if width==390:
                    history=full_round(page,folder)
                    daily_roundtrip(page)
                    # One cold new tab after activation, with network disabled.
                    page.goto(url,wait_until='networkidle')
                    page.evaluate('() => navigator.serviceWorker.ready')
                    page.reload(wait_until='networkidle')
                    page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=20000)
                    ctx.set_offline(True)
                    offline=ctx.new_page()
                    offline.goto(url,wait_until='domcontentloaded')
                    offline.locator('[data-table-nav="play"]').click()
                    require(offline.locator('.table-round-summary').count()==1,
                            'offline real R3 result unavailable')
                    offline.locator('[data-table-nav="replay"]').click()
                    offline.wait_for_selector('.table-replay',timeout=20000)
                    svg=offline.evaluate("""async()=>{const x=await Promise.all(
                      Array.from({length:34},(_,i)=>fetch('./public/tiles/'+i+'.svg')));
                      return x.every(r=>r.ok)}""")
                    require(svg,'34 SVG not cached offline')
                    offline.screenshot(path=str(folder/'table-390-real-offline.png'),full_page=True)
                    ctx.set_offline(False)
                else:
                    open_game(page)
                    available=page.locator('.table-hand button[data-pick-action]:enabled')
                    if not available.count():
                        available=page.locator('.table-action-buttons button[data-submit-action]:enabled')
                    require(available.count()>0, 'no legal player control after R3 start')
                    first=available.first.bounding_box()
                    require(first and first['width']>=44,
                            str(width)+'px touch target below 44px')
                    require(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
                            str(width)+'px overflow')
                require(not errors,str(width)+'px JS errors: '+str(errors))
                ctx.close()
            browser.close()
    (folder/'real-r3-verification.txt').write_text(
        'R3 terminal round via real UI, Bots, Rules, settlement, Replay, Daily, offline, 34 SVG.\n'
        'Browser Chromium emulation only, NOT physical iPhone evidence.\n'
        'Human action histogram: '+str({x:history.count(x) for x in set(history)}),
        encoding='utf-8')

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument('--screenshots',default='tw16-r3-real-evidence')
    args=ap.parse_args()
    run(Path(args.screenshots))
