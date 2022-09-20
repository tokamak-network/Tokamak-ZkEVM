# 1. Introduction
This document records the time spent for running the whole UniGro16 protocol.
## 1.1. Operating hardware
- CPU: Intel the 12-th Generation i3-12100F @3.3GHz
- Memory: 16GB @3200MHz
- Storage: WD Blue SN570
- OS: Windows

## 1.2. EVM system
- 26 Circom subcircuits for 24 EVM instructions are implemented.
- The subcircuit information of each instruction is as follows,

|Index|Instruction|Opcode|NWires|NOutputs|NInputs|Note|
|:---:|:---:|:---:|:---:|:---:|:---:|:---|
|0|Data load|0xfff|33|16|16|A virtual subcircuit managing data exchange in EVM stack with EVM memory and world storage|
|1|ADD|0x01|5|1|2||
|2|MUL|0x02|4|1|2||
|3|SUB|0x03|5|1|2||
|4|DIV|0x04|5|1|2||
|5|SHA3|0x20|4|1|2|A virtual subcircuit doing nothing|
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

## 1.3. Test EVM Applications
### 1.3.1. Schnorr protocol proving algorithm
- Pseudocode

```
Storage inputs: x, y, g, p
Storage outputs: t, r
1. v <= x**x (mod p)
2. t <= g**v (mod p)
3. c <= g**y (mod p)
4. r <= (v-cx) (mod p-1)
5. return Keccak256((r|0))
```
- EVM bytecode
```
0x6000546000540a6003549006806000526002540a60035490066004556001546002540a60035490066000540260016003540303600160035403900660016003540360005106016001600354039006806005556020526040602060006040522060605260206060f3
```

### 1.3.2. Ether transfer smart contract
- Solidity
```
pragma solidity >=0.7.0 <0.9.0;

contract transferContract {
  address public receiverAddr;
  function transferEther(uint _amount) public payable {
      payable(receiverAddr).transfer(_amount);
  }
}
```
- EVM bytecode of a transaction
```
0x608060405260043610601c5760003560e01c806373ffd5b7146021575b600080fd5b60376004803603810190603391906095565b6039565b005b3373ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f19350505050158015607e573d6000803e3d6000fd5b5050565b600081359050608f8160cc565b92915050565b60006020828403121560a85760a760c7565b5b600060b4848285016082565b91505092915050565b6000819050919050565b600080fd5b60d38160bd565b811460dd57600080fd5b5056fea2646970667358221220636baf301ef7dcfbad4a06503059606cddffb049b12f23eef7f26f8899149d7d64736f6c63430008070033
```

# 2. Benchmarks
## 2.1. Schnorr protocol proving algorithm
- The number of arithmetic instructions: 18
- The number of circuit wires: 130
- The degree of QAP (bivariate) polynomials: (64, 32)
- Test results:

|Results (in secs)|BuildQAP|Setup|Derive|Prove|Verify|Note|
|:---|:---:|:---:|:---:|:---:|:---:|:---|
|Overall time|6.2|11.9|7.89|12.32|0.9||
|Time for EC exponentiations|-|4.15|5.25|1.67|0||
|Time for polynomial arithmetics w/o division|0|-|0.48|2.97|-||
|Time for polynomial division|-|-|-|6.08|-|FFT is not applied for now|
|Time for storage access|5.66|0.79|0.88|0.84|0||
|Time for pairing and hashing|-|-|-|-|0||

## 2.2. Ether transfer smart contract
- The number of arithmetic instructions: 21
- The number of circuit wires: 2615
- The degree of QAP (bivariate) polynomials: (1024, 32)
- Test results:

|Results (in mins)|BuildQAP|Setup|Derive|Prove|Verify|Note|
|:---|:---:|:---:|:---:|:---:|:---:|:---|
|Overall time|1.17|6.03|17.59|5.94 hours|1.7 secs||
|Time for EC exponentiations|-|4.73|1.94|0.44|0||
|Time for polynomial arithmetics w/o division|0.71|-|5.84|14.19|-||
|Time for polynomial division|-|-|-|5.62 hours|-|FFT is not applied for now|
|Time for storage access|0.45|1.07|6.76|4.31|0||
|Time for pairing and hashing|-|-|-|-|0||

# 3. Concluding remark
Proving Ether transfer is unrealistically time consuming for now, since FFT is not applied in polynomial multiplications and divisions. Since the prove algorithm of our protocol is ALMOST identical with the original Groth16's with the only difference in circuit parameters, we expect that the proving speed will be improved as fast as the original one, when the FFT and the file access optimization are applied.
