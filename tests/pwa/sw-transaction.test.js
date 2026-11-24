import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const base = 'https://test.invalid/app/';
const version = source.match(/const CACHE_VERSION = '([^']+)'/)[1];
const candidate = 'tmt-shell-' + version, old = 'tmt-shell-previous';
const urls = [...source.slice(source.indexOf('const SHELL = ['),source.indexOf('].map(path')).matchAll(/'\.\/([^']*)'/g)].map(m=>new URL(m[1],base).href);
function harness(fault='none', script=source) {
  const stores = new Map([[old,new Map([[base+'index.html','old bytes']])],['other-cache',new Map([['https://test.invalid/other/index.html','other']])],['tmt-shell-other-app',new Map([['https://test.invalid/other/index.html','other']])]]);
  const timeline = [], handlers = new Map();
  let writes=0, claims=0, skips=0;
  const cache = name => ({
    async put(url, response) {
      timeline.push(['put',name,url]);
      if (fault==='put' && ++writes===3) throw Error('QuotaExceededError');
      if (!(fault==='missing-put' && url===urls[3])) stores.get(name).set(url,response);
    },
    async keys() {
      if (fault==='keys' && name===candidate) throw Error('keys failed');
      return [...stores.get(name).keys()].map(url=>({url}));
    }
  });
  const caches = {
    async has(name){return stores.has(name);},
    async open(name){timeline.push(['open',name]);if(!stores.has(name))stores.set(name,new Map());return cache(name);},
    async keys(){return [...stores.keys()];},
    async delete(name){timeline.push(['delete',name]);return stores.delete(name);},
    async match(url,{cacheName}){return stores.get(cacheName)?.get(url);}
  };
  const self={location:{href:base+'sw.js'},addEventListener:(k,v)=>handlers.set(k,v),
    clients:{claim:async()=>{claims++;timeline.push(['claim']);}},skipWaiting:async()=>{skips++;}};
  const fetch=async url=>{
    timeline.push(['fetch',url]);
    if(fault==='network' && url===urls[3])throw Error('network disconnected');
    return {ok:!(fault==='404'&&url===urls[3]),status:fault==='404'&&url===urls[3]?404:200,
      type:'basic',redirected:false,clone:()=>({arrayBuffer:async()=>{
        if(fault==='truncated'&&url===urls[3])throw Error('body truncated');
        return new ArrayBuffer(fault==='empty'&&url===urls[3]?0:1);
      }})};
  };
  vm.runInNewContext(script,{self,caches,fetch,URL,Response,console:{info(){},warn(){}}});
  async function dispatch(type,extra={}){
    let lifetime;handlers.get(type)({...extra,waitUntil:p=>{lifetime=p;}});
    assert.ok(lifetime,'missing waitUntil '+type);await lifetime;
  }
  return {stores,timeline,dispatch,cache,caches,handlers,claims:()=>claims,skips:()=>skips};
}
for (const fault of ['404','network','truncated','empty','put','keys','missing-put']){
  test('SW rollback preserves old and unrelated caches: '+fault,async()=>{
    const h=harness(fault);const before=[...h.stores.keys()];
    await assert.rejects(h.dispatch('install'));
    assert.deepEqual([...h.stores.keys()],before);
    assert.equal(h.stores.get(old).get(base+'index.html'),'old bytes');
    assert.equal(h.claims(),0);
    if(['404','network','truncated','empty'].includes(fault))
      assert.equal(h.timeline.some(x=>x[0]==='open'),false,'network preflight must not create staging cache');
    else assert.equal(h.timeline.filter(x=>x[0]==='delete').at(-1)[1],candidate);
    console.log(JSON.stringify({fault,before,after:[...h.stores.keys()],events:h.timeline.filter(x=>x[0]!=='fetch'&&x[0]!=='put')}));
  });
}
test('duplicate version cannot overwrite active or waiting cache',async()=>{
  const h=harness();h.stores.set(candidate,new Map([[base+'index.html','valid existing bytes']]));
  await assert.rejects(h.dispatch('install'),/already exists/);
  assert.equal(h.stores.get(candidate).get(base+'index.html'),'valid existing bytes');
  assert.equal(h.timeline.length,0);
});
test('successful install waits; activation removes only retired same-scope cache',async()=>{
  const h=harness();await h.dispatch('install');
  assert.equal(h.stores.get(candidate).size,urls.length);assert.ok(h.stores.has(old));assert.equal(h.claims(),0);
  await h.dispatch('message',{data:{type:'SKIP_WAITING'}});assert.equal(h.skips(),1);
  await h.dispatch('activate');assert.equal(h.claims(),1);
  assert.deepEqual([...h.stores.keys()],['other-cache','tmt-shell-other-app',candidate]);
});
test('incomplete waiting cache cannot accept skipWaiting',async()=>{
  const h=harness();await h.dispatch('install');h.stores.get(candidate).delete(urls[3]);
  await assert.rejects(h.dispatch('message',{data:{type:'SKIP_WAITING'}}),/Incomplete/);
  assert.equal(h.skips(),0);assert.ok(h.stores.has(old));
});
test('retired worker cache miss cannot recreate a deleted cache',async()=>{
  const h=harness();let result;
  h.handlers.get('fetch')({request:{method:'GET',url:base+'index.html',mode:'navigate'},respondWith:p=>{result=p;}});
  assert.equal((await result).type,'error');assert.equal(h.stores.has(candidate),false);
});
