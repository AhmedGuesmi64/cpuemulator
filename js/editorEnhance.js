// editorEnhance.js
// CodeMirror setup for ASM and HEX editors with lightweight hints
(function(coreTarget){
  const CPU = coreTarget.CPU;
  if(!CPU) throw new Error('CPU core missing for editor enhance.');

  let asmEditor = null;
  let hexEditor = null;

  function defineModes(){
    if(!window.CodeMirror || !CodeMirror.defineSimpleMode) return;
    CodeMirror.defineSimpleMode('asmTiny', {
      start: [
        { regex: /;.*$/, token: 'comment' },
        { regex: /\b(LD|ST|ADD|JMP|HALT)\b/i, token: 'keyword' },
        { regex: /\br[0-3]\b/i, token: 'variable-2' },
        { regex: /0x[0-9A-Fa-f]+|\b[0-9A-Fa-f]+\b/, token: 'number' },
        { regex: /\[[^\]]+\]/, token: 'bracket' },
      ]
    });
    CodeMirror.defineSimpleMode('hexTiny', {
      start: [
        { regex: /;.*$/, token: 'comment' },
        { regex: /\b[0-9A-Fa-f]{1,2}\b/, token: 'number' },
        { regex: /[,]/, token: 'punctuation' }
      ]
    });
  }

  function makeHint(words){
    return function(cm){
      const cur = cm.getCursor();
      const token = cm.getTokenAt(cur);
      const start = token.start;
      const end = cur.ch;
      const str = token.string.slice(0, end - start);
      const list = words.filter(w => w.toUpperCase().startsWith(str.toUpperCase()));
      return {
        list,
        from: CodeMirror.Pos(cur.line, start),
        to: CodeMirror.Pos(cur.line, end)
      };
    };
  }

  function wireAutoHint(cm, helperName){
    if(!cm || !CodeMirror.hint || !CodeMirror.hint[helperName]) return;
    cm.on('keyup', (cmInstance, event)=>{
      const { key } = event;
      // only auto-trigger on alphanumerics/hex chars
      if(/^[0-9A-Za-z]$/.test(key)){
        CodeMirror.commands.autocomplete(cmInstance, CodeMirror.hint[helperName], { completeSingle:false });
      }
    });
  }

  function initEditors(){
    if(!window.CodeMirror) return;
    defineModes();

    const asmTextarea = document.getElementById('assembler-in');
    const hexTextarea = document.getElementById('machine-in');
    if(asmTextarea){
      asmEditor = CodeMirror.fromTextArea(asmTextarea, {
        lineNumbers: true,
        mode: 'asmTiny',
        theme: 'material-darker',
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Cmd-Space': 'autocomplete',
        },
        hintOptions: {
          hint: CodeMirror.hint.asmTiny,
          completeSingle: false
        }
      });
      CodeMirror.registerHelper('hint', 'asmTiny', makeHint(['LD','ST','ADD','JMP','HALT','r0','r1','r2','r3']));
      wireAutoHint(asmEditor, 'asmTiny');
    }
    if(hexTextarea){
      hexEditor = CodeMirror.fromTextArea(hexTextarea, {
        lineNumbers: true,
        mode: 'hexTiny',
        theme: 'material-darker',
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Cmd-Space': 'autocomplete',
        },
        hintOptions: {
          hint: CodeMirror.hint.hexTiny,
          completeSingle: false
        }
      });
      CodeMirror.registerHelper('hint', 'hexTiny', makeHint(['00','01','02','03','04','05','10','20','30','FF','C0','A1']));
      wireAutoHint(hexEditor, 'hexTiny');
    }
  }

  function getAsmText(){
    return asmEditor ? asmEditor.getValue() : (document.getElementById('assembler-in')?.value || '');
  }
  function getHexText(){
    return hexEditor ? hexEditor.getValue() : (document.getElementById('machine-in')?.value || '');
  }
  function setAsmText(val){
    if(asmEditor){ asmEditor.setValue(val || ''); asmEditor.refresh(); }
    else {
      const el = document.getElementById('assembler-in');
      if(el) el.value = val || '';
    }
  }
  function setHexText(val){
    if(hexEditor){ hexEditor.setValue(val || ''); hexEditor.refresh(); }
    else {
      const el = document.getElementById('machine-in');
      if(el) el.value = val || '';
    }
  }

  CPU.editor = {
    init: initEditors,
    getAsmText,
    getHexText,
    setAsmText,
    setHexText
  };
})(window);

