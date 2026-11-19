"""Phase 3 table-only browser gates. Screenshots are browser emulation, NOT physical iOS proof.
Full 4-player end-to-end must remain NOT_RUN until Rules + Bot + Replay official APIs exist.
"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

def require(value, message):
    if not value: raise AssertionError(message)

def table_open(page):
    page.locator('#full-table-navigation [data-table-nav="play"]').click()
    require(page.locator('#full-table-root').is_visible(), 'table is not visible')
    require(page.locator('#academy-root').is_hidden(), 'Academy overlays table')

def run(out):
    out.mkdir(parents=True, exist_ok=True)
    with served_site() as (url, _):
      with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
        for width in [320,375,390,430,768,1440]:
            ctx = browser.new_context(
                viewport={'width':width,'height':844 if width<768 else 900},
                device_scale_factor=3 if width<=430 else 1,
                is_mobile=width<=430, has_touch=width<=430,
                reduced_motion='reduce' if width==375 else 'no-preference',
                service_workers='allow')
            page = ctx.new_page()
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url, wait_until='networkidle')
            require(page.locator('#academy-navigation button').count()==6,
                    'original Academy navigation was replaced')
            require(page.locator('#full-table-navigation button').count()==3,
                    'table and replay navigation missing')
            table_open(page)
            require('實驗' in page.locator('#full-table-root').inner_text(),
                    'experimental scope not disclosed')
            require(page.locator('#table-profile option').count()>=1,
                    'explicit RuleProfile selection missing')
            page.locator('#full-table-root [data-start-new]').click()
            require(page.locator('.table-hand button[data-pick-action]').count()==17,
                    'initial real engine 17 legal physical tiles missing')
            require(page.locator('.table-hand .tile-face-image').count()==17,
                    '17 traditional SVG faces missing')
            require(page.locator('.table-concealed').count()==3,
                    'hidden opponents must display only concealed counts')
            require(page.locator('.table-opponent .table-hand').count()==0,
                    'opponent concealed hand leaked')
            require(page.locator('[data-submit-action]').count()==0,
                    'discard confirmation should not be preselected')
            require(page.locator('.table-action-buttons button').count()==0,
                    'unverified chi/pong/kong/win buttons should be absent')
            require(page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),
                    str(width)+'px horizontal overflow')
            require(page.locator('.table-hand button').first.get_attribute('aria-label'),
                    'tile button not accessible')
            if width<=430:
                button_width=page.locator('.table-hand button').first.bounding_box()['width']
                require(button_width>=44, str(width)+'px touch tile width under 44px: '+str(button_width))
            if width==375:
                transition=page.locator('.table-hand button').first.evaluate(
                    '(el) => getComputedStyle(el).transitionDuration')
                require(transition in ('0s','0s, 0s'),'reduced motion transition still active')
            if width==768:
                keyboard=page.locator('.table-hand button[data-pick-action]').first
                keyboard.focus()
                require(keyboard.evaluate('(el)=>document.activeElement===el'), 'keyboard tile focus lost')
                keyboard.press('Enter')
                require(page.locator('[data-submit-action]').count()==1,
                        'keyboard Enter did not select a legal discard')
                page.locator('[data-clear-selection]').click()
            if width in [390,1440]:
                page.screenshot(path=str(out/('table-'+str(width)+'-ready.png')),full_page=True)
            if width==390:
                before=page.evaluate("""() => localStorage.getItem('tw-mahjong-master-academy:table-sandbox:v1')""")
                page.locator('.table-hand button[data-pick-action]').first.click()
                require(page.locator('[data-submit-action]').count()==1,
                        'two-step discard confirmation missing')
                require(page.evaluate("""() => localStorage.getItem('tw-mahjong-master-academy:table-sandbox:v1')""")==before,
                        'selecting a tile already mutated game state')
                page.locator('[data-submit-action]').click()
                require(page.locator('.table-self .table-river .tile-face-image').count()==1,
                        'canonical discard not reflected in public river')
                require(page.locator('.table-hand button').count()==16,
                        'canonical discard did not reduce concealed count')
                require('尚未整合正式 Bot API' in page.locator('.table-actions').inner_text(),
                        'missing bots must fail closed, not auto-play fake decisions')
                require(page.locator('.table-action-buttons button').count()==0,
                        'unverified declarations rendered after discard')
                page.reload(wait_until='networkidle')
                table_open(page)
                require(page.locator('.table-hand button').count()==16,
                        'reload failed to recover saved real Rules state')
                page.locator('#full-table-navigation [data-table-nav="replay"]').click()
                require('尚未開放' in page.locator('#full-table-root').inner_text(),
                        'fake Replay was displayed without official provider')
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
                # Offline in a brand-new navigation after SW activation.
                page.goto(url,wait_until='networkidle')
                page.evaluate('() => navigator.serviceWorker.ready.then(() => true)')
                page.reload(wait_until='networkidle')
                page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=20000)
                ctx.set_offline(True)
                offline=ctx.new_page()
                offline.goto(url,wait_until='domcontentloaded')
                table_open(offline)
                require(offline.locator('.table-hand button').count()==16,
                        'offline restored game unavailable')
                cached=offline.evaluate("""async () => {
                  const responses=await Promise.all(
                    Array.from({length:34},(_,i)=>fetch('./public/tiles/'+i+'.svg')));
                  return responses.every(x=>x.ok && x.headers.get('content-type')?.includes('svg'));
                }""")
                require(cached,'34 offline SVG tiles unavailable')
                offline.screenshot(path=str(out/'table-390-offline.png'),full_page=True)
                ctx.set_offline(False)
            require(not errors, str(width)+'px JS errors: '+str(errors))
            ctx.close()
        browser.close()
    (out/'verification.txt').write_text(
        'Widths: 320,375,390,430,768,1440. Touch, keyboard labels, reduced motion,\n'
        'real sandbox discard, reload and 390 offline new tab. Full Rules/Bot/Replay E2E: NOT_RUN.\n',
        encoding='utf-8')
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',default='tw16-table-evidence')
    args=parser.parse_args()
    run(Path(args.screenshots))
