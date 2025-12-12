// uiModule.js
// keeps the DOM barely alive without letting the emulator implode
//good luck trying to bebug this mess 
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing.');

  const { state, utils, hooks } = CPU;
  let memoryViewMode = 'unified'; // 'unified' or 'split'

  function getCurrentInstructionContext(){
    if(state.pc < 0 || state.pc >= CPU.config.MEM_SIZE) return null;
    const opcode = state.mem[state.pc];
    if(typeof opcode === 'undefined') return null;
    const type = (opcode >>> 6) & 0x03;
    const op2 = (opcode >>> 4) & 0x03;
    const op1 = (opcode >>> 2) & 0x03;
    const op0 = opcode & 0x03;
    const ctx = {
      type,
      regDest: null,
      regSources: [],
      dataOperands: [],
      immediateRows: [],
      jumpTargets: []
    };
    const operandRow = utils.wrapAddr(state.pc + 1);

    if(type === CPU.config.ISA_TYPE.LOAD){
      const addr = state.mem[operandRow] ?? 0;
      ctx.dataOperands.push(addr);
      ctx.regDest = op0;
      ctx.immediateRows.push(operandRow);
    } else if(type === CPU.config.ISA_TYPE.STORE){
      const addr = state.mem[operandRow] ?? 0;
      ctx.dataOperands.push(addr);
      ctx.regSources.push(op0);
      ctx.immediateRows.push(operandRow);
    } else if(type === CPU.config.ISA_TYPE.ADD){
      ctx.regDest = op2;
      ctx.regSources.push(op1, op0);
    } else if(type === CPU.config.ISA_TYPE.JMP){
      const target = opcode & 0x3F;
      ctx.jumpTargets.push(target);
    }

    return ctx;
  }

  /**
   * Re-render memory tables, registers, PC, and flag badges.
   * Called after almost every state mutation.
   * 
   * don't you love front-end development? as a mattter of fact this fucntion is so fucking good I can barely read it 
   */
  function updateAll(){
    const instrCtx = getCurrentInstructionContext();
    const dataOperandSet = new Set(instrCtx?.dataOperands || []);
    const immRowSet = new Set(instrCtx?.immediateRows || []);
    const jumpTargetSet = new Set(instrCtx?.jumpTargets || []);
    const regSourceSet = new Set(instrCtx?.regSources || []);

    if(memoryViewMode === 'unified'){
      const unifiedEl = document.getElementById('unified-mem-table');
      if(unifiedEl){
        let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Disasm</th></tr>';
        for(let i=0;i<CPU.config.MEM_SIZE;i++){
          const isCurrent = (i === state.pc);
          const showPrevNext = CPU.highlight.enabled;
          const isPrev = showPrevNext && state.prevPc !== null && i === state.prevPc;
          const isNext = showPrevNext && state.nextPc !== null && i === state.nextPc;
          const classes = [];
          if(isCurrent) classes.push('pm-current');
          else if(isPrev) classes.push('pm-prev');
          else if(isNext) classes.push('pm-next');
          if(immRowSet.has(i)) classes.push('pm-operand-byte');
          if(jumpTargetSet.has(i)) classes.push('pm-target');
          if(dataOperandSet.has(i)) classes.push('dm-operand');
          const cls = classes.join(' ');

          rows += `<tr class="${cls}">
            <td>${utils.toHex(i)}</td>
            <td contenteditable="true" onblur="editMem(${i}, this.innerText)">${utils.toHex(state.mem[i])}</td>
            <td>${state.mem[i]}</td>
            <td>${(CPU.assembler?.disasm(i)) || '??'}</td>
          </tr>`;
        }
        unifiedEl.innerHTML = rows;
      }
    } else {
      const pmEl = document.getElementById('prog-mem-table');
      if(pmEl){
        let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Disasm</th></tr>';
        for(let i=0;i<CPU.config.MEM_SIZE;i++){
          const isCurrent = (i === state.pc);
          const showPrevNext = CPU.highlight.enabled;
          const isPrev = showPrevNext && state.prevPc !== null && i === state.prevPc;
          const isNext = showPrevNext && state.nextPc !== null && i === state.nextPc;
          const classes = [];
          if(isCurrent) classes.push('pm-current');
          else if(isPrev) classes.push('pm-prev');
          else if(isNext) classes.push('pm-next');
          if(immRowSet.has(i)) classes.push('pm-operand-byte');
          if(jumpTargetSet.has(i)) classes.push('pm-target');
          const cls = classes.join(' ');

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
          const cls = dataOperandSet.has(i) ? 'dm-operand' : '';
          rows += `<tr>
            <td class="${cls}">${utils.toHex(i)}</td>
            <td class="${cls}" contenteditable="true" onblur="editMem(${i}, this.innerText)">${utils.toHex(state.mem[i])}</td>
            <td class="${cls}">${state.mem[i]}</td>
          </tr>`;
        }
        dmEl.innerHTML = rows;
      }
    }

    for(let i=0;i<4;i++){
      const el = document.getElementById(`reg${i}`);
      if(el){
        el.innerText = utils.toHex(state.regs[i]);
        const box = el.parentElement;
        if(box && box.classList){
          box.classList.toggle('reg-dest', instrCtx && instrCtx.regDest === i);
          box.classList.toggle('reg-source', regSourceSet.has(i));
        }
      }
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
    if(mode === 'write') cell.style.background = 'rgba(61,223,230,0.20)'; //LD: "I'm gonna touch you lil bro"
    else if(mode === 'read') cell.style.background = 'rgba(24,180,162,0.18)';//ST: "Oil up lil bro"
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

  function updateMemoryViewButtons(){
    const unifiedBtn = document.getElementById('mem-view-unified');
    const splitBtn = document.getElementById('mem-view-split');
    if(unifiedBtn) unifiedBtn.classList.toggle('active', memoryViewMode === 'unified');
    if(splitBtn) splitBtn.classList.toggle('active', memoryViewMode === 'split');
    const unifiedWrap = document.getElementById('unified-wrapper');
    const splitWrap = document.getElementById('split-wrapper');
    if(unifiedWrap) unifiedWrap.classList.toggle('hidden', memoryViewMode !== 'unified');
    if(splitWrap) splitWrap.classList.toggle('hidden', memoryViewMode !== 'split');
  }

  function setMemoryView(mode = 'unified'){
    memoryViewMode = (mode === 'split') ? 'split' : 'unified';
    updateMemoryViewButtons();
    updateAll();
  }

  /** Keeps the two editor panes (CodeMirror fallback) in sync with whatever we just loaded. */
  function setEditorBuffers(asmText = '', hexText = ''){
    if(CPU.editor){
      CPU.editor.setAsmText(asmText.trim());
      CPU.editor.setHexText(hexText.trim());
    } else {
      const asmEl = document.getElementById('assembler-in');
      if(asmEl) asmEl.value = asmText.trim();
      const hexEl = document.getElementById('machine-in');
      if(hexEl) hexEl.value = hexText.trim();
    }
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
    updateMemoryViewButtons();
    updateAll();
    const highlightBtn = document.getElementById('highlight-toggle-btn');
    if(highlightBtn){
      highlightBtn.addEventListener('click', toggleHighlightLookahead);
    }
    const unifiedBtn = document.getElementById('mem-view-unified');
    const splitBtn = document.getElementById('mem-view-split');
    if(unifiedBtn) unifiedBtn.addEventListener('click', ()=> setMemoryView('unified'));
    if(splitBtn) splitBtn.addEventListener('click', ()=> setMemoryView('split'));
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
    setMemoryView,
    init
  };
})(window);

