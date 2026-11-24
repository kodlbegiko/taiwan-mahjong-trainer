"""REAL R3 browser E2E contract. Fail closed when latest Phase3 modules are absent.
NOT part of legacy sandbox CI. AI6 must run on one merged source SHA and attach evidence.
No fixtures or fabricated Bot decisions are permitted.
"""
from pathlib import Path
import json
import os
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
    if os.environ.get('PHASE3_REQUIRE_SINGLE_WINNER')=='1':
        r5='tw16-single-winner-interception@experimental-v1'
        require(any('一炮一響' in p and '攔胡' in p for p in profiles),
                'R5 single-winner experimental profile label missing')
        page.locator('#table-profile').select_option(r5)
        require(page.locator('#table-profile').input_value()==r5,
                'R5 Profile selection failed')
    difficulty=os.environ.get('PHASE3_BOT_DIFFICULTY','Beginner')
    selector=page.locator('#table-bot-difficulty')
    require(selector.input_value()=='Beginner','Historical Beginner default changed')
    selector.select_option(difficulty)
    fixed_seed=os.environ.get('PHASE3_FIXED_SEED')
    if fixed_seed:
        page.locator('#table-fixed-seed').fill(fixed_seed)
        require(page.locator('#table-fixed-seed').input_value()==fixed_seed,'Fixed seed not selected in normal UI')
    page.locator('#full-table-root [data-start-new]').click()
    page.wait_for_selector('.table-hand', timeout=25000)
    require(page.locator('[data-bot-difficulty]').get_attribute('data-bot-difficulty')==difficulty,
            'Selected difficulty did not reach real host')

def probe_inline_confirmation(page, folder):
    """Negative tests use public DOM clicks; no GameState/Rules fixtures."""
    initial_revision=page.locator('.table-version').inner_text()
    option=page.locator('.table-action-buttons [data-submit-action]:enabled').first
    action_id=option.get_attribute('data-submit-action')
    option.click()
    require(page.locator('[data-action-confirmation]').count()==1,
            'Legal declaration must open an in-page confirmation')
    require(page.locator('.table-version').inner_text()==initial_revision,
            'Opening a declaration confirmation mutated Rules revision')
    require(page.locator('[data-confirm-action]').evaluate(
                '(el) => document.activeElement===el'),
            'Keyboard focus must move to the explicit confirmation')
    page.screenshot(path=str(folder/'table-390-r7-declaration-confirm.png'),full_page=True)
    page.locator('[data-cancel-action]').click()
    require(page.locator('[data-action-confirmation]').count()==0,
            'Cancel left a pending confirmation visible')
    require(page.locator('.table-version').inner_text()==initial_revision,
            'Cancelled declaration committed a Rules event')
    require(page.evaluate('(id)=>document.activeElement?.dataset.submitAction===id',action_id),
            'Cancel must return focus to the exact still-legal declaration')
    # Exercise rejection of a tampered DOM token, not a fabricated GameState.
    page.locator('.table-action-buttons [data-submit-action]:enabled').first.click()
    require(page.locator('[data-confirm-action]').count()==1,
            'Retry did not restore the same legal declaration')
    page.locator('[data-confirm-action]').evaluate(
        "(el) => el.dataset.confirmAction='__r7_invalid_action_id__'")
    page.locator('[data-confirm-action]').click()
    require('確認動作已過期' in page.locator('[role="alert"]').last.inner_text(),
            'Forged DOM confirmation was not refused')
    require(page.locator('.table-version').inner_text()==initial_revision,
            'Forged confirmation mutated Rules revision')
    require(page.locator('[data-action-confirmation]').count()==0,
            'Invalid confirmation left a replayable pending token')
    # The next ordinary UI action is the legitimate retry.

