import assert from 'node:assert/strict';

// Validate raw benchmark evidence before aggregation. Do not coerce missing
// measurements to zero or silently ignore unknown game modes.
const count=n=>Number.isSafeInteger(n)&&n>=0;
const bit=n=>n===0||n===1;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const seats=[0,1,2,3];

export function validateGameEvidence(g,seedSet,policies,phase,selected){
  assert.ok(seedSet.has(g.seed),'unknown game seed');
  assert.equal(g.gameId,'r73-game-'+g.seed);
  assert.equal(g.wallSeed,'r73-wall-'+g.seed);
  assert.equal(g.dealerSeat,g.seed%4);
  assert.equal(g.replayMatched,true);
  assert.equal(g.invalidActions,0);
  assert.ok(['win','exhaustive-draw'].includes(g.finish),'unknown terminal reason');
  assert.ok(Array.isArray(g.lineup)&&g.lineup.length===4,'invalid lineup');
  assert.ok(['baseline','paired','direct'].includes(g.mode),'unknown game mode');
  if(g.mode==='baseline'){
    assert.equal(g.target,null);
    assert.ok(g.lineup.every(p=>p==='legacy'));
  }else if(g.mode==='paired'){
    assert.ok(seats.includes(g.target));
    assert.ok(policies.includes(g.lineup[g.target]),'unknown paired policy');
    assert.ok(g.lineup.every((p,s)=>s===g.target||p==='legacy'));
  }else{
    assert.notEqual(phase,'calibration','unexpected direct match');
    assert.equal(g.target,null);
    assert.deepEqual([...g.lineup].sort(),['Beginner','Intermediate',selected||'combined','legacy'].sort());
  }
  assert.ok(Array.isArray(g.observations)&&g.observations.length===4,'four seat records required');
  for(const [seat,o] of g.observations.entries()){
    assert.equal(o.seat,seat,'seat observation order');
    assert.equal(o.policy,g.lineup[seat],'seat policy mismatch');
    assert.ok([o.won,o.dealIn,o.draw].every(bit),'invalid result flag');
    assert.ok(!(o.won&&o.dealIn),'winner cannot deal in');
    assert.ok(Number.isSafeInteger(o.score),'invalid score');
    for(const k of ['actions','discardActions','legalClaimWindows','claimActions','claimPasses','ownKongOffers','ownKongs'])
      assert.ok(count(o[k]),'invalid '+k);
    assert.ok(o.discardActions<=o.actions&&o.legalClaimWindows<=o.actions&&o.ownKongOffers<=o.actions);
    assert.ok(o.claimActions+o.claimPasses<=o.legalClaimWindows&&o.ownKongs<=o.ownKongOffers);
    assert.ok(Array.isArray(o.latencyMs)&&o.latencyMs.length===o.actions&&o.latencyMs.every(x=>finite(x)&&x>=0),'invalid latency evidence');
    assert.ok(Array.isArray(o.postDiscardShanten)&&o.postDiscardShanten.length===o.discardActions&&o.postDiscardShanten.every(Number.isInteger),'invalid shanten evidence');
    if(o.discardActions){
      const mean=o.postDiscardShanten.reduce((s,x)=>s+x,0)/o.discardActions;
      assert.equal(o.meanShanten,mean,'shanten mean mismatch');
    }else assert.equal(o.meanShanten,null);
  }
  const sum=k=>g.observations.reduce((s,o)=>s+o[k],0);
  assert.ok(count(g.actions)&&g.actions>0);
  assert.equal(sum('actions'),g.actions,'action count mismatch');
  assert.equal(sum('score'),0,'non-zero-sum match');
  assert.equal(sum('won'),g.finish==='win'?1:0,'winner count mismatch');
  assert.equal(sum('draw'),g.finish==='exhaustive-draw'?4:0,'draw flag mismatch');
  assert.ok(sum('dealIn')<=(g.finish==='win'?1:0),'deal-in count mismatch');
  if(g.finish==='exhaustive-draw')assert.ok(g.observations.every(o=>o.score===0),'draw must have zero settlement');
}

export function passesLatencyBudget(metrics){
  return count(metrics.decisionCount)&&metrics.decisionCount>0&&
    finite(metrics.p95DecisionMs)&&finite(metrics.p99DecisionMs)&&
    metrics.p95DecisionMs>=0&&metrics.p99DecisionMs>=metrics.p95DecisionMs&&
    metrics.p95DecisionMs<=50&&metrics.p99DecisionMs<=100;
}
