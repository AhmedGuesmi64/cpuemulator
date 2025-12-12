// themeToggle.js
// Tiny theme switcher (dark/light) stored in localStorage
(function(){
  const STORAGE_KEY = 'cpuemulator_theme';
  const body = document.body;

  function applyTheme(theme){
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
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function toggleTheme(){
    const next = loadTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    applyTheme(loadTheme());
    const btn = document.getElementById('theme-toggle');
    if(btn) btn.addEventListener('click', toggleTheme);
  });
})();

