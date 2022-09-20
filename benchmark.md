# Introduction
This document records the time spent for running the whole UniGro16 protocol.
## Operating hardware
- CPU: Intel the 12-th Generation i3-12100F @3.3GHz
- Memory: 16GB @3200MHz
- Storage: WD Blue SN570
- OS: Windows

## EVM system
- 26 Circom subcircuits for 24 EVM instructions are implemented.
- The subcircuit information of each instruction is as follows,

|Index|Instruction|Opcode|NWires|NOutputs|NInputs|Note|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|0|Data load|0xfff|33|16|16|A virtual subcircuit managing data exchange in EVM stack with EVM memory and world storage.|
|1|ADD|0x01|5|1|2||
|2|MUL|0x02|4|1|2||
|3|SUB|0x03|5|1|2||
|4|DIV|0x04|5|1|2||
|5|SHA3|0x20|4|1|2|A virtual subcircuit doing nothing.|
|6|SDIV|0x05|41|1|2||
|7|MOD|0x06|5|1|2||
|8|SMOD|0x07|41|1|2||
|9|ADDMOD|0x08|7|1|2||
|10|MULMOD|0x09|8|1|3||
|11|EXP|0x0a|32|1|2||
|12|LT|0x10|255|1|2||
|13|GT|0x11|255|1|2||
|14|SLT|0x12|290|1|2||
|15|SGT|0x13|290|1|2||
|16|EQ|0x14|5|1|2||
|17|ISZERO|0x15|4|1|2||
|18|AND|0x16|760|1|2||
|19|OR|0x17|760|1|2||
|20|XOR|0x18|760|1|2||
|21|NOT|0x19|255|1|1||
|22|SHL|0x1b|18|1|2||
|23|SHR-L|0x1c1|19|1|2|A subcircuit of SHR for input value smaller than circom's modulo|
|24|SHR-H|0x1c2|19|1|2|A subcircuit of SHR for input value greater than circom's modulo|
|25|SAR|0x1d|286|1|2||

