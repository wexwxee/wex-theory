const assert=require('node:assert/strict');
const store=require('../../static/js/test-draft-store.js');
const valid=()=>({savedAt:Date.now(),ids:[11,12],selectedAnswers:{11:[1]},currentIndex:1,timerSeconds:1234,attemptId:null,flags:[]});
const key='wexDraft:v1:4:1:original';
assert.equal(store.parse(key,valid()).answered,1);
for(const change of [{savedAt:Date.now()-8*86400000},{savedAt:Date.now()+120000},
 {ids:[11,11]},{currentIndex:2},{timerSeconds:0},{selectedAnswers:{'99':[1]}},
 {selectedAnswers:{'11':[1,1]}},{attemptId:-2}])assert.equal(store.parse(key,{...valid(),...change}),null);
assert.equal(store.parse('wexDraft:v1:4:14:original',valid()),null);
const values=new Map([[key,JSON.stringify(valid())],
 ['wexDraft:v1:5:1:original',JSON.stringify(valid())],
 ['wexDraft:v1:4:2:exam',JSON.stringify(valid())],
 ['wexDraft:v1:4:0:original',JSON.stringify(valid())],
 ['wexDraft:v1:4:14:original',JSON.stringify({...valid(),attemptId:57,href:'https://untrusted.invalid/'})]]);
global.localStorage={get length(){return values.size;},key(index){return [...values.keys()][index];},getItem(key){return values.get(key)||null;}};
assert.equal(store.list('4',false,[0,1,2,14],[]).length,1);
const entries=store.list('4',true,[0,1,2,14],[2]);assert.equal(entries.length,4);
assert.equal(entries.find(entry=>entry.test===1).href,'/test/1?wording=original');
assert.equal(entries.find(entry=>entry.test===2).href,'/test/2?wording=exam');
assert.equal(entries.find(entry=>entry.test===14).href,'/test/14?attempt_id=57');
assert.equal(store.list('4',true,[0,1,2,14],[]).some(entry=>entry.wording==='exam'),false);
assert.equal(store.list('4',true,[0],[]).length,1);
console.log('OK draft validity, expiry, account/access/wording isolation and safe generated resume links');
