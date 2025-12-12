// executionModule.js
// Runs instructions, manages run/step/animate, and logs whatever happens.
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing, nothing to execute, story of my life.');

  const { state, utils, config, trace, hooks } = CPU;

  function advance(count){
    state.pc = utils.wrapAddr(state.pc + count);
    utils.refreshNextPc();
  }

  /**
   * Execute a single instruction sitting at the current PC and
   * update flags/regs/highlights accordingly.
   */
  function execInstr(){
    state.prevPc = state.pc;
    const opcode = state.mem[state.pc];
    const type = (opcode >>> 6) & 0x03;
    const op2 = (opcode >>> 4) & 0x03;
    const op1 = (opcode >>> 2) & 0x03;
    const op0 = opcode & 0x03;

    switch(type){
      case config.ISA_TYPE.LOAD: {
        const addr = state.mem[utils.wrapAddr(state.pc + 1)];
        state.regs[op0] = state.mem[addr] ?? 0;
        state.flags.Z = state.regs[op0] === 0;
        state.flags.C = false;
        hooks.flashDataCell(addr, 'read');
        hooks.flashRegister(op0);
        trace.log({ asm:`LD [${utils.toHex(addr)}] → ${utils.regName(op0)} = ${utils.toHex(state.regs[op0])}`, bytes:[opcode, addr] });
        advance(2);
        break;
      }

      case config.ISA_TYPE.STORE: {
        const addr = state.mem[utils.wrapAddr(state.pc + 1)];
        state.mem[addr] = state.regs[op0] & 0xFF;
        hooks.flashDataCell(addr, 'write');
        trace.log({ asm:`ST ${utils.regName(op0)} → [${utils.toHex(addr)}] = ${utils.toHex(state.mem[addr])}`, bytes:[opcode, addr] });
        advance(2);
        break;
      }

      case config.ISA_TYPE.ADD: {
        const sum = state.regs[op1] + state.regs[op0];
        state.regs[op2] = sum & 0xFF;
        state.flags.C = sum > 0xFF;
        state.flags.Z = state.regs[op2] === 0;
        hooks.flashRegister(op2);
        trace.log({ asm:`ADD ${utils.regName(op2)} = ${utils.regName(op1)} + ${utils.regName(op0)} → ${utils.toHex(state.regs[op2])}`, bytes:[opcode] });
        advance(1);
        break;
      }

      case config.ISA_TYPE.JMP: {
        const target = opcode & 0x3F;
        if(target === config.HALT_SENTINEL){
          trace.log({ asm:'HALT (JMP 3F sentinel)', bytes:[opcode] });
          state.halted = true;
        } else {
          trace.log({ asm:`JMP ${utils.toHex(target)}`, bytes:[opcode] });
        }
        state.pc = utils.wrapAddr(target);
        utils.refreshNextPc();
        break;
      }

      default: {
        trace.log({ asm:`UNK ${utils.toHex(opcode)} — halting`, bytes:[opcode] });
        state.halted = true;
        utils.refreshNextPc();
        break;
      }
    }
  }
  //Jesus mary and joesph this function is long and it makes me feel like I should take a shower after writing it

  /**
   * Wraps `execInstr` with bounds/exception checks so UI buttons can spam it.
   * Returns true if something actually ran.
   */
  function safeStep(){
    if(state.halted) return false;
    if(state.pc < 0 || state.pc >= config.MEM_SIZE){
      state.halted = true;
      utils.refreshNextPc();
      CPU.ui?.updateAll?.();
      return false;
    }
    try{
      execInstr();
    }catch(err){
      console.error('execInstr faceplanted', err);
      state.halted = true;
      utils.refreshNextPc();
      return false;
    }
    CPU.ui?.updateAll?.();
    return true;
  }

  /**
   * Blocking “run” mode—plows through RAM until HALT or a sanity limit.
   */
  function run(){
    stop();
    state.running = true;
    const MAX = 20000;
    let steps = 0;
    while(state.running && !state.halted && state.pc>=0 && state.pc<config.MEM_SIZE && steps < MAX){
      execInstr();
      steps++;
    }
    if(steps >= MAX) trace.log('Run bailed: step limit hit (again)');
    CPU.ui?.updateAll?.();
    state.running = false;
  }

  /** Reads the delay input and falls back to 400ms if users type nonsense. which usually do */
  function getAnimDelay(){
    const el = document.getElementById('anim-delay');
    const v = el ? parseInt(el.value,10) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 400;
  }

  let animRunning = false;
  let animHandle = null;

  /** Stops animation timers and marks the CPU as not running. */
  function stop(){
    animRunning = false;
    if(animHandle !== null){
      clearTimeout(animHandle);
      animHandle = null;
    }
    if(typeof coreTarget.animTimer !== 'undefined' && coreTarget.animTimer !== null){
      clearInterval(coreTarget.animTimer);
      coreTarget.animTimer = null;
    }
    state.running = false;
    trace.log('Execution stopped (again).');
  }

  /**
   * Friendly wrapper around setTimeout that step()s repeatedly
   * until HALT or the user clicks stop.
   */
  function animateExec(){
    if(animRunning){
      console.warn('Animation already spiraling');
      return;
    }
    stop();
    animRunning = true;
    state.running = true;
    trace.log('Animation pretending to be fancy');

    const loop = ()=>{
      if(!animRunning || state.halted || state.pc < 0 || state.pc >= config.MEM_SIZE){
        stop();
        return;
      }
      if(!safeStep()){
        stop();
        return;
      }
      animHandle = setTimeout(loop, getAnimDelay());
    };

    loop();
  }

  /** Hard reset for RAM/regs/trace plus a UI repaint. */
  function reset(){
    stop();
    config.stateReset();
    utils.refreshNextPc();
    CPU.ui?.updateAll?.();
  }

  /**
   * Soft restart: keep memory/register contents but jump back to PC 0
   * and clear the halted flag so the current program can rerun.
   */
  function restart(){
    state.pc = 0;
    state.halted = false;
    utils.refreshNextPc();
    CPU.trace.log('Restarted program counter');
    CPU.ui?.updateAll?.();
  }

  CPU.execution = {
    execInstr,
    safeStep,
    run,
    animateExec,
    stop,
    getAnimDelay,
    reset,
    restart
  };
})(window);

