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
  