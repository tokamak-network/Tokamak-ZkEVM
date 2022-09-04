# Decode algorithm for universal Groth16 for EVM

## Algorithm description
Decode parses a p-code (bytecode) of an EVM application to obtain the arithmetic opcodes (instructions) used and the connection of input and output wires among them. In specific, the goal of decode can be summarized in three folds:
1. To find the combination of arithmetic opcodes composing a p-code,
2. To find the connection of input and output wires among them, and
3. To generate instances (input and output values) of all the opcodes.
To express the wire connections, we mathmatically define a *wire map* $\rho: (k, i)\mapsto (k', i')$ for nonnegative integers $k, i, k', i'$, where $\rho(k,i) = (k',i')$ if the $i$-th (input) wire of the $k$-th arithmetic opcode takes its value from the $i'$-th (output) wire of the $k'$-th arithmetic opcode. 
