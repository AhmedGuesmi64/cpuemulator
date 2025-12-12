// memoryView.js
// Unified von Neumann-ish memory renderer (shows program + data in one table)
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing for memoryView.');

  const { state, utils } = CPU;

  function renderUnifiedTable(){
    const table = document.getElementById('unified-mem-table');
    if(!table) return;

    const instrCtx = coreTarget.getCurrentInstructionContext
      ? coreTarget.getCurrentInstructionContext()
      : null;
    const dataOperandSet = new Set(instrCtx?.dataOperands || []);
    const immRowSet = new Set(instrCtx?.immediateRows || []);
    const jumpTargetSet = new Set(instrCtx?.jumpTargets || []);

    let rows = '<tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Disasm</th></tr>';
    for(let i=0;i<CPU.config.MEM_SIZE;i++){
      const isCurrent = (i === state.pc);
      const isPrev    = CPU.highlight.enabled && state.prevPc !== null && i === state.prevPc;
      const isNext    = CPU.highlight.enabled && state.nextPc !== null && i === state.nextPc;

      const classes = [];
      if(isCurrent) classes.push('pm-current');
      else if(isPrev) classes.push('pm-prev');
      else if(isNext) classes.push('pm-next');
      if(immRowSet.has(i)) classes.push('pm-operand-byte');
      if(jumpTargetSet.has(i)) classes.push('pm-target');
      if(dataOperandSet.has(i)) classes.push('dm-operand');

      rows += `<tr class="${classes.join(' ')}">
        <td>${utils.toHex(i)}</td>
        <td contenteditable="true" onblur="editMem(${i}, this.innerText)">${utils.toHex(state.mem[i])}</td>
        <td>${state.mem[i]}</td>
        <td>${(CPU.assembler?.disasm(i)) || '??'}</td>
      </tr>`;
    }
    table.innerHTML = rows;
  }

  CPU.memoryView = { renderUnifiedTable };
})(window);