def make_human_decision(page, coverage, folder):
    # Only click currently issued UI LegalAction controls. Never fabricate IDs.
    # Intermediate/Advanced may need longer than the original 100ms pacing.
    # Observe the real busy state; never click a disabled or pending action.
    page.locator('[data-table-busy="false"]').wait_for(timeout=25000)
    if page.locator('.table-round-summary').count():
        return 'settled'
    if coverage.get('consumed_id') and not coverage.get('expired_dom'):
        # Re-submit the actual prior Rules-issued token through a DOM control.
        # Never change GameState, storage, or the Rules/Bot authority.
        stale=page.locator('.table-action-buttons [data-submit-action]:enabled')
        if stale.count():
            revision=page.locator('.table-version').inner_text()
            stale.first.evaluate('(el,id)=>el.dataset.submitAction=id',coverage['consumed_id'])
            stale.first.click()
            require('過期' in page.locator('[role="alert"]').last.inner_text(),
                    'Previously consumed LegalAction was not explicitly rejected')
            require(page.locator('.table-version').inner_text()==revision,
                    'Expired action changed Rules revision')
            require(page.locator('[data-action-confirmation]').count()==0,'Expired action was staged')
            coverage['expired_dom']=True
    cont=page.locator('[data-continue-bots]:enabled')
    if cont.count():
        cont.click()
        return 'continue-bots'
    options=page.locator('.table-action-buttons [data-submit-action]:enabled')
    if options.count():
        if not coverage['declaration_negative_paths']:
            probe_inline_confirmation(page,folder)
            coverage['declaration_negative_paths']=True
            options=page.locator('.table-action-buttons [data-submit-action]:enabled')
        labels=options.all_text_contents()
        preference=(['胡牌','補花','明槓','暗槓','加槓','碰','吃','摸牌','放棄宣告']
                    if os.environ.get('PHASE3_R71_CLAIMS')=='1' else
                    ['胡牌','補花','摸牌','放棄宣告','明槓','暗槓','加槓','碰','吃'])
        chosen=next((i for word in preference for i,label in enumerate(labels) if word in label),0)
        selected=options.nth(chosen)
        label=labels[chosen]
        selected.click()
        require(page.locator('[data-action-confirmation]').count()==1,
                'Legal non-discard action must require an in-page confirmation')
        if not coverage.get('double_confirm'):
            # Two real click events on the same rendered button, no Rules injection.
            before=page.locator('.table-version').inner_text()
            coverage['consumed_id']=page.locator('[data-confirm-action]').get_attribute('data-confirm-action')
            page.locator('[data-confirm-action]').evaluate('(el)=>{el.click();el.click()}')
            page.wait_for_function('''before=>document.querySelector('[data-table-busy="false"]') &&
                document.querySelector('.table-version')?.innerText!==before''',arg=before,timeout=25000)
            require(page.locator('.table-version').inner_text()!=before,'Confirmed action did not advance')
            require(page.locator('[data-action-confirmation]').count()==0,'Duplicate left stale confirmation')
            require(page.locator('[role="alert"]').count()==0,'Duplicate confirmation caused error')
            coverage['double_confirm']=True
        else:
            page.locator('[data-confirm-action]').click()
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
    native_dialogs=[]
    def on_unexpected_dialog(dialog):
        native_dialogs.append(dialog.message)
        dialog.dismiss()
    page.on('dialog', on_unexpected_dialog)
    open_game(page)
    page.locator('.table-header-tools [data-start-new]:enabled').wait_for(timeout=25000)
    original_revision=page.locator('.table-version').inner_text()
    require(page.locator('[data-table-busy="false"]').count()==1,
            'The real UI is still busy after opening the game')
    page.locator('.table-header-tools [data-start-new]').click()
    require(page.locator('[data-restart-confirmation]').count()==1,
            'Restart must require an in-page confirmation')
    require(page.locator('.table-version').inner_text()==original_revision,
            'Opening restart confirmation mutated state')
    restart_level=page.locator('#table-bot-difficulty')
    require(restart_level.input_value()==os.environ.get('PHASE3_BOT_DIFFICULTY','Beginner'),'Restart did not retain current difficulty')
    restart_level.select_option('Advanced' if restart_level.input_value()!='Advanced' else 'Intermediate')
    page.locator('[data-cancel-new]').click()
    require(page.locator('[data-bot-difficulty]').get_attribute('data-bot-difficulty')==os.environ.get('PHASE3_BOT_DIFFICULTY','Beginner'),
            'Cancelled restart changed current difficulty')
    require(page.locator('.table-version').inner_text()==original_revision,
            'Cancelling restart mutated the ongoing match')
    page.locator('[data-show-replay]').click()
    page.locator('#full-table-root [role="alert"]').wait_for(timeout=10000)
    require('只支援已結束' in page.locator('#full-table-root [role="alert"]').last.inner_text(),
            'Pre-settlement Replay should report an explicit guarded refusal')
    page.locator('[data-return-table]').click()
    require(page.locator('.table-version').inner_text()==original_revision,
            'Replay refusal / recovery modified the live Rules revision')
    require('EXPERIMENTAL' in page.locator('#full-table-root').inner_text(),
            'experimental warning missing')
    require(page.locator('.table-opponent .table-hand').count()==0,
            'opponent concealed leaked')
    page.screenshot(path=str(folder/'table-390-real-r3.png'),full_page=True)
    history=[]
    coverage={'declaration_negative_paths':False}
    for step in range(MAX_HUMAN_DECISIONS):
        page.wait_for_timeout(100)
        if page.locator('.table-round-summary').count():
            break
        label=make_human_decision(page,coverage,folder)
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
    require(coverage['declaration_negative_paths'],
            'No real flower/claim declaration exercised cancellation, refusal and retry')
    require(coverage.get('double_confirm'),'No genuine duplicate confirmation exercised')
    require(coverage.get('expired_dom'),'No real consumed LegalAction retry exercised')
    require(not native_dialogs,
            'Native browser dialog appeared in full-match table UI: '+str(native_dialogs))
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
    require(page.locator('.table-round-summary').inner_text()==result,'Reload altered authoritative settlement')
    require(page.locator('[data-bot-difficulty]').get_attribute('data-bot-difficulty')==os.environ.get('PHASE3_BOT_DIFFICULTY','Beginner'),
            'Reload altered selected Bot difficulty')
    page.screenshot(path=str(folder/'table-390-real-settled-reloaded.png'),full_page=True)
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
    (folder/'r7-confirmation-coverage.json').write_text(json.dumps({
        'declaration_cancel_reject_retry':coverage['declaration_negative_paths'],
        'duplicate_click':coverage['double_confirm'],'expired_actual_token':coverage['expired_dom'],
        'native_dialogs':native_dialogs,'difficulty':os.environ.get('PHASE3_BOT_DIFFICULTY','Beginner'),
        'restored_settlement_and_difficulty':True,'humanActionHistogram':{h:history.count(h) for h in set(history)}
    },ensure_ascii=False,indent=2),encoding='utf-8')
    return history

