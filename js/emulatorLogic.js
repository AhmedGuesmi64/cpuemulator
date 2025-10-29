// emulatorLogic.js
// Full emulator logic for emulator.html
// Assumes DOM IDs: prog-mem-table, data-mem-table, regs, pc, flags, trace,
// assembler-in, machine-in, anim-delay, file-input, drop-target, notes, notes-* buttons

// ---- Config ----
const PMEM_SIZE = 32;
const DMEM_SIZE = 32;

// ---- State ----
let pmem = new Uint8Array(PMEM_SIZE).fill(0);
let dmem = new Uint8Array(DMEM_SIZE).fill(0);
let regs = [0,0,0,0];
let flags = { Z:false, C:false };
let pc = 0;
let halted = false;
let running = false;

// Animation control
let animRunning = false;
let animHandle = null;

// ---- Helpers ----
function toHex(x, pad = 2){ return (x & 0xFF).toString(16).toUpperCase().padStart(pad,'0'); }
function logTrace(s){
  const t = document.getElementById('trace');
  if(!t) return;
  const el = document.createElement('div');
  el.textContent = s;
  t.prepend(el);
  while(t.children.length > 200) t.removeChild(t.lastChild);
}
window.addEventListener('error', (e)=> console.error('Uncaught error', e.error || e.message));

// ---- Disasm / Assembler ----
function disasm(instr){
  let b = instr & 0xFF;
  let op = (b & 0xC0) >> 6;
  if(op === 0){
    let isStore = (b & 0x20) !== 0;
    let operand = (b >> 2) & 0x0F;
    let regid = b & 0x03;
    return isStore ? `ST r${regid}, [${toHex(operand)}]` : `LD [${toHex(operand)}], r${regid}`;
  } else if(op === 2){
    let z = (b >> 4) & 0x03, x = (b >> 2) & 0x03, y = b & 0x03;
    return `ADD r${z}, r${x}, r${y}`;
  } else if(op === 3){
    let addr6 = b & 0x3F;
    return `JMP ${toHex(addr6)}`;
  } else {
    return 'UNK';
  }
}

function assemble(){
  const src = (document.getElementById('assembler-in')?.value || '').trim().split(/\n/);
  let out = [];
  for(let raw of src){
    let line = raw.replace(/(;|#).*$/,'').trim();
    if(!line) continue;
    let m;
    if(m = line.match(/^LD\s*\[\s*([^\]]+)\s*\],\s*r([0-3])$/i)){
      let addr = parseInt(m[1],16);
      if(isNaN(addr)){ alert('Bad LD address: '+m[1]); return; }
      addr &= 0x0F; let r = parseInt(m[2],10)&0x03;
      out.push((0x00)|((addr&0x0F)<<2)|(r&0x03));
    } else if(m = line.match(/^ST\s*r([0-3])\s*,\s*\[\s*([^\]]+)\s*\]$/i)){
      let r = parseInt(m[1],10)&0x03; let addr = parseInt(m[2],16);
      if(isNaN(addr)){ alert('Bad ST address: '+m[2]); return; }
      addr &= 0x0F; out.push((0x00)|0x20|((addr&0x0F)<<2)|(r&0x03));
    } else if(m = line.match(/^ADD\s*r([0-3])\s*,\s*r([0-3])\s*,\s*r([0-3])$/i)){
      let z = parseInt(m[1],10)&0x03, x = parseInt(m[2],10)&0x03, y = parseInt(m[3],10)&0x03;
      out.push(0x80 | ((z&0x03)<<4) | ((x&0x03)<<2) | (y&0x03));
    } else if(m = line.match(/^JMP\s*([0-9A-Fa-f]+)$/i)){
      let addr = parseInt(m[1],16);
      if(isNaN(addr)){ alert('Bad JMP address: '+m[1]); return; }
      addr &= 0x3F; out.push(0xC0 | addr);
    } else {
      alert('Cannot parse: ' + line);
      return;
    }
  }
  pmem.fill(0);
  out.forEach((v,i)=>{ if(i<PMEM_SIZE) pmem[i]=v; });
  pc = 0; halted = false;
  updateAll();
  logTrace(`Assembled ${out.length} instr(s)`);
}

