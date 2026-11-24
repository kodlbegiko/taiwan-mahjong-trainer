import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,createDeck,getRuleProfile,listLegalActions,applyAction,
  replayGame,createPlayerView,validateGameState,
} from '../../src/rules/index.js';
import {createReplayService,ReplayError} from '../../src/replay/index.js';
import {createReplayArchive,validateReplayArchive,checksum} from '../../src/replay/internal.js';
import {prepareVerifiedAdaptiveEvidence} from '../../src/scenario/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const profile=getRuleProfile(REF.profileId,REF.ruleVersion);
const copies=(type,count)=>Array.from({length:count},(_,i)=>'t:'+type+':'+i);
const triplets=()=>[0,1,2,3,4].flatMap(t=>copies(t,3));
const clone=x=>JSON.parse(JSON.stringify(x));
function arrangedDeck(seats={},liveFirst=[]) {
  const all=createDeck(profile),standard=all.filter(x=>x.startsWith('t:'));
  const sizes=[17,16,16,16],configured=Array.from({length:4},(_,i)=>[...(seats[i]||[])]);
  const taken=new Set([...configured.flat(),...liveFirst]);
  assert.equal(taken.size,configured.flat().length+liveFirst.length,'unique physical fixture');
  for(let seat=0;seat<4;seat++) {
    assert.ok(configured[seat].length<=sizes[seat]);
    for(const id of standard) {
      if(configured[seat].length===sizes[seat])break;
      if(!taken.has(id)){taken.add(id);configured[seat].push(id);}
    }
    assert.equal(configured[seat].length,sizes[seat]);
  }
  const dealer=[...configured[0]],extra=dealer.pop();
  const deck=[...dealer,...configured[1],...configured[2],...configured[3],extra,
    ...liveFirst,...all.filter(id=>!taken.has(id))];
  assert.equal(new Set(deck).size,144);
  assert.deepEqual(new Set(deck),new Set(all));
  return deck;
}
function fixed(seats={},tag='default',liveFirst=[]) {
  return createGame({gameId:'r3-replay-'+tag,seed:'r3-golden-'+tag,
    fixtureDeck:arrangedDeck(seats,liveFirst),dealerSeat:0,...REF});
}
function act(state,seat,kind,tile,reason) {
  const a=listLegalActions(state,seat).find(x=>x.kind===kind&&
    (tile===undefined||x.tileIds.includes(tile))&&
    (reason===undefined||x.legalityBasis.reasonCodes.includes(reason)));
  assert.ok(a,'missing legal '+kind+' seat '+seat+' phase '+state.round.phase);
  return applyAction(state,{actorSeat:seat,actionId:a.actionId,
    expectedRevision:a.expectedRevision}).state;
}
function resolve(state,choice={}) {
  const from=state.extensions.tw16.window.fromSeat;
  for(let seat=0;seat<4;seat++) {
    if(seat===from)continue;
    const c=choice[seat]||{};
    state=act(state,seat,c.kind||'pass',c.tile,c.reason);
  }
  return state;
}
const service=(state,ownerSeat=0,disclosurePolicy='none')=>{
  const store=new Map([['tw-mahjong-trainer:archive:v3','untouched']]);
  const api=createReplayService({storage:store});
  const manifest=api.saveReplay(state,{ownerSeat,disclosurePolicy});
  return {api,manifest,store};
};
const code=(fn,expected)=>assert.throws(fn,e=>e instanceof ReplayError&&e.code===expected);