def daily_roundtrip(page,folder):
    page.locator('[data-table-nav="daily"]').click()
    # Navigation asynchronously imports the official Adaptive and Learning
    # modules. Wait for a completed Daily view, not the preceding Replay h1.
    page.wait_for_function("""() => document.body.dataset.tableView === 'daily'
      && !!document.querySelector('#full-table-root [data-daily-start],'
        +'#full-table-root [data-daily-resume],'
        +'#full-table-root [data-daily-retry]')""",timeout=25000)
    if page.locator('[data-daily-start]').count():
        page.locator('[data-daily-start]').click()
    elif page.locator('[data-daily-resume]').count():
        page.locator('[data-daily-resume]').click()
    else:
        folder.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(folder/'table-390-daily-error.png'),full_page=True)
        raise AssertionError('Daily controls unavailable after navigation: '+
            page.locator('#full-table-root').inner_text()[-1500:])
    page.wait_for_timeout(800)
    error=page.locator('#full-table-root [role="alert"]')
    require(error.count()==0,'Daily Controller not initialized: '+(
        error.first.inner_text() if error.count() else ''))
    before=page.locator('#full-table-root').inner_text()
    require('日期 ' in before and ' 題' in before,'Daily official DTO missing')
    require(page.locator('[data-daily-submit]').count()==1,
            'Daily created a Session without a real QuestionPublic answer form')
    # Assert canonical storage, not translated UI text. Capture only metadata,
    # never the private answer keys or a raw legacy archive in CI logs.
    before_state=page.evaluate("""() => {
      const v=JSON.parse(localStorage.getItem('tw-mahjong-master-academy:state:v1')||'{}');
      return {links:(v.provenanceLinks||[]).length,
              records:(v.trainingSessions||[]).reduce((n,s)=>n+(s.recordRefs||[]).length,0)};
    }""")
    original_ref=page.locator('[data-daily-question-ref]').get_attribute('data-daily-question-ref')
    page.locator('[name="daily-answer"]').first.check()
    # Two direct clicks in the same browser turn exercise the real UI re-entry guard.
    # Exactly one canonical v3 RecordRef is permitted.
    page.evaluate("""() => {
      const button=document.querySelector('[data-daily-submit]');
      if(!button)throw Error('Missing official submit button');
      button.click();button.click();
    }""")
    page.locator('[data-daily-state="saved"][data-daily-record-id]').wait_for(timeout=25000)
    require(page.locator('[data-daily-save-confirmed="true"]').count()==1,
            'Daily UI claims saved without an explicit verified RecordRef readback')
    ui_record_id=page.locator('[data-daily-state="saved"]').get_attribute('data-daily-record-id')
    require(ui_record_id is not None and len(ui_record_id)>0,
            'Daily UI did not expose validated public RecordRef')
    after_state=page.evaluate("""() => {
      const sidecar=JSON.parse(localStorage.getItem('tw-mahjong-master-academy:state:v1')||'{}');
      const archive=JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')||'{}');
      const records=(archive.records||[]).filter(r=>r.schemaVersion===3);
      const sessions=(sidecar.trainingSessions||[]);
      const links=sidecar.provenanceLinks||[];
      return {links:links.length,recordCount:records.length,
        sessionCount:sessions.length,
        recordRefs:sessions.reduce((a,s)=>a.concat(s.recordRefs||[]),[]),
        linkedRecordIds:links.map(x=>x.recordRef?.id),
        canonicalRecordIds:records.map(x=>x.id),
        pending:(sidecar.pendingProvenance||[]).length,
        abilityPresent:!!sidecar.abilityProfile,reviewPresent:!!sidecar.reviewPlan};
    }""")
    view=page.locator('#full-table-root').inner_text()
    require(ui_record_id in after_state['linkedRecordIds'] and
            ui_record_id in after_state['canonicalRecordIds'] and
            ui_record_id in [r['id'] for r in after_state['recordRefs']],
            'Saved UI RecordRef is absent from canonical archive/sidecar/session')
    require(after_state['links']==before_state['links']+1 and
            len(after_state['recordRefs'])==before_state['records']+1 and
            all(ref.get('id') in after_state['canonicalRecordIds'] and
                ref.get('id') in after_state['linkedRecordIds']
                for ref in after_state['recordRefs']) and
            after_state['pending']==0 and
            after_state['abilityPresent'] and after_state['reviewPresent'],
            'Daily canonical durability failed: '+str(after_state)+
            '; UI='+view[-900:])
    next_question=page.locator('[data-daily-question-ref]')
    require(next_question.count()==0 or
            next_question.get_attribute('data-daily-question-ref')!=original_ref,
            'Daily form did not advance from the officially saved QuestionRef')
    page.screenshot(path=str(folder/'table-390-daily-durable.png'),full_page=True)
    page.reload(wait_until='networkidle')
    page.locator('[data-table-nav="daily"]').click()
    page.wait_for_function("""() => document.body.dataset.tableView === 'daily'
      && Array.from(document.querySelectorAll('#full-table-root [role="status"]'))
        .some(node => node.textContent?.includes('日期 '))""",timeout=25000)
    require('日期 ' in page.locator('#full-table-root').inner_text(),
            'Daily session was not resumed from Adaptive authority')
    reread=page.evaluate("""() => {
      const sidecar=JSON.parse(localStorage.getItem('tw-mahjong-master-academy:state:v1')||'{}');
      const archive=JSON.parse(localStorage.getItem('tw-mahjong-trainer:archive:v3')||'{}');
      return {
        recordIds:(archive.records||[]).filter(r=>r.schemaVersion===3).map(r=>r.id),
        linkedRecordIds:(sidecar.provenanceLinks||[]).map(x=>x.recordRef?.id),
        sessionRecordIds:(sidecar.trainingSessions||[]).flatMap(s=>(s.recordRefs||[]).map(r=>r.id)),
        completed:(sidecar.trainingSessions||[]).flatMap(s=>s.recordRefs||[]).length,
        abilityPresent:!!sidecar.abilityProfile,
        reviewPresent:!!sidecar.reviewPlan
      };
    }""")
    savedIds=[ref['id'] for ref in after_state['recordRefs']]
    require(all(rid in reread['recordIds'] and
                rid in reread['linkedRecordIds'] and
                rid in reread['sessionRecordIds'] for rid in savedIds)
            and reread['completed']>=len(savedIds)
            and reread['abilityPresent'] and reread['reviewPresent'],
            'Daily durable readback failed across real browser reload: '+str(reread))
    page.screenshot(path=str(folder/'table-390-daily-reloaded.png'),full_page=True)
    (folder/'daily-durable-evidence.json').write_text(
        json.dumps({'status':'verified-browser-readback',
                    'uiSavedRecordId':ui_record_id,
                    'recordRefs':after_state['recordRefs'],
                    'canonicalRecordIds':reread['recordIds'],
                    'provenanceRecordIds':reread['linkedRecordIds'],
                    'sessionRecordIds':reread['sessionRecordIds'],
                    'pendingProvenance':after_state['pending'],
                    'abilityPresent':reread['abilityPresent'],
                    'reviewPlanPresent':reread['reviewPresent']},
                   ensure_ascii=False,indent=2),encoding='utf-8')

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
                    ctx.tracing.start(screenshots=True,snapshots=True,sources=True)
                    try:
                        history=full_round(page,folder)
                    finally:
                        ctx.tracing.stop(path=str(folder/'table-390-r7-full-round.trace.zip'))
                    daily_roundtrip(page,folder)
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
        'R7: inline non-discard confirmation, cancel, tampered DOM token refusal, retry,\n'
        'restart cancellation, nonterminal Replay error/recovery, trace ZIP.\n'
        'Human action histogram: '+str({x:history.count(x) for x in set(history)}),
        encoding='utf-8')

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument('--screenshots',default='tw16-r3-real-evidence')
    args=ap.parse_args()
    run(Path(args.screenshots))