// Load machine hex text into pmem (from textarea)
function loadMachineCode(){
  const txt = (document.getElementById('machine-in')?.value || '').trim();
  if(!txt) return;
  loadMachineCodeFromString(txt);
}

// Programmatic hex loader (string may contain spaces/commas)
function loadMachineCodeFromString(hexString){
  try{
    const parts = hexString.trim().split(/[\s,]+/).filter(Boolean);
    if(parts.some(x=>!/^[0-9A-Fa-f]{1,2}$/.test(x))) throw new Error('Invalid hex token detected');
    pmem.fill(0);
    parts.map(x=>parseInt(x,16)&0xFF).forEach((v,i)=>{ if(i<PMEM_SIZE) pmem[i]=v; });
    pc = 0; halted = false;
    updateAll();
    logTrace(`Loaded program (${Math.min(parts.length,PMEM_SIZE)} bytes)`);
  }catch(e){
    alert('Failed to load hex: ' + (e && e.message ? e.message : e));
  }
}

// ---- Execution ----
function execInstr(b){
  let op = (b & 0xC0) >> 6;
  if(op === 0){
    let isStore = (b & 0x20) !== 0;
    let regid = b & 0x03;
    let addr = (b >> 2) & 0x0F;
    if(isStore){
      dmem[addr] = regs[regid] & 0xFF;
      logTrace(`ST r${regid} -> [${toHex(addr)}] = ${toHex(dmem[addr])}`);
      flashDataCell(addr,'write');
    } else {
      regs[regid] = dmem[addr] & 0xFF;
      logTrace(`LD [${toHex(addr)}] -> r${regid} = ${toHex(regs[regid])}`);
      flashDataCell(addr,'read');
    }
    pc = (pc + 1) & 0xFF;
  } else if(op === 2){
    let z = (b >> 4) & 0x03, x = (b >> 2) & 0x03, y = b & 0x03;
    let s = regs[x] + regs[y];
    flags.C = s > 0xFF;
    regs[z] = s & 0xFF;
    flags.Z = regs[z] === 0;
    logTrace(`ADD r${z} = r${x} + r${y} -> ${toHex(regs[z])} (C:${flags.C?1:0} Z:${flags.Z?1:0})`);
    pc = (pc + 1) & 0xFF;
  } else if(op === 3){
    let addr = b & 0x3F;
    logTrace(`JMP ${toHex(addr)}`);
    pc = addr & 0xFF;
  } else {
    logTrace(`UNK ${toHex(b)}`);
    pc = (pc + 1) & 0xFF;
  }
}

// safe single-step wrapper
function safeStep(){
  if(halted) return false;
  if(pc < 0 || pc >= PMEM_SIZE){ halted = true; updateAll(); return false; }
  try {
    execInstr(pmem[pc]);
  } catch(e){
    console.error('execInstr error', e);
    halted = true;
    return false;
  }
  updateAll();
  return true;
}

// blocking run
function run(){
  stop(); // ensure no animation
  running = true;
  const MAX = 20000;
  let steps = 0;
  while(running && !halted && pc>=0 && pc<PMEM_SIZE && steps < MAX){
    execInstr(pmem[pc]);
    steps++;
  }
  if(steps >= MAX) logTrace('Run stopped: step limit reached');
  updateAll();
  running = false;
}

