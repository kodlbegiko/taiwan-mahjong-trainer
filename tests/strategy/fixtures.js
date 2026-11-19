import { CONTRACT_VERSION } from '../../src/strategy/view.js';

const V=1;
const tileIdentity = (tile,copyIndex) => ({
  schemaVersion:V,contractVersion:CONTRACT_VERSION,
  id:'t:'+tile+':'+copyIndex,kind:'standard',tileType:tile,copyIndex,
});
const ruleRef={profileId:'fixture-structural-16',ruleVersion:'fixture/1.0.0'};
const handTypes=[0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28];
export function makePlayerView({public28=false,legalClaims=false}={}) {
  const used=Array(34).fill(0);
  const concealed=handTypes.map(t=>tileIdentity(t,used[t]++));
  const legalActions=[...new Set(handTypes)].map(t=>{
    const physical=concealed.find(x=>x.tileType===t).id;
    return {
      schemaVersion:V,contractVersion:CONTRACT_VERSION,
      actionId:'discard:'+physical,kind:'discard',actorSeat:0,expectedRevision:4,
      tileIds:[physical],ruleRef:{...ruleRef},
      legalityBasis:{engineVersion:'fixture-legal/1',reasonCodes:['FIXTURE_DISCARD']},
    };
  });
  if (legalClaims) legalActions.push({
    schemaVersion:V,contractVersion:CONTRACT_VERSION,
    actionId:'pong:fixture',kind:'pong',actorSeat:0,expectedRevision:4,
    tileIds:['t:28:0','t:28:1','t:28:2'],claimEventId:'claim-fixture',
    ruleRef:{...ruleRef},legalityBasis:{engineVersion:'fixture-legal/1',reasonCodes:['FIXTURE_ONLY']},
  });
  return {
    schemaVersion:V,contractVersion:CONTRACT_VERSION,
    viewId:'v-fixture-4',gameId:'g-fixture',ruleRef:{...ruleRef},audienceSeat:0,asOfEventSeq:4,
    round:{
      schemaVersion:V,contractVersion:CONTRACT_VERSION,
      roundId:'round-fixture',handIndex:0,dealerSeat:0,currentSeat:0,
      phase:'await_discard',lastPublicEventSeq:4,
    },
    self:{seat:0,concealed,melds:[],river:[],flowers:[]},
    opponents:[1,2,3].map(seat=>({
      seat,concealedCount:16,melds:[],
      river:public28 && seat===1 ? [{tileId:'t:28:2',seq:3}] : [],
      flowers:[],
    })),
    publicEvents:[],legalActions,knownUnavailableTypes:[],
    capabilities:{structuralScore:true,roundActions:false,settlement:false},
  };
}
export { handTypes };
