// coreState.js
// Shared “brain” for the emulator. Keeps the config, the live state,
// and all those tiny helpers in one place so every other module can breathe.
(function(coreTarget){
  const CPU = coreTarget.CPU || (coreTarget.CPU = {});

  // just enough config to remind me how small this "CPU" is
  const MEM_SIZE = 256;
  const ADDR_MASK = MEM_SIZE - 1;
  const ISA_TYPE = Object.freeze({
    LOAD : 0,
    STORE: 1,
    ADD  : 2,
    JMP  : 3
  });
  const REG_LABELS = ['r0','r1','r2','r3'];
  const HALT_SENTINEL = 0x3F;

  /**
   * Everything the pretend CPU needs to remember between steps.
   * Other modules poke this directly, so try not to mutate it blindly.
   * Update: I did mutate it blindly anyway because JS is weird like that.
   */
  const state = {
    mem: new Uint8Array(MEM_SIZE).fill(0),
    regs: [0,0,0,0],
    flags: { Z:false, C:false },
    pc: 0,
    halted: false,
    running: false,
    prevPc: null,
    nextPc: null
  };

  /**
   * Hooks for UI callbacks. uiModule assigns the real functions later.
   */
  const hooks = {
    flashDataCell: ()=>{},
    flashRegister: ()=>{},
    onStateRendered: ()=>{},
    onHighlightChange: ()=>{},
    onTraceModeChange: ()=>{},
  };

  // --- helpers ---
  /** Turn any number into an uppercase hex string (00 by default). */
  function toHex(x, pad = 2){
    return (x & 0xFF).toString(16).toUpperCase().padStart(pad,'0');
  }

  /** Serialize a pile of bytes so humans can read it in the trace/editor. */
  function bytesToHexString(iterable){
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function') return '';
    return Array.from(iterable, v => toHex(Number(v) || 0)).join(' ');
  }

  function wrapAddr(value){ return value & ADDR_MASK; }

  function regName(index){ return REG_LABELS[index & 0x03]; }

  /**
   * Accepts raw numbers, hex with 0x, or bare hex. Throws when nonsense shows up.
   */
  function parseNumberLiteral(token){
    if(!token) throw new Error('no number provided');
    const trimmed = token.trim();
    let value;
    if(/^0x[0-9a-f]+$/i.test(trimmed)) value = parseInt(trimmed,16);
    else if(/^[0-9]+$/i.test(trimmed)) value = parseInt(trimmed,10);
    else if(/^[0-9a-f]+$/i.test(trimmed)) value = parseInt(trimmed,16);
    else throw new Error(`"${token}" is not a number no matter how hard I squint`);
    if(!Number.isFinite(value)) throw new Error(`"${token}" blew up my parser`);
    return value;
  }

  /** Returns instruction length in bytes so we can guess the next PC. */
  function instructionLengthFromOpcode(opcode){
    const type = (opcode >>> 6) & 0x03;
    return (type === ISA_TYPE.LOAD || type === ISA_TYPE.STORE) ? 2 : 1;
  }

  /** Predicts the PC after executing whatever sits at `addr`. */
  function computeNextPcFrom(addr){
    if(typeof addr !== 'number' || addr < 0 || addr >= MEM_SIZE) return null;
    const opcode = state.mem[addr];
    if(typeof opcode !== 'number') return null;
    const type = (opcode >>> 6) & 0x03;
    if(type === ISA_TYPE.JMP){
      const target = opcode & 0x3F;
      return target === HALT_SENTINEL ? null : wrapAddr(target);
    }
    return wrapAddr(addr + instructionLengthFromOpcode(opcode));
  }

  /** Updates `state.nextPc` using the current PC + opcode. */
  function refreshNextPc(){
    state.nextPc = state.halted ? null : computeNextPcFrom(state.pc);
  }

  // --- trace handling because apparently console.log is not enough ---
  const trace = {
    mode: 'asm',
    maxEntries: 200
  };

  /** Massage trace entries so both ASM and HEX strings exist. */
  function normalizeTraceRecord(entry){
    if(typeof entry === 'string' || typeof entry === 'number'){
      const text = String(entry);
      return { asm:text, hex:text };
    }
    if(entry && typeof entry === 'object'){
      const clone = { ...entry };
      if(Array.isArray(clone.bytes) && !clone.hex){
        clone.hex = bytesToHexString(clone.bytes);
      }
      const fallback = clone.text || clone.asm || clone.hex || '';
      return {
        asm: clone.asm || fallback,
        hex: clone.hex || fallback
      };
    }
    return { asm:'', hex:'' };
  }

  /** Decide which version (asm/hex) should be shown for the current mode. */
  function traceTextForMode(record){
    return trace.mode === 'hex'
      ? (record.hex || record.asm || '')
      : (record.asm || record.hex || '');
  }

  /**
   * Pushes a trace line to the log, keeping data-* copies of both asm/hex.
   * UI toggles can swap instantly without recomputing anything expensive.
   * NOTE: would be cool to log the data and do some fun stuff later like filtering and performance and all that jazz
   */
  function formatTimestamp(){
    const d = new Date();
    const hr = `${d.getHours()}`.padStart(2,'0');
    const min = `${d.getMinutes()}`.padStart(2,'0');
    const sec = `${d.getSeconds()}`.padStart(2,'0');
    const ms = `${d.getMilliseconds()}`.padStart(3,'0');
    return `${hr}:${min}:${sec}.${ms}`;
  }
  // --- main trace logging function ---
  //I also love this idea cause you can actually use the trace for debugging and stuff that is of course if 
  //the emulator works as intended
  function logTrace(entry){
    const target = document.getElementById('trace');
    if(!target) return;
    const record = normalizeTraceRecord(entry);
    const node = document.createElement('div');
    node.className = 'trace-entry';
    node.dataset.asm = record.asm || '';
    node.dataset.hex = record.hex || record.asm || '';
    const stamp = formatTimestamp();
    node.dataset.timestamp = stamp;
    node.textContent = `[${stamp}] ${traceTextForMode(record)}`;
    target.prepend(node);
    while(target.children.length > trace.maxEntries){
      target.removeChild(target.lastChild);
    }
  }

  /** Re-render every trace row whenever the mode changes. */
  function applyTraceMode(){
    const target = document.getElementById('trace');
    if(!target) return;
    target.querySelectorAll('.trace-entry').forEach((node)=>{
      const body = trace.mode === 'hex'
        ? (node.dataset.hex || node.dataset.asm || '')
        : (node.dataset.asm || node.dataset.hex || '');
      const stamp = node.dataset.timestamp ? `[${node.dataset.timestamp}] ` : '';
      node.textContent = stamp + body;
    });
    hooks.onTraceModeChange(trace.mode);
  }

  /** Public switch that also notifies the UI toggle buttons. */
  function setTraceMode(mode = 'asm'){
    trace.mode = mode === 'hex' ? 'hex' : 'asm';
    applyTraceMode();
  }

  // --- highlight switch because apparently color helps me think call that 'tism moment ---
  const highlight = {
    enabled: true,
    toggle(){
      this.enabled = !this.enabled;
      hooks.onHighlightChange(this.enabled);
    }
  };

  // --- sample programs ripped from the lecture PDF so I stop retyping ---
  const samples = {
    exercise22: {
      program: [
        0x00, 0x30,
        0x01, 0x31,
        0xB4,
        0x02, 0x32,
        0xBB,
        0x43, 0x33,
        0xC0
      ],
      asm: [
        'LD [30], r0',
        'LD [31], r1',
        'ADD r3, r1, r0',
        'LD [32], r2',
        'ADD r3, r2, r3',
        'ST r3, [33]',
        'JMP 00'
      ].join('\n'),
      data: { 0x30:0x05, 0x31:0x07, 0x32:0x09 }
    },
    exercise23: {
      program: [
        0xCA,
        0xBF,
        0x00, 0x10,
        0x43, 0xF0,
        0xFF,
        0xDA
      ],
      asm: [
        'JMP 0A',
        'ADD r3, r3, r3',
        'LD [10], r0',
        'ST r3, [F0]',
        'HALT',
        'JMP 1A'
      ].join('\n'),
      data: {}
    }
  };

  /** Wipe RAM, registers, PC, trace – basically puts everything back to zero. I want to call it the nuclear button but I'm supposed to professional*/
  function resetState(){
    state.mem.fill(0);
    state.regs.forEach((_, i)=> state.regs[i] = 0);
    state.flags.Z = false;
    state.flags.C = false;
    state.pc = 0;
    state.halted = false;
    state.running = false;
    state.prevPc = null;
    refreshNextPc();
    const traceEl = document.getElementById('trace');
    if(traceEl) traceEl.innerHTML = '';
  }

  CPU.config = { MEM_SIZE, ADDR_MASK, ISA_TYPE, REG_LABELS, HALT_SENTINEL };
  CPU.state = state;
  CPU.utils = {
    toHex,
    bytesToHexString,
    wrapAddr,
    regName,
    parseNumberLiteral,
    instructionLengthFromOpcode,
    computeNextPcFrom,
    refreshNextPc
  };
  CPU.trace = {
    log: logTrace,
    setMode: setTraceMode,
    applyMode: applyTraceMode,
    normalize: normalizeTraceRecord,
    textForMode: traceTextForMode,
    getMode: ()=> trace.mode
  };
  CPU.highlight = highlight;
  CPU.hooks = hooks;
  CPU.samples = samples;
  CPU.config.stateReset = resetState;
})(window);