// ---- Robust animate / stop ----
function getAnimDelay(){
  const el = document.getElementById('anim-delay');
  const v = el ? parseInt(el.value,10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 400;
}

function stop(){
  animRunning = false;
  if(animHandle !== null){ clearTimeout(animHandle); animHandle = null; }
  // compatibility: clear any old interval variable if present
  if(typeof animTimer !== 'undefined' && animTimer !== null){ clearInterval(animTimer); animTimer = null; }
  running = false;
  logTrace('Execution stopped');
}

function animateExec(){
    // prevent double-start
    if(animRunning){ console.warn('Animation already running'); return; }
    stop();
    animRunning = true;
    running = true;
    logTrace('Animation started');
  
    function loop(){
      if(!animRunning || halted || pc < 0 || pc >= PMEM_SIZE){
        stop();
        return;
      }
      const did = safeStep();
      if(!did){ stop(); return; }
      animHandle = setTimeout(loop, getAnimDelay());
    }
  
    loop(); // start immediately
  }
  

// ---- UI updates and helpers ----
function updateAll(){
  // program memory
  const pmEl = document.getElementById('prog-mem-table');
  if(pmEl){
    let rows = '<tr><th>Addr</th><th>Hex</th><th>Disasm</th></tr>';
    for(let i=0;i<PMEM_SIZE;i++){
      const cls = (i===pc && !halted && pc>=0 && pc<PMEM_SIZE) ? 'class="highlight"' : '';
      rows += `<tr ${cls}><td>${toHex(i)}</td><td>${toHex(pmem[i])}</td><td>${disasm(pmem[i])}</td></tr>`;
    }
    pmEl.innerHTML = rows;
  }

  // data memory
  const dmEl = document.getElementById('data-mem-table');
  if(dmEl){
    let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th></tr>';
    for(let i=0;i<DMEM_SIZE;i++){
      rows += `<tr><td>${toHex(i)}</td><td contenteditable='true' onblur='editDmem(${i}, this.innerText)'>${toHex(dmem[i])}</td><td>${dmem[i]}</td></tr>`;
    }
    dmEl.innerHTML = rows;
  }

  // registers + pc + flags
  const regsEl = document.getElementById('regs');
  if(regsEl) regsEl.innerText = regs.map((v,i)=>`r${i}: ${toHex(v)}`).join(' | ');
  const pcEl = document.getElementById('pc');
  if(pcEl) pcEl.innerText = toHex(pc);
  const flagsEl = document.getElementById('flags');
  if(flagsEl) flagsEl.innerText = 'Z:'+(flags.Z?1:0)+' C:'+(flags.C?1:0);
}

function editDmem(i, txt){
  let s = (txt||'').trim();
  let x = parseInt(s,16);
  if(isNaN(x)) x = parseInt(s,10);
  if(isNaN(x) || x<0 || x>255) x = 0;
  dmem[i] = x & 0xFF;
  updateAll();
}

function flashDataCell(addr, mode){
  const table = document.getElementById('data-mem-table');
  if(!table) return;
  const rows = table.querySelectorAll('tr');
  const idx = addr + 1;
  if(idx < 1 || idx >= rows.length) return;
  const cell = rows[idx].children[1];
  const orig = cell.style.background;
  cell.style.transition = 'background .18s';
  cell.style.background = mode === 'write' ? 'rgba(61,223,230,0.12)' : 'rgba(24,180,162,0.08)';
  setTimeout(()=>{ cell.style.background = orig; }, 220);
}

// ---- Sample program ----
const SAMPLE = [
  0x00,
  (0x00)|((0x01&0x0F)<<2)|1,
  0x80|((2&0x03)<<4)|((0&0x03)<<2)|1,
  (0x00)|0x20|((0x02&0x0F)<<2)|2,
  0xC0|0x06
];

function loadSample(){
  pmem.fill(0);
  SAMPLE.forEach((v,i)=>{ if(i<PMEM_SIZE) pmem[i]=v; });
  dmem.fill(0);
  dmem[0]=0x05; dmem[1]=0x07;
  pc = 0; halted = false;
  const tr = document.getElementById('trace'); if(tr) tr.innerHTML = '';
  updateAll();
  logTrace('Sample loaded');
}

// ---- Fragment loader (#hex=... or #loadSample) ----
function tryLoadFromFragment(){
  const frag = location.hash.replace('#','');
  if(!frag) return;
  const params = new URLSearchParams(frag.replace(/\+/g,' '));
  if(params.has('hex')){
    try{
      const encoded = params.get('hex');
      const hex = decodeURIComponent(encoded);
      loadMachineCodeFromString(hex);
    }catch(e){
      console.warn('Failed to parse hex fragment', e);
    }
  }
  if(location.hash.indexOf('loadSample') >= 0) loadSample();
}
tryLoadFromFragment();

// ---- File import / drag and drop ----
const fileInput = document.getElementById('file-input');
if(fileInput){
  fileInput.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) readAndLoadFile(f); fileInput.value = ''; });
}

