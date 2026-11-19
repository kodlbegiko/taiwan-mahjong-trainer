import { BANK_SPEC } from './catalog.js';
import { CONTRACT_VERSION, SCHEMA_VERSION, getSkillTag, assertContract } from './registry.js';
import { RULESET_VERSION } from '../training/exercises.js';

export const LEVELS=Object.freeze([
  { level:1,titleZhTW:'入門',description:'牌種、面子、將眼與十六張基本結構' },
  { level:2,titleZhTW:'熟練',description:'向聽、進張、何切與多面聽' },
  { level:3,titleZhTW:'進階',description:'拆搭、牌型變化與接近最佳答案比較' },
  { level:4,titleZhTW:'高手',description:'已知資訊與決策界線；攻防仍未驗證' },
  { level:5,titleZhTW:'大師挑戰',description:'結構牌效綜合檢核；非真人實力認證' }
]);
const topics=[
  ['牌種與數字索引','面子、搭子與將眼','台灣十六張結構','聽牌的必要條件'],
  ['向聽數的意義','有效進張與孤張','何切的評分次序','單面與多面聽'],
  ['拆搭選擇','牌型變化','一巡效率的精確範圍','接近最佳答案比較'],
  ['牌河是已知資訊','公開副露不代表暗牌已知','巡目與攻守的條件性','台數和速度不可混用評分'],
  ['多因素但僅限可驗證結構','限時答題不等於能力認證','提出可重播的理由','綜合測驗與未知因素']
];
const tags=[
  ['tiles.identity','structure.melds','structure.hand16','waits.enumeration'],
  ['efficiency.shanten','efficiency.ukeire','efficiency.discard','waits.multi'],
  ['efficiency.structure-change','efficiency.discard','efficiency.ukeire','efficiency.near-tie'],
  ['public.visible-count','strategy.open-meld','strategy.round-timing','strategy.scoring-tradeoff'],
  ['strategy.synthesis','efficiency.near-tie','efficiency.shanten','strategy.synthesis']
];
const notes=[
  [
    '數牌分為萬、筒、索，各一至九；字牌為東南西北中發白。牌碼固定 0–33，花牌不計入此索引。',
    '順子為同花色連續三張、刻子為三張相同、將眼為兩張相同；兩張相連或間隔一張只是搭子，尚未成為面子。',
    '本題庫只驗證未副露的五面子一將眼，共 17 張和牌形；平時可打出一張時持有 17 張，聽牌題取 16 張。',
    '聽牌表示加入一張可形成完整結構；不代表已驗證過水、放槍、自摸或地方桌規。'
  ],
  [
    '向聽數是距離可聽牌的結構步數；這裡沿用正式 shanten 演算法，不宣稱包含實際勝率。',
    '有效進張是能改善向聽的牌，剩餘張數須扣除手牌與題目已知明牌，不等同實際壁牌機率。',
    '何切先比較最低向聽，再比較有效進張枚數；同一最優數值的牌都可接受為最佳。',
    '多面聽需完整列出所有能和牌的牌種；多選、少選都會影響正式評分。'
  ],
  [
    '拆搭不能只看搭子張數，應枚舉每個合法棄牌候選的結構向聽與有效進張。',
    '一副手牌可有多種面子與將眼拆法；題庫比較的是演算法對整副牌的最佳結構結果。',
    '本版「一巡」只表示當前一摸的改善枚數；兩巡後分布需要獨立經驗證的模型，未納入正式答案。',
    '若兩張牌維持相同向聽，但有效進張不同，不能把較低進張選項稱作完全正確。'
  ],
  [
    '牌河能提供已公開的牌種與剩餘可用副本資訊；未公開壁牌及對手暗牌不可據此得知。',
    '吃碰槓牽涉座位、回合與補牌，尚待 Rules Engine 提供正式合法動作判定，本課只提供觀念。',
    '巡目可能改變攻守取捨，但目前無具人類校準的放槍風險模型；此課的練習只按結構牌效評分。',
    '台數與速度的權重受桌規及情境影響；沒有可驗證計分器時，不能把牌效率最高誤稱成總策略最佳。'
  ],
  [
    '請區分當前結構可精確計算的部分，與未知對手行為、牌壁、台數和風險的假設。',
    '限時可以用來練習決策節奏，但速度並不是人類麻將實力的經驗校準量表。',
    '解題理由應列出向聽與有效進張等可重播證據；推測對手意圖不能當作已證明事實。',
    '本級綜合題仍以既有三種結構牌效題為正式評分；複雜策略題需後續可信 scorer 才能計分。'
  ]
];
const ruleRef=Object.freeze({profileId:'legacy-exercise-v3-structural',ruleVersion:RULESET_VERSION});
export const LESSONS=Object.freeze(topics.flatMap((row,l)=>row.map((title,j)=>{
  const lessonId='academy-l'+(l+1)+'-'+String(j+1).padStart(2,'0');
  const depends=j?['academy-l'+(l+1)+'-'+String(j).padStart(2,'0')]:l?['academy-l'+l+'-04']:[];
  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    lessonId,lessonVersion:'1.0.0',titleZhTW:title,
    objectives:[notes[l][j]],skillTagIds:[tags[l][j]],
    prerequisiteLessonIds:depends,ruleRef,
    questionRefs:BANK_SPEC.filter(s=>s.lessonId===lessonId).map(s=>({questionId:s.questionId,questionVersion:s.questionVersion})),
    evidenceRefs:[{fixtureId:'academy-structural-bank-v1',sourceVersion:'legacy-exercise-v3'}],
    contentBlocks:[
      {kind:'text',content:notes[l][j]},
      {kind:'explanation',content:'本課正式作答只評估未副露結構：向聽、有效進張與聽張；任何攻守、台數及實際勝率仍需另行驗證。'},
      {kind:'tile-example',content:'依照題目顯示的 0–33 牌碼與實際手牌重播，不能把未公開資訊當成已知。'}
    ],
    status:l<3?'published':'validated'
  });
})));
export function listLessons({level,includeDraft=true}={}) {
  return LESSONS.filter(l=>(level==null || l.lessonId.startsWith('academy-l'+level+'-')) &&
    (includeDraft || l.status==='published')).map(l=>JSON.parse(JSON.stringify(l)));
}
export function getLessonPublic(id) {
  const lesson=LESSONS.find(l=>l.lessonId===id);
  return lesson?JSON.parse(JSON.stringify(lesson)):null;
}
export function validateLessons(lessons=LESSONS,questionRefs=null) {
  const map=new Map();
  for(const l of lessons){
    assertContract(l);
    if(!l.lessonId || map.has(l.lessonId) || !l.lessonVersion || !l.titleZhTW ||
       !Array.isArray(l.objectives) || !l.objectives.length ||
       !Array.isArray(l.skillTagIds) || !l.skillTagIds.length ||
       l.skillTagIds.some(id=>!getSkillTag(id)) ||
       !Array.isArray(l.prerequisiteLessonIds) || !Array.isArray(l.questionRefs) ||
       !Array.isArray(l.evidenceRefs) || !Array.isArray(l.contentBlocks) ||
       !l.contentBlocks.length ||
       l.contentBlocks.some(b=>!['text','tile-example','explanation'].includes(b.kind)||!b.content) ||
       !['draft','validated','published'].includes(l.status) ||
       l.ruleRef?.ruleVersion!==RULESET_VERSION) throw new RangeError('Lesson 欄位無效');
    if(questionRefs)for(const q of l.questionRefs)if(!questionRefs.has(q.questionId+'@'+q.questionVersion))throw new RangeError('Lesson 引用不存在題目');
    map.set(l.lessonId,l);
  }
  const visiting=new Set(),done=new Set();
  function visit(id){
    if(!map.has(id))throw new RangeError('未知先修課程');
    if(visiting.has(id))throw new RangeError('Lesson 先修循環');
    if(done.has(id))return;
    visiting.add(id);
    for(const dep of map.get(id).prerequisiteLessonIds)visit(dep);
    visiting.delete(id);done.add(id);
  }
  for(const id of map.keys())visit(id);
  return true;
}
