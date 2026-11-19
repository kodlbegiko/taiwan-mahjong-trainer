"""Independent V0.2 browser release gates, beyond PR #21's basic smoke.

Real localhost HTTP/subpath and visible player actions; test code never calls
production submit handlers or patches scoring. Only crypto-generated exercise IDs
are made deterministic to allow exact canonical comparisons.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from _release_site import served_site, deterministic_uuids, queue_seed, canonical_exercise, archive

V1 = 'tw-mahjong-trainer:session:v1'

def require(value, detail):
    if not value:
        raise AssertionError(detail)

def sorted_tiles(page):
    return page.locator('#hand button[data-tile]').evaluate_all(
        'nodes => nodes.map(n => Number(n.dataset.tile))')

def find_seed(page, style, level='intermediate'):
    # Search published, deterministic generator only. No fake hand injected in UI.
    return page.evaluate("""async ({style,level}) => {
      const {createExercise} = await import('./src/training/exercises.js');
      for (let i = 0; i < 160; i++) {
        const seed = 'release-' + style + '-' + i;
        const exercise = createExercise({seed, index:0, taskType:'discard', level});
        const ranking = exercise.answer.ranking;
        const found = style === 'tie'
          ? exercise.answer.optimalTiles.length >= 2
          : ranking.some(row => row.shanten > ranking[0].shanten);
        if (found) return seed;
      }
      throw new Error('Could not find deterministic ' + style + ' seed in 160 candidates');
    }""", {'style': style, 'level': level})

def wait_new_discard(page, seed):
    queue_seed(page, seed)
    page.locator('#skip').click()
    page.wait_for_function('(s) => window.__releaseLastId === s && document.querySelectorAll("#hand button").length === 17', arg=seed)
    expected = canonical_exercise(page, seed)
    require(sorted_tiles(page) == expected['hand'], 'UI hand differs from generated canonical Exercise')
    return expected

def read_latest(page):
    saved = archive(page)
    require(saved and saved['schemaVersion'] == 3 and saved['records'], 'v3 records absent')
    return saved, saved['records'][-1]

def reference_explanation(page, hand, discard, visible):
    return page.evaluate("""async ({hand,discard,visible}) => {
      const {explainDiscard} = await import('./src/analysis/explain.js');
      const {gradeAnswer} = await import('./src/practice.js');
      const explanation = explainDiscard(hand, discard, {visibleTiles:visible});
      return {explanation,grading:gradeAnswer(explanation.candidates.map(c => ({
        tile:c.discard.tile,shanten:c.metrics.shanten,kinds:c.metrics.kinds,
        copies:c.metrics.copies,draws:c.metrics.draws.map(({tile,count})=>({tile,count}))
      })),discard)};
    }""", {'hand': hand, 'discard': discard, 'visible': visible})

def assert_discard_result(page, exercise, chosen):
    ranking = exercise['answer']['ranking']
    expected = next(row for row in ranking if row['tile'] == chosen)
    best = ranking[0]
    optimal = exercise['answer']['optimalTiles']
    is_perfect = chosen in optimal
    grade = 'perfect' if is_perfect else 'acceptable' if expected['shanten'] == best['shanten'] else 'improve'
    require(page.locator('#answer').is_visible(), 'player result is hidden')
    require(page.locator('#answer-heading').evaluate('(el) => document.activeElement === el'),
            'result heading did not receive keyboard focus')
    require(page.locator('#chosen-shanten').inner_text() == str(expected['shanten']), 'UI shanten mismatch')
    require(page.locator('#chosen-kinds').inner_text() == str(expected['kinds']), 'UI kinds mismatch')
    require(page.locator('#chosen-copies').inner_text() == str(expected['copies']), 'UI copies mismatch')
    require(page.locator('#best-shanten').inner_text() == str(best['shanten']), 'UI best shanten mismatch')
    require(page.locator('#best-kinds').inner_text() == str(best['kinds']), 'UI best kinds mismatch')
    require(page.locator('#best-copies').inner_text() == str(best['copies']), 'UI best copies mismatch')
    require(page.locator('#rankings tr').count() == len(ranking), 'candidate row count incorrect')
    require(page.locator('#rankings .pill.green').count() == len(optimal), 'incorrect best/tie badges')
    rows = page.locator('#rankings tr')
    for pos, row in enumerate(ranking):
        texts = rows.nth(pos).locator('td').all_inner_texts()
        require(texts[2:] == [str(row['shanten']),str(row['kinds']),str(row['copies'])],
                f'candidate UI row {pos} does not match canonical ranking: {texts} != {row}')
        require(('並列最佳' in texts[1]) == (row['tile'] in optimal),
                f'false best claim in row {pos}')
    details = page.locator('#draw-details').inner_text()
    for draw in expected['draws']:
        # Compare tile and physical remaining count as actually displayed to the player.
        label = page.evaluate('(t) => import("./src/tiles.js").then(m => m.TILE_LABELS[t])', draw['tile'])
        require(f"{label} × {draw['count']}" in details,
                f'missing or wrong draw {draw} in visible explanation {details}')
    saved, record = read_latest(page)
    require(record['chosen'] == chosen, 'record chosen not equal player click')
    require(record['grade'] == grade, f'wrong grade {record["grade"]}, expected {grade}')
    require(record['exerciseSnapshot'] == exercise, 'persisted exercise snapshot changed')
    require(record['answerMetadata']['chosenShanten'] == expected['shanten'], 'persisted shanten mismatch')
    require(record['answerMetadata']['chosenCopies'] == expected['copies'], 'persisted copies mismatch')
    require(record['answerMetadata']['optimalTiles'] == optimal, 'record best-tile list mismatch')
    require(record['scoringVersion'] == 'efficiency-v2', 'scoringVersion regressed')
    require((page.locator('#exercise-status').get_attribute('class') or '').find(grade) >= 0,
            'player status grade differs from persisted grade')
    reference = reference_explanation(page, exercise['hand'], chosen, exercise['visibleTiles'])
    explanation = reference['explanation']
    require(explanation['decision']['trainingGrade'] == grade, 'explanation trainingGrade mismatch')
    text = page.locator('#explanation-summary').inner_text()
    for sentence in explanation['decision']['explanations']['beginner']:
        require(sentence in text, f'UI explanation omitted canonical sentence: {sentence}')
    page.locator('#explanation-details summary').click()
    advanced = page.locator('#explanation-advanced').inner_text()
    for sentence in explanation['decision']['explanations']['advanced']:
        require(sentence in advanced, f'advanced explanation differs: {sentence}')
    require(page.locator('#explanation-panel').is_visible(), 'teaching panel not displayed')
    return record

def go_mode(page, seed, mode, level):
    queue_seed(page, seed)
    page.locator(f'[data-mode="{mode}"]').click()
    page.wait_for_function('(s) => window.__releaseLastId === s', arg=seed)
    exercise = canonical_exercise(page, seed, mode, level)
    observed = page.locator('#hand .tile').count()
    require(observed == len(exercise['hand']) == 16, f'{mode} hand size wrong: {observed}')
    require(page.locator('#wait-options button[data-wait]').count() == 34, 'wait picker missing')
    require(page.locator('#answer').is_hidden(), 'old answer leaked into new mode')
    require(page.locator('#wait-selected').inner_text().startswith('已選 0 種'), 'old selected waits leaked')
    return exercise

def answer_waits(page, exercise, selected):
    for tile in selected:
        page.locator(f'#wait-options button[data-wait="{tile}"]').click()
    require(page.locator('#wait-selected').inner_text().startswith(f'已選 {len(selected)} 種'),
            'picker count does not reflect actual clicks')
    page.locator('#submit-waits').click()
    page.locator('#wait-answer:visible').wait_for()
    saved, record = read_latest(page)
    target = set(exercise['answer']['expectedTiles'])
    chosen = set(selected)
    require(record['chosen'] == sorted(selected), 'record wait selection mismatch')
    require(record['exerciseSnapshot'] == exercise, 'wait Exercise snapshot changed')
    require(record['answerMetadata']['expectedTiles'] == exercise['answer']['expectedTiles'], 'wait answer mismatch')
    require(record['answerMetadata']['missedTiles'] == sorted(target - chosen), 'missed tiles wrong')
    require(record['answerMetadata']['extraTiles'] == sorted(chosen - target), 'extra tiles wrong')
    require(('perfect' == record['grade']) == (chosen == target), 'wait grade and correctness disagree')
    for wait in exercise['answer']['winningTiles']:
        label = page.evaluate('(t) => import("./src/tiles.js").then(m => m.TILE_LABELS[t])', wait['tile'])
        require(f"{label} × {wait['copies']}" in page.locator('#wait-expected').inner_text(),
                'wrong visible winning tile copies')
    return record

def run_view(browser, url, output, width):
    context = browser.new_context(viewport={'width':width,'height':850},
                                  is_mobile=width==390,has_touch=width==390,
                                  accept_downloads=True)
    deterministic_uuids(context)
    page = context.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.goto(url + '?academy=training', wait_until='domcontentloaded')
    page.locator('#hand button').first.wait_for()
    require(page.locator('#hand button').count() == 17, 'initial exercise unavailable')
    require(page.locator('#answer').is_hidden(), 'result visible before answering')

    # Real difficulty selector, including a new exercise each time.
    for level in ['beginner', 'advanced', 'intermediate']:
        page.locator('#difficulty').select_option(level)
        page.locator('#hand button').first.wait_for()
        require(page.locator('#difficulty').input_value() == level, 'difficulty not switched')
        require(page.locator('#answer').is_hidden(), 'difficulty switch leaked result')
    if width == 390:
        boxes = page.locator('#hand button').evaluate_all(
            'nodes => nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,w:r.width,h:r.height}})')
        require(all(b['w'] >= 40 and b['h'] >= 44 and b['x'] >= -1 and b['right'] <= 391 for b in boxes),
                f'mobile tap targets fail: {boxes}')
        require(page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),
                'mobile global horizontal overflow')
        page.locator('#hand button').first.focus()
        page.keyboard.press('End')
        require(page.evaluate('document.activeElement.dataset.index') == '16', 'End keyboard failed')
        page.keyboard.press('Home')
        require(page.evaluate('document.activeElement.dataset.index') == '0', 'Home keyboard failed')

    tie_seed = find_seed(page, 'tie')
    tie = wait_new_discard(page, tie_seed)
    require(len(tie['answer']['optimalTiles']) >= 2, 'tie fixture not actually tied')
    best_tile = tie['answer']['optimalTiles'][-1]
    page.locator(f'#hand button[data-tile="{best_tile}"]').first.click()
    assert_discard_result(page, tie, best_tile)
    page.screenshot(path=str(output / f'{width}-tie-best.png'), full_page=True)

    wrong_seed = find_seed(page, 'wrong')
    queue_seed(page, wrong_seed)
    page.locator('#next-bottom').click()
    page.wait_for_function('(s) => window.__releaseLastId === s', arg=wrong_seed)
    wrong = canonical_exercise(page, wrong_seed)
    require(sorted_tiles(page) == wrong['hand'], 'next question differs from canonical exercise')
    require(page.locator('#answer').is_hidden(), 'previous result not cleared after next')
    require(page.locator('#explanation-panel').is_hidden(), 'previous explanation not cleared')
    require(page.locator('#hand button').first.evaluate('(e) => e===document.activeElement'),
            'focus did not return to new hand')
    choice = next(row['tile'] for row in wrong['answer']['ranking']
                  if row['shanten'] > wrong['answer']['ranking'][0]['shanten'])
    page.locator(f'#hand button[data-tile="{choice}"]').first.click()
    require(assert_discard_result(page, wrong, choice)['grade'] == 'improve',
            'deliberately incorrect discard was not rejected')
    page.screenshot(path=str(output / f'{width}-wrong-discard.png'), full_page=True)

    tenpai = go_mode(page, f'release-tenpai-{width}', 'tenpai', 'intermediate')
    answer_waits(page, tenpai, tenpai['answer']['expectedTiles'])
    page.screenshot(path=str(output / f'{width}-tenpai-perfect.png'), full_page=True)
    multi = go_mode(page, f'release-multi-{width}', 'multi_wait', 'intermediate')
    require(len(multi['answer']['expectedTiles']) >= 2, 'multi_wait generated non-multiple wait')
    available = [tile for tile in range(34) if
      tile not in multi['answer']['expectedTiles']
      and multi['hand'].count(tile) + multi['visibleTiles'].count(tile) < 4]
    require(bool(available), 'no valid incorrect choice')
    bad_wait = available[0]
    record = answer_waits(page, multi, [bad_wait])
    require(record['grade'] != 'perfect', 'incorrect wait set was awarded perfect grade')
    page.screenshot(path=str(output / f'{width}-multi-wrong.png'), full_page=True)

    saved, _ = read_latest(page)
    require(len(saved['records']) == 4 and len(saved['exercises']) == 4, '4 exercise records expected')
    async_download = page.expect_download()
    with async_download as download_info:
        page.locator('#export-history').click()
    download = download_info.value
    require(download.suggested_filename.endswith('.json'), 'export filename not JSON')
    exported = json.loads(Path(download.path()).read_text(encoding='utf-8'))
    require(exported == saved, 'downloaded v3 export bytes disagree with persisted archive')
    page.reload(wait_until='domcontentloaded')
    page.locator('#hand button').first.wait_for()
    require(archive(page) == saved, 'refresh did not restore full Exercise/DecisionRecord history')
    require(page.locator('#history-list details').count() == 4, 'history viewer lost entries')
    require(page.locator('#stat-total').inner_text() == '4', 'UI summary count wrong after reload')
    require(not failures, f'uncaught browser JS errors: {failures}')
    print(f'PASS browser-{width}: exact seeded canonical best/tie/wrong/waits + 4 snapshots + export/refresh')
    context.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', type=Path, required=True)
    args = parser.parse_args()
    args.screenshots.mkdir(parents=True, exist_ok=True)
    with served_site() as (url, _):
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox'])
            try:
                for width in [1440, 390]:
                    run_view(browser, url, args.screenshots, width)
            finally:
                browser.close()

if __name__ == '__main__':
    main()
