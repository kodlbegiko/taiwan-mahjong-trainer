import assert from 'node:assert/strict';
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {R73_VARIANTS} from '../../src/bots/strategy-r7.js';
import {validateGameEvidence,passesLatencyBudget} from './r74-evidence.js';
const [phase,inputDir,outPath]=process.argv.slice(2);
assert.ok(['calibration','validation','smoke'].includes(phase));
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(join(d,x.name)):[join(d,x.name)]);
const batches=walk(inputDir).filter(x=>x.endsWith('.json')).map(x=>JSON.parse(readFileSync(x,'utf8')));
const expected=phase==='calibration'?4:phase==='validation'?10:1;
const start=phase==='calibration'?1000:phase==='validation'?2000:3000;
const n=phase==='calibration'?20:phase==='validation'?100:1;
assert.equal(batches.length,expected,'Missing batches; no partial promotion');
const seeds=batches.flatMap(b=>b.seeds).sort((a,b)=>a-b);
assert.deepEqual(seeds,Array.from({length:n},(_,i)=>start+i));
const sha=batches[0].sourceSHA,profile=batches[0].profile,scoring=batches[0].scoring;
const selected=batches[0].selected;
assert.deepEqual(profile,{profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'});
assert.equal(scoring,'tw16-minimal-tai-v1');
assert.ok(sha===null||/^[0-9a-f]{40}$/.test(sha),'invalid source SHA');
assert.ok(phase==='validation'?R73_VARIANTS.includes(selected):selected===null,'invalid frozen candidate');
for(const b of batches){
  assert.equal(b.schema,'r73-benchmark/1.0');assert.equal(b.phase,phase);assert.equal(b.failure,null);
  assert.equal(b.sourceSHA,sha);assert.deepEqual(b.profile,profile);assert.equal(b.scoring,scoring);
  assert.equal(b.selected,selected);
  assert.ok(b.games.every(g=>g.replayMatched===true&&g.invalidActions===0&&b.seeds.includes(g.seed)));
}
const games=batches.flatMap(b=>b.games),mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const keys=['won','dealIn','draw','score','meanShanten'];
const policies=phase==='calibration'?['Advanced',...R73_VARIANTS]:['Beginner','Intermediate','Advanced',selected||'combined'];
assert.equal(games.length,n*(phase==='calibration'?17:21),'unexpected total game count');
const base=new Map(),paired=new Map();
const seedSet=new Set(seeds);
for(const g of games){
  validateGameEvidence(g,seedSet,policies,phase,selected);
  if(g.mode==='baseline'){
    assert.equal(g.lineup.join(','),'legacy,legacy,legacy,legacy');
    assert.ok(!base.has(g.seed));base.set(g.seed,g);
  }else if(g.mode==='paired'){
    const key=g.seed+':'+g.target+':'+g.lineup[g.target];
    assert.ok(!paired.has(key));paired.set(key,g);
    assert.ok(g.lineup.every((p,s)=>s===g.target||p==='legacy'));
  }
}
assert.equal(base.size,n);assert.equal(paired.size,n*4*policies.length);
const flat=(gs,policy)=>gs.flatMap(g=>g.observations.filter(o=>o.policy===policy).map(o=>({...o,seed:g.seed})));
const percentile=(a,p)=>a.length?a[Math.max(0,Math.ceil(p*a.length)-1)]:null;
function summarize(rows){
 assert.ok(rows.length,'empty policy observations');
 const times=rows.flatMap(r=>r.latencyMs).sort((a,b)=>a-b);
 const sh=rows.map(r=>r.meanShanten).filter(Number.isFinite);
 return {hands:rows.length,wins:rows.reduce((s,r)=>s+r.won,0),winRate:mean(rows.map(r=>r.won)),
   dealInRate:mean(rows.map(r=>r.dealIn)),drawRate:mean(rows.map(r=>r.draw)),
   meanScore:mean(rows.map(r=>r.score)),meanPostDiscardShanten:sh.length?mean(sh):null,
   shantenHands:sh.length,meanDecisionMs:times.length?mean(times):null,p95DecisionMs:percentile(times,.95),
   p99DecisionMs:percentile(times,.99),maxDecisionMs:times.at(-1),
   fractionOver50ms:times.length?mean(times.map(x=>x>50?1:0)):null,decisionCount:times.length,
   claimWindows:rows.reduce((s,r)=>s+r.legalClaimWindows,0),
   claims:rows.reduce((s,r)=>s+r.claimActions,0),claimPasses:rows.reduce((s,r)=>s+r.claimPasses,0),
   ownKongOffers:rows.reduce((s,r)=>s+r.ownKongOffers,0),ownKongs:rows.reduce((s,r)=>s+r.ownKongs,0)};
}
// Fixed PRNG bootstrap over independent seed clusters, preserving all seats
// in each draw. Percentile intervals exploratory (especially small n).
function interval(values){
 if(values.length<2)return {estimate:mean(values),ci95:null,n:values.length};
 let rng=0x773caa91;const samples=[];
 for(let b=0;b<4000;b++){
   let sum=0;
   for(let i=0;i<values.length;i++){
     rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;
     sum+=values[(rng>>>0)%values.length];
   }
   samples.push(sum/values.length);
 }
 samples.sort((a,b)=>a-b);
 return {estimate:mean(values),ci95:[percentile(samples,.025),percentile(samples,.975)],n:values.length};
}
const control=seeds.flatMap(seed=>base.get(seed).observations.map(o=>({...o,seed})));
const target={};
for(const p of policies){
 const rows=seeds.flatMap(seed=>[0,1,2,3].map(seat=>{
   const g=paired.get(seed+':'+seat+':'+p);
   assert.ok(g);const b=base.get(seed);
   for(const k of ['gameId','wallSeed','dealerSeat'])assert.equal(g[k],b[k]);
   return {...g.observations[seat],seed};
 }));
 target[p]={rows,metrics:summarize(rows)};
}
function compare(a,b){
 const result={};
 for(const k of keys){
   const deltas=[];
   for(const seed of seeds){
     const x=a.filter(r=>r.seed===seed&&Number.isFinite(r[k])).map(r=>r[k]);
     const y=b.filter(r=>r.seed===seed&&Number.isFinite(r[k])).map(r=>r[k]);
     if(x.length&&y.length)deltas.push(mean(x)-mean(y));
   }
   result[k]=deltas.length?interval(deltas):null;
 }
 return result;
}
const comparisons=Object.fromEntries(policies.map(p=>[p,{
 metrics:target[p].metrics,vsLegacy:compare(target[p].rows,control),
 vsOldAdvanced:compare(target[p].rows,target.Advanced.rows)}]));
let selection=null;
if(phase==='calibration'){
 const options=R73_VARIANTS.map(variant=>({variant,delta:comparisons[variant].vsOldAdvanced.score.estimate,
   dealInDelta:comparisons[variant].vsOldAdvanced.dealIn.estimate}));
 const eligible=options.filter(x=>x.delta>0&&x.dealInDelta<=.05);
 const pool=eligible.length?eligible:options;
 pool.sort((a,b)=>b.delta-a.delta||a.dealInDelta-b.dealInDelta||a.variant.localeCompare(b.variant));
 selection={variant:pool[0].variant,calibrationEligible:eligible.length>0,
   rule:'highest paired mean score gain vs old Advanced, require positive gain and deal-in increase <=5pp; otherwise evaluate best exploratory candidate only',options};
}
const direct=games.filter(g=>g.mode==='direct');
let directComparison=null;
if(phase!=='calibration'){
 assert.equal(direct.length,n*4);
 const roster=['Beginner','Intermediate',selected||'combined','legacy'];
 for(const seed of seeds)for(const seat of [0,1,2,3]){
   const rows=direct.filter(g=>g.seed===seed);
   assert.equal(new Set(rows.map(g=>g.lineup[seat])).size,4);
   assert.ok(rows.every(g=>roster.every(p=>g.lineup.includes(p))));
 }
 directComparison=Object.fromEntries(roster.map(p=>[p,{metrics:summarize(flat(direct,p)),
  vsIntermediate:compare(flat(direct,p),flat(direct,'Intermediate'))}]));
}
const report={schema:'r73-report/1.0',sourceSHA:sha,phase,seedCount:n,seeds,profile,scoring,
 actualGames:games.length,pairedObservationsPerPolicy:4*n,baseline:summarize(control),comparisons,
 selection,selectedVariant:phase==='validation'?selected:null,direct:directComparison,
 invalidActions:0,replayMatches:games.length,
 perfBudget:{scope:'Node runner, not phone',p95Ms:50,p99Ms:100,
   passByPolicy:Object.fromEntries(policies.map(p=>[p,passesLatencyBudget(target[p].metrics)]))},
 note:'No promotion: calibration is exploratory; independent validation score CI, deal-in risk, latency and integrated/mobile gates must be reviewed. No calibrated risk probabilities.'};
mkdirSync(dirname(outPath),{recursive:true});writeFileSync(outPath,JSON.stringify(report,null,2));
console.log('BOT_R73_REPORT '+JSON.stringify(report));
