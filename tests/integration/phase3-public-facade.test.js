import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase3PublicFacade,PHASE3_FACADE_VERSION } from '../../src/integration/phase3-public-facade.js';
import { LEGACY_SESSION_KEY, ARCHIVE_STORAGE_KEY } from '../../src/storage/archive.js';
class Store{
 constructor(){this.map=new Map();}
 getItem(k){return this.map.has(k)?this.map.get(k):null;}
 setItem(k,v){this.map.set(k,String(v));}
 removeItem(k){this.map.delete(k);}
}
const asOf='2026-11-20T04:00:00.000Z';
test('Phase 3 facade preserves V1 authority and keeps unverified game gates disabled',()=>{
 const store=new Store();const raw='[]';store.setItem(LEGACY_SESSION_KEY,raw);
 const facade=createPhase3PublicFacade(store);
 assert.equal(facade.contractVersion,PHASE3_FACADE_VERSION);
 assert.equal(facade.originalAcademyContract,'master-academy/1.0.0');
 assert.equal(facade.capabilities.completeTaiwanRuleProfileVerified,false);
 assert.equal(facade.capabilities.settledThreeBotMatchVerified,false);
 assert.equal(facade.capabilities.postgameFullReplayVerified,false);
 assert.equal(facade.capabilities.scenarioScorerVerified,false);
 assert.equal(store.getItem(LEGACY_SESSION_KEY),raw);
 assert.equal(store.getItem(ARCHIVE_STORAGE_KEY),null);
 assert.deepEqual(facade.replay.list(),[]);
});
test('Cross-module real Daily start survives a fresh V1 + Phase3 facade and retains one provenance authority',()=>{
 const storage=new Store(),first=createPhase3PublicFacade(storage);
 const s=first.daily.startToday({asOf,minutes:10});
 assert.equal(s.status,'planned');
 assert.ok(s.questionRefs.length>0);
 const second=createPhase3PublicFacade(storage);
 assert.deepEqual(second.daily.getToday({asOf}),s);
 assert.equal(second.daily.startToday({asOf,minutes:60}).sessionId,s.sessionId);
 assert.equal(second.academy.getTrainingSession().sessionId,s.sessionId);
 assert.equal(second.daily.progress({asOf}).completed,0);
 const question=second.daily.getQuestion(s.questionRefs[0],{asOf});
 assert.ok(['discard','tenpai','multi_wait'].includes(question.taskType));
 assert.equal(Object.hasOwn(question,'answerKey'),false);
});
test('Experimental Table is still a legal public seat view, not private GameState',()=>{
 const facade=createPhase3PublicFacade(new Store());
 const table=facade.createExperimentalTable();
 assert.equal(table.snapshot(),null);
 const profile=table.availableProfiles().find(p=>p.profileId==='tw16-four-player-sandbox');
 assert.ok(profile);
 const snapshot=table.start({profileId:profile.profileId,ruleVersion:profile.ruleVersion});
 assert.equal(snapshot.view.audienceSeat,0);
 assert.ok(snapshot.view.legalActions.length);
 assert.equal(Object.hasOwn(snapshot,'players'),false);
 assert.equal(Object.hasOwn(snapshot,'wall'),false);
 assert.equal(snapshot.botConnected,false);
 assert.equal(snapshot.replayConnected,false);
});
