// projectBundle.js
// Save/load a bundle of asm/hex/mem/regs/flags/pc as a JSON file
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing for project bundle.');

  function exportProject(){
    const payload = {
      version: 1,
      asm: CPU.editor?.getAsmText?.() || '',
      hex: CPU.editor?.getHexText?.() || '',
      mem: Array.from(CPU.state.mem || []),
      regs: Array.from(CPU.state.regs || []),
      flags: { ...CPU.state.flags },
      pc: CPU.state.pc,
      halted: CPU.state.halted,
      running: CPU.state.running,
      prevPc: CPU.state.prevPc,
      nextPc: CPU.state.nextPc
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.cpuproj.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importProjectFromText(txt){
    const obj = JSON.parse(txt);
    if(!obj || typeof obj !== 'object') throw new Error('Invalid project file');
    const { mem, regs, flags, pc, halted, running, prevPc, nextPc, asm, hex } = obj;
    // stop any running animation before we mutate state
    if(coreTarget.stop) coreTarget.stop();
    if(CPU.execution && CPU.execution.stop) CPU.execution.stop();
    CPU.state.running = false;

    if(Array.isArray(mem)) mem.forEach((v,i)=>{ if(i < CPU.config.MEM_SIZE) CPU.state.mem[i] = v & 0xFF; });
    if(Array.isArray(regs)) regs.forEach((v,i)=>{ if(i < CPU.state.regs.length) CPU.state.regs[i] = v & 0xFF; });
    if(flags && typeof flags === 'object'){
      CPU.state.flags.Z = !!flags.Z;
      CPU.state.flags.C = !!flags.C;
    }
    if(typeof pc === 'number') CPU.state.pc = pc & 0xFF;
    CPU.state.halted = !!halted;
    CPU.state.running = false; // always start idle after import
    CPU.state.prevPc = (typeof prevPc === 'number') ? prevPc & 0xFF : null;
    CPU.state.nextPc = (typeof nextPc === 'number') ? nextPc & 0xFF : null;
    if(CPU.editor){
      if(typeof asm === 'string') CPU.editor.setAsmText(asm);
      if(typeof hex === 'string') CPU.editor.setHexText(hex);
      CPU.editor.scrollEditorsToTop?.();
      if(asm && !hex) CPU.editor.scrollEditorIntoView?.('asm');
      else if(hex && !asm) CPU.editor.scrollEditorIntoView?.('hex');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'import-display',
          hypothesisId:'H3',
          location:'projectBundle.js:importProjectFromText',
          message:'project import set editors + scrolled',
          data:{asmLen:(asm||'').length, hexLen:(hex||'').length, focus: asm && !hex ? 'asm' : hex && !asm ? 'hex' : 'both'},
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
    }
    CPU.utils.refreshNextPc();
    CPU.ui?.updateAll?.();
    CPU.trace.log('Project loaded');
  }

  function importProjectFromFile(file){
    if(!file) return;
    file.text().then(importProjectFromText).catch(err=>{
      CPU.hooks?.showToast?.('Failed to import project: ' + (err && err.message ? err.message : err), 'error');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'toast-debug',
          hypothesisId:'T4',
          location:'projectBundle.js:importProjectFromFile',
          message:'project import error toast',
          data:{name:file && file.name},
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
    });
  }

  CPU.projectBundle = {
    exportProject,
    importProjectFromFile,
    importProjectFromText
  };
})(window);

