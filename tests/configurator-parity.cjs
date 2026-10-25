/* Generate shared rule vectors from the actual web expert engine for native verification. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const snapshot=JSON.parse(fs.readFileSync('android-store/app/src/main/assets/catalog.json','utf8'));
const products=Array.isArray(snapshot)?snapshot:snapshot.products;
const context={window:{BS:{util:{sum:(xs,fn)=>xs.reduce((n,x)=>n+fn(x),0)},db:{}}}};
vm.runInNewContext(fs.readFileSync('js/ai/advisor.js','utf8'),context);
const ad=context.window.BS.advisor, vectors=[];
function vector(build){const c=ad.checkCompatibility(build);vectors.push({ids:Object.fromEntries(Object.entries(build).map(([s,p])=>[s,p.id])),errors:c.errors.length,warnings:c.warnings.length,notes:c.notes.length,peak:c.power.peak,minimum:c.power.minimum,recommended:c.power.recommended,total:c.total,fps:ad.estimate(build,{}).fps});}
vector({});
const slots=ad.SLOTS;
for(const a of slots)for(const p of products.filter(p=>p.categoryId===a.categoryId)){
 vector({[a.slot]:p});
 for(const b of slots.filter(b=>b.slot!==a.slot))for(const q of products.filter(p=>p.categoryId===b.categoryId))vector({[a.slot]:p,[b.slot]:q});
}
assert.ok(vectors.length>1000);
const path='android-store/app/src/androidTest/assets/configurator-parity.json';fs.mkdirSync(require('node:path').dirname(path),{recursive:true});const data=JSON.stringify(vectors)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),data,'Regenerate rule fixtures');else fs.writeFileSync(path,data);
console.log('PASS web rule fixtures: '+vectors.length+' empty, individual and cross-component configurations');
