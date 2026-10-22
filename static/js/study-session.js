(function(){
  'use strict';
  const node=document.querySelector('[data-study-account]');
  if(!node)return;
  const account=node.dataset.studyAccount;
  const key=`wexStudy:v1:${account}`;
  const AGE=7*86400000;
  const token=new URLSearchParams(location.search).get('study');
  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(key)||'null');
      if(!value||value.version!==1||value.account!==account||!/^[a-z0-9-]{16,64}$/.test(value.id)
        ||!Number.isFinite(value.startedAt)||value.startedAt>Date.now()+60000||Date.now()-value.startedAt>AGE
        ||typeof value.lesson!=='string'||!value.steps||typeof value.steps!=='object'||Array.isArray(value.steps))return null;
      for(const [step,result]of Object.entries(value.steps)){
        if(!['words','signs'].includes(step)||!result||!Number.isInteger(result.score)||!Number.isInteger(result.total)
          ||result.total<=0||result.score<0||result.score>result.total||!Number.isFinite(result.completedAt)
          ||result.completedAt<value.startedAt||result.completedAt>Date.now()+60000
          ||(step==='words'&&result.total!==10)||(step==='signs'&&(result.total<3||result.total>10)))return null;
      }
      return value;
    }catch(_){return null;}
  }
  function write(value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function create(lesson,revision){const value={version:1,account,id:crypto.randomUUID(),lesson,revision,startedAt:Date.now(),steps:{}};return write(value)?value:null;}
  function active(step){const value=read();if(!value||value.id!==token)return null;if(step==='signs'&&node.dataset.lessonId!==value.lesson)return null;return value;}
  function finish(step,score,total,mode){
    const value=active(step);
    if(!value||!['words','signs'].includes(step)||!Number.isInteger(score)||!Number.isInteger(total)
      ||score<0||score>total||(step==='words'&&total!==10)||(step==='signs'&&(total<3||total>10)))return null;
    if(value.steps[step])return value; // Re-reading feedback or practising mistakes must not overwrite the first check.
    value.steps[step]={score,total,mode:typeof mode==='string'?mode:'quiz',completedAt:Date.now()};
    return write(value)?value:null;
  }
  function returnLink(container,step,score,total,mode){
    if(!finish(step,score,total,mode))return;
    const link=document.createElement('a');link.href='/study';link.className='btn-primary';link.dataset.studyReturn='';link.textContent='Continue study session →';container.append(link);
  }
  window.WEXStudy={read,create,active,returnLink};
  if(token&&active(node.id==='exam-words-mode'?'words':'signs')){
    const parent=document.querySelector('.ew-app')||document.querySelector('.lesson-hero');
    if(parent){const link=document.createElement('a');link.href='/study';link.className='btn-ghost btn-sm';link.textContent='← Study session';parent.prepend(link);}
  }
})();
