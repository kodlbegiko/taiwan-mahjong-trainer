"""Visual geometry checks for actual local sandbox table, not a mockup."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--evidence',type=Path,required=True)
    out=p.parse_args().evidence
    out.mkdir(parents=True,exist_ok=True)
    evidence=[]
    with served_site() as (url,_), sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        try:
            for width,height in [(1440,900),(1024,768),(900,700),(741,850),(681,850),(561,800),(430,932),(390,844),(375,812),(320,640),(844,390)]:
                ctx=browser.new_context(viewport={'width':width,'height':height},
                    reduced_motion='reduce',device_scale_factor=1)
                page=ctx.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                try:
                    if width==1440:
                        page.add_init_script("""(() => {
                          window.__tmtSoundStarts=0;
                          const start=AudioBufferSourceNode.prototype.start;
                          AudioBufferSourceNode.prototype.start=function(...args){
                            window.__tmtSoundStarts++;
                            return start.apply(this,args);
                          };
                        })()""")
                    page.goto(url+'?table=sandbox',wait_until='networkidle')
                    page.locator('[data-table-nav="play"]').click()
                    page.locator('#table-profile').wait_for()
                    page.locator('#full-table-root [data-start-new]').click()
                    page.locator('.table-hand button[data-pick-action]').first.wait_for()
                    page.wait_for_function("""() => [...document.querySelectorAll('.table-hand img')].every(i=>i.complete&&i.naturalWidth>0)""")
                    report=page.evaluate("""() => {
                        const root=document.querySelector('[data-table-theme="jade-room"]');
                        const hand=root.querySelector('.table-hand');
                        const bounds=hand.getBoundingClientRect();
                        const buttons=[...hand.querySelectorAll('button[data-pick-action]')];
                        const rects=buttons.map(b=>{
                            const r=b.getBoundingClientRect(), i=b.querySelector('img').getBoundingClientRect();
                            return {w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
                                iw:i.width,ih:i.height,clipped:i.left<r.left-1||i.right>r.right+1||i.top<r.top-1||i.bottom>r.bottom+1};
                        });
                        return {theme:root.dataset.tableTheme,tiles:buttons.length,
                            opponents:root.querySelectorAll('.table-opponent').length,
                            backs:root.querySelectorAll('.table-back-tile').length,
                            sorted:buttons.map(b=>Number(new URL(b.querySelector('img').src).pathname.match(/(\\d+)\\.svg$/)[1])).every((n,i,a)=>i===0||a[i-1]<=n),
                            ownRiver:!!root.querySelector('.table-self .table-own-river .table-river'),
                            winds:[...root.querySelectorAll('[data-seat-wind]')].map(el=>el.dataset.seatWind).sort(),
                            dealerCount:root.querySelectorAll('[data-dealer-seat="true"]').length,
                            activeCount:root.querySelectorAll('[data-seat-turn="true"]').length,
                            overflow:document.documentElement.scrollWidth-innerWidth,
                            invalid:rects.filter(r=>r.w<44||r.h<44||r.iw<20||r.ih<20||r.clipped||r.left<bounds.left-1||r.right>bounds.right+1),
                            rowCount:new Set(rects.map(r=>Math.round(r.top))).size,
                            minTileWidth:Math.min(...rects.map(r=>r.w)),
                            minFaceWidth:Math.min(...rects.map(r=>r.iw))};
                    }""")
                    assert report['theme']=='jade-room',report
                    assert report['tiles']==17 and report['opponents']==3,report
                    assert report['backs']==48 and report['sorted'] and report['ownRiver'],report
                    assert report['winds']==sorted(['東','南','西','北']) and report['dealerCount']==1 and report['activeCount']==1,report
                    assert report['overflow']<=1 and not report['invalid'],report
                    assert not errors,errors
                    report['viewport']=[width,height]
                    evidence.append(report)
                    page.locator('[data-table-theme="jade-room"]').screenshot(path=str(out/f'jade-{width}x{height}.png'))
                    first=page.locator('.table-hand button[data-pick-action]').first
                    revision=page.locator('.table-version').inner_text()
                    first.click()
                    assert page.locator('.table-hand button[aria-pressed="true"]').count()==1
                    assert page.locator('[data-submit-action]').count()==1
                    assert page.locator('.table-version').inner_text()==revision
                    if width in (1440,390):
                        selector=page.locator('[data-table-theme-select]')
                        actions=page.locator('.table-hand button[data-pick-action]').evaluate_all('(els)=>els.map(e=>e.dataset.pickAction)')
                        selected=page.locator('.table-hand button[aria-pressed="true"]').get_attribute('data-pick-action')
                        backgrounds=[]
                        for theme in ['walnut-room','midnight-room','jade-room']:
                            selector.select_option(theme)
                            surface=page.locator('[data-table-theme="'+theme+'"]')
                            assert surface.count()==1
                            backgrounds.append(surface.locator('.table-grid').evaluate('(el)=>getComputedStyle(el).backgroundImage'))
                            assert page.locator('.table-version').inner_text()==revision
                            assert page.locator('.table-hand button[data-pick-action]').evaluate_all('(els)=>els.map(e=>e.dataset.pickAction)')==actions
                            assert page.locator('.table-hand button[aria-pressed="true"]').get_attribute('data-pick-action')==selected
                            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                            assert page.locator('.table-hand button[data-pick-action]').first.bounding_box()['width']>=44
                            if theme!='jade-room':
                                surface.screenshot(path=str(out/f'{theme}-{width}x{height}.png'))
                        assert len(set(backgrounds))==3
                        report['themes']='PASS: distinct CSS surfaces; exact actions, selection and revision unchanged'
                    page.locator('[data-clear-selection]').click()
                    assert page.locator('.table-hand button[aria-pressed="true"]').count()==0
                    if width==1440:
                        sound=page.locator('[data-table-sound]')
                        assert sound.get_attribute('aria-pressed')=='false'
                        assert page.evaluate('window.__tmtSoundStarts')==0
                        sound.click()
                        page.wait_for_function("""() => document.querySelector('[data-table-sound]')?.getAttribute('aria-pressed')==='true'""")
                        assert page.evaluate('window.__tmtSoundStarts')==0
                        page.locator('.table-hand button[data-pick-action]').first.click()
                        assert page.evaluate('window.__tmtSoundStarts')==0
                        page.locator('[data-submit-action]').click()
                        page.wait_for_function('window.__tmtSoundStarts===1')
                        assert page.locator('.table-last-discard').count()==1
                        sound.click()
                        assert sound.get_attribute('aria-pressed')=='false'
                        assert page.evaluate('window.__tmtSoundStarts')==1
                        page.reload(wait_until='networkidle')
                        page.locator('[data-table-nav="play"]').click()
                        assert page.locator('[data-table-sound]').get_attribute('aria-pressed')=='false'
                        assert page.evaluate('window.__tmtSoundStarts')==0
                        report['soundOptIn']='PASS: real Web Audio start on committed discard only; reload silent'
                        assert not errors,errors
                    print('PASS',width,height,json.dumps(report,ensure_ascii=False))
                finally:
                    ctx.close()
        finally:
            browser.close()
    (out/'jade-geometry.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')

if __name__=='__main__':
    main()
