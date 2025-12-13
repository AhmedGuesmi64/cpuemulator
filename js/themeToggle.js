// themeToggle.js
// Tiny theme switcher (dark/light) stored in localStorage
(function(){
  const STORAGE_KEY = 'cpuemulator_theme';

  // apply immediately to avoid flicker
  (function applyEarly(){
    try{
      const theme = localStorage.getItem(STORAGE_KEY) || 'dark';
      const body = document.body;
      if(theme === 'light'){
        body.classList.add('theme-light');
      } else {
        body.classList.remove('theme-light');
      }
    }catch(_){}
  })();

  function applyTheme(theme){
    const body = document.body;
    if(theme === 'light'){
      body.classList.add('theme-light');
    } else {
      body.classList.remove('theme-light');
    }
    const btn = document.getElementById('theme-toggle');
    if(btn){
      btn.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    }
  }

  function loadTheme(){
    try{
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    }catch(_){
      return 'dark';
    }
  }

  function toggleTheme(){
    const next = loadTheme() === 'light' ? 'dark' : 'light';
    try{ localStorage.setItem(STORAGE_KEY, next); }catch(_){}
    applyTheme(next);
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    applyTheme(loadTheme());
    const btn = document.getElementById('theme-toggle');
    if(btn) btn.addEventListener('click', toggleTheme);
  });
})();

