 import { readFileSync } from "fs";
// import subcircuit from '../resource/subcircuits/subcircuit_info.json' assert {type: 'json'};
import { wire_mapping } from './wire_mappings.js';

import hash from 'js-sha3';
import { BigNumber } from 'ethers'

import { 
  hexToInteger, 
  decimalToHex, 
  pop_stack, 
  getWire, 
  getRangeCell, 
  getWireList, 
  getIVIP, 
  makeBinFile, 
  makeJsonFile,
  hexToString,
  getSubcircuit
} from './utils/convert.js';

import {
  getByte,
  sar256BitInteger,
  signExtend,
  signedDivide,
  signedLessThan256BitInteger,
  signedMod
} from './utils/helper_functions.js';

export class Decoder {
  constructor () {
  }

  getEnv(code, config) {
    const codelen = code.length
    const callcode_suffix_raw = '63fffffffd5447101561040163fffffffe541016';
    const callcode_suffix_pt = code.length + 1;
    
    const callcode_suffix = Buffer.from(callcode_suffix_raw, 'hex') 
    const callcode_suffix_len = callcode_suffix_raw.length / 2
    const {
      Iddata, Isdata, storagedata, storageKeys
    } = config
    
    const padData = '' 
  
    const pc_pt = callcode_suffix_pt + callcode_suffix_len
    const pc_len = 4
    
    const Iv_pt = pc_pt + pc_len
    const Iv_len = 32
    const Id_pt = Iv_pt + Iv_len
    const Id_len = Iddata.length / 2
    const Id_len_info_pt = Id_pt + Id_len
    const Id_len_info_len = 2

    const lendata = decimalToHex(Id_len)
    const Id_lendata = lendata.padStart(Id_len_info_len * 2, '0')
    
    const Is_pt = Id_len_info_pt + Id_len_info_len
    const Is_len = 32
    const od_pt = Is_pt + Is_len
    const od_len = 128
    const od_len_info_pt = od_pt + od_len
    const od_len_info_len = 1
    const sd_pt = od_len_info_pt + od_len_info_len
    const sd_len = 32
    const calldepth_pt = sd_pt + sd_len
    const calldepth_len = 2
    const balance_pt = calldepth_pt + calldepth_len
    const balance_len = 32
    const zerodata = '00';
    const zero_pt = balance_pt + balance_len
    const zero_len = 1
    
    let storage_pts = [0, 0, 0, 0]
    let storage_lens = [0, 0, 0, 0]
    
    storage_pts[0] = zero_pt + zero_len
    storage_lens[0] = storagedata[0].length / 2
    for (let i=1; i < storagedata.length ; i++) {
      storage_pts[i] = storage_pts[i-1] + storage_lens[i-1]
      storage_lens[i] = storagedata[1].length / 2
    }
  
    const environ_pts = {
      pc_pt: pc_pt,
      pc_len: pc_len,
      Iv_pt: Iv_pt,
      Iv_len: Iv_len,
      Id_pt: Id_pt,
      Id_len: Id_len,
      Id_len_info_pt: Id_len_info_pt,
      Id_len_info_len: Id_len_info_len,
      Is_pt: Is_pt,
      Is_len: Is_len,
      od_pt: od_pt,
      od_len: od_len,
      od_len_info_pt: od_len_info_pt,
      od_len_info_len: od_len_info_len,
      sd_pt: sd_pt,
      sd_len: sd_len,
      calldepth_pt: calldepth_pt,
      calldepth_len: calldepth_len,
      balance_pt: balance_pt,
      balance_len: balance_len,
      zero_pt: zero_pt,
      zero_len: zero_len,
      storage_pts: storage_pts,
      storage_lens: storage_lens,
    }
    
    // const Isdata = '0000000000000000000000005B38Da6a701c568545dCfcB03FcB875f56beddC4'
    
    const od_lendata = od_len.toString(16)
    const pcdata = padData.padStart(pc_len * 2, '0')
    const Ivdata = padData.padStart(Iv_len*2, '0')
    const oddData = padData.padStart(od_len * 2, '0')
    const sddata = '55'.padStart(sd_len * 2, '0')
    const calldepthdata = padData.padStart(calldepth_len * 2, '0')
    const balance = 1000000
    const balancedata = balance.toString(16).padStart(balance_len * 2, '0')
  
    const storage_keys = storageKeys
    
    let storage_pt = {}
    for (let i = 0; i < storage_keys.length; i++) {
      storage_pt[storage_keys[i]] = [0, storage_pts[i], storage_lens[i]]
    }

    let data = pcdata 
                + Ivdata 
                + Iddata 
                + Id_lendata 
                + Isdata 
                + oddData 
                + od_lendata 
                + sddata 
                + calldepthdata 
                + balancedata 
                + zerodata
                // + storagedata[0]
                // + storagedata[1]
                // + storagedata[2]
                // + storagedata[3]
    
    for (let i = 0; i < storagedata.length; i ++) data = data + storagedata[i]
    
    const environData = Buffer.from(data, 'hex')
    let call_pt = []
    
    const codewdata = Buffer.concat([code, callcode_suffix, environData])
    const calldepth = 1
    
    call_pt.push([1, codelen])

    this.oplist = [{
      opcode: '',
      pt_inputs: [],
      pt_outputs: [],
      inputs: [],
      outputs: [],
    }]
    
    this.call_pt = call_pt
    this.codewdata = codewdata
    this.calldepth = calldepth
    this.environData = environData
    this.storage_keys = storage_keys
    this.environ_pts = environ_pts
    this.op_pointer = 0
    this.cjmp_pointer = 0;
    this.storage_pt = storage_pt
    this.storage_pts = storage_pts
    this.callcode_suffix = callcode_suffix
    this.callcode_suffix_pt = callcode_suffix_pt
    this.callresultlist = []
    this.vmTraceStep = 0
    this.call_pointer = 0

    return { environ_pts, callcode_suffix }
  }

