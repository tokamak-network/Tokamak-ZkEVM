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

## Test EVM Applications
### Schnorr protocol proving algorithm
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

### Schnorr protocol verifying algorithm
- Pseudocode

```
Storage inputs: y, g, p, t, r
Output: b

1. c<= g**y (mod p)
2. a<= g**r * y**c (mod p)
3. b<= t-a (mod p)
4. return b
```

- EVM bytecode
```
0x6002546000546001540a066000540a6004546001540a0260025490066002540360035401600254900660005260206000f3
```

### Ether transfer
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
- EVM bytecode
```
0x608060405234801561001057600080fd5b506101fd806100206000396000f3fe6080604052600436106100295760003560e01c806373ffd5b71461002e578063a3dcb4d21461004a575b600080fd5b6100486004803603810190610043919061013e565b610075565b005b34801561005657600080fd5b5061005f6100df565b60405161006c91906101ac565b60405180910390f35b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501580156100db573d6000803e3d6000fd5b5050565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600080fd5b6000819050919050565b61011b81610108565b811461012657600080fd5b50565b60008135905061013881610112565b92915050565b60006020828403121561015457610153610103565b5b600061016284828501610129565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006101968261016b565b9050919050565b6101a68161018b565b82525050565b60006020820190506101c1600083018461019d565b9291505056fea2646970667358221220df1b58bcf19df6fd94743afea0ef7e17e624092b40c348f910dd780370b911c564736f6c634300080f0033
```

# Benchmarks

