// Topnav: highlight active link and wire Back/Forward buttons
//this is broken I have to fix it later
//this function is still broken please help
(function(){
    // highlight active link based on pathname
    const links = document.querySelectorAll('.topnav-link');
    const path = window.location.pathname.split('/').pop() || 'index.html';
    links.forEach(a=>{
      const href = a.getAttribute('href') || '';
      if(href.split('/').pop() === path) a.classList.add('active');
    });
  
    // back/forward buttons
    const backBtn = document.getElementById('nav-back');
    const fwdBtn = document.getElementById('nav-forward');
    if(backBtn) backBtn.addEventListener('click', ()=>{ if(window.history.length>1) window.history.back(); else window.location.href='index.html'; });
    if(fwdBtn) fwdBtn.addEventListener('click', ()=>{ window.history.forward(); });
  })();
  
  // instrumentation for nav/status links presence
  //this is all for the sake of debuuggin so it's commented out 
  // document.addEventListener('DOMContentLoaded', ()=>{
  //   const sessionId = 'debug-session';
  //   const runId = 'pre-fix';
  //   const endpoint = 'http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029';
  //   const buttons = Array.from(document.querySelectorAll('.nav-button')).map(b=>b.textContent?.trim());
  //   const statusButtons = buttons.filter(t=>t && /status/i.test(t));
  //   const resourceLinks = Array.from(document.querySelectorAll('.resource-cards .card button, .resource-cards .card a')).map(b=>b.textContent?.trim() || '');
  //   const statusResources = resourceLinks.filter(t=>t && /status/i.test(t));
  //   
  //   fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  //     sessionId,runId,hypothesisId:'A',location:'navigationMenuScript.js:DOMLoaded',message:'nav buttons snapshot',data:{buttons,statusButtons},timestamp:Date.now()
  //   })}).catch(()=>{});
  //   fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  //     sessionId,runId,hypothesisId:'B',location:'navigationMenuScript.js:DOMLoaded',message:'resource links snapshot',data:{resourceLinks,statusResources},timestamp:Date.now()
  //   })}).catch(()=>{});
  // });
  //writen by Ahmed Guesmi (bm_mido)
  