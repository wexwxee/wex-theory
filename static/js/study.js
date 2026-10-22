(function(){
  const root=document.getElementById('studySession');if(!root)return;
  document.getElementById('studyBurger').addEventListener('click',sbOpen);
  document.getElementById('studyTheme').addEventListener('click',toggleTheme);
  const select=document.getElementById('studyLesson');
  select.value=root.dataset.suggested;
  function updateTopic(){
    const choice=document.querySelector(`[data-study-choice="${select.value}"]`);
    if(!choice)return;
    document.getElementById('studySelectedTitle').textContent=choice.dataset.title;
    document.getElementById('studySelectedCopy').textContent=choice.dataset.focus;
    document.getElementById('studySelectedArt').replaceChildren(...[...choice.querySelectorAll('img')].map(image=>image.cloneNode(true)));
    document.querySelectorAll('[data-study-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button===choice)));
  }
  document.querySelectorAll('[data-study-choice]').forEach(button=>button.addEventListener('click',()=>{
    select.value=button.dataset.studyChoice;updateTopic();document.getElementById('studyTopics').open=false;
    document.getElementById('studyTopics').querySelector('summary').focus({preventScroll:true});
  }));
  select.addEventListener('change',updateTopic);updateTopic();
  function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
  let choosingNew = false;
  function render(){
    const state=window.WEXStudy.read();
    const valid=!choosingNew&&state&&state.revision===root.dataset.revision&&[...select.options].some(option=>option.value===state.lesson);
    document.getElementById('studySetup').hidden=Boolean(valid);
    document.getElementById('studyRoute').hidden=!valid;
    document.getElementById('studySummary').hidden=true;
    document.getElementById('studyCancelNew').hidden=!choosingNew;
    if(!valid){updateTopic();return;}
    const steps=document.getElementById('studySteps');steps.replaceChildren();
    const done=Object.keys(state.steps).length;
    document.getElementById('studySessionCount').textContent=`${done} of 2 steps checked`;
    document.getElementById('studyProgress').value=done;
    const lesson=[...select.options].find(option=>option.value===state.lesson).textContent;
    for(const [key,title,copy,url]of[
      ['words','1. Ten exam words','Recall the meaning of phrases used in the questions.',root.dataset.wordsUrl],
      ['signs','2. One sign lesson',lesson,`/signs/lesson/${state.lesson}`],
    ]){
      const item=element('li');item.append(element('h3',title),element('p',copy));
      const result=state.steps[key];
      item.classList.toggle('is-complete',Boolean(result));
      const next=!result&&(key==='words'||Boolean(state.steps.words));
      item.classList.toggle('is-next',next);
      item.prepend(element('span',result?'Checked':next?'Next step':'After the word check','study-step-status'));
      if(result)item.append(element('p',`${result.score}/${result.total} right${key==='words'&&['cards','mixed'].includes(result.mode)?' · includes self-check':''}`,'study-step-result'));
      if(key==='signs'&&!state.steps.words)item.append(element('p','Finish the word round first, then continue here.'));
      else{const a=element('a',result?'Practise again':key==='words'?'Practise ten words':'Open the sign lesson',result?'btn-ghost':'btn-primary');a.href=url+'?study='+state.id;a.dataset.studyStep=key;item.append(a);}
      steps.append(item);
    }
    if(done===2){
      document.getElementById('studySummary').hidden=false;
      const missed=state.steps.words.total-state.steps.words.score+state.steps.signs.total-state.steps.signs.score;
      document.getElementById('studySummaryCopy').textContent=missed
        ?`${missed} answers need another look. Use the completed steps above to revisit explanations and practise again.`
        :'Both checks are complete. You can now review anything due or choose a full test.';
    }
  }
  function start(){
    const value=window.WEXStudy.create(select.value,root.dataset.revision);
    if(!value){document.getElementById('studyStorageError').textContent='Browser storage is unavailable. Open the words or sign lessons from the dashboard, or allow storage to keep a guided session.';return;}
    choosingNew=false;
    render();
    document.getElementById('studyRouteTitle').focus({preventScroll:true});
  }
  document.getElementById('studyStart').addEventListener('click',start);
  document.getElementById('studyNew').addEventListener('click',()=>{
    if(!confirm('Start a new session? The current session summary in this browser will be replaced.'))return;
    const previous=window.WEXStudy.read();
    if(previous){const index=[...select.options].findIndex(option=>option.value===previous.lesson);select.selectedIndex=(index+1)%select.options.length;}
    choosingNew=true;render();document.getElementById('studyTopics').querySelector('summary').focus({preventScroll:true});
  });
  document.getElementById('studyCancelNew').addEventListener('click',()=>{choosingNew=false;render();document.getElementById('studyNew').focus({preventScroll:true});});
  window.addEventListener('pageshow',render);window.addEventListener('storage',render);render();
})();
