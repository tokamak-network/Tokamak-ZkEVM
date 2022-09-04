# Decode algorithm for universal Groth16 for EVM

## Algorithm description
Decode parses a p-code (bytecode) of an EVM application to obtain the arithmetic opcodes (instructions) used and the connection of input and output wires among them. In specific, the goal of decode can be summarized in three folds:
1. To find the combination of arithmetic opcodes composing a p-code,
2. To find the connection of input and output wires among them, and
3. To generate instances (input and output values) of all the opcodes.

To express the wire connections, we mathmatically define a *wire map* $\rho: (k, i)\mapsto (k', i')$ for nonnegative integers $k, i, k', i'$, where $\rho(k,i) = (k',i')$ if the $i$-th (input) wire of the $k$-th arithmetic opcode takes its value from the $i'$-th (output) wire of the $k'$-th arithmetic opcode, or if $\rho(k,i) = (k,i)$ if $i$-th wire of the $k$-th arithmetic opcode takes its value from nowhere. It is useful that the wires indexed by the pre-image set $\rho^{-1}\[k',i']$ always share the same value, which will be used in *derive algorithm* of [universal Groth16 for EVM](https://github.com/Onther-Tech/UniGro16js/blob/master/README.md).

Decode finally outputs four things: the instance of a p-code, the array $s$ of indices of arithmetic opcodes used in a p-code, the array of circuit wires  $m=((k,i))$ such that $|\rho^{-1}\[k,i]|>=1$, the input-output connections $\rho^{-1}\[k,i]$ for all $(k,i) \in m$. Later, the derive will takes them as inputs to generate proving and verifying keys for each wire of a specific circuit (p-code-specific) by linearly combining the elements in universal reference string indexd by $\rho^{-1}\[k,i]$.

## Implementation (Demo. Ver.)
The current version of implementation does not provide a user interface, which will be updated in the future version.

### How to use
1. Open DecodeScript.m
2. Modify the path to input p-code (txt file).
3. Modify the environment data part to hardcode environment data such as calldata, value, caller address, and caller valance.
4. Modify the storage data part and the storage keys part to hardcode storage data and keys.
5. Modify the output storage paths.
6. Run DecodeScript.m
7. Find 4 output files "OpList.bin", "Set_I_P.bin", "Set_I_V.bin", "WireList.bin" and 1 output directory "instance".
