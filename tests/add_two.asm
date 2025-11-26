; add_two.asm
; Adds bytes at 0x20 and 0x21, drops the sum into 0x22, then halts.
LD [20], r0
LD [21], r1
ADD r2, r0, r1
ST r2, [22]
HALT

