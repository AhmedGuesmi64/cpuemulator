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

  function scrollEditorsToTop(){
    if(asmEditor){
      asmEditor.scrollTo(null, 0);
      asmEditor.setCursor(0,0);
    } else {
      const el = document.getElementById('assembler-in');
      if(el) el.scrollTop = 0;
    }
    if(hexEditor){
      hexEditor.scrollTo(null, 0);
      hexEditor.setCursor(0,0);
    } else {
      const el = document.getElementById('machine-in');
      if(el) el.scrollTop = 0;
    }
  }

  function scrollEditorIntoView(which){
    const useEditor = which === 'asm' ? asmEditor : hexEditor;
    const fallbackId = which === 'asm' ? 'assembler-in' : 'machine-in';
    const el = useEditor?.getWrapperElement ? useEditor.getWrapperElement() : document.getElementById(fallbackId);
    const target = el || document.body;
    const rect = target.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - 120; // offset to clear sticky nav + breathing room
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/89a61684-f466-4725-bf91-45e7dcbb8029',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'import-display',
        hypothesisId:'H4',
        location:'editorEnhance.js:scrollEditorIntoView',
        message:'scroll to editor',
        data:{which, target: useEditor ? 'codemirror' : 'textarea', rectTop: rect.top},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    window.scrollTo({ top: targetY, behavior:'smooth' });
  }

  function attachDropToEditors(onDrop){
    const wire = (el, which)=>{
      if(!el) return;
      el.addEventListener('dragover', (e)=>{ e.preventDefault(); el.classList.add('drop-highlight'); });
      el.addEventListener('dragleave', ()=> el.classList.remove('drop-highlight'));
      el.addEventListener('drop', (e)=>{
        e.preventDefault();
        el.classList.remove('drop-highlight');
        onDrop(e, which);
      });
    };
    wire(asmEditor?.getWrapperElement?.(), 'asm');
    wire(hexEditor?.getWrapperElement?.(), 'hex');
    wire(document.getElementById('assembler-in'), 'asm');
    wire(document.getElementById('machine-in'), 'hex');
  }

  CPU.editor = {
    init: initEditors,
    getAsmText,
    getHexText,
    setAsmText,
    setHexText,
    scrollEditorsToTop,
    scrollEditorIntoView,
    attachDropToEditors
  };
})(window);

