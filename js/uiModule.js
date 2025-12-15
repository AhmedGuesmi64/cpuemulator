// uiModule.js
// keeps the DOM barely alive without letting the emulator implode
//good luck trying to bebug this mess 
(function(coreTarget){
  // #region state & constants
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing.');

  const { state, utils, hooks } = CPU;
  let memoryViewMode = 'unified'; // 'unified' or 'split'
  let prevMem = new Uint8Array(CPU.config.MEM_SIZE);
  const EDITOR_STORAGE_KEY = 'cpuemu-editors';
  const sampleFallbacks = {
    add_two: {
      asm: `; add_two.asm
; Adds bytes at 0x20 and 0x21, drops the sum into 0x22, then halts.
LD [20], r0
LD [21], r1
ADD r2, r0, r1
ST r2, [22]
HALT`,
      hex: `00 20 01 21 A1 42 22 FF`
    },
    store_and_mix: {
      asm: `; store_and_mix.asm
; Copies a source byte to 0x40, mixes it with another value, stores to 0x41.
LD [30], r0      ; read first operand
ST r0, [40]      ; mirror the first operand into 0x40
LD [31], r1      ; read second operand
ADD r2, r0, r1   ; mix them into r2
ST r2, [41]      ; stash the sum at 0x41
HALT`,
      hex: `00 30 40 40 01 31 A1 42 41 FF`
    },
    loop_sum: {
      asm: `; loop_sum.asm
; Continuously adds the byte at 0x51 into 0x50 and loops forever.
LD [50], r0
LD [51], r1
ADD r0, r0, r1
ST r0, [50]
JMP 00`,
      hex: `00 50 01 51 81 40 50 C0`
    }
  };
  // #endregion state & constants

  // #region rendering & view helpers
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
    const changedAddrs = [];
    for(let i=0;i<CPU.config.MEM_SIZE;i++){
      if(state.mem[i] !== prevMem[i]) changedAddrs.push(i);
    }
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

    // flash cells that changed
    if(changedAddrs.length){
      flashChangedCells(changedAddrs);
      // #region agent log (disabled)
      // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      //   method:'POST',headers:{'Content-Type':'application/json'},
      //   body:JSON.stringify({
      //     sessionId:'debug-session',
      //     runId:'flash-fix',
      //     hypothesisId:'H1',
      //     location:'uiModule.js:updateAll',
      //     message:'memory changed',
      //     data:{mode:memoryViewMode,count:changedAddrs.length,addrs:changedAddrs.slice(0,8)},
      //     timestamp:Date.now()
      //   })
      // }).catch(()=>{});
      // #endregion
    }

    prevMem = Uint8Array.from(state.mem);

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
      // #region agent log (disabled)
      // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      //   method:'POST',headers:{'Content-Type':'application/json'},
      //   body:JSON.stringify({
      //     sessionId:'debug-session',
      //     runId:'highlight-toggle',
      //     hypothesisId:'H2',
      //     location:'uiModule.js:updateHighlightToggleLabel',
      //     message:'highlight toggle label update',
      //     data:{enabled:CPU.highlight.enabled, text:btn.textContent},
      //     timestamp:Date.now()
      //   })
      // }).catch(()=>{});
      // #endregion
    }
  }

  /** Button handler for the prev/next highlight toggle. */
  function toggleHighlightLookahead(){
    CPU.highlight.toggle();
    updateHighlightToggleLabel();
    updateAll();
  }

  function ensureToastStack(){
    let stack = document.getElementById('toast-stack');
    if(!stack){
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast(message, variant='info'){
    const stack = ensureToastStack();
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    stack.appendChild(toast);
    // #region agent log (disabled)
    // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
    //   method:'POST',headers:{'Content-Type':'application/json'},
    //   body:JSON.stringify({
    //     sessionId:'debug-session',
    //     runId:'step-limit',
    //     hypothesisId:'H3',
    //     location:'uiModule.js:showToast',
    //     message:'toast shown',
    //     data:{variant,message},
    //     timestamp:Date.now()
    //   })
    // }).catch(()=>{});
    // #endregion
    setTimeout(()=> toast.classList.add('fade'), 3200);
    setTimeout(()=> toast.remove(), 3800);
  }
  //I want to remove this but I'm scared of breaking everything
  function flashChangedCells(addrs){
    const unified = document.getElementById('unified-mem-table');
    const pm = document.getElementById('prog-mem-table');
    const dm = document.getElementById('data-mem-table');
    const applyFlash = (table, colIndex = 1)=>{
      if(!table) return;
      addrs.forEach(addr=>{
        const row = table.rows[addr+1];
        if(row && row.cells[colIndex]){
          const cell = row.cells[colIndex];
          cell.classList.add('mem-flash');
          setTimeout(()=> cell.classList.remove('mem-flash'), 260);
        }
      });
    };
    applyFlash(unified, 1);
    applyFlash(pm, 1);
    applyFlash(dm, 1);
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
  // #endregion rendering & view helpers

  // #region editor buffers & inputs
  /** Keeps the two editor panes (CodeMirror fallback) in sync with whatever we just loaded.
   * actually kind of proud of this function ngl
   */
  function setEditorBuffers(asmText = '', hexText = ''){
    if(CPU.editor){
      CPU.editor.setAsmText(asmText.trim());
      CPU.editor.setHexText(hexText.trim());
      CPU.editor.scrollEditorsToTop?.();
      if(asmText.trim() && !hexText.trim()){
        CPU.editor.scrollEditorIntoView?.('asm');
      } else if(hexText.trim() && !asmText.trim()){
        CPU.editor.scrollEditorIntoView?.('hex');
      }
      persistEditors(asmText, hexText);
      // #region agent log (disabled)
      // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      //   method:'POST',headers:{'Content-Type':'application/json'},
      //   body:JSON.stringify({
      //     sessionId:'debug-session',
      //     runId:'import-display',
      //     hypothesisId:'H2',
      //     location:'uiModule.js:setEditorBuffers',
      //     message:'scroll editors after set',
      //     data:{asmLen:asmText.length, hexLen:hexText.length, focus: asmText.trim() && !hexText.trim() ? 'asm' : hexText.trim() && !asmText.trim() ? 'hex' : 'both'},
      //     timestamp:Date.now()
      //   })
      // }).catch(()=>{});
      // #endregion
    } else {
      const asmEl = document.getElementById('assembler-in');
      if(asmEl) asmEl.value = asmText.trim();
      const hexEl = document.getElementById('machine-in');
      if(hexEl) hexEl.value = hexText.trim();
      persistEditors(asmText, hexText);
    }
  }

  /** One-click way to blank both textareas. */
  function clearSource(){
    setEditorBuffers('', '');
  }

  /** Accepts either .hex or .asm files via input/drag-drop and loads them. 
   * haha UX goes brrrrrrr
  */
  function readAndLoadFile(file){
    if(!file) return;
    file.text().then((txt)=>{
      const name = (file.name || '').toLowerCase();
      const trimmed = txt.trim();
      const isHex = name.endsWith('.hex') || /^[0-9A-Fa-f\s,]+$/.test(trimmed);
      // #region agent log (disabled)
      // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      //   method:'POST',headers:{'Content-Type':'application/json'},
      //   body:JSON.stringify({
      //     sessionId:'debug-session',
      //     runId:'import-display',
      //     hypothesisId:'H1',
      //     location:'uiModule.js:readAndLoadFile',
      //     message:'import file parsed',
      //     data:{name, isHex, length:trimmed.length},
      //     timestamp:Date.now()
      //   })
      // }).catch(()=>{});
      // #endregion
      if(name.endsWith('.hex') || /^[0-9A-Fa-f\s,]+$/.test(txt.trim())){
        const machineBox = document.getElementById('machine-in');
        if(machineBox) machineBox.value = trimmed;
        CPU.ui?.setEditorBuffers?.('', trimmed);
        CPU.assembler.loadMachineCodeFromString(trimmed);
      }else{
        const asmBox = document.getElementById('assembler-in');
        if(asmBox) asmBox.value = txt;
        CPU.ui?.setEditorBuffers?.(txt, '');
        CPU.assembler.assemble();
      }
    }).catch((err)=> hooks.showToast?.('Failed to read file: ' + (err && err.message ? err.message : err), 'error'));
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
    // also wire direct editor drops
    CPU.editor?.attachDropToEditors?.(handleEditorDrop);
  }
  // #endregion editor buffers & inputs

  // #region samples
  /**
   * Fetches one of the sample programs under /tests and loads it either
   * as ASM (assemble immediately) or HEX (direct memory load).
   */
  function loadSampleTest(name, format = 'asm'){
    const ext = format === 'hex' ? 'hex' : 'asm';
    const paths = [
      `tests/${name}.${ext}`,
      `./tests/${name}.${ext}`,
      `/tests/${name}.${ext}`
    ];

    const tryFetch = (idx=0)=>{
      if(idx >= paths.length) throw new Error('All sample paths failed');
      const url = paths[idx];
      return fetch(url)
        .then(resp=>{
          // #region log (disabled)
          // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
          //   method:'POST',headers:{'Content-Type':'application/json'},
          //   body:JSON.stringify({
          //     sessionId:'debug-session',
          //     runId:'sample-load',
          //     hypothesisId:'S1',
          //     location:'uiModule.js:loadSampleTest',
          //     message:'fetch status',
          //     data:{name, ext, path:url, ok:resp.ok, status:resp.status},
          //     timestamp:Date.now()
          //   })
          // }).catch(()=>{});
          // #endregion
          if(!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
          return resp.text();
        })
        .catch(err=>{
          if(idx < paths.length - 1){
            return tryFetch(idx+1);
          }
          throw err;
        });
    };

    tryFetch()
      .then(text=>{
        const trimmed = (text || '').trim();
        // #region log (disabled)
        // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
        //   method:'POST',headers:{'Content-Type':'application/json'},
        //   body:JSON.stringify({
        //     sessionId:'debug-session',
        //     runId:'sample-load',
        //     hypothesisId:'S2',
        //     location:'uiModule.js:loadSampleTest',
        //     message:'sample loaded',
        //     data:{name, ext, length:trimmed.length},
        //     timestamp:Date.now()
        //   })
        // }).catch(()=>{});
        // #endregion
        if(!trimmed){
          hooks.showToast?.('Sample file was empty—double-check the tests folder.', 'error');
          return;
        }
        if(ext === 'asm'){
          setEditorBuffers(trimmed, '');
          CPU.assembler.assemble();
          CPU.trace.log(`Sample ${name}.asm assembled`);
          CPU.editor?.scrollEditorIntoView?.('asm');
        } else {
          setEditorBuffers('', trimmed);
          CPU.assembler.loadMachineCodeFromString(trimmed);
          CPU.trace.log(`Sample ${name}.hex loaded`);
          CPU.editor?.scrollEditorIntoView?.('hex');
        }
      })
      .catch(err=>{
        const fb = sampleFallbacks[name];
        if(fb && fb[ext]){
          const trimmed = (fb[ext] || '').trim();
          // #region log (disabled)
          // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
          //   method:'POST',headers:{'Content-Type':'application/json'},
          //   body:JSON.stringify({
          //     sessionId:'debug-session',
          //     runId:'sample-load',
          //     hypothesisId:'S4',
          //     location:'uiModule.js:loadSampleTest',
          //     message:'fallback sample used',
          //     data:{name, ext, length:trimmed.length},
          //     timestamp:Date.now()
          //   })
          // }).catch(()=>{});
          // #endregion
          if(ext === 'asm'){
            setEditorBuffers(trimmed, '');
            CPU.assembler.assemble();
            CPU.trace.log(`Sample ${name}.asm assembled (fallback)`);
            CPU.editor?.scrollEditorIntoView?.('asm');
          } else {
            setEditorBuffers('', trimmed);
            CPU.assembler.loadMachineCodeFromString(trimmed);
            CPU.trace.log(`Sample ${name}.hex loaded (fallback)`);
            CPU.editor?.scrollEditorIntoView?.('hex');
          }
          return;
        }
        // #region log (disabled)
        // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
        //   method:'POST',headers:{'Content-Type':'application/json'},
        //   body:JSON.stringify({
        //     sessionId:'debug-session',
        //     runId:'sample-load',
        //     hypothesisId:'S3',
        //     location:'uiModule.js:loadSampleTest',
        //     message:'sample load failed',
        //     data:{name, ext, error: (err && err.message) || String(err)},
        //     timestamp:Date.now()
        //   })
        // }).catch(()=>{});
        // #endregion
        hooks.showToast?.(`Failed to load sample (${name}.${ext}): ${err && err.message ? err.message : err}`, 'error');
      });
  }
  // #endregion samples

  // #region legend & trace
  function toggleLegend(){
    // #region log (disabled)
    // try{
    //   fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
    //     method:'POST',headers:{'Content-Type':'application/json'},
    //     body:JSON.stringify({
    //       sessionId:'debug-session',
    //       runId:'legend-toggle',
    //       hypothesisId:'L0',
    //       location:'uiModule.js:toggleLegend',
    //       message:'legend toggle invoked',
    //       data:{},
    //       timestamp:Date.now()
    //     })
    //   }).catch(()=>{});
    // }catch(_){}
    // #endregion
    const list = document.getElementById('legend-list');
    const btn = document.getElementById('legend-toggle-btn');
    if(list && btn){
      const isCollapsed = list.classList.contains('collapsed');
      const nextCollapsed = !isCollapsed;
      list.classList.toggle('collapsed', nextCollapsed);
      btn.textContent = nextCollapsed ? 'Show Legend' : 'Hide Legend';
      // #region log (disabled)
      // try{
      //   fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      //     method:'POST',headers:{'Content-Type':'application/json'},
      //     body:JSON.stringify({
      //       sessionId:'debug-session',
      //       runId:'legend-toggle',
      //       hypothesisId:'L1',
      //       location:'uiModule.js:toggleLegend',
      //       message:'legend toggled',
      //       data:{collapsed:nextCollapsed},
      //       timestamp:Date.now()
      //     })
      //   }).catch(()=>{});
      // }catch(_){}
      // #endregion
    }
  }

  function exportTrace(){
    // #region log (disabled)
    // try{
    //   fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
    //     method:'POST',headers:{'Content-Type':'application/json'},
    //     body:JSON.stringify({
    //       sessionId:'debug-session',
    //       runId:'trace-export',
    //       hypothesisId:'E0',
    //       location:'uiModule.js:exportTrace',
    //       message:'exportTrace invoked',
    //       data:{},
    //       timestamp:Date.now()
    //     })
    //   }).catch(()=>{});
    // }catch(_){}
    // #endregion
    const traceEl = document.getElementById('trace');
    if(!traceEl){
      hooks.showToast?.('No trace to export', 'error');
      return;
    }
    const lines = Array.from(traceEl.querySelectorAll('.trace-entry')).map(n=>n.textContent || '');
    if(!lines.length){
      hooks.showToast?.('No trace entries to export', 'error');
      return;
    }
    const blob = new Blob([lines.join('\n')], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trace.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    hooks.showToast?.('Trace exported', 'info');
    // #region log (disabled)
    // try{
    //   fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
    //     method:'POST',headers:{'Content-Type':'application/json'},
    //     body:JSON.stringify({
    //       sessionId:'debug-session',
    //       runId:'trace-export',
    //       hypothesisId:'E1',
    //       location:'uiModule.js:exportTrace',
    //       message:'trace exported',
    //       data:{count:lines.length},
    //       timestamp:Date.now()
    //     })
    //   }).catch(()=>{});
    // }catch(_){}
    // #endregion
  }
  // #endregion legend & trace

  // #region persistence & editor utilities
  function persistEditors(asm, hex){
    try{
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ asm, hex }));
    }catch(_){}
  }

  function restoreEditors(){
    try{
      const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
      if(!raw) return;
      const obj = JSON.parse(raw);
      if(obj && (obj.asm || obj.hex)){
        setEditorBuffers(obj.asm || '', obj.hex || '');
      }
    }catch(_){}
  }

  function handleEditorDrop(e, target){
    const files = e.dataTransfer?.files;
    if(files && files.length){
      const file = files[0];
      file.text().then(txt=>{
        const isHex = /^[0-9A-Fa-f\s,]+$/.test(txt.trim());
        if(isHex){
          setEditorBuffers('', txt.trim());
          CPU.assembler.loadMachineCodeFromString(txt.trim());
          hooks.showToast?.(`Loaded HEX into ${target.toUpperCase()}`, 'info');
        } else {
          setEditorBuffers(txt, '');
          CPU.assembler.assemble();
          hooks.showToast?.(`Loaded ASM into ${target.toUpperCase()}`, 'info');
        }
      }).catch(err=>{
        hooks.showToast?.('Drop failed: ' + (err && err.message ? err.message : err), 'error');
      });
    } else {
      const text = e.dataTransfer?.getData('text') || '';
      const isHex = /^[0-9A-Fa-f\s,]+$/.test(text.trim());
      if(isHex){
        setEditorBuffers('', text.trim());
        CPU.assembler.loadMachineCodeFromString(text.trim());
        hooks.showToast?.(`Loaded HEX into ${target.toUpperCase()}`, 'info');
      } else if(text.trim()){
        setEditorBuffers(text, '');
        CPU.assembler.assemble();
        hooks.showToast?.(`Loaded ASM into ${target.toUpperCase()}`, 'info');
      }
    }
  }

  function clearAsm(){
    setEditorBuffers('', CPU.editor?.getHexText?.() || document.getElementById('machine-in')?.value || '');
  }

  function clearHex(){
    setEditorBuffers(CPU.editor?.getAsmText?.() || document.getElementById('assembler-in')?.value || '', '');
  }
  // #endregion persistence & editor utilities

  // #region init & wiring
  /**
   * Main entry point: registers hooks, initializes file input/drag-drop,
   * and ensures the highlight + trace mode buttons have the right state.
   */
  function init(){
    hooks.flashDataCell = flashDataCell;
    hooks.flashRegister = flashRegister;
    hooks.showToast = showToast;
    // #region log (disabled)
    // fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
    //   method:'POST',headers:{'Content-Type':'application/json'},
    //   body:JSON.stringify({
    //     sessionId:'debug-session',
    //     runId:'toast-wire',
    //     hypothesisId:'T1',
    //     location:'uiModule.js:init',
    //     message:'hooks.showToast wired',
    //     data:{wired:true},
    //     timestamp:Date.now()
    //   })
    // }).catch(()=>{});
    // #endregion
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
    restoreEditors();
    updateAll();
    const highlightBtn = document.getElementById('highlight-toggle-btn');
    if(highlightBtn){
      highlightBtn.addEventListener('click', toggleHighlightLookahead);
    }
    const legendBtn = document.getElementById('legend-toggle-btn');
    if(legendBtn){
      legendBtn.addEventListener('click', toggleLegend);
    }
    const traceExportBtn = document.getElementById('trace-export-btn');
    if(traceExportBtn){
      traceExportBtn.addEventListener('click', exportTrace);
    }
    const unifiedBtn = document.getElementById('mem-view-unified');
    const splitBtn = document.getElementById('mem-view-split');
    if(unifiedBtn) unifiedBtn.addEventListener('click', ()=> setMemoryView('unified'));
    if(splitBtn) splitBtn.addEventListener('click', ()=> setMemoryView('split'));
    const navUnified = document.getElementById('nav-mem-unified');
    const navSplit = document.getElementById('nav-mem-split');
    if(navUnified) navUnified.addEventListener('click', (e)=>{ e.preventDefault(); setMemoryView('unified'); });
    if(navSplit) navSplit.addEventListener('click', (e)=>{ e.preventDefault(); setMemoryView('split'); });
  }
  //I have the sneaking suspicion that this entire file is one giant region I also have a suspicion that I'm going to regret commenting out all these logs
  //but then again performance comes first
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
  // #endregion init & wiring
})(window);
//writen by Ahmed Guesmi

