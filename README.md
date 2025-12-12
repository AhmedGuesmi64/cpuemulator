# Small Lecture Processor Emulator

Browser-based toolchain for a tiny teaching CPU. It pairs a compact assembler with a live emulator so students can write mnemonics, assemble to machine code, and watch the fetch–decode–execute cycle with animated highlights.

## Architecture

- **coreState.js** — shared config/state (memory, registers, flags, PC), helpers, trace mode/timestamps, highlight state, sample programs.
- **assemblerModule.js** — assemble/disassemble, load hex, load samples, and apply programs to memory.
- **executionModule.js** — exec/step/run/animate/restart/reset; updates flags and trace.
- **uiModule.js** — renders unified/split memory tables, highlights operands/jumps/source/dest regs, handles flashes, file inputs, and view toggles.
- **editorEnhance.js** — CodeMirror setup for ASM/HEX with hints and theme.
- **projectBundle.js** — export/import project JSON (asm, hex, mem, regs, flags, PC).
- **appBindings.js** — wires everything to the window for button handlers.
- **themeToggle.js** — light/dark theme with persistence.
- **emulator.html** — main UI (top/secondary nav, editors, sample loader, memory view, status/controls, trace, project I/O).
- **index.html** — landing page with hero CTA, features, how-it-works, and docs links.

## Features

- Unified or split memory view with instruction-aware highlights (current/prev/next, operand bytes, jump targets, LD/ST operands, source/dest registers).
- ASM + HEX editors (CodeMirror) with autocomplete and line numbers.
- Execution controls: Step, Run, Animate, Restart (PC=0), Reset All, Stop; trace entries have millisecond timestamps and ASM/HEX toggle.
- Sample programs: `/tests` (`add_two`, `store_and_mix`, `loop_sum`) wired into the UI.
- Project export/import as `.cpuproj.json`.
- Light/dark theme toggle.

## Repository Layout

```
cpuemulator/
├── css/                # Theme shared by index/emulator
├── docs/               # Docs and status PDF
├── js/                 # Modular runtime (state, assembler, execution, UI, etc.)
├── tests/              # Sample ASM/HEX programs loaded from the UI
├── emulator.html       # Main emulator UI
├── index.html          # Landing page
└── README.md           # You are here
```

## Getting Started

1. Clone or download the folder.
2. Open the root directory in VS Code.
3. Install **Live Server** (Ritwick Dey).
4. Right-click `emulator.html` → **Open with Live Server** (auto-reloads on save).
5. Use the nav to open Emulator; load a sample or paste your own ASM/HEX.

Pure front-end; no node build or backend required.

## Manual Test Plan

1. **Samples:** Load `add_two`, `store_and_mix`, `loop_sum`; verify editors, trace, and highlights.
2. **Execution:** Step/Run/Animate/Stop/Restart/Reset; check PC/Next/Flags and memory/register highlights.
3. **Custom Program:** Paste ASM, Assemble, export `.hex`, Clear, re-import via HEX; confirm trace timestamps.
4. **Drag & Drop:** Drop a `/tests` file onto the import card; ensure it loads.
5. **Project I/O:** Export `.cpuproj.json`, clear state, import it; confirm asm/hex/mem/regs/flags restore.
6. **Theme:** Toggle light/dark; ensure nav, editor, and cards remain readable.

## Roadmap / Open Items

- Richer editor UX (diagnostics, search/replace).
- Optional configurable ISA description (JSON-driven).
- Additional landing-page polish if desired.
