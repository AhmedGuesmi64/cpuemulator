# Small Lecture Processor Emulator

Browser-based toolchain that mirrors Prof. Widmann’s “Small Example Processor” from. It pairs a compact assembler with a live emulator so students can write mnemonics, assemble to machine code, and watch the fetch–decode–execute cycle with animated highlights.

## Features

- **Modular runtime:** `coreState`, `assemblerModule`, `executionModule`, `uiModule`, and `appBindings` split responsibilities for state, ISA encoding, execution control, UI wiring, and global bindings.
- **Assembly + hex editors:** paste mnemonics or raw bytes, assemble or load directly, and drag/drop `.asm`/`.hex` files into the emulator.
- **Execution controls:** Step/Run/Animate, plus `Restart` (jump to PC 0) and `Reset All` (clear RAM/trace). Trace entries include millisecond timestamps and can toggle between ASM and machine-code views.
- **Instruction-aware highlighting:** current/previous/next rows, operand bytes, jump targets, source vs destination registers, and LD/ST operand addresses are color-coded per the professors’ request.
- **Sample programs:** `/tests` contains paired `.asm`/`.hex` files (`add_two`, `store_and_mix`, `loop_sum`) wired into the UI for quick demos.
- **Docs + status:** `docs/README.html` and `docs/Status Ahmed 2025-10-29-1.pdf` capture the lecture brief, requirements, and meeting notes.

## Repository Layout

```
cpuemulator/
├── css/                # Theme shared by index, emulator, editor
├── docs/               # PDF + HTML docs from the course brief
├── js/                 # Modular runtime (state, assembler, execution, UI)
├── tests/              # Sample ASM/HEX programs loaded from the UI
├── emulator.html       # Main emulator UI
├── index.html          # Landing page with links to docs/emulator
├── Editor.html         # Legacy editor (optional)
└── README.md           # You are here
```

## Getting Started

1. Clone the repo (or download the folder).
2. Open the root directory in VS Code.
3. Install the **Live Server** extension (Ritwick Dey).
4. Right-click `emulator.html` → **Open with Live Server**. The browser auto-reloads whenever you save code.
5. Click a sample (ASM or HEX) to load prebuilt programs, or paste your own code in the editor areas.

The editor uses pure front-end JS—no node build step or backend server required.

## Manual Test Plan

1. **Load Samples:** Use the Sample Programs card (`add_two`, `store_and_mix`, `loop_sum`) and verify both editors, trace, and highlights update.
2. **Execution Controls:** Step, Run, Animate, Stop, Restart, and Reset on each program. Watch the status pill (Ready/Running/Halted), PC/Next PC, and register/memory highlights.
3. **Custom Program:** Paste mnemonics, Assemble, export `.hex`, Clear, re-import via the hex editor, and confirm trace entries show timestamps.
4. **Drag & Drop:** Drop any file from `/tests` onto the import card to confirm the drag handler runs.
5. **Error Handling:** Enter invalid hex (e.g., `GG 12`) and ensure the UI alerts instead of crashing.