  runCode (code, config, dirname, instanceId) {
    this.config = config
    this.getEnv(code, this.config)
    let outputs_pt = this.decode(code)
    this.oplist[0].pt_inputs = outputs_pt[0] ?  outputs_pt[0] : []

    
    for (let i = 0; i < this.oplist.length ;i ++) {
      let k_pt_inputs = this.oplist[i].pt_inputs
      console.log("init k_pt_inputs", k_pt_inputs)
      k_pt_inputs = this.oplist[i].opcode == 'fff' && !k_pt_inputs[0]
                    ? [] 
                    : k_pt_inputs[0][0] 
                    ? k_pt_inputs[0]
                    : [k_pt_inputs]
      let k_inputs = []
      //console.log('After k_pt_inputs', k_pt_inputs,"this.oplist[i]", this.oplist[i])

      for (let j=0; j < k_pt_inputs.length ; j++) {
        const result = this.evalEVM(k_pt_inputs[j])
        k_inputs.push(result)
      }
      let k_pt_outputs = this.oplist[i].pt_outputs;
      const opcode = this.oplist[i].opcode

      k_pt_outputs = opcode === 'fff' ? k_pt_outputs : [k_pt_outputs]
      let k_outputs = []
      for (let j = 0; j < k_pt_outputs.length ; j ++) {
        let k_output = this.evalEVM(k_pt_outputs[j])
        k_output = k_output === undefined ? 0 : k_output
        k_outputs.push(k_output)
      }
      
      this.oplist[i].inputs=k_inputs
      this.oplist[i].outputs=k_outputs
    }
    // ======= oplist filed with all the data =======

    console.log('oplist length', this.oplist.length)
    
    const oplist_len = this.oplist.length
    const oplist = this.oplist

    const { NWires, wireIndex } = getWire(this.oplist)
    console.log("NWires: ",NWires)
    console.log("wireIndex: ",wireIndex)


    const NCONSTWIRES=1
    const NINPUT = (NWires[0] - NCONSTWIRES)/2 // IO buffer input number = (Input + Output) / 2

    console.log("oplist_len", oplist_len, "NWires", NWires, "NCONSTWIRES", NCONSTWIRES, "NINPUT", NINPUT)
    const RangeCell = getRangeCell(oplist_len, oplist, NWires, NCONSTWIRES, NINPUT)
    const wireList = getWireList(NWires, RangeCell, oplist_len)
    console.log("wireList", wireList)
    
    const { SetData_I_V, SetData_I_P } = getIVIP(wireList, oplist, NINPUT, NCONSTWIRES, wireList.length, RangeCell)

    const dir = dirname

    console.log("=================final====================")
    console.log('oplist length', this.oplist.length)
    console.log(this.oplist)
    console.log("=========================codewdata====================")
    console.log(this.codewdata)
    console.log(this.oplist[0])
    
    makeBinFile(dir, SetData_I_V, SetData_I_P, wireIndex, wireList)
    makeJsonFile (dir, oplist, NINPUT, this.codewdata, instanceId)
  }