test('R3 self-win+settlement is one atomic decision; owner historical and opted-in postgame separation',()=>{
  const s=fixed({0:[...triplets(),...copies(5,2)]},'selfwin');
  const end=act(s,0,'win',undefined,'SELF_DRAW_WIN');
  assert.equal(end.round.phase,'settled');
  assert.deepEqual(end.events.slice(-2).map(e=>e.type),['win','settle']);
  const {api,manifest}=service(end,0,'settled-public-only');
  assert.equal(manifest.completionStatus,'settled-experimental');
  assert.equal(manifest.ruleStatus,'experimental');
  assert.equal(manifest.postgameAvailable,true);
  assert.equal(manifest.actionCount,1);
  assert.deepEqual(api.listReplayFrameBoundaries(manifest.replayId,{viewerSeat:0}),[1,3]);
  code(()=>api.listReplayFrameBoundaries(manifest.replayId,{viewerSeat:1}),'VIEW_FORBIDDEN');
  assert.equal(manifest.settlementResultRef.eventSeq,end.revision);
  assert.equal(JSON.stringify(manifest).includes(end.rng.seed),false);
  assert.equal(JSON.stringify(manifest).includes('fixtureDeck'),false);
  code(()=>api.getReplayFrame(manifest.replayId,end.revision-1),'NON_ATOMIC_EVENT_SEQ');
  const past=api.getReplayFrame(manifest.replayId,1);
  assert.equal(past.playerView.round.phase,'await_discard');
  assert.equal(past.postgameDisclosure,null);
  assert.deepEqual(past.playerView,createPlayerView(s,0,1));
  const d=api.getPlayerDecision(manifest.replayId,2);
  assert.equal(d.kind,'win');
  assert.equal(d.beforeEventSeq,1);
  assert.equal(d.endEventSeq,3);
  assert.deepEqual(api.getPlayerDecision(manifest.replayId,3),d);
  const analysis=api.getDecisionAnalysis(manifest.replayId,2);
  assert.deepEqual(api.getDecisionAnalysis(manifest.replayId,3),analysis,
    'start and end of one atomic action must have identical coaching provenance');
  assert.equal(analysis.eventSeq,2);
  assert.equal(analysis.sourceViewRef.asOfEventSeq,1);
  assert.equal(analysis.analysisStatus,'advisory-legal-only');
  assert.equal(analysis.officialScorerVerified,false);
  assert.equal(analysis.epistemic.winRate,'unknown');
  assert.ok(analysis.candidates.every(c=>c.metrics.some(m=>
    m.name==='dealInRisk'&&m.value===null&&m.epistemic==='unknown')));
  const post=api.getReplayFrame(manifest.replayId,1,{perspective:'postgame'});
  assert.deepEqual(post.playerView,past.playerView,'postgame must not rewrite historical view');
  assert.equal(post.postgameDisclosure.allowedForDecisionScoring,false);
  assert.equal(post.postgameDisclosure.status,'experimental-not-certified');
  assert.deepEqual(post.postgameDisclosure.outcome.delta,[540,-180,-180,-180]);
  assert.equal(JSON.stringify(post).includes('fixtureDeck'),false);
  code(()=>api.getReplayFrame(manifest.replayId,1,{viewerSeat:1, perspective:'postgame'}),'VIEW_FORBIDDEN');
  const noOpt=service(end).api;
  code(()=>noOpt.getReplayFrame(manifest.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  assert.deepEqual(replayGame(end),end);
});

test('R3 contested chi/pong claim and pass group: no hidden intent or future meld in historical frame',()=>{
  let s=fixed({0:['t:4:3'],1:['t:3:0','t:5:0'],2:['t:4:0','t:4:1']},'claim');
  s=act(s,0,'discard','t:4:3');
  const before=s.revision;
  s=act(s,1,'chi');
  const chiSeq=s.revision;
  s=act(s,2,'pong');
  const pongSeq=s.revision;
  s=act(s,3,'pass');
  assert.equal(s.round.phase,'await_discard');
  assert.equal(s.players[2].melds.at(-1).kind,'triplet');
  const responder=service(s,3);
  code(()=>responder.api.getReplayFrame(responder.manifest.replayId,s.revision-1),
    'NON_ATOMIC_EVENT_SEQ');
  const lastAction=responder.api.getPlayerDecision(responder.manifest.replayId,s.revision);
  assert.equal(lastAction.kind,'pass');
  assert.equal(lastAction.endEventSeq,s.revision);
  assert.equal(lastAction.eventSeq,s.revision-1);
  const defender=service(s,2);
  assert.notDeepEqual(defender.api.getReplayFrame(defender.manifest.replayId,before).playerView.self.concealed,
    service(s,1).api.getReplayFrame('replay:'+s.gameId,before).playerView.self.concealed,
    'each replay owner receives a distinct seat-scoped historical concealed hand');
  const {api,manifest}=service(s,1);
  const initial=api.getReplayFrame(manifest.replayId,before);
  const declared=api.getReplayFrame(manifest.replayId,chiSeq);
  assert.equal(initial.playerView.opponents.some(p=>p.melds.length),false);
  assert.equal(declared.playerView.opponents.some(p=>p.melds.length),false);
  assert.equal(JSON.stringify(declared).includes('"tileIds":["t:3:0","t:5:0"'),false);
  assert.equal(declared.playerView.publicEvents.at(-1).type,'claim');
  assert.deepEqual(declared.playerView.publicEvents.at(-1).payload,{});
  const done=api.getReplayFrame(manifest.replayId,s.revision);
  assert.equal(done.playerView.opponents.find(p=>p.seat===2).melds.length,1);
  assert.deepEqual(done.playerView,createPlayerView(s,1));
  assert.equal(api.getPlayerDecision(manifest.replayId,chiSeq).kind,'chi');
  assert.equal(api.getDecisionAnalysis(manifest.replayId,chiSeq).analysisStatus,'advisory-legal-only');
  code(()=>api.getDecisionAnalysis(manifest.replayId,pongSeq),'VIEW_FORBIDDEN');
  assert.equal(manifest.completionStatus,'incomplete');
  code(()=>api.getReplayFrame(manifest.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
});

test('R3 successful chi and open kong expose only Rules-public resolved melds at action boundaries',()=>{
  let chi=fixed({0:['t:4:3'],1:['t:3:0','t:5:0']},'actual-chi');
  chi=act(chi,0,'discard','t:4:3');
  const before=chi.revision;
  chi=resolve(chi,{1:{kind:'chi'}});
  const a=service(chi,1);
  const prior=a.api.getReplayFrame(a.manifest.replayId,before);
  assert.equal(prior.playerView.self.melds.length,0);
  const last=a.api.getReplayFrame(a.manifest.replayId,chi.revision);
  assert.equal(last.playerView.self.melds.length,1);
  assert.equal(last.playerView.self.melds[0].kind,'sequence');
  assert.equal(chi.round.currentSeat,1);
  assert.equal(chi.round.phase,'await_discard');
  assert.equal(a.api.getPlayerDecision(a.manifest.replayId,before+1).kind,'chi');
  assert.deepEqual(last.playerView,createPlayerView(chi,1));

  let open=fixed({0:['t:4:3'],1:['t:4:0','t:4:1','t:4:2']},'open-kong');
  open=act(open,0,'discard','t:4:3');
  open=resolve(open,{1:{kind:'kong',reason:'OPEN_KONG'}});
  assert.equal(open.round.phase,'replacement');
  assert.equal(open.players[1].melds.at(-1).kind,'kong');
  assert.equal(open.players[1].melds.at(-1).open,true);
  const k=service(open,1);
  assert.equal(k.api.getReplayFrame(k.manifest.replayId,open.revision)
    .playerView.self.melds.at(-1).kind,'kong');
  assert.equal(k.api.getDecisionAnalysis(k.manifest.replayId,3).analysisStatus,
    'advisory-legal-only');
  open=act(open,1,'draw',undefined,'TAIL_KONG_REPLACEMENT');
  const supplemented=service(open,1);
  assert.deepEqual(supplemented.api.getReplayFrame('replay:'+open.gameId,open.revision)
    .playerView,createPlayerView(open,1));
  assert.deepEqual(replayGame(open),open);
});

test('R3 concealed kong, replacement draw and flower replacement project correct full-round boundaries',()=>{
  let kong=fixed({0:copies(6,4)},'kong');
  kong=act(kong,0,'kong',undefined,'CONCEALED_KONG');
  const kseq=kong.revision;
  kong=act(kong,0,'draw',undefined,'TAIL_KONG_REPLACEMENT');
  const {api,manifest}=service(kong);
  assert.equal(api.getReplayFrame(manifest.replayId,kseq).playerView.self.melds[0].kind,'kong');
  assert.deepEqual(api.getReplayFrame(manifest.replayId,kong.revision).playerView,
    createPlayerView(kong,0));
  const replacement=api.getPlayerDecision(manifest.replayId,kong.revision);
  assert.equal(replacement.kind,'draw');
  assert.equal(api.getDecisionAnalysis(manifest.replayId,kseq).officialScorerVerified,false);
  const flowerId=createDeck(profile).find(id=>id.startsWith('f:'));
  let flower=fixed({0:[flowerId]},'flower');
  assert.equal(flower.round.phase,'replacement');
  flower=act(flower,0,'replace_flower',flowerId);
  const sf=service(flower);
  assert.ok(sf.api.getReplayFrame(sf.manifest.replayId,flower.revision)
    .playerView.self.flowers.some(x=>x.id===flowerId));
  assert.equal(sf.api.getPlayerDecision(sf.manifest.replayId,2).kind,'replace_flower');
  assert.equal(validateGameState(flower),true);
});

test('R3 discard-win settlement remains experimental; all source mutation and unknown scorer fail closed',()=>{
  let s=fixed({0:['t:5:1'],1:[...triplets(),'t:5:0']},'ron');
  s=act(s,0,'discard','t:5:1');
  s=resolve(s,{1:{kind:'win',tile:'t:5:1'}});
  assert.equal(s.round.phase,'settled');
  const {api,manifest,store}=service(s,1,'settled-public-only');
  assert.equal(manifest.completionStatus,'settled-experimental');
  assert.deepEqual(api.getReplayFrame(manifest.replayId,1,{perspective:'postgame'})
    .postgameDisclosure.outcome.delta,[-140,140,0,0]);
  const win=api.getPlayerDecision(manifest.replayId,
    s.events.find(e=>e.type==='claim'&&e.visibility==='seat-private').seq);
  assert.equal(win.kind,'win');
  assert.equal(win.endEventSeq,win.eventSeq,'the win declaration is a single private event');
  assert.equal(s.events.at(-1).causedByActionId,s.events.at(-2).causedByActionId,
    'last response owns the atomic win-and-settle group');
  const archived=createReplayArchive(s,{ownerSeat:1,disclosurePolicy:'settled-public-only'});
  const forged=clone(archived);
  forged.events[1].turnEvent.payload.tileId='t:9:0';
  forged.manifest.integrity.eventsChecksum=checksum(forged.events);
  code(()=>validateReplayArchive(forged),'CORRUPT_REPLAY');
  const forbidden=clone(archived);
  forbidden.manifest.completionStatus='settled-verified';
  code(()=>validateReplayArchive(forbidden),'CORRUPT_REPLAY');
  const qState=fixed({},'unscored');
  const qs=act(qState,0,'discard');
  const q=service(qs).api.createReviewQuestion('replay:'+qs.gameId,2);
  assert.equal(q.status,'unscorable');
  code(()=>prepareVerifiedAdaptiveEvidence({record:{},question:q,finding:{}}),'UNVERIFIED_SCORER');
  assert.equal(store.get('tw-mahjong-trainer:archive:v3'),'untouched');
});

test('R3 incomplete draw / all claim-pass / arbitrary boundary frames and no future wall disclosure',()=>{
  let s=fixed({},'draw');
  let passes=0,draws=0;
  for(let n=0;n<420&&s.round.phase!=='settled';n++){
    const phase=s.round.phase;
    let seat,kind;
    if(phase==='claim_window'){
      const from=s.extensions.tw16.window.fromSeat;
      seat=[0,1,2,3].find(i=>i!==from&&!s.extensions.tw16.window.decisions.some(d=>d.seat===i));
      kind='pass';passes++;
    }else{
      seat=s.round.currentSeat;
      kind=phase==='replacement'
        ?(listLegalActions(s,seat).some(a=>a.kind==='replace_flower')?'replace_flower':'draw')
        :phase==='await_draw'?'draw':'discard';
      if(kind==='draw')draws++;
    }
    s=act(s,seat,kind);
  }
  assert.equal(s.round.phase,'settled','full draw fixture must exhaust live wall');
  assert.equal(s.extensions.tw16.result.reason,'exhaustive-draw');
  assert.ok(passes>0&&draws>0);
  const {api,manifest}=service(s,0,'settled-public-only');
  assert.equal(manifest.completionStatus,'settled-experimental');
  assert.equal(api.getReplayFrame(manifest.replayId,1).playerView.publicEvents.length,1);
  const end=api.getReplayFrame(manifest.replayId,s.revision);
  assert.equal(end.playerView.round.phase,'settled');
  const result=api.getReplayFrame(manifest.replayId,1,{perspective:'postgame'});
  assert.equal(result.postgameDisclosure.outcome.reason,'exhaustive-draw');
  assert.deepEqual(result.postgameDisclosure.outcome.delta,[0,0,0,0]);
  assert.equal(JSON.stringify(api.listReplays()).includes(s.rng.seed),false);
  assert.equal(JSON.stringify(end).includes('fixtureDeck'),false);
  assert.deepEqual(api.getReplayFrame(manifest.replayId,5),api.getReplayFrame(manifest.replayId,5));
});

test('R7.4 review and coaching use one verified storage snapshot and preserve original bytes',()=>{
  const initial=fixed({},'single-snapshot'),end=act(initial,0,'discard');
  const map=new Map();
  let reads=0;
  const storage={getItem(key){if(key.startsWith('tw-mahjong-replay:archive:v1:'))reads++;return map.get(key)??null;},
    setItem(key,value){map.set(key,String(value));}};
  const api=createReplayService({storage}),manifest=api.saveReplay(end,{ownerSeat:0});
  const key='tw-mahjong-replay:archive:v1:'+manifest.replayId,original=map.get(key);
  const decision=api.getPlayerDecision(manifest.replayId,2);
  reads=0;
  const scenario=api.createReviewQuestion(manifest.replayId,decision.endEventSeq);
  assert.equal(reads,1,'review must not read a second potentially changed archive');
  assert.equal(scenario.source.eventSeq,decision.eventSeq);
  assert.equal(scenario.prompt.playerView.asOfEventSeq,decision.beforeEventSeq);
  assert.equal(scenario.prompt.playerView.viewId,decision.sourceViewRef.viewId);
  assert.equal(scenario.status,'unscorable');
  assert.equal(scenario.canRecordOfficialAnswer,false);
  reads=0;
  api.listCoachingFindings(manifest.replayId);
  assert.equal(reads,1,'coaching must use one verified snapshot');
  assert.equal(map.get(key),original);
  map.set(key,original.slice(0,-1));
  assert.throws(()=>api.createReviewQuestion(manifest.replayId,decision.endEventSeq),
    e=>e instanceof ReplayError&&e.code==='CORRUPT_REPLAY');
});
