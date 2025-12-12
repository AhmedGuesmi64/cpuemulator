// assemblerModule.js
// glues together mnemonics, hex goo, and all the fun
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core vanished before assembler could even complain.');

  const { state, utils, config, samples } = CPU;

  /**
   * Light-weight disassembler for the tiny ISA.
   * Called for every memory row so keep it boring and fast.
   */
  function disasm(addr){
    const opcode = state.mem[addr];
    const type = (opcode >>> 6) & 0x03;
    const op2 = (opcode >>> 4) & 0x03;
    const op1 = (opcode >>> 2) & 0x03;
    const op0 = opcode & 0x03;
    const operand = state.mem[utils.wrapAddr(addr + 1)];

    switch(type){
      case config.ISA_TYPE.LOAD:
        return `LD [${utils.toHex(operand)}], ${utils.regName(op0)}`;
      case config.ISA_TYPE.STORE:
        return `ST ${utils.regName(op0)}, [${utils.toHex(operand)}]`;
      case config.ISA_TYPE.ADD:
        return `ADD ${utils.regName(op2)}, ${utils.regName(op1)}, ${utils.regName(op0)}`;
      case config.ISA_TYPE.JMP: {
        const target = opcode & 0x3F;
        return target === config.HALT_SENTINEL ? 'HALT' : `JMP ${utils.toHex(target)}`;
      }
      default:
        return `DB ${utils.toHex(opcode)}`;
    }
  }

  /**
   * Reads the assembler textarea, emits machine bytes,
   * and drops them straight into program memory.
   * also probably need to change the textarea to data so that I can add autocomplete and stuff
   * this funciton is longer than a morning's piss it feels so wrong to impliemnt it like this but eh fuck it
   */
  function assemble(){
    const src = (CPU.editor?.getAsmText?.() || '')
      .trim()
      .split(/\n/);
    const output = [];
    //for loop goes brrrr
    for(const raw of src){
      const line = raw.replace(/(;|#).*$/,'').trim();
      if(!line) continue;
      let match;

      try{
        if((match = line.match(/^LD\s*\[\s*([^\]]+)\s*\]\s*,\s*r([0-3])$/i))){
          const addr = utils.parseNumberLiteral(match[1]);
          if(addr < 0 || addr > 0xFF) throw new Error('LD address must sit between 0x00 and 0xFF');
          const reg = parseInt(match[2],10) & 0x03;
          output.push((config.ISA_TYPE.LOAD << 6) | reg, addr & 0xFF);
          continue;
        }

        if((match = line.match(/^ST\s*r([0-3])\s*,\s*\[\s*([^\]]+)\s*\]$/i))){
          const reg = parseInt(match[1],10) & 0x03;
          const addr = utils.parseNumberLiteral(match[2]);
          if(addr < 0 || addr > 0xFF) throw new Error('ST address must live inside 0x00-0xFF');
          output.push((config.ISA_TYPE.STORE << 6) | reg, addr & 0xFF);
          continue;
        }

        if((match = line.match(/^ADD\s*r([0-3])\s*,\s*r([0-3])\s*,\s*r([0-3])$/i))){
          const dest = parseInt(match[1],10) & 0x03;
          const src1 = parseInt(match[2],10) & 0x03;
          const src0 = parseInt(match[3],10) & 0x03;
          output.push((config.ISA_TYPE.ADD << 6) | (dest << 4) | (src1 << 2) | src0);
          continue;
        }

        if((match = line.match(/^JMP\s*([0-9A-Fa-fx]+)$/i))){
          const addr = utils.parseNumberLiteral(match[1]);
          if(addr < 0 || addr > 0x3F) throw new Error('JMP target is 0x00-0x3F, sorry not sorry');
          output.push((config.ISA_TYPE.JMP << 6) | (addr & 0x3F));
          continue;
        }

        if(/^HALT$/i.test(line)){
          output.push((config.ISA_TYPE.JMP << 6) | config.HALT_SENTINEL);
          continue;
        }

        throw new Error('no idea what that line was supposed to be');
      }catch(err){
        alert(`Assemble fail: ${err.message || err} (line: "${line}")`);
        return;
      }
    }

    state.mem.fill(0);
    const byteCount = Math.min(output.length, config.MEM_SIZE);
    for(let i=0;i<byteCount;i++) state.mem[i] = output[i] & 0xFF;
    if(output.length > config.MEM_SIZE){
      CPU.trace.log(`Warning: output chopped to ${config.MEM_SIZE} bytes because limits exist`);
    }
    state.pc = 0;
    state.halted = false;
    state.prevPc = null;
    utils.refreshNextPc();
    CPU.ui?.updateAll?.();
    CPU.trace.log({ asm:`Assembled ${byteCount} bytes`, hex: utils.bytesToHexString(output.slice(0, byteCount)) });
  }

  /** Pulls the hex textarea into memory. */
  function loadMachineCode(){
    const txt = (CPU.editor?.getHexText?.() || '').trim();
    if(!txt) return;
    loadMachineCodeFromString(txt);
  }

  /** Accepts a string of bytes (spaces or commas) and loads them verbatim.
   * 
   * god bless javascript for having such a great string interpolation system. It's so good I only wanted to throw my pc out like 9000 times only
   */
  function loadMachineCodeFromString(hexString){
    try{
      const parts = hexString.trim().split(/[\s,]+/).filter(Boolean);
      if(parts.some(x=>!/^[0-9A-Fa-f]{1,2}$/.test(x))) throw new Error('Found a non-hex goblin in there');
      state.mem.fill(0);
      parts.map(x=>parseInt(x,16)&0xFF).forEach((v,i)=>{ if(i<config.MEM_SIZE) state.mem[i]=v; });
      state.pc = 0;
      state.halted = false;
      state.prevPc = null;
      utils.refreshNextPc();
      CPU.ui?.updateAll?.();
      CPU.trace.log({ asm:`Loaded machine code (${Math.min(parts.length,config.MEM_SIZE)} bytes)`, hex: hexString });
    }catch(err){
      alert('Failed to load hex: ' + (err && err.message ? err.message : err));
    }
  }

  /**
   * Utility for sample loaders or fragment loaders.
   * Resets memory, applies any data defaults, and refreshes UI.
   * sweet jesus this function was a pain in the ass
   */
  function applyProgram(bytes, dataInit = {}, statusMessage = 'Program lobbed into memory'){
    state.mem.fill(0);
    bytes.forEach((value, index)=>{
      if(index < config.MEM_SIZE) state.mem[index] = value & 0xFF;
    });
    Object.entries(dataInit).forEach(([addr,val])=>{
      const idx = Number(addr) & config.ADDR_MASK;
      state.mem[idx] = val & 0xFF;
    });
    state.pc = 0;
    state.halted = false;
    state.prevPc = null;
    utils.refreshNextPc();
    const traceEl = document.getElementById('trace'); if(traceEl) traceEl.innerHTML = '';
    CPU.ui?.updateAll?.();
    CPU.trace.log(statusMessage);
  }

  /** Load Prof. Widmann’s exercise 22 sample and sync the editors. */
  function loadExercise22(){
    applyProgram(samples.exercise22.program, samples.exercise22.data, 'Exercise 22 dumped in');
    CPU.ui?.setEditorBuffers?.(samples.exercise22.asm, utils.bytesToHexString(samples.exercise22.program));
  }

  /** Same deal but with exercise 23. */
  function loadExercise23(){
    applyProgram(samples.exercise23.program, samples.exercise23.data, 'Exercise 23 dumped in');
    CPU.ui?.setEditorBuffers?.(samples.exercise23.asm, utils.bytesToHexString(samples.exercise23.program));
  }

  /** Historical alias for the old “load sample” button. */
  function loadSample(){
    loadExercise22();
  }

  /**
   * Parses #hex=... fragments so folks can deep-link programs
   * into the emulator without copy/paste gymnastics.
   */
  function tryLoadFromFragment(){
    const frag = window.location.hash.replace('#','');
    if(!frag) return;
    const params = new URLSearchParams(frag.replace(/\+/g,' '));
    if(params.has('hex')){
      try{
        const encoded = params.get('hex');
        const hex = decodeURIComponent(encoded);
        loadMachineCodeFromString(hex);
      }catch(err){
        console.warn('Fragment hex puked', err);
      }
    }
    if(frag.includes('loadSample')) loadSample();
    if(frag.includes('loadExercise23')) loadExercise23();
  }

  CPU.assembler = {
    disasm,
    assemble,
    loadMachineCode,
    loadMachineCodeFromString,
    applyProgram,
    loadExercise22,
    loadExercise23,
    loadSample,
    tryLoadFromFragment
  };
})(window);

