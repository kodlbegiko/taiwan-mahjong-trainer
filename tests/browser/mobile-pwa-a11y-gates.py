"""R7 Chromium emulation gates; NOT physical iOS/Android or screen reader certification."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site

SIZES = ((320, 640), (375, 812), (390, 844), (430, 932), (768, 900), (1440, 900))
LANDSCAPE = (844, 390)

def require(ok, message):
    if not ok:
        raise AssertionError(message)

def audit(page, label):
    results = page.evaluate("""() => {
      const root = document.querySelector('#full-table-root');
      const buttons = [...root.querySelectorAll('.table-hand button[data-pick-action]')];
      const controls = [...root.querySelectorAll('.table-actions button:not(:disabled), #full-table-navigation button:not(:disabled)')];
      const undersized = [...buttons, ...controls].flatMap(b => {
        const r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44 ? [b.outerHTML.slice(0, 180) + ' ' + r.width + 'x' + r.height] : [];
      });
      const unnamed = [...root.querySelectorAll('button:not(:disabled)')].filter(b =>
        !((b.getAttribute('aria-label') || b.innerText || '').trim())).map(b => b.outerHTML.slice(0, 160));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        tileCount: buttons.length,
        tileImages: root.querySelectorAll('.table-hand .tile-face-image').length,
        groups: root.querySelectorAll('[role="group"][aria-label]').length,
        undersized, unnamed,
        heading: !!root.querySelector('#table-heading'),
        navigator: !!document.querySelector('nav[aria-label="四人麻將與課程切換"]'),
      };
    }""")
    require(results['overflow'] <= 1, f'{label}: document horizontal overflow: {results}')
    require(results['tileCount'] == 17 and results['tileImages'] == 17,
            f'{label}: physical 17 tile buttons/SVG not visible: {results}')
    require(results['groups'] >= 5 and results['heading'] and results['navigator'],
            f'{label}: table semantics incomplete: {results}')
    require(not results['undersized'], f'{label}: controls below 44x44: {results}')
    require(not results['unnamed'], f'{label}: accessible button names missing: {results}')
    return results

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--evidence', type=Path, required=True)
    args = p.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)
    matrix = []
    with served_site() as (url, _):
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            try:
                for width, height in (*SIZES, LANDSCAPE):
                    label = f'{width}x{height}'
                    mobile = width <= 430 or (width, height) == LANDSCAPE
                    context = browser.new_context(
                        viewport={'width': width, 'height': height},
                        device_scale_factor=3 if mobile else 1,
                        is_mobile=mobile, has_touch=mobile,
                        reduced_motion='reduce' if width == 375 else 'no-preference',
                        service_workers='allow')
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    try:
                        page.goto(url + '?table=sandbox', wait_until='networkidle')
                        page.locator('#academy-navigation button').first.wait_for()
                        page.locator('[data-table-nav="play"]').click()
                        page.locator('#table-profile').wait_for()
                        page.locator('#full-table-root [data-start-new]').click()
                        page.locator('.table-hand button[data-pick-action]').first.wait_for()
                        measured = audit(page, label)
                        page.locator('.table-hand button[data-pick-action]').first.scroll_into_view_if_needed()
                        page.screenshot(path=str(args.evidence / f'mobile-{label}.png'), full_page=True)
                        if width == 375:
                            button = page.locator('.table-hand button[data-pick-action]').first
                            button.focus()
                            button.press('Enter')
                            page.locator('[data-submit-action]').first.wait_for()
                            page.wait_for_function(
                                "() => document.activeElement?.matches('.table-hand button[data-pick-action]')")
                            require(page.locator('.table-hand button[aria-pressed="true"]').count() == 1,
                                    'selection accessibility state not exposed')
                            require(page.locator('.table-hand button').first.evaluate(
                                '(e) => getComputedStyle(e).transitionDuration') in ('0s', '0s, 0s'),
                                'reduced-motion transition persists')
                            page.locator('[data-clear-selection]').click()
                            page.wait_for_function("() => document.activeElement !== document.body")
                        if width == 390:
                            page.locator('[data-table-nav="academy"]').click()
                            page.locator('[data-academy-nav="training"]').click()
                            page.locator('#hand button').first.wait_for()
                            require(page.locator('#hand button').count() == 17, 'V0.2 training broken')
                            page.locator('[data-mode="tenpai"]').click()
                            require(page.locator('#wait-options button').count() == 34, '34 waits not shown')
                            # Smoke the real integrated table, without claiming a settled R3 round.
                            full = context.new_page()
                            full.goto(url, wait_until='networkidle')
                            full.locator('[data-table-nav="play"]').click()
                            full.locator('#table-profile').wait_for()
                            require(full.locator('#table-profile option').count() >= 1,
                                    'R3 profile selection missing')
                            full.locator('#full-table-root [data-start-new]').click()
                            full.wait_for_selector('.table-hand, .table-round-summary', timeout=30000)
                            require(full.locator('#full-table-root [role="alert"]').count() == 0,
                                    'full-table init displayed an error')
                            full.screenshot(path=str(args.evidence / 'mobile-390-full-mode.png'), full_page=True)
                            full.close()
                        require(not errors, f'{label}: page errors: {errors}')
                        matrix.append({'viewport': label, 'status': 'PASS', **measured})
                        print('PASS', label, 'touch/overflow/svg/aria/keyboard baseline')
                    except Exception as exc:
                        matrix.append({'viewport': label, 'status': 'FAIL', 'reason': str(exc)})
                        page.screenshot(path=str(args.evidence / f'mobile-{label}-failure.png'), full_page=True)
                        raise
                    finally:
                        context.close()
            finally:
                browser.close()
                (args.evidence / 'viewport-results.json').write_text(
                    json.dumps({'engine': 'headless Chrome via Playwright',
                                'physical_iPhone': 'NOT_RUN',
                                'physical_Android': 'NOT_RUN',
                                'VoiceOver': 'NOT_RUN',
                                'TalkBack': 'NOT_RUN', 'results': matrix},
                               ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