async function readAndLoadFile(file){
  try{
    const name = (file.name || '').toLowerCase();
    const txt = await file.text();
    if(name.endsWith('.hex') || /^[0-9A-Fa-f\s,]+$/.test(txt.trim())){
      const machineBox = document.getElementById('machine-in');
      if(machineBox) machineBox.value = txt.trim();
      loadMachineCodeFromString(txt);
    } else {
      const asmBox = document.getElementById('assembler-in');
      if(asmBox) asmBox.value = txt;
      assemble();
    }
  }catch(e){
    alert('Failed to read file: ' + (e && e.message ? e.message : e));
  }
}

const dropTarget = document.getElementById('drop-target');
if(dropTarget){
  dropTarget.addEventListener('dragover', (e)=>{ e.preventDefault(); dropTarget.style.outline='2px dashed rgba(61,223,230,0.3)'; });
  dropTarget.addEventListener('dragleave', (e)=>{ dropTarget.style.outline=''; });
  dropTarget.addEventListener('drop', (e)=>{ e.preventDefault(); dropTarget.style.outline=''; const files = e.dataTransfer.files; if(files && files.length) readAndLoadFile(files[0]); });
}

// ---- Notes save/export/import (localStorage + file) ----
const NOTES_KEY = 'cp_emulator_notes_v1';
const notesEl = document.getElementById('notes');
const notesFileInput = document.getElementById('notes-file-input');
function loadNotesFromStorage(){
  try{
    const saved = localStorage.getItem(NOTES_KEY);
    if(saved !== null && notesEl) notesEl.innerText = saved;
  }catch(e){ console.warn('notes load failed', e); }
}
function saveNotesToStorage(){
  try{ if(!notesEl) return; const text = notesEl.innerText; localStorage.setItem(NOTES_KEY, text); const s = document.getElementById('notes-autosave-status'); if(s) s.innerText = 'Saved'; setTimeout(()=>{ if(s) s.innerText = 'On'; }, 900); } catch(e){ console.warn('notes save failed', e); }
}
function exportNotesAsFile(filename = 'notes.txt'){
  if(!notesEl) return;
  const blob = new Blob([notesEl.innerText || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importNotesFromFile(file){
  if(!file || !notesEl) return;
  const reader = new FileReader();
  reader.onload = (e)=>{ notesEl.innerText = e.target.result || ''; saveNotesToStorage(); };
  reader.readAsText(file);
}
const notesSaveBtn = document.getElementById('notes-save-btn');
const notesExportBtn = document.getElementById('notes-export-btn');
const notesImportBtn = document.getElementById('notes-import-btn');
if(notesSaveBtn) notesSaveBtn.addEventListener('click', saveNotesToStorage);
if(notesExportBtn) notesExportBtn.addEventListener('click', ()=>exportNotesAsFile('cp_notes.txt'));
if(notesImportBtn) notesImportBtn.addEventListener('click', ()=>{ if(notesFileInput) notesFileInput.click(); });
if(notesFileInput) notesFileInput.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) importNotesFromFile(f); notesFileInput.value = ''; });
if(notesEl){
  let autosaveTimer = null;
  notesEl.addEventListener('input', ()=>{
    const status = document.getElementById('notes-autosave-status');
    if(status) status.innerText = 'Typing';
    if(autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(()=>{ saveNotesToStorage(); autosaveTimer = null; }, 700);
  });
  loadNotesFromStorage();
}

// ---- Reset / initialization ----
function defaultInstr(){ return 0x00; } // LD [00], r0
function reset(){
  pmem.fill(defaultInstr());
  dmem.fill(0);
  regs = [0,0,0,0];
  flags = { Z:false, C:false };
  pc = 0; halted = false;
  running = false;
  stop();
  const tr = document.getElementById('trace'); if(tr) tr.innerHTML = '';
  updateAll();
}
reset();

// Expose some functions for console and inline onclick usage
window.assemble = assemble;
window.loadMachineCode = loadMachineCode;
window.loadMachineCodeFromString = loadMachineCodeFromString;
window.loadSample = loadSample;
window.step = function(){ safeStep(); };
window.run = run;
window.animateExec = animateExec;
window.stop = stop;
window.reset = reset;