  decode (code) {
    let outputs_pt = []
    let stack_pt = []
    
    let {
      Iv_pt,
      Id_pt,
      Id_len,
      Iv_len,
      Id_len_info_pt,
      Id_len_info_len,
      Is_pt,
      Is_len,
      balance_pt,
      balance_len,
      zero_pt,
      zero_len,
      cjmp_pointer,
      calldepth_pt,
      calldepth_len,
      od_pt
    } = this.environ_pts
    
    let storage_pt = this.storage_pt
    let call_pt = this.call_pt
    
    let codelen = code.length
  
    const codewdata = this.codewdata
    let mem_pt = {}

    let pc = 0;
    while (pc < codelen) {
      const op = decimalToHex(code[pc])

      console.log('pc', pc)
      console.log("op", op)
      pc = pc + 1

      let d = 0 //input
      let a = 0 //output

      if (hexToInteger(op) - hexToInteger('60') >= 0 
        && hexToInteger(op) - hexToInteger('60') < 32) {
        const pushlen = hexToInteger(op) - hexToInteger('60') + 1
        console.log("PUSH length",pushlen)
        for(let i = 0; i < pushlen; i++){
          console.log("PUSH value",decimalToHex(code[pc + i]))
        }
        stack_pt.unshift([0, pc+call_pt[this.calldepth - 1][0], pushlen])
        pc = pc + pushlen
      } else if (op === '50') {
        d = 1;
        a = 0

        stack_pt = pop_stack(stack_pt, d)
      } 
      else if (op === '51') { // mload
        d = 1
        a = 0
        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        stack_pt = pop_stack(stack_pt,d)

        // if (mem_pt.length === 0) {

        // }
        
        stack_pt.unshift(mem_pt[addr])
      } else if (op === '52') { //mstore
        d = 2
        a = 0

        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        const data = stack_pt[1]
        mem_pt[addr] = data

        stack_pt = pop_stack(stack_pt, d)
      } else if (op === '53') {
        d = 2;
        a = 0;
        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        
        const data = stack_pt[1]
        data[2] = 1
        mem_pt[addr] = data
        
        stack_pt = pop_stack(stack_pt, d)
      }
      else if (op === '54') { //sload
        d = 1
        a = 1

        const addr = this.evalEVM(stack_pt[0]).toString().padStart(64, '0')
        stack_pt = pop_stack(stack_pt, d)

        const sdata_pt = storage_pt[addr] ? storage_pt[addr] : [0, zero_pt, zero_len]

        stack_pt.unshift(sdata_pt)
      } else if (op === '55') { // store
        d = 2;
        a = 0;

        const addr = this.evalEVM(stack_pt[0]).toString().padStart(64, '0')
        const sdata_pt = stack_pt[1]
        stack_pt = pop_stack(stack_pt, d)

        storage_pt[addr] = sdata_pt
        
      } else if (op === '33') { // caller
        d = 0;
        a = 1

        stack_pt.unshift([0, Is_pt, Is_len])
      } else if (op === '34') { // callvalue
        d = 0;
        a = 1

        stack_pt.unshift([0, Iv_pt, Iv_len])
      } else if (op === '35') { // calldataload
        d = 1;
        a = 1

        const offset = this.evalEVM(stack_pt[0])

        let pt = Id_pt + Number(offset)
        let chose_data_len = Math.min(Id_len - Number(offset), 32)
        stack_pt = pop_stack(stack_pt, d)

        if (pt >= Id_pt && pt + chose_data_len - 1 <= Id_pt + Id_len - 1) {
          stack_pt.unshift([0, pt, chose_data_len])
        }
      } else if (op === '36') { // calldatasize
        d = 0;
        a = 1

        stack_pt.unshift([0, Id_len_info_pt, Id_len_info_len])
      } else if (op === '47') { // selfbalance
        d = 0;
        a = 1

        stack_pt.unshift([0, balance_pt, balance_len])
      } else if (hexToInteger(op) - hexToInteger('80') >= 0 
        && hexToInteger(op) - hexToInteger('80') < 16) { // duplicate
        d = 1;
        a = 2

        const duplen = hexToInteger(op) - hexToInteger('80')
        stack_pt.unshift(stack_pt[duplen]) 
      } else if (hexToInteger(op) - hexToInteger('90') >= 0 
       && hexToInteger(op) - hexToInteger('90') < 16) { // swap
        d = 0;
        a = 0;

        const target_index = hexToInteger(op) - hexToInteger('90') + 1
        const temp = stack_pt[0]
        stack_pt[0] = stack_pt[target_index]
        stack_pt[target_index] = temp
      } 

      /************* SUB Circuit Library *************/
      else if (hexToInteger(op) >= hexToInteger('01') && hexToInteger(op) < hexToInteger('0b')
          || (hexToInteger(op) >= hexToInteger('10') && hexToInteger(op) <= hexToInteger('1d'))
          || (hexToInteger(op) === hexToInteger('20'))
      ) {
        const {numberOfInputs, numberOfOutputs} = getNumberOfIO(op);
        d = numberOfInputs / 2
        a = numberOfOutputs / 2

          if (op === '20') {// SHA3
            a=1;
            const addr = Number(this.evalEVM(stack_pt[0])) + 1
            let len = Number(this.evalEVM(stack_pt[1]))
            stack_pt = pop_stack(stack_pt, 2)
            
            let len_left = len
            let target_mem = []
            let target_addr = addr.toString()

            while (len_left > 0) {
              const target = mem_pt[target_addr]
              target_mem.push(target)
              len_left = len_left - 32
              target_addr = Number(target_addr) + 32
            }

            d = target_mem.length
            for (let i = target_mem.length ; i > 0; i --) {
              stack_pt.unshift(target_mem[i - 1])
            }
          }
        console.log("d: ",d)
        console.log("a: ",a)
        
        this.op_pointer = this.op_pointer + 1 //for subcircuit sequence (0: LOAD)
        this.oplist.push({
          opcode: '',
          pt_inputs: [], //For wires
          pt_outputs: [], //For wires
          inputs: [], //EVM inputs
          outputs: [], //EVM outputs
        })
        this.oplist = wire_mapping(op, stack_pt, d, a, this.oplist, this.op_pointer, code, this.config)
        console.log(this.oplist[this.oplist.length - 1])
        stack_pt = pop_stack(stack_pt, d)
        stack_pt.unshift(this.oplist[this.op_pointer].pt_outputs)
      }
      /****************************/

      else if (op === '56') {
        d = 1;
        a = 0;
        const target_pc = this.evalEVM(stack_pt[0])
        pc = Number(target_pc)

        stack_pt = pop_stack(stack_pt, d)
      } else if (op === '57') {
        cjmp_pointer = cjmp_pointer + 1;

        d = 2;
        a = 0;

        const target_pc = this.evalEVM(stack_pt[0])
        const condition = this.evalEVM(stack_pt[1])
        
        if (Number(condition) !== 0) {
          console.log('jumpi', target_pc, condition)
          pc = Number(target_pc)
          // if (code.slice(this.calldepth - 1,target_pc)) {

          // }
        }
        stack_pt = pop_stack(stack_pt, d)
      } else if (op === '57') {
        d = 0;
        a = 1;

        codewdata.set([pc, pc_len * 2], pc_pt - 1);
        stack_pt.unshift([0, pc_pt, pc_len])
      } else if (op === '5b') {

      }
      else if (op === '39') { // codecopy
        d = 3
        a = 0

        let addr_offset = Number(this.evalEVM(stack_pt[0])) + 1
        let addr_len = Number(this.evalEVM(stack_pt[2]))
        let addr_slots = Math.ceil(addr_len / 32)
        let addrs = new Array(addr_slots).fill(0)
        let codept_offset = Number(this.evalEVM(stack_pt[1])) + 1

        if (code.slice(codept_offset - 1, code.length).length < addr_len) {
          pc = codelen
          console.log(`codecopy is STOPED at pc ${pc}, code ${op}`)
        } else {
          let left_code_length = addr_len
          for (let i=0; i< addr_slots-1 ; i ++) {
            addrs[i] = addr_offset + i * 32
            if (left_code_length > 32) {
              mem_pt[addrs[i]] = [0, codept_offset + i * 32, 32]
              left_code_length=left_code_length-32;
            } else {
              mem_pt[addrs[i]] = [0, codept_offset + i * 32, left_code_length]
            }
          }
        }

        stack_pt = pop_stack(stack_pt, d)
      }
      else if (op === '3e') { //returndatacopy
        d = 3
        a = 0

        let addr_offset = Number(this.evalEVM(stack_pt[0])) + 1
        let addr_len = Number(this.evalEVM(stack_pt[2]))
        let addr_slots = Math.ceil(addr_len / 32)
        let addrs = new Array(addr_slots).fill(0)
        let ad_offset = od_pt + Number(this.evalEVM(stack_pt[1]))
        // console.log('3e', addr_offset, addr_len, addr_slots, addrs, ad_offset)
        let left_od_length = addr_len
        for (let i=0; i< addr_slots-1 ; i ++) {
          addrs[i] = addr_offset + i * 32
          if (left_od_length > 32) {
            mem_pt[addrs[i]] = [0, ad_offset + i * 32, 32]
            left_code_length=left_code_length-32;
          } else {
            mem_pt[addrs[i]] = [0, ad_offset + i * 32, left_code_length]
          }
        }
        stack_pt = pop_stack(stack_pt, d)
      }
      else if (op === '3d') {
        d = 0
        a = 1

        stack_pt.push([0, this.od_len_info_pt, this.od_len_info_len])
      }
      else if (op === 'f1') {
        d = 7;
        a = 1;

        let value = this.evalEVM(stack_pt[2]);
        let value_pt = stack_pt[2];
        let in_offset = Number(this.evalEVM(stack_pt[3])) + 1;
        let in_size = Number(this.evalEVM(stack_pt[4]));
        let out_offset = Number(this.evalEVM(stack_pt[5])) + 1;
        let out_size = this.evalEVM(stack_pt[6]);
        stack_pt = pop_stack(stack_pt, d);
        
        let in_slots = Math.ceil(in_size / 32);
        let addrs = new Array(in_slots).fill(0);
        let mem_pt_data = new Array(in_slots).fill(0);
        let left_in_size = in_size;
        for (let i = 0; i < in_slots; i++) {
          addrs[i] = in_offset + i * 32;
          let pt = mem_pt[addrs[i]];
          if (pt[0] !== 0) {
            throw new Error('invalid callcode offset');
          }
          if (left_in_size >= 32) {
            pt[2] = 32;
            left_in_size -= 32;
          } else {
            pt[2] = left_in_size;
          }
          mem_pt_data[i] = pt;
        }

        if (this.calldepth < 1024 && value <= this.evalEVM([0, balance_pt, balance_len])) {
          this.calldepth++;
          codewdata.set(['0'.padStart(calldepth_len * 2, '0'), decimalToHex(this.calldepth)], calldepth_pt - 1);
          
          let curr_offset = mem_pt_data.length === 0 ? 1 : mem_pt_data[0][1];
          let callcode_pt_offset = call_pt[this.calldepth - 2][0] + curr_offset - 1;
          call_pt[this.calldepth - 1] = [callcode_pt_offset, in_size];

          let next_callcode = code.slice(callcode_pt_offset, callcode_pt_offset + in_size);
          let call_output_pt = this.decode(next_callcode);

          this.calldepth--;
          codewdata.set(['0'.padStart(calldepth_len * 2, '0'), decimalToHex(this.calldepth)], calldepth_pt - 1);
          call_pt.length = this.calldepth + 1;

          let actual_out_len = call_output_pt.reduce((acc, curr) => acc + curr[2], 0);
          let n = Math.min(actual_out_len, out_size);
          let out_slots = Math.ceil(n / 32);
          let left_n = n;
          for (let i = 0; i < out_slots; i++) {
            let addr = out_offset + i * 32;
            let pt = call_output_pt[i];
            pt[2] = Math.min(left_n, 32);
            mem_pt[addr] = pt;
            left_n -= 32;
          }
        }

        this.call_pointer++;

        storage_pt[0xfffffffe] = value_pt;
        storage_pt[0xffffffff] = [0, calldepth_pt, calldepth_len];

        this.calldepth++;
        codewdata.set(['0'.padStart(calldepth_len * 2, '0'), decimalToHex(this.calldepth)], calldepth_pt - 1);

        let callcode_pt_offset = this.callcode_suffix_pt;
        call_pt[this.calldepth - 1] = [callcode_pt_offset, this.callcode_suffix.length];

        let next_callcode = this.callcode_suffix;
        let vmTraceStep_old = this.vmTraceStep;
        this.decode(next_callcode);
        this.vmTraceStep = vmTraceStep_old;

        this.calldepth--;
        codewdata.set(['0'.padStart(calldepth_len * 2, '0'), decimalToHex(this.calldepth)], calldepth_pt - 1);
        call_pt.length = this.calldepth + 1;

        let op = this.oplist[this.op_pointer];
        let x_pointer
        if (op.opcode !== '16') {
          throw new Error('error in retrieving call result');
        } else {
          x_pointer = op.pt_outputs;
          this.callresultlist[this.call_pointer] = this.op_pointer;
        }
        stack_pt = [x_pointer, ...stack_pt];

      }
      else if (op === 'f3' || op === 'fd') {
        d=2
        a=0
        // console.log(stack_pt)
        const addr_offset = Number(this.evalEVM(stack_pt[0])) + 1
        const addr_len = this.evalEVM(stack_pt[1])

        let len_left = Number(addr_len)
        let addr = addr_offset
        // console.log('addr', addr, mem_pt[addr],mem_pt)
        while (len_left > 0) {
          let target_data = mem_pt[addr]
          outputs_pt.push(target_data)
          len_left = len_left - target_data[2]
          addr = addr + target_data[2]
        }
        stack_pt = pop_stack(stack_pt, d)
        pc = codelen
      } 
      else if (op === 'ff') {

      }
      else if (op === '00') {
        d = 0;
        a = 0;
        pc = codelen
      } 
      
      else if (hexToInteger(op) - hexToInteger('a0') >= 0
        && hexToInteger(op) - hexToInteger('a0') < 5) {
        const lognum = hexToInteger(op) - hexToInteger('a0') 
        d = lognum + 2
        a = 0
        stack_pt=pop_stack(stack_pt, d)
      }
      else {
        console.log('xxxx', pc, op)
      }

      // const newStackSize = stack_pt.length
      // if (newStackSize - prev_stack_size !== a-d) {

      // }
      this.vmTraceStep = this.vmTraceStep + 1
      console.log("stack_pt", stack_pt)
      console.log("==========next step==============")
    }
    return outputs_pt
  }

