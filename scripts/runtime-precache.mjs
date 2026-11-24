/* R7.1 build/audit tool, not browser runtime. Requires pinned acorn (see CI). */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
const read = path => readFileSync(path, 'utf8');
const list = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? list(join(dir, e.name)) : [join(dir, e.name)]);
const inventory = list('src').filter(p => /\.m?js$/.test(p)).sort();
const marker = /  \/\/ BEGIN GENERATED RUNTIME JS[^\n]*\n[\s\S]*?  \/\/ END GENERATED RUNTIME JS/;
let sw = read('sw.js');
if (!marker.test(sw)) throw Error('Generated SW inventory markers missing');
const block = '  // BEGIN GENERATED RUNTIME JS (node scripts/runtime-precache.mjs --write)\n' +
  inventory.map(p => "  './" + p + "',").join('\n') + '\n  // END GENERATED RUNTIME JS';
const writing = process.argv.includes('--write');
if (writing) sw = sw.replace(marker, block);
if (sw.match(marker)[0] !== block) throw Error('Runtime JS inventory differs. Run node scripts/runtime-precache.mjs --write, commit sw.js.');
const shell = sw.slice(sw.indexOf('const SHELL = ['), sw.indexOf('].map(path'));
const cached = [...shell.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);
if (new Set(cached).size !== cached.length) throw Error('Duplicate shell entry');
const set = new Set(cached);
for (const p of cached) if (p && (!existsSync(p) || !statSync(p).isFile())) throw Error('Missing shell file: ' + p);
const edges = [], seen = new Set();
function requireAsset(p, owner) {
  if (!set.has(p) || !existsSync(p)) throw Error(owner + ' needs uncached/missing ' + p);
}
function dep(owner, spec, kind) {
  if (!spec.startsWith('.')) throw Error(owner + ' has unsupported external module ' + spec);
  const p = posix.normalize(posix.join(posix.dirname(owner), spec));
  requireAsset(p, owner);
  edges.push({from:owner, to:p, kind});
  if (/\.m?js$/.test(p)) visit(p);
}
function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { n.forEach(v => walk(v, fn)); return; }
  if (n.type) fn(n);
  for (const [k,v] of Object.entries(n)) if (k !== 'loc') walk(v, fn);
}
function visit(p) {
  if (seen.has(p)) return;
  seen.add(p); requireAsset(p, 'entry');
  const ast = parse(read(p), {ecmaVersion:'latest',sourceType:'module'});
  walk(ast, n => {
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type) && n.source)
      dep(p, n.source.value, 'static');
    if (n.type === 'ImportExpression') {
      if (n.source.type !== 'Literal' || typeof n.source.value !== 'string')
        throw Error(p + ' computed dynamic import requires explicit audit');
      dep(p,n.source.value,'dynamic');
    }
    if (n.type === 'NewExpression' && n.callee.name === 'URL' &&
        n.arguments[1]?.type === 'MemberExpression' && n.arguments[1].object?.type === 'MetaProperty' &&
        n.arguments[1].property?.name === 'url') {
      const a = n.arguments[0];
      if (a.type === 'Literal' && typeof a.value === 'string') {
        const dest = posix.normalize(posix.join(posix.dirname(p),a.value));
        // The app uses new URL('../', import.meta.url) for SW registration scope.
        if (a.value.endsWith('/')) return;
        requireAsset(dest,p); edges.push({from:p,to:dest,kind:'asset'});
      } else if (p === 'src/tile-visuals.js' && a.type === 'TemplateLiteral' &&
                 a.quasis[0]?.value.raw === '../public/tiles/' && a.quasis[1]?.value.raw === '.svg') {
        for (let i=0;i<34;i++) requireAsset('public/tiles/'+i+'.svg',p);
      } else throw Error(p + ' computed asset URL requires explicit audit');
    }
  });
}
const html = read('index.html');
const entries = [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="\.\/([^"]+)"/g)].map(m=>m[1]);
if (!entries.length) throw Error('No HTML module roots');
entries.forEach(visit);
// Audit all source modules in the conservative cache inventory. A new source
// file must be cached even if its public entry-point is wired in a later PR.
inventory.forEach(visit);
for (const m of html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="\.\/([^"]+)"/g)) requireAsset(m[1],'index.html');
for(let i=0;i<34;i++) requireAsset('public/tiles/'+i+'.svg','tile contract');
if (writing) {
  const normalized = sw.replace(/const CACHE_VERSION = '[^']+'/, "const CACHE_VERSION = '<generated>'");
  const hash = createHash('sha256').update(normalized);
  for (const p of cached.filter(p=>p && p!=='sw.js').sort()) hash.update(p+'\0').update(readFileSync(p));
  sw = sw.replace(/const CACHE_VERSION = '[^']+'/, "const CACHE_VERSION = 'tmt-v02-realistic-tiles-r7-"+hash.digest('hex').slice(0,16)+"'");
  writeFileSync('sw.js',sw);
}
const report = {entries,sourceModules:inventory.length,visitedModules:seen.size,shellAssets:cached.length,edges,
  note:'Static and literal dynamic ESM edges plus module-relative asset URLs; every src JS cached. Non-module fetch/CSS URL additions need explicit shell audit.'};
console.log(JSON.stringify(report,null,2));
