(function(root){
  'use strict';
  const MAX_AGE=7*86400000;
  function parse(key,value,now=Date.now()){
    const match=/^wexDraft:v1:(guest|[1-9]\d*):(\d+):(original|exam)$/.exec(key);
    if(!match||!value||typeof value!=='object'||Array.isArray(value))return null;
    const test=Number(match[2]);
    if(!Number.isInteger(test)||test<0||test>14||(match[3]==='exam'&&(test<1||test>13)))return null;
    if(!Number.isFinite(value.savedAt)||value.savedAt>now+60000||now-value.savedAt>MAX_AGE
      ||!Array.isArray(value.ids)||!value.ids.length||value.ids.length>25
      ||value.ids.some(id=>!Number.isInteger(id)||id<=0)||new Set(value.ids).size!==value.ids.length
      ||!Number.isInteger(value.currentIndex)||value.currentIndex<0||value.currentIndex>=value.ids.length
      ||!Number.isFinite(value.timerSeconds)||value.timerSeconds<=0||value.timerSeconds>1500
      ||!value.selectedAnswers||typeof value.selectedAnswers!=='object'||Array.isArray(value.selectedAnswers)
      ||(value.attemptId!==null&&value.attemptId!==undefined&&(!Number.isInteger(value.attemptId)||value.attemptId<=0))
      ||(test===14&&!Number.isInteger(value.attemptId)))return null;
    for(const [id,answers]of Object.entries(value.selectedAnswers)){
      if(!value.ids.includes(Number(id))||!Array.isArray(answers)||answers.length>20
        ||answers.some(answer=>!Number.isInteger(answer)||answer<=0)||new Set(answers).size!==answers.length)return null;
    }
    return {key,account:match[1],test,wording:match[3],draft:value,
      answered:Object.values(value.selectedAnswers).filter(answers=>answers.length).length};
  }
  function read(key){try{return parse(key,JSON.parse(localStorage.getItem(key)||'null'))?.draft||null;}catch(_){return null;}}
  function list(account,hasAccess,allowedTests,readyWording){
    const found=[];
    try{for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key?.startsWith(`wexDraft:v1:${account}:`))continue;
      let entry;try{entry=parse(key,JSON.parse(localStorage.getItem(key)));}catch(_){continue;}
      if(!entry||(!hasAccess&&entry.test!==0)||!allowedTests.includes(entry.test)
        ||(entry.wording==='exam'&&!readyWording.includes(entry.test))
        ||(!entry.answered&&!entry.draft.currentIndex&&!entry.draft.flags?.length))continue;
      const query=new URLSearchParams();
      if(entry.test>=1&&entry.test<=13)query.set('wording',entry.wording);
      if(entry.test===14)query.set('attempt_id',String(entry.draft.attemptId));
      entry.href=`/test/${entry.test}`+(query.size?'?'+query:'');
      found.push(entry);
    }}catch(_){}
    return found.sort((a,b)=>b.draft.savedAt-a.draft.savedAt);
  }
  const api={parse,read,list};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WEXTestDrafts=api;
})(typeof window==='undefined'?globalThis:window);