  evalEVM (pt) {
    const codewdata = this.codewdata

    const op_pointer = pt[0]
    const wire_pointer = pt[1]
    const byte_size = pt[2]

    console.log("op_pointer", op_pointer, "wire_pointer", wire_pointer, "byte_size", byte_size)
    if (op_pointer === 0) {
      const slice = codewdata.slice(wire_pointer - 1, wire_pointer + byte_size - 1)
      let output = ''
      for (let i=0; i < slice.length; i ++){
        output = output + decimalToHex(slice[i])
      }
      return BigNumber.from('0x' + output).toString()
    }

    let t_oplist = this.oplist[op_pointer - 1]
    const op = t_oplist.opcode
    console.log("t_oplist", t_oplist)
    if (t_oplist.outputs.length !== 0) {
      return t_oplist.outputs[wire_pointer - 1]
    }
    
    try {
      if (op === 'fff') {
        let new_pt = t_oplist.pt_outputs[wire_pointer - 1]
        const value = this.evalEVM(new_pt)
        return value
      } else {
        let inputlen = t_oplist.pt_inputs[0].length
        let inputs = []
        let outputs
        let pt_inputs = t_oplist.pt_inputs[0][0][0] ? t_oplist.pt_inputs[0] : t_oplist.pt_inputs
        console.log("**********pt_inputs", pt_inputs)
        for (let i=0; i < inputlen; i ++) {
          inputs.push(this.evalEVM(pt_inputs[i]))
        }

        switch (op) {
          case '01': // ADD
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[0]) + BigInt(inputs[1])) % 2n**256n
            break;
          case '02': // MUL
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[0]) * BigInt(inputs[1])) % 2n ** 256n;
            break;
          case '03': // SUB
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (2n ** 256n + BigInt(inputs[0]) - BigInt(inputs[1])) % 2n ** 256n;
            break;
          case '04': // DIV
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[1]) === 0n) ? 0n : BigInt(inputs[0]) / BigInt(inputs[1]);
            break;
          case '05': // SDIV
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = signedDivide(inputs[0], inputs[1]);
            break;
          case '06': // MOD
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[1]) === 0n) ? 0n : BigInt(inputs[0]) % BigInt(inputs[1]);
            break;
          case '07': // SMOD
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = signedMod(inputs[0], inputs[1]);
            break;
          case '08': // ADDMOD
            if (inputlen !== 3) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[2]) === 0n) ? 0n : (BigInt(inputs[0]) + BigInt(inputs[1])) % BigInt(inputs[2]);
            break;
          case '09': // MULMOD
            if (inputlen !== 3) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[2]) === 0n) ? 0n : (BigInt(inputs[0]) * BigInt(inputs[1])) % BigInt(inputs[2]);
            break;
          case '0a': // EXP
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[0]) ** BigInt(inputs[1])) % 2n ** 256n;
            break;
          case '0b': // SIGNEXTEND
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = signExtend(inputs[0], inputs[1]);
            break;
          case '10': // LT
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) < BigInt(inputs[1]) ? 1 : 0;
            break;
          case '11': // GT
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) > BigInt(inputs[1]) ? 1 : 0;
            break;
          case '12': // SLT
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = signedLessThan256BitInteger(inputs[0], inputs[1]);
            break;
          case '13': // SGT
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = signedLessThan256BitInteger(inputs[1], inputs[0]);
            break;
          case '14': // EQ
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) == BigInt(inputs[1]) ? 1 : 0;
            break;
          case '15': // ISZERO
            if (inputlen !== 1) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) == BigInt(0) ? 1 : 0;
            break;
          case '16': // AND
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) & BigInt(inputs[1]);
            break;
          case '17': // OR
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) | BigInt(inputs[1]);
            break;
          case '18': // XOR
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = BigInt(inputs[0]) ^ BigInt(inputs[1]);
            break;
          case '19': // NOT
            if (inputlen !== 1) throw new Error("Invalid input length");
            const bitmask = (1n << 256n) - 1n;
            outputs = BigInt(inputs[0]) ^ bitmask;
            break;
          case '1a': // BYTE
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = getByte(inputs[0], inputs[1]);
            break;
          case '1b': // SHL
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[1]) << BigInt(inputs[0])) % 2n ** 256n;
            break;
          case '1c': // SHR
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = (BigInt(inputs[1]) >> BigInt(inputs[0])) % 2n ** 256n;
            break;
          case '1d': // SAR
            if (inputlen !== 2) throw new Error("Invalid input length");
            outputs = sar256BitInteger(inputs[1], inputs[0]);
            break;
          case '20': // SHA3
            for (let i = 0; i < inputs.length; i++) {
              inputs[i] = BigInt(inputs[i]).toString(16).padStart(64, '0');
            }
            const { keccak256 } = hash;
            const input_con = inputs.join('');
            const hToString = hexToString(input_con);
            const hex = keccak256(hToString);
            outputs = hex;
            break;
          default:
            throw new Error("Unknown operation");
        }
        //this.oplist[op_pointer - 1].outputs.push(outputs);
        return outputs;
      }

    } catch(e) {
      console.log(e)
    }
  }
}

function getNumberOfIO (op) {
  const subcircuits = getSubcircuit()
  const opcode = subcircuits.find(subcircuit => subcircuit.opcode === op)
  //if op does not exist in subcircuits
  if (!opcode) {
    console.error(`No subcircuit found for opcode: ${op}`);
    return {numberOfInputs: -1, numberOfOutputs: -1}
  }
  return {numberOfInputs: opcode.In_idx[1], numberOfOutputs: opcode.Out_idx[1]}
}