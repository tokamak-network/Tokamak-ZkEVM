# Tokamak zk-EVM

Development of a new zk-EVM for L2 rollup.

Tokamak zk-EVM := zero-knowledge proof (e.g., SNARK) + multi-party verification (e.g., Fault proof system of Optimism)

## Technical goals

1. Development of a new zk-SNARK
    - (A1) New theory establishment (academic paper)
    - (A2) Practical implementation of our SNARK
2. Development of our zk-EVM
    - (B1) EVM circuit implementation
    - (B2) Adaptation of an existing multi-party verification system
    - (B3) Documentation (specification)
    - (B4) Demonstration and fine-tuning
3. Operation of a testing rollup network based on our zk-EVM
    - (C1) Adaptation of an existing rollup network organization (network entities, penalty and reward policies, …)
    - (C2) Demonstration and fine-tuning

## Progress so far (as of Apr. 2024)
|Milestone|A1|A2|B1|B2|B3|B4|C1|C2|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|Progress|Done|Just begun|Finalizing|Just begun|Just begun|Not started|Not started| Not started|

## Expected contributions

- We aim to explore a new area of compromising the trade-off between existing zk-rollups (ZKR) and optimistic rollups (OR).
- For academic motivation, see Introduction of [our SNARK paper](https://eprint.iacr.org/2024/507).
- Our compromises are ultimately to make Ethereum viable for mass adoption ([Vitalik's post will help you get an overview of the shortcomings of traditional rollups](https://vitalik.eth.limo/general/2021/01/05/rollup.html)).
- The compromises are as follows:
    - Higher compatibility with EVM (than ZKR, but possibly worse than OR)
    - Lower offchain computation costs ⇒ higher transaction throughput in L2 (than ZKR, but possibly worse than OR)
    - Faster, more dynamic, and predictable withdrawal to L1 (than OR, but possibly worse than ZKR)
    - Lower security dependency on data availability ⇒ higher scalability in L1 (than OR, but possibly worse than ZKR)

## How to use our SNARK?
**_!The current implementation explained below will be reworked soon, as there have been numerous changes to our theory!_**
### Protocol composition

UniGro16 consists of eight algorithms: compile, buildQAP, generateWitness, decode, setup, derive, prove, and verify.

- **compile** takes circom implementations of all EVM instructions as inputs and outputs respective R1CSs and wasms and metadata.
- **buildQAP** takes R1CSs and an EVM parameter as inputs and outputs respective QAP polynomials
- **decode (written in MATLAB script)** takes a p-code(bytecode) of an EVM application, initial storage data, and the EVM instruction metadata as inputs and outputs instances for all instructions used in a p-code and a wire map that contaning circuit information of an EVM application.
- **setup** takes the R1CSs and EVM parameters as inputs and outputs a universal reference string.
- **derive** takes the universal reference string and the wire map as inputs and outputs a circuit-specific reference string.
- **generateWitness** takes instances and the wasms for all instructions used in a p-code as inputs and outputs respective witnesses. Each witness includes the instance as well.
- **prove** takes the circuit-specific reference string, the witnesses, the QAPs and the wire map as inputs and outputs a proof.
- **verify** takes the proof, the circuit-specific reference string, the instances, and the wire map as inputs and prints out whether the proof is valid or not.

### Explanation for the inputs and outputs

- EVM instructions: Arithmetic opcodes including keccak256 in EVM from 0x01 to 0x20
- Circom implementation: A circom script to execute an opcode and build its (sub)circuit.
- R1CS: A set of wires and constraints forming the (sub)circuit of a circom implementation (called subcircuit)
- wasm: A script of executing an opcode ported in wasm
- WILL BE UPDATED

### Prerequisites and preparation for use

- Implementing circoms and generating R1CSs and wasms needs to install Circom package by Iden3.
  - [How to install Circom](https://docs.circom.io/getting-started/installation/)
- Some of libraries by Iden3 are used.
  - How to install Iden3 libraries

      ```bash
     git clone https://github.com/tokamak-network/UniGro16js.git
     cd UniGro16js
     npm install
     ```

- Compatibility with EVM (in the current version)
  - [compile](https://github.com/tokamak-network/circom-ethereum-opcodes/blob/main/README.md)
  - [decode](https://github.com/tokamak-network/UniGroth16_Decode/blob/master/Decode/readme.md)

- Parameters
  - \[sD]: The number of instructions defined in an EVM.
  - \[sMax]: The maximum number of arithmetic opcodes (might be defined by an EVM system) that can be contained in an EVM application (p-code).
  - \[rsName]: The file name (string) for a universal reference string.
  - \[crsName]: The file name for a circuit-specific reference string.
  - \[circuitName]: The directory name for a circuit (EVM application).
  - \[instanceId]: The index for an instance of a circuit.
  <!-- - \[prfName]: The file name for a proof. -->
  <!-- - \[anyNumber]: Any number for a seed of random number generation. -->

### How to use

<!-- All file names used in the following commands does not include the file name extensions (e.g., for "refstr.rs", just type "refstr") -->

You can use the interactive command by adding the following commands to your terminal

```bash
# build
$ npm run buildcli

# You can execute the interactive CLI app by adding one of the following commands to your terminal.

# 1. use the command anywhere in your terminal
$ npm link
$ unigroth

# 2. use the build file
$ node build/cli.cjs

# 3. run the following command in the project directory
$ node . 
```

- **compile**

  ![compile](/examples/compile.gif)
  
  <!-- - Be sure that the input [circom scripts](https://github.com/tokamak-network/circom-ethereum-opcodes/blob/main/README.md) are placed in ```./resource/subcircuits/circom/[instruction name]\_test.circom```. -->
  <!-- - Go to the directory ```./resource/subcircuits```.
  - Enter the command ```./compile.sh```. -->
  - Find the output EVM information in ```./resource/subcircuits/wire_list.json```, where the index for each instruction is numbered.
  - Find the output R1CSs in ```./resources/subcircuits/R1CS/subcircuit#.r1cs``` for all indices # of instructions upto sD-1.
  - Find the output wasms ```./resources/subcircuits/wasm/subcircuit#.wasm``` for all indices # of instructions upto sD-1.

- **buildQAP**

  ![build-qap](/examples/qap.gif)

  - Be sure that the R1CSs generated by compile are placed in the proper directory.
  <!-- - Enter the command ```node  .  qap-all  bn128  [sD]  [sMax]```. -->
  - Find an output QAP parameter in ```./resource/subcircuits/param_[sD]_[sMax].dat```.
  - Find the output QAPs in ```./resource/subcircuits/QAP_[sD]_[sMax]/subcircuit#.qap``` for all indices # of instructions upto sD-1.
  
- **setup**

  ![setup](/examples/setup.gif)

  - Be sure that the R1CSs generated by compile are placed in the proper directory.
  <!-- - Enter the command ```node . setup param_[sD]_[sMax] [rsName] QAP\_sD\_s_max [anyNumber]```. -->
  - Find the output universal reference string in ```./resource/universal_rs/[rsName].urs```.

- **decode**
  - [How to run decode](https://github.com/tokamak-network/UniGroth16_Decode/blob/master/Decode/readme.md)
  - Copy and paste the output circuit information into ```./resource/circuits/[circuitName]/{OpList.bin, Set_I_P.bin, Set_I_V.bin, WireList.bin}```.
  - Copy and paste the output instances into ```./resource/circuits/[circuitName]/instance[instanceId]/{input_opcode#.json, output_opcode#.json}``` for all indices # of opcodes used in an EVM application less than sMax.

- **derive**

  ![derive](/examples/derive.gif)

  - Be sure that the circuit information generated by decode are placed in the proper directory.
  <!-- - Enter the command ```node . derive [input rs file name] [crsName] [circuitName] QAP\_sD\_s_max```. -->
  - Find the output circuit-specific reference string in ```./resource/circuits/[circuitName]/[crsName].crs```.

- **generateWitness**

  - In the current version, generatedWitness is called during the run of prove (will be updated to be separately executed).
  - Find the output witnesses in ```./resource/circuits/[circuitName]/witness[instanceId]/witness#.wtns``` for all indices # of opcodes used in an EVM application less than sMax.

- **prove**

  ![prove](/examples/prove.gif)

  <!-- - Be sure that all the outputs of the above algorithms are placed in the proper directories. -->
  <!-- - Enter the command ```node . prove [crsName] [prfName] [circuitName] [instanceId] [anyNumber]```. -->
  - Find the output proof in ```./resource/circuits/[circuitName]/[prfName].proof```.

- **verify**

  ![verify](/examples/verify.gif)

  <!-- - Be sure that all the outputs of the above algorithms are placed in the proper directories. -->
  <!-- - Enter the command ```node . verify [prfName] [crsName] [circuitName] [instanceId]```. -->
  - Check the verification results displayed in terminal.

### Test run example

- An example EVM system
  
  - [Circom scripts](https://github.com/tokamak-network/UniGro16js/tree/master/resource/subcircuits/circom) of [12 instructions](https://github.com/tokamak-network/UniGro16js/blob/master/resource/subcircuits/subcircuit_info.json).
  
  - This system supports applications with instances of length 16 (this number can be modified in [here](https://github.com/tokamak-network/UniGro16js/blob/master/resource/subcircuits/circom/circuits/load.circom)).

- Two EVM application examples
  
  - Application-1: [A prove implementation of Schnorr protocol](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_prove/readme.md)

    - [p-code](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_prove/bytes_schnorr_prove.txt)

    - Two instance sets are prepared: [instance-1-1](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_prove/instance1/scenario.txt), [instance-1-2](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_prove/instance2/scenario.txt)

  - Application-2: [A verify implementation of Schnorr protocol](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_verify/readme.md)

    - [p-code](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_verify/bytes_schnorr_verify.txt)

    - [Instance-2-1](https://github.com/tokamak-network/UniGro16js/blob/master/resource/circuits/schnorr_verify/instance1/scenario.txt)
  
  - Both applications use less than 18 arithmetic instructions (i.e., sMax = 18).

- As **decode** has no build currently, we provide the outputs of **decode** that have been created in advance.

- Test run commands

  1. **Compile**

      choose *compile* command

  2. **Build QAP**

      Select the following options.

      - What is the name of curve?: `BN128`

      - How many instructions are defined in the EVM?: `12`

      - The maximum number of arithmetic instructions in the EVM application? `18`

  3. **Setup**

      Select the following options.

      - Which parameter file will you use?: `[Workspace]/UniGro16js/resource/subcircuits/param_12_18.dat`

      - Which QAP will you use? `[Workspace]/UniGro16js/resource/subcircuits/QAP_12_18`

      - What is the name of the universial reference string file? `rs_18`
  
  4. **Derive**

      a. Select the following options for application-1.

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove`

      - Which reference string file will you use? `[Workspace]/UniGro16js/resource/universal_rs/rs_18.urs`

      - Which QAP will you use? `[Workspace]/UniGro16js/resource/subcircuits/QAP_12_18`

      - What is the name of the circuit-specific reference string file? `crs_schnorr_prove`

      b. Select the following options for application-2

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify`

      - Which reference string file will you use? `[Workspace]/UniGro16js/resource/universal_rs/rs_18.urs`

      - Which QAP will you use? `[Workspace]/UniGro16js/resource/subcircuits/QAP_12_18`

      - What is the name of the circuit-specific reference string file? `crs_schnorr_verify`

  5. **Prove**

      a. Select the following options for the instance-1-1 of the application-1.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/crs_schnorr_prove.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove`

      - What is the index of the instance of the circuit? `1`

      - What is the name of the proof? `proof1`
  
      b. Select the following options for the instance-1-2 of the application-1.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/crs_schnorr_prove.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove`

      - What is the index of the instance of the circuit? `2`

      - What is the name of the proof? `proof2`

      c. Select the following options for the instance-2-1 of the application-2.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify/crsSchnorr_verify.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify`

      - What is the index of the instance of the circuit? `1`

      - What is the name of the proof? `proof`

  6. **Verify**

      a. Select the following options for the instance-1-1 of the application-1.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/crs_schnorr_prove.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove`

      - What is the index of the instance of the circuit? `1`

      - Which proof will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/proof1.proof`
  
      b. Select the following options for the instance-1-2 of the application-1.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/crs_schnorr_prove.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove`

      - What is the index of the instance of the circuit? `2`

      - Which proof will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_prove/proof2.proof`

      c. Select the following options for the instance-2-1 of the application-2.

      - Which circuit-specific reference string will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify/crsSchnorr_verify.crs`

      - Which circuit will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify`

      - What is the index of the instance of the circuit? `1`

      - Which proof will you use? `[Workspace]/UniGro16js/resource/circuits/schnorr_verify/proof.proof`
  
  Since this is under construction, you can set `TEST_MODE` environment variable to true for testing

- Summary of input parameters used for the test run

|Parameters |Application-1 with instance-1-1  |Application-1 with instance-1-2  |Application-2 with instance-2-1|
|:---------:|:---------:|:---------:|:-------:|
|sD        |12|12|12|
|sMax      |18|18|18|
|rsName     |"rs_18"|"rs_18"|"rs_18"|
|crsName    |"crsSchnorr_prove"|"crsSchnorr_prove"|"crsSchnorr_verify"|
|circuitName|"schnorr_prove"|"schnorr_prove"|"schnorr_verify"|
|instanceId|    1|    2|    1|
|prfName|"proof1"|"proof2"|"proof"|
|anyNumber|1|1|1|

## Related Docs
- About the current implementation (outdated)
   - [Performance test report](https://github.com/tokamak-network/UniGro16js/blob/master/Performance.md)
   - [The technical specification of current implementation (outdated)](https://drive.google.com/file/d/1DTEWbiKalPe3l1ohniP60jlyr-vIUiuH/view?usp=sharing)
   - [History of implementation updates](https://github.com/tokamak-network/UniGro16js/blob/master/UpdateHistory.md)
- Articles related to Tokamak zk-EVM project   
   - [About Tokamak zk-EVM project](https://medium.com/onther-tech/project-tokamak-zk-evm-67483656fd21)
   - [Tokamak zk-EVM Q1 report](https://medium.com/onther-tech/tokamak-zk-evm-q1-report-1f7e369ec0d8)
   - [Tokamak zk-EVM Q2 report](https://medium.com/onther-tech/tokamak-zk-evm-q2-report-9a264eba417f)
   - [Tokamak zk-EVM Q3 report](https://medium.com/onther-tech/tokamak-zk-evm-q3-report-69102605077b)
   - [Tokamak zk-EVM Q4 report](https://medium.com/onther-tech/tokamak-zk-evm-q4-report-d2985b4513b2)
- Formal Docs
   - [Jehyuk Jang and Jamie Judd, "An Efficient SNARK for Field-Programmable and RAM Circuits," Mar. 2024](https://eprint.iacr.org/2024/507)

## Contact

- [jake@tokamak.network](mailto:jake@tokamak.network)

## Licence

- [GPLv3](https://github.com/tokamak-network/UniGro16js/blob/master/COPYING.md)
