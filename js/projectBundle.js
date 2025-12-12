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
    }
    CPU.utils.refreshNextPc();
    CPU.ui?.updateAll?.();
    CPU.trace.log('Project loaded');
  }

  function importProjectFromFile(file){
    if(!file) return;
    file.text().then(importProjectFromText).catch(err=>{
      alert('Failed to import project: ' + (err && err.message ? err.message : err));
    });
  }

  CPU.projectBundle = {
    exportProject,
    importProjectFromFile,
    importProjectFromText
  };
})(window);

