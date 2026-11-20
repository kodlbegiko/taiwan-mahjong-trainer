"""Phase 3 real-engine Table UI compatibility and responsive/offline gate.

The old sandbox-only assumption ('17 discard controls immediately after deal,
no Bot API, Replay permanently unavailable') is not a valid R3 contract.
Require the real R3 profile, process legal flower replacements, and exercise
the real Rules/Bot application without disabling the independent full-match E2E.
All six viewport sizes plus legacy Academy and offline cold-tab remain gated.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

KEY='tw-mahjong-master-academy:full-table:r3:v1'

def require(value, message):
    if not value:
        raise AssertionError(message)

def table_open(page):
    page.locator('#full-table-navigation [data-table-nav="play"]').click()
    require(page.locator('#full-table-root').is_visible(), 'table is not visible')
    require(page.locator('#academy-root').is_hidden(), 'Academy overlays table')

def read_checkpoint(page):
    return page.evaluate("""key => {
        const raw=localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }""",KEY)

def await_dealer_discard(page):
    """Observe public legal actions only; never bypass flower replacement."""
    for _ in range(36):
        page.wait_for_timeout(180)
        if page.locator('.table-hand button[data-pick-action]:enabled').count()==17:
            return
        replacement=page.locator('.table-action-buttons button[data-submit-action]:enabled')
        if replacement.count():
            labels=replacement.all_text_contents()
            found=next((i for i,label in enumerate(labels) if '補花' in label),None)
            if found is not None:
                replacement.nth(found).click()
                page.wait_for_timeout(200)
                continue
        if page.locator('#full-table-root [role="alert"]').count():
            raise AssertionError('R3 start/flower failure: '+
                page.locator('#full-table-root [role="alert"]').last.inner_text())
    raise AssertionError('Dealer never reached 17 legal discards after real flower phase: '+
        page.locator('#full-table-root').inner_text()[-1200:])

def run(out):
    out.mkdir(parents=True, exist_ok=True)
    with served_site() as (url, _):
      with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        for width in [320,375,390,430,768,1440]:
            ctx=browser.new_context(
                viewport={'width':width,'height':844 if width<768 else 900},
                device_scale_factor=3 if width<=430 else 1,
                is_mobile=width<=430,has_touch=width<=430,
                reduced_motion='reduce' if width==375 else 'no-preference',
                service_workers='allow')
            page=ctx.new_page()
            page.on('dialog',lambda dialog:dialog.accept())
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url,wait_until='networkidle')
            require(page.locator('#academy-navigation button').count()==6,
                    'original six Academy navigation pages were replaced')
            require(page.locator('#full-table-navigation button').count()==4,
                    'table / Replay / Daily / Academy navigation missing')
            table_open(page)
            require('實驗' in page.locator('#full-table-root').inner_text(),
                    'experimental rules not disclosed')
            require(any('tw16-configurable-table' in p for p in
                    page.locator('#table-profile option').all_text_contents()),
                    'R3 full profile absent; sandbox-only fallback cannot pass Phase 3')
            page.locator('#full-table-root [data-start-new]').click()
            page.wait_for_selector('.table-hand',timeout=25000)
            await_dealer_discard(page)
            require(page.locator('.table-hand button[data-pick-action]:enabled').count()==17,
                    'dealer has not reached 17 physical legal discards after flower replacements')
            require(page.locator('.table-hand .tile-face-image').count()==17,
                    '17 original SVG faces missing after flower replacement')
            require(page.locator('.table-concealed').count()==3,
                    'three redacted opponent hand counts missing')
            require(page.locator('.table-opponent .table-hand').count()==0,
                    'opponent concealed tiles leaked')
            require(page.locator('.table-selected [data-submit-action]').count()==0,
                    'discard should not be pre-selected')
            require(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
                    str(width)+'px horizontal overflow')
            first=page.locator('.table-hand button[data-pick-action]').first
            require(first.get_attribute('aria-label'),'tile button lacks accessible label')
            if width<=430:
                touch=first.bounding_box()
                require(touch and touch['width']>=44,
                        str(width)+'px tile touch width under 44px')
            if width==375:
                duration=first.evaluate('(el)=>getComputedStyle(el).transitionDuration')
                require(duration in ('0s','0s, 0s'),'reduced motion transition active')
            if width==768:
                first.focus()
                require(first.evaluate('(el)=>document.activeElement===el'),
                        'keyboard focus lost')
                first.press('Enter')
                require(page.locator('.table-selected [data-submit-action]').count()==1,
                        'keyboard Enter did not select a Rules legal discard')
                page.locator('[data-clear-selection]').click()
            if width in (390,1440):
                page.screenshot(path=str(out/('table-'+str(width)+'-ready.png')),full_page=True)
            if width==390:
                pre=read_checkpoint(page)
                require(pre and pre.get('gameState',{}).get('round',{}).get('phase')=='await_discard',
                        'canonical R3 state not persisted after legal flower replacement')
                page.locator('.table-hand button[data-pick-action]:enabled').first.click()
                require(page.locator('.table-selected [data-submit-action]').count()==1,
                        'physical tile selection lacks confirmation')
                require(read_checkpoint(page)==pre,
                        'merely selecting a tile mutated the Rules GameState')
                page.locator('.table-selected [data-submit-action]').click()
                page.wait_for_function("""(args) => {
                  const p=localStorage.getItem(args.key);
                  return p && JSON.parse(p).gameState.revision>args.rev;
                }""",arg={'key':KEY,'rev':pre['gameState']['revision']},timeout=25000)
                post=read_checkpoint(page)
                require(post['gameState']['revision']>pre['gameState']['revision'],
                        'legal submission did not advance authoritative Rules revision')
                page.reload(wait_until='networkidle')
                table_open(page)
                restored=read_checkpoint(page)
                require(restored and restored['gameState']['revision']>=post['gameState']['revision'],
                        'reload did not restore persisted Rules checkpoint')
                require(page.locator('.table-opponent .table-hand').count()==0,
                        'private opponent hand leaked after restore')
                page.locator('#full-table-navigation [data-table-nav="replay"]').click()
                require('尚未開放' in page.locator('#full-table-root').inner_text(),
                        'unfinished round fabricated verified Replay')
                page.screenshot(path=str(out/'table-390-replay-gated.png'),full_page=True)
                page.locator('#full-table-navigation [data-table-nav="academy"]').click()
                require(page.locator('#academy-root').is_visible(),'Academy not restored')
                page.locator('[data-academy-nav="training"]').click()
                require(page.locator('#hand button[data-tile]').count()==17,
                        'legacy official discard training broken')
                page.locator('[data-mode="tenpai"]').click()
                require(page.locator('#wait-options button').count()==34,
                        'legacy tenpai broken')
                page.locator('[data-mode="multi_wait"]').click()
                require(page.locator('#wait-options button').count()==34,
                        'legacy multi-wait broken')
                page.goto(url,wait_until='networkidle')
                page.evaluate('() => navigator.serviceWorker.ready.then(() => true)')
                page.reload(wait_until='networkidle')
                page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=20000)
                ctx.set_offline(True)
                offline=ctx.new_page()
                offline.goto(url,wait_until='domcontentloaded')
                table_open(offline)
                require(offline.locator('.table-hand').count()==1,
                        'offline recovered R3 game unavailable')
                require(offline.locator('.table-opponent .table-hand').count()==0,
                        'offline privacy projection leaked')
                svg=offline.evaluate("""async () => {
                  const result=await Promise.all(Array.from({length:34},
                    (_,i)=>fetch('./public/tiles/'+i+'.svg')));
                  return result.every(x=>x.ok && x.headers.get('content-type')?.includes('svg'));
                }""")
                require(svg,'34 traditional SVG tiles unavailable offline')
                offline.screenshot(path=str(out/'table-390-offline.png'),full_page=True)
                ctx.set_offline(False)
            require(not errors,str(width)+'px JS errors: '+str(errors))
            ctx.close()
        browser.close()
    (out/'verification.txt').write_text(
        'Six widths; real R3 flower completion, 17 legal physical discards, '
        'UI confirmation, durable Rules revision, restore, privacy, legacy Academy, '
        'offline new-tab and 34 SVG. Full R3/Daily terminal proof remains separate. '
        'Chromium emulation only; physical iPhone NOT_RUN.\n',encoding='utf-8')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--screenshots',default='tw16-table-evidence')
    args=p.parse_args()
    run(Path(args.screenshots))
