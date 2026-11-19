/** Phase 3 public-only composition.
 * Source modules are never rewritten here. No full GameState, future wall,
 * opponent concealed tiles or unverified scenario score crosses this facade.
 */
import * as learning from '../academy/index.js';
import { createMasterAcademyFacade, APPROVED_LEGACY_REGISTRY } from './master-academy-facade.js';
import { createDailyTrainingController } from '../adaptive/daily-training.js';
import { createReplayService } from '../replay/index.js';
import { createSandboxSession } from '../table-ui/session.js';

export const PHASE3_FACADE_VERSION='mahjong-full-game/0.1.0-experimental';
const clone=x=>JSON.parse(JSON.stringify(x));

export function createPhase3PublicFacade(storage,{
  timezone='Asia/Taipei',profileId='local-academy-profile',
}={}) {
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
    throw new TypeError('Explicit localStorage-compatible adapter required');
  const academy=createMasterAcademyFacade(storage);
  const daily=createDailyTrainingController(storage,{
    learning,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:learning.validateAcademyDecisionRecord,
    timezone,profileId,
  });
  const replay=createReplayService({storage});
  return Object.freeze({
    contractVersion:PHASE3_FACADE_VERSION,
    originalAcademyContract:academy.contractVersion,
    capabilities:Object.freeze({
      dailyCanonicalPublishedStructural:true,
      experimentalFourSeatRules:true,
      botPlayerViewOnly:true,
      historicalSandboxReplay:true,
      completeTaiwanRuleProfileVerified:false,
      settledThreeBotMatchVerified:false,
      claimWindowBotAutomationVerified:false,
      postgameFullReplayVerified:false,
      scenarioScorerVerified:false,
      humanSkillCalibrationVerified:false,
      physicalDeviceVerified:false,
      fullGamePreviewReady:false,
    }),
    academy,
    daily:Object.freeze({
      getToday:({asOf})=>clone(daily.readToday({asOf})),
      startToday:({asOf,minutes=30})=>clone(daily.ensureToday({asOf,minutes})),
      progress:({asOf})=>clone(daily.progress({asOf})),
      getQuestion:(ref,{asOf})=>clone(daily.getQuestion(ref,{asOf})),
      submit:(ref,choice,details)=>clone(daily.submit(ref,choice,details)),
    }),
    // A standalone experimental UI sandbox, intentionally NOT a full Bot match.
    createExperimentalTable:()=>createSandboxSession({storage}),
    replay:Object.freeze({
      list:()=>clone(replay.listReplays()),
      load:id=>clone(replay.loadReplay(id)),
      getHistoricalFrame:(id,eventSeq,{viewerSeat=0}={})=>
        clone(replay.getReplayFrame(id,eventSeq,{viewerSeat,perspective:'player-at-time'})),
      getAdvisoryAnalysis:(id,eventSeq,{viewerSeat=0}={})=>
        clone(replay.getDecisionAnalysis(id,eventSeq,{viewerSeat})),
    }),
  });
}
