// uiModule.js
// keeps the DOM barely alive without letting the emulator implode
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing.');

  const { state, utils, hooks } = CPU;

  /**
   * Re-render memory tables, registers, PC, and flag badges.
   * Called after almost every state mutation.
   */
  function updateAll(){
    const pmEl = document.getElementById('prog-mem-table');
    if(pmEl){
      let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Disasm</th></tr>';
      for(let i=0;i<CPU.config.MEM_SIZE;i++){
        const isCurrent = (i === state.pc);
        const showPrevNext = CPU.highlight.enabled;
        const isPrev = showPrevNext && state.prevPc !== null && i === state.prevPc;
        const isNext = showPrevNext && state.nextPc !== null && i === state.nextPc;
        const cls = isCurrent ? 'pm-current' :
          isPrev ? 'pm-prev' :
          isNext ? 'pm-next' : '';

        rows += `<tr class="${cls}">
          <td>${utils.toHex(i)}</td>
          <td contenteditable="true" onblur="editMem(${i}, this.innerText)">${utils.toHex(state.mem[i])}</td>
          <td>${state.mem[i]}</td>
          <td>${(CPU.assembler?.disasm(i)) || '??'}</td>
        </tr>`;
      }
      pmEl.innerHTML = rows;
    }

    const dmEl = document.getElementById('data-mem-table');
    if(dmEl){
      let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th></tr>';
      for(let i=0;i<CPU.config.MEM_SIZE;i++){
        rows += `<tr>
          <td>${utils.toHex(i)}</td>
          <td contenteditable="true" onblur="editMem(${i}, this.innerText)">${utils.toHex(state.mem[i])}</td>
          <td>${state.mem[i]}</td>
        </tr>`;
      }
      dmEl.innerHTML = rows;
    }

    for(let i=0;i<4;i++){
      const el = document.getElementById(`reg${i}`);
      if(el) el.innerText = utils.toHex(state.regs[i]);
    }
    const pcEl = document.getElementById('pc');
    if(pcEl) pcEl.innerText = utils.toHex(state.pc);
    const flagsEl = document.getElementById('flags');
    if(flagsEl) flagsEl.innerText = `Z:${state.flags.Z?1:0} C:${state.flags.C?1:0}`;
    const nextPcEl = document.getElementById('next-pc');
    if(nextPcEl) nextPcEl.innerText = state.nextPc === null ? '--' : utils.toHex(state.nextPc);
    const runStateEl = document.getElementById('run-state');
    if(runStateEl){
      const label = state.halted ? 'Halted' : (state.running ? 'Running' : 'Ready');
      runStateEl.textContent = label;
      runStateEl.classList.remove('state-pill--running','state-pill--halted','state-pill--idle');
      runStateEl.classList.add(
        state.halted ? 'state-pill--halted' :
        state.running ? 'state-pill--running' : 'state-pill--idle'
      );
    }
  }

  /** Handles inline edits in the memory tables. */
  function editMem(idx, text){
    let value = parseInt((text || '').trim(), 16);
    if(isNaN(value)) value = parseInt((text || '').trim(), 10);
    if(isNaN(value) || value < 0 || value > 255) value = 0;
    state.mem[idx] = value & 0xFF;
    utils.refreshNextPc();
    updateAll();
  }

  /** Quick highlight for memory cells touched by LD/ST. */
  function flashDataCell(addr, mode){
    const table = document.getElementById('prog-mem-table');
    if(!table) return;
    const rows = table.querySelectorAll('tr');
    const idx = addr + 1;
    if(idx < 1 || idx >= rows.length) return;
    const cell = rows[idx].children[1];
    const original = cell.style.background;
    cell.style.transition = 'background .18s';
    if(mode === 'write') cell.style.background = 'rgba(61,223,230,0.20)';
    else if(mode === 'read') cell.style.background = 'rgba(24,180,162,0.18)';
    setTimeout(()=>{ cell.style.background = original; }, 220);
  }

  /** Visual nudge for registers that just changed. */
  function flashRegister(index){
    const el = document.getElementById(`reg${index}`);
    if(!el) return;
    const original = el.style.background;
    el.style.transition = 'background .18s';
    el.style.background = 'rgba(61, 130, 255, 0.25)';
    setTimeout(()=>{ el.style.background = original; }, 220);
  }

  /** Swap the label so users know whether prev/next highlights are on. */
  function updateHighlightToggleLabel(){
    const btn = document.getElementById('highlight-toggle-btn');
    if(btn){
      btn.textContent = CPU.highlight.enabled ? 'Hide prev/next highlight' : 'Show prev/next highlight';
    }
  }

  /** Button handler for the prev/next highlight toggle. */
  function toggleHighlightLookahead(){
    CPU.highlight.toggle();
    updateHighlightToggleLabel();
    updateAll();
  }

  function updateTraceModeButtons(){
    const mode = CPU.trace.getMode ? CPU.trace.getMode() : 'asm';
    const asmBtn = document.getElementById('trace-mode-asm');
    const hexBtn = document.getElementById('trace-mode-hex');
    if(asmBtn) asmBtn.classList.toggle('active', mode === 'asm');
    if(hexBtn) hexBtn.classList.toggle('active', mode === 'hex');
  }

  /** Keeps the two editor textareas in sync with whatever we just loaded. */
  function setEditorBuffers(asmText = '', hexText = ''){
    const asmEl = document.getElementById('assembler-in');
    if(asmEl) asmEl.value = asmText.trim();
    const hexEl = document.getElementById('machine-in');
    if(hexEl) hexEl.value = hexText.trim();
  }

  /** One-click way to blank both textareas. */
  function clearSource(){
    setEditorBuffers('', '');
  }

  /** Accepts either .hex or .asm files via input/drag-drop and loads them. */
  function readAndLoadFile(file){
    if(!file) return;
    file.text().then((txt)=>{
      const name = (file.name || '').toLowerCase();
      if(name.endsWith('.hex') || /^[0-9A-Fa-f\s,]+$/.test(txt.trim())){
        const machineBox = document.getElementById('machine-in');
        if(machineBox) machineBox.value = txt.trim();
        CPU.assembler.loadMachineCodeFromString(txt);
      }else{
        const asmBox = document.getElementById('assembler-in');
        if(asmBox) asmBox.value = txt;
        CPU.assembler.assemble();
      }
    }).catch((err)=> alert('Failed to read file: ' + (err && err.message ? err.message : err)));
  }

  /** Set up the hidden file input plus the drag-and-drop target. */
  function initFileInputs(){
    const fileInput = document.getElementById('file-input');
    if(fileInput){
      fileInput.addEventListener('change',(ev)=>{
        const f = ev.target.files && ev.target.files[0];
        if(f) readAndLoadFile(f);
        fileInput.value = '';
      });
    }

    const dropTarget = document.getElementById('drop-target');
    if(dropTarget){
      dropTarget.addEventListener('dragover',(e)=>{
        e.preventDefault();
        dropTarget.style.outline = '2px dashed rgba(61,223,230,0.3)';
      });
      dropTarget.addEventListener('dragleave',()=>{ dropTarget.style.outline = ''; });
      dropTarget.addEventListener('drop',(e)=>{
        e.preventDefault();
        dropTarget.style.outline = '';
        const files = e.dataTransfer.files;
        if(files && files.length) readAndLoadFile(files[0]);
      });
    }
  }

  /**
   * Fetches one of the sample programs under /tests and loads it either
   * as ASM (assemble immediately) or HEX (direct memory load).
   */
  function loadSampleTest(name, format = 'asm'){
    const ext = format === 'hex' ? 'hex' : 'asm';
    fetch(`tests/${name}.${ext}`)
      .then(resp=>{
        if(!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        return resp.text();
      })
      .then(text=>{
        const trimmed = (text || '').trim();
        if(!trimmed){
          alert('Sample file was empty—double-check the tests folder.');
          return;
        }
        if(ext === 'asm'){
          setEditorBuffers(trimmed, '');
          CPU.assembler.assemble();
          CPU.trace.log(`Sample ${name}.asm assembled`);
        } else {
          setEditorBuffers('', trimmed);
          CPU.assembler.loadMachineCodeFromString(trimmed);
          CPU.trace.log(`Sample ${name}.hex loaded`);
        }
      })
      .catch(err=>{
        alert(`Failed to load sample (${name}.${ext}): ${err && err.message ? err.message : err}`);
      });
  }

  /**
   * Main entry point: registers hooks, initializes file input/drag-drop,
   * and ensures the highlight + trace mode buttons have the right state.
   */
  function init(){
    hooks.flashDataCell = flashDataCell;
    hooks.flashRegister = flashRegister;
    hooks.onHighlightChange = ()=>{
      updateHighlightToggleLabel();
      updateAll();
    };
    hooks.onStateRendered = ()=> updateAll();
    hooks.onTraceModeChange = ()=> updateTraceModeButtons();

    initFileInputs();
    updateHighlightToggleLabel();
    updateTraceModeButtons();
    updateAll();
    const highlightBtn = document.getElementById('highlight-toggle-btn');
    if(highlightBtn){
      highlightBtn.addEventListener('click', toggleHighlightLookahead);
    }
  }

  CPU.ui = {
    updateAll,
    editMem,
    flashDataCell,
    flashRegister,
    updateHighlightToggleLabel,
    toggleHighlightLookahead,
    setEditorBuffers,
    clearSource,
    updateTraceModeButtons,
    loadSampleTest,
    init
  };
})(window);

