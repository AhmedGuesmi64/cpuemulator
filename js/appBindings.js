// appBindings.js
// One place to expose every action to the window/global buttons.
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU vanished before bindings, which is really annoying.');

  CPU.ui.init();
  CPU.editor.init();
  CPU.trace.setMode('asm');
  CPU.assembler.tryLoadFromFragment();
  if(CPU.memoryView && CPU.memoryView.renderUnifiedTable){
    CPU.memoryView.renderUnifiedTable();
  }
  //this feels so wrong to do there's probably a better way to do this but eh if it works it works
  //also this is really weird because js doesn't really support OOP in the traditional sense so this works for now
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
    clearHex: ()=> CPU.ui.clearHex(),
    clearAsm: ()=> CPU.ui.clearAsm(),
    toggleHighlightLookahead: ()=> CPU.ui.toggleHighlightLookahead(),
    toggleLegend: ()=> CPU.ui.toggleLegend(),
    exportTrace: ()=> CPU.ui.exportTrace(),
    loadSampleTest: (name, format)=> CPU.ui.loadSampleTest(name, format),
    step: ()=> CPU.execution.safeStep(),
    run: ()=> CPU.execution.run(),
    animateExec: ()=> CPU.execution.animateExec(),
    stop: ()=> CPU.execution.stop(),
    reset: ()=> CPU.execution.reset(),
    restart: ()=> CPU.execution.restart(),
    exportProject: ()=> CPU.projectBundle.exportProject(),
    handleProjectImport: (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) CPU.projectBundle.importProjectFromFile(f); ev.target.value=''; }
  });
})(window);

