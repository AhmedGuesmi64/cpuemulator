; store_and_mix.asm
; Copies a source byte to 0x40, mixes it with another value, stores to 0x41.
LD [30], r0      ; read first operand
ST r0, [40]      ; mirror the first operand into 0x40
LD [31], r1      ; read second operand
ADD r2, r0, r1   ; mix them into r2
ST r2, [41]      ; stash the sum at 0x41
HALT

