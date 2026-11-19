/**
 * Experimental Rules adapter for the Phase 3 table UI.
 * Authority: ONLY src/rules API may create, validate, and change GameState.
 * No front-end claim/win/scoring inference, no fabricated Bot or Replay data.
 * This adapter is deliberately replaceable by AI6's Phase 3 façade.
 */
import {
  createGame, validateGameState, createPlayerView, listLegalActions,
  applyAction, getRuleProfile, listRuleProfiles,
} from '../rules/index.js';

export const TABLE_STORAGE_KEY = 'tw-mahjong-master-academy:table-sandbox:v1';
const CURRENT_SEAT = 0;
const duplicate = value => JSON.parse(JSON.stringify(value));

function isLegalSubmission(state, supplied) {
  if (!supplied || typeof supplied !== 'object'
      || !Number.isInteger(supplied.actorSeat)
      || supplied.expectedRevision !== state.revision
      || typeof supplied.actionId !== 'string') return false;
  return listLegalActions(state, supplied.actorSeat)
    .some(a => a.actionId === supplied.actionId
      && a.expectedRevision === supplied.expectedRevision
      && a.actorSeat === supplied.actorSeat);
}

export function availableTableProfiles() {
  // A structural-only profile is NOT a playable four-player profile.
  return listRuleProfiles().filter(p => p.scope === 'four-player' && p.status !== 'incomplete');
}

/**
 * The only production-visible sandbox option is clearly experimental:
 * currently chi/pong/kong/win/settlement and bots have no verified provider.
 * Never persist to the canonical training v1/v3 or Adaptive storage keys.
 */
export function createSandboxSession({ storage = null, botAdapter = null, replayAdapter = null } = {}) {
  let state = null;
  let blockedStorage = false;
  let storageWarning = '';
  let activeSubmission = false;

  function save(next) {
    if (!storage) { storageWarning = '本機儲存不可用；關閉分頁後無法恢復這場測試對局。'; return; }
    if (blockedStorage) throw new Error('現有對局資料未通過驗證，禁止覆寫');
    try {
      storage.setItem(TABLE_STORAGE_KEY, JSON.stringify({ version: 1, gameState: next }));
      storageWarning = '';
    } catch {
      storageWarning = '對局資料保存失敗；請勿假設重新開啟後能恢復。';
    }
  }

  function restore() {
    if (!storage) return false;
    let raw;
    try { raw = storage.getItem(TABLE_STORAGE_KEY); }
    catch { storageWarning = '無法讀取本機儲存。'; return false; }
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !parsed.gameState) throw new Error('版本無效');
      validateGameState(parsed.gameState);
      state = parsed.gameState;
      return true;
    } catch {
      blockedStorage = true;
      storageWarning = '既有沙盒對局資料無效；已停止寫入，避免破壞原始資料。';
      return false;
    }
  }

  function start({ profileId, ruleVersion } = {}) {
    if (blockedStorage) throw new Error(storageWarning);
    const profile = getRuleProfile(profileId, ruleVersion);
    if (profile.scope !== 'four-player' || profile.status !== 'experimental')
      throw new Error('目前只能啟動明確標示的 experimental 四人沙盒');
    const seed = 'table-' + (globalThis.crypto?.randomUUID?.() ??
      String(Date.now()) + '-' + Math.floor(Math.random() * 1000000));
    const next = createGame({
      gameId: seed.replace(/[^A-Za-z0-9_-]/g, '-'),
      seed, profileId: profile.profileId, ruleVersion: profile.ruleVersion, dealerSeat: CURRENT_SEAT,
    });
    validateGameState(next);
    state = next;
    save(next);
    return snapshot();
  }

  function snapshot() {
    if (!state) return null;
    // DO NOT expose the state, wall, RNG, or opponents' concealed tiles.
    const view = createPlayerView(state, CURRENT_SEAT);
    if (view.opponents.some(p => Object.hasOwn(p, 'concealed')))
      throw new Error('PlayerView leaked hidden opponent tiles');
    return duplicate({
      view,
      wallRemaining: state.wall.length,
      profile: getRuleProfile(state.ruleRef.profileId, state.ruleRef.ruleVersion),
      botConnected: typeof botAdapter?.selectAction === 'function',
      replayConnected: typeof replayAdapter?.getTimeline === 'function',
      storageWarning,
      phase: 'experimental-draw-discard',
      result: null, // No official settlement result in this Rules version.
    });
  }

  function submit(submission) {
    if (!state) throw new Error('尚未開始對局');
    if (activeSubmission) throw new Error('上一個動作仍在處理');
    if (!isLegalSubmission(state, submission)) throw new Error('動作已過期或非正式合法選項');
    activeSubmission = true;
    try {
      // The canonical engine, not the UI, owns all transitions.
      const { state: next } = applyAction(state, {
        actorSeat: submission.actorSeat,
        actionId: submission.actionId,
        expectedRevision: submission.expectedRevision,
      });
      state = next;
      save(next);
      return snapshot();
    } finally { activeSubmission = false; }
  }

  async function advanceBots({ maxActions = 64 } = {}) {
    if (!state || state.round.currentSeat === CURRENT_SEAT) return snapshot();
    if (typeof botAdapter?.selectAction !== 'function') return snapshot();
    for (let i = 0; i < maxActions && state.round.currentSeat !== CURRENT_SEAT; i++) {
      const seat = state.round.currentSeat;
      const view = createPlayerView(state, seat);
      const proposed = await botAdapter.selectAction(duplicate(view));
      // Bot can only choose an exact engine-issued LegalAction.
      if (!isLegalSubmission(state, proposed) || proposed.actorSeat !== seat)
        throw new Error('Bot 回傳非合法或過期動作；已安全停止');
      submit(proposed);
    }
    return snapshot();
  }

  async function replay() {
    if (!state || typeof replayAdapter?.getTimeline !== 'function') return null;
    // Official provider must certify each historical PlayerView and finding.
    const result = await replayAdapter.getTimeline({ gameId: state.gameId, audienceSeat: CURRENT_SEAT });
    if (!result || result.verified !== true || !Array.isArray(result.frames)) return null;
    if (result.frames.some(f => !f.view || f.view.audienceSeat !== CURRENT_SEAT
      || f.view.opponents?.some(p => Object.hasOwn(p, 'concealed')))) return null;
    return duplicate(result);
  }

  return Object.freeze({ start, restore, snapshot, submit, advanceBots, replay, availableProfiles: availableTableProfiles });
}
