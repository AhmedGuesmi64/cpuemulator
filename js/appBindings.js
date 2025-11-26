// appBindings.js
// One place to expose every action to the window/global buttons.
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU vanished before bindings, which is really annoying.');

  CPU.ui.init();
  CPU.trace.setMode('asm');
  CPU.assembler.tryLoadFromFragment();

  Object.assign(coreTarget, {
    assemble: ()=> CPU.assembler.assemble(),
    loadMachineCode: ()=> CPU.assembler.loadMachineCode(),
    loadMachineCodeFromString: (txt)=> CPU.assembler.loadMachineCodeFromString(txt),
    loadExercise22: ()=> CPU.assembler.loadExercise22(),
    loadExercise23: ()=> CPU.assembler.loadExercise23(),
    loadSample: ()=> CPU.assembler.loadSample(),
    setTraceMode: (mode)=> CPU.trace.setMode(mode),
    editMem: (idx, txt)=> CPU.ui.editMem(idx, txt),
    clearSource: ()=> CPU.ui.clearSource(),
    toggleHighlightLookahead: ()=> CPU.ui.toggleHighlightLookahead(),
    loadSampleTest: (name, format)=> CPU.ui.loadSampleTest(name, format),
    step: ()=> CPU.execution.safeStep(),
    run: ()=> CPU.execution.run(),
    animateExec: ()=> CPU.execution.animateExec(),
    stop: ()=> CPU.execution.stop(),
    reset: ()=> CPU.execution.reset(),
    restart: ()=> CPU.execution.restart()
  });
})(window);

