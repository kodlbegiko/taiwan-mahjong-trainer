"""Render actual shipped tile assets through the production renderer."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--evidence',type=Path,required=True)
    out=parser.parse_args().evidence
    out.mkdir(parents=True,exist_ok=True)
    with served_site() as (url,_), sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox'])
        try:
            page=browser.new_page(viewport={'width':1200,'height':900},device_scale_factor=2)
            page.goto(url,wait_until='networkidle')
            page.evaluate("""async () => {
                const {tileFaceMarkup,tileAccessibleName}=await import('./src/tile-visuals.js');
                const root=document.createElement('section');
                root.id='tile-gallery';
                root.style.cssText='padding:32px;background:#164b3c;color:#f9f3df;font:600 16px system-ui;max-width:1200px';
                const title=document.createElement('h1');title.textContent='Ivory Engraving · 34 tile faces';
                root.append(title);
                for(const [start,end] of [[0,9],[9,18],[18,27],[27,34]]){
                    const row=document.createElement('div');
                    row.style.cssText='display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:12px;margin:18px 0';
                    for(let i=start;i<end;i++){
                        const cell=document.createElement('div');
                        cell.style.cssText='min-width:0;text-align:center';
                        const tile=document.createElement('div');tile.className='tile';
                        tile.style.cssText='width:76px;height:106px;margin:0 auto 7px';
                        tile.innerHTML=tileFaceMarkup(i);
                        const label=document.createElement('span');label.textContent=tileAccessibleName(i);
                        cell.append(tile,label);row.append(cell);
                    }
                    root.append(row);
                }
                document.body.replaceChildren(root);
            }""")
            page.wait_for_function("""() => [...document.querySelectorAll('#tile-gallery img')].length===34 && [...document.querySelectorAll('#tile-gallery img')].every(i=>i.complete&&i.naturalWidth>0)""")
            assert page.locator('#tile-gallery img').count()==34
            assert page.locator('#tile-gallery .tile').count()==34
            page.locator('#tile-gallery').screenshot(path=str(out/'ivory-engraving-all-34.png'))
        finally:
            browser.close()

if __name__=='__main__':
    main()
