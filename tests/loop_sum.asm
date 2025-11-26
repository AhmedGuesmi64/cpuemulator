; loop_sum.asm
; Continuously adds the byte at 0x51 into 0x50 and loops forever.
LD [50], r0
LD [51], r1
ADD r0, r0, r1
ST r0, [50]
JMP 00

