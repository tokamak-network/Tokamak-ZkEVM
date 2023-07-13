// import transaction from '../resource/circuits/schnorr_prove/transaction1.json' assert {type: 'json'};
import { subcircuit } from '../resource/subcircuits/subcircuit_info.js'
import {
  trap,
  mod,
  fromTwos,
  toTwos,
  exponentiation,
} from './evm/utils.js'
import { wire_mapping } from './wire_mappings.js';
import { Stack } from './evm/stack.js';
import { Memory } from './evm/memory.js';
import { handlers } from './evm/functions.js';
import { keccak256 } from 'ethereum-cryptography/keccak.js'
import { bytesToHex } from 'ethereum-cryptography/utils.js'
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
  hd_dec2bin,
  bin2dec
} from './utils/convert.js';

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
    const Id_lendata = lendata.padStart(Id_len_info_len*2, '0')
    
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
      storage_lens: storage_lens
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

    const data = pcdata 
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
                + storagedata[0]
                + storagedata[1]
                + storagedata[2]
                + storagedata[3]
    
    const environData = Buffer.from(data, 'hex')
    let call_pt = []
    
    const codewdata = Buffer.concat([code, callcode_suffix, environData])
    const callDepth = '1'.padStart(calldepth_len * 2, '0')
    
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
    this.callDepth = callDepth
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

  runCode (code, config, dirname) {
    this.decode(code, config)
    
    const listLength = this.oplist.length
    const oplist = this.oplist
    // console.log(oplist)
    const { NWires, wireIndex } = getWire(this.oplist)
    
    const NCONSTWIRES=1
    const NINPUT = (NWires[0] - NCONSTWIRES)/2

    const RangeCell = getRangeCell(listLength, oplist, NWires, NCONSTWIRES, NINPUT)
    const WireListm = getWireList(NWires, RangeCell, listLength) 
    // console.log(wireIndex)
    let mWires = WireListm.length;
    
    const { SetData_I_V, SetData_I_P } = getIVIP(WireListm, oplist, NINPUT, NCONSTWIRES, mWires, RangeCell)
    // console.log(this.oplist)
    // const dir = `${process.cwd()}/resource/circuits/${dirname}`
    
    // console.log(listLength, NWires, wireIndex, NINPUT)
    // console.log('oplist',wireIndex)
    // for (let i=0; i < WireListm.length; i ++) {
    //   console.log(WireListm[i])
    // }

    // console.log(SetData_I_V)
    // for (let i=0; i < SetData_I_V.length; i++) {
    //   console.log(i, SetData_I_V[i])
    // }

    const dir = dirname
    
    makeBinFile(dir, SetData_I_V, SetData_I_P, wireIndex, WireListm)
    makeJsonFile (dir, oplist, NINPUT, this.codewdata)
  }

  decode (code, config) {
    let outputs_pt = []
    let stack_pt = []
    this.getEnv(code, config)
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
    } = this.environ_pts
    
    let storage_pt = this.storage_pt
    let call_pt = this.call_pt
    let calldepth = this.callDepth
    let codelen = code.length
  
    const codewdata = this.codewdata
    let mem_pt = {}

    let pc = 0;
    // console.log(code)
    while (pc < codelen) {
      const op = decimalToHex(code[pc])
      pc = pc + 1
      // console.log('op',op, pc )
      
      let d = 0
      let a = 0
      const prev_stack_size = stack_pt.length

      if (hexToInteger(op) - hexToInteger('60') >= 0 
        && hexToInteger(op) - hexToInteger('60') < 32) {
        const pushlen = hexToInteger(op) - hexToInteger('60') + 1
        
        stack_pt.unshift([0, pc+call_pt[calldepth - 1][0], pushlen])
        pc = pc + pushlen
      } else if (hexToInteger(op) === hexToInteger('50')) {
        d = 1;
        a = 0

        stack_pt = pop_stack(stack_pt, d)
      } 
      else if (hexToInteger(op) === hexToInteger('51')) { // mload
        d = 1
        a = 0
        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        stack_pt = pop_stack(stack_pt,d)

        // if (mem_pt.length === 0) {

        // }
        
        stack_pt.unshift(mem_pt[addr])
      } else if (hexToInteger(op) === hexToInteger('52')) { //mstore
        d = 2
        a = 0
        // console.log(stack_pt[0])
        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        const data = stack_pt[1]
        mem_pt[addr] = data

        stack_pt = pop_stack(stack_pt, d)
      } else if (hexToInteger(op) === hexToInteger('53')) {
        d = 2;
        a = 0;
        const addr = Number(this.evalEVM(stack_pt[0])) + 1
        
        const data = stack_pt[1]
        data[2] = 1
        mem_pt[addr] = data
        
        stack_pt = pop_stack(stack_pt, d)
      }
      else if (hexToInteger(op) === hexToInteger('54')) { //sload
        d = 1
        a = 1
        // console.log('54 ',this.evalEVM(stack_pt[0]), stack_pt[0])
        const addr = this.evalEVM(stack_pt[0]).toString().padStart(64, '0')
        stack_pt = pop_stack(stack_pt, d)
        
        let sdata_pt;
        if (storage_pt[addr]) {
          sdata_pt = storage_pt[addr]
        } else {
          sdata_pt = [0, zero_pt, zero_len]
        }
        // console.log('sdata_pt', addr, storage_pt[addr],  sdata_pt)
        stack_pt.unshift(sdata_pt)
      } else if (hexToInteger(op) === hexToInteger('55')) { // store
        d = 2;
        a = 0;

        const addr = this.evalEVM(stack_pt[0]).toString().padStart(64, '0')
        const sdata_pt = stack_pt[1]
        stack_pt = pop_stack(stack_pt, d)

        storage_pt[addr] = sdata_pt
        
      } else if (hexToInteger(op) === hexToInteger('33')) { // caller
        d = 0;
        a = 1

        stack_pt.unshift([0, Is_pt, Is_len])
      } else if (hexToInteger(op) === hexToInteger('34')) { // callvalue
        d = 0;
        a = 1

        stack_pt.unshift([0, Iv_pt, Iv_len])
      } else if (hexToInteger(op) === hexToInteger('35')) { // calldataload
        d = 1;
        a = 1

        const offset = this.evalEVM(stack_pt[0])

        let pt = Id_pt + Number(offset)
        let chose_data_len = Math.min(Id_len - Number(offset), 32)
        stack_pt = pop_stack(stack_pt, d)

        if (pt >= Id_pt && pt + chose_data_len - 1 <= Id_pt + Id_len - 1) {
          stack_pt.unshift([0, pt, chose_data_len])
        }
      } else if (hexToInteger(op) === hexToInteger('36')) { // calldatasize
        d = 0;
        a = 1

        stack_pt.unshift([0, Id_len_info_pt, Id_len_info_len])
      } else if (hexToInteger(op) === hexToInteger('47')) { // selfbalance
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
      else if (hexToInteger(op) < '11'
          || (hexToInteger(op) >= '16' && hexToInteger(op) <= '29')
          || (hexToInteger(op) == 32)
      ) {
        const numberOfInputs = getNumberOfInputs(op);
        d = numberOfInputs

        switch (op) {
          case ['15','19'].includes(op) :
            d = 1;
            a = 1;
          case ['10', '1b', '1c', '14', '01', '02', '03', '04', '16', '17', '18', '0a', '12', '11', '06', '05', '07', '0b', '13', '1a', '1d'].includes(op):
            d = 2
            a = 1
          case ['08', '09'].includes(op):
            d = 3;
            a = 1;
          case '20': // keccak256
            a=1;
            const addr = Number(this.evalEVM(stack_pt[0])) + 1
            let len = Number(this.evalEVM(stack_pt[1]))
            console.log(len, stack_pt[1], this.evalEVM(stack_pt[1]), Number(this.evalEVM(stack_pt[1])))
            stack_pt = pop_stack(stack_pt, 2)
            
            let len_left = len
            let data_lengths = [];
            let target_mem = []
            let target_addr = addr.toString()
            // console.log('mem_pt', addr, mem_pt, mem_pt['1'], len_left)
            while (len_left > 0) {
              const target = mem_pt[target_addr]
              // console.log('target', target, len_left, target_addr)
              target_mem.push(target)
              len_left = len_left - 32
              target_addr = Number(target_addr) + 32
            }

            d = target_mem.length
            // console.log('op 20 target', target_mem)
            for (let i = target_mem.length ; i > 0; i --) {
              stack_pt.unshift(target_mem[i - 1])
            }
        }
        // console.log('0p',op, pc, stack_pt)
        this.op_pointer = this.op_pointer + 1
        this.oplist.push({
          opcode: '',
          pt_inputs: [],
          pt_outputs: [],
          inputs: [],
          outputs: [],
        })
        this.oplist = wire_mapping(op, stack_pt, d, a, this.oplist, this.op_pointer, code, config)

        stack_pt = pop_stack(stack_pt, d)
        stack_pt.unshift(this.oplist[this.op_pointer].pt_outputs)
      }
      else if (hexToInteger(op) == hexToInteger('f3') || hexToInteger(op) == hexToInteger('fd')) {
        d=2
        a=0
        const addr_offset = Number(this.evalEVM(stack_pt[0])) + 1
        const addr_len = this.evalEVM(stack_pt[1])

        outputs_pt = []
        let len_left = Number(addr_len)
        let addr = addr_offset

        while (len_left > 0) {
          let target_data = mem_pt[addr]
          outputs_pt.push(target_data)
          len_left = len_left - target_data[2]
          addr = addr + target_data[2]
        }
        stack_pt = pop_stack(stack_pt, d)
        pc = codelen
      } 
      else if (hexToInteger(op) == hexToInteger('ff')) {

      }
      else if (hexToInteger(op) == hexToInteger('00')) {
        d = 0;
        a = 0;
        outputs_pt=[]
        pc = codelen
      } else if (hexToInteger(op) == hexToInteger('56')) {
        d = 1;
        a = 0;
        const target_pc = this.evalEVM(stack_pt[0])
        pc = Number(target_pc)

        stack_pt = pop_stack(stack_pt, d)
      } else if (hexToInteger(op) == hexToInteger('57')) {
        cjmp_pointer = cjmp_pointer + 1;

        d = 2;
        a = 0;

        const target_pc = this.evalEVM(stack_pt[0])
        const condition = this.evalEVM(stack_pt[1])
        // console.log('target', pc, target_pc, condition, stack_pt[1])
        if (Number(condition) !== 0) {
          pc = Number(target_pc)
          // if (code.slice(calldepth - 1,target_pc)) {

          // }
        }
        stack_pt = pop_stack(stack_pt, d)
      } else if (hexToInteger(op) == hexToInteger('58')) {
        d = 0;
        a = 1;

        codewdata[pc_pt]
        stack_pt.unshift([0, pc_pt, pc_len])
      } else if (hexToInteger(op) == hexToInteger('5b')) {

      }
      else if (hexToInteger(op) - hexToInteger('a0') >= 0
        && hexToInteger(op) - hexToInteger('a0') < 5) {
        const lognum = hexToInteger(op) - hexToInteger('a0') 
        d = lognum + 2
        a = 0
        stack_pt=pop_stack(stack_pt, d)
      }
      else {
        console.log('xxxx', op)
      }

      // const newStackSize = stack_pt.length
      // if (newStackSize - prev_stack_size !== a-d) {

      // }
      this.vmTraceStep = this.vmTraceStep + 1
    }
    outputs_pt[0] ? this.oplist[0].pt_inputs = outputs_pt[0] : this.oplist[0].pt_inputs = []
    for (let i = 0; i < this.oplist.length ;i ++) {
      let k_pt_inputs = this.oplist[i].pt_inputs
      k_pt_inputs = this.oplist[i].opcode == 'fff' && !k_pt_inputs[0]
                    ? [] 
                    : k_pt_inputs[0][0] 
                    ? k_pt_inputs[0] 
                    : [k_pt_inputs]
      let k_inputs = []

      for (let j=0; j<k_pt_inputs.length ; j++) {
        const a = this.evalEVM(k_pt_inputs[j])
        // console.log('inpupt',k_pt_inputs[j], a, this.oplist[i].outputs)
        k_inputs.push(a)
      }
      let k_pt_outputs = this.oplist[i].pt_outputs;
      const opcode = this.oplist[i].opcode

      k_pt_outputs = opcode === 'fff' ? k_pt_outputs : [k_pt_outputs]
      let k_outputs = []
      for (let j = 0; j < k_pt_outputs.length ; j ++) {
        let k_output = this.evalEVM(k_pt_outputs[j])
        k_output = k_output === undefined ? 0 : k_output
        // console.log('aaa', k_pt_outputs[j], k_output)
        k_outputs.push(k_output)
      }
      this.oplist[i].inputs=k_inputs
      this.oplist[i].outputs=k_outputs
      // console.log('k_inputs', k_inputs)
      // console.log('k_outputs',k_outputs)
      
    }
    console.log(this.oplist.length)
    // console.log('input check',this.oplist[2].inputs)
    // console.log('input check',this.oplist[2].outputs)
    return outputs_pt
  }

  evalEVM (pt) {
    const codewdata = this.codewdata
    // console.log(pt)
    const op_pointer = pt[0]
    const wire_pointer = pt[1]
    const byte_size = pt[2]

    if (op_pointer == 0) {
      const slice = codewdata.slice(wire_pointer - 1, wire_pointer + byte_size - 1)
      let output = ''
      for (let i=0; i < slice.length; i ++){
        output = output + decimalToHex(slice[i])
      }
      // console.log('output', output,  BigNumber.from('0x' + output).toString())
      return BigNumber.from('0x' + output).toString()
    }
    
    let t_oplist = this.oplist[op_pointer - 1]
    const op = t_oplist.opcode
    if (t_oplist.outputs.length !== 0) {
      return t_oplist.outputs[wire_pointer - 1]
    }

    // if (op_pointer === 32) console.log(t_oplist, t_oplist.pt_inputs)

    try {
      if (hexToInteger(op) == hexToInteger('fff')) {
        let new_pt = t_oplist.pt_outputs[wire_pointer - 1]
        
        const value = this.evalEVM(new_pt)
        return value
      } else {
        let inputlen = t_oplist.pt_inputs[0].length
        let inputs = []
        let outputs
        // console.log('pt', pt, t_oplist.pt_inputs)
        let pt_inputs = t_oplist.pt_inputs[0][0][0] ? t_oplist.pt_inputs[0] : t_oplist.pt_inputs

        for (let i=0; i < inputlen; i ++) {
          // if (op_pointer === 32) console.log(op_pointer, pt_inputs[i], this.evalEVM(pt_inputs[i]))
          // if (op_pointer === 18) console.log(op_pointer, pt_inputs[i], this.evalEVM(pt_inputs[i]))
          inputs.push(this.evalEVM(pt_inputs[i]))
        }

        if (op === '01') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          // if (op_pointer === 31) console.log('add', Number(inputs[0], Number(inputs[1])), Number(inputs[0]) + Number(inputs[1]))
          return Number(inputs[0]) + Number(inputs[1])
          // console.log('output', output)
        }
        if (op === '02') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          outputs = Number(inputs[0]) * Number(inputs[1])
        }
        if (op === '03') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          outputs = Number(inputs[0]) - Number(inputs[1])
        }
        if (op === '04') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          outputs = Number(inputs[0]) / Number(inputs[1])
        }
        if (op === '05') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          const result = Number(inputs[1]) === 0 ? 0 : Number(inputs[0]) / Number(inputs[1])
          outputs = result
        }
        if (op === '06') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          const result = Number(inputs[1]) === 0 ? Number(inputs[1]) : Number(inputs[0]) % Number(inputs[1])
          outputs = result
        }
        if (op === '0a') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          outputs = inputs[0] ** inputs[1]
        } 
        if (op === '10') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          inputs[0] = inputs[0] % (2**256)
          inputs[1] = inputs[1] % (2**256)
         
          outputs = inputs[0] < inputs[2] ? 1 : 0
        }
        if (op === '11') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          inputs[0] = inputs[0] % (2**256)
          inputs[1] = inputs[1] % (2**256)
         
          outputs = inputs[0] > inputs[2] ? 1 : 0
        }
        if (op === '12') { // slt: signed less than
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var inputlengths = [pt_inputs[0][2], pt_inputs[1][2]];
          var bin_input = [];
          
          bin_input[0] = hd_dec2bin(inputs[0], inputlengths[0] * 8);
          bin_input[1] = hd_dec2bin(inputs[1], inputlengths[1] * 8);
          
          var signed_inputs = new Array(2);
          
          for (var i = 0; i < 2; i++) {
            var temp = bin_input[i];
            signed_inputs[i] = -bin2dec(temp[0]) * Math.pow(2, inputlengths[i] * 8 - 1) + bin2dec(temp.slice(1));
          }
          
          outputs = Number(signed_inputs[0] < signed_inputs[1]);      
        }
        if (op === '13') { // sgt: signed greater than
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var inputlengths = [pt_inputs[0][2], pt_inputs[1][2]];
          var bin_input = [];
          
          bin_input[0] = hd_dec2bin(inputs[0], inputlengths[0] * 8);
          bin_input[1] = hd_dec2bin(inputs[1], inputlengths[1] * 8);
          
          var signed_inputs = new Array(2);
          
          for (var i = 0; i < 2; i++) {
            var temp = bin_input[i];
            signed_inputs[i] = -bin2dec(temp[0]) * Math.pow(2, inputlengths[i] * 8 - 1) + bin2dec(temp.slice(1));
          }
          
          outputs = Number(signed_inputs[0] > signed_inputs[1]);
          
        }
        if (op === '14') { // equality
          if (inputlen !== 2) throw new Error("Invalid input length");
          outputs = Number(Number(inputs[0]) === Number(inputs[1]));
        }
        if (op === '15') { // iszero
          if (inputlen !== 1) throw new Error("Invalid input length");
          outputs = Number(Number(inputs[0]) === 0);
        }
        if (op === '16') { // and
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var bin_input = [];
          bin_input[0] = hd_dec2bin(inputs[0], 253);
          bin_input[1] = hd_dec2bin(inputs[1], 253);
          
          // var bin_and_result = bin_input[0].split('').map((digit, index) => {
          //   return (Number(digit) * Number(bin_input[1][index])).toString();
          // }).join('');
          let bin_and_result1 = BigInt(inputs[0]) & BigInt(inputs[1])
          // console.log('inputs[0]', inputs[0])
          // console.log('bin_input[0]', bin_input[0])
          // console.log('inputs[1]', inputs[1])
          // console.log('bin_input[1]', bin_input[1])
          // console.log('bin_and_result', bin_and_result, Number(bin2dec(bin_and_result)), bin_and_result1, hd_dec2bin(bin_and_result1, 253))
          // outputs = Number(bin2dec(bin_and_result));
          // console.log('output',bin_and_result1.toString())
          // console.log('')
          outputs = bin_and_result1.toString()
        }
        if (op === '17') { // or
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var bin_input = [];
          bin_input[0] = hd_dec2bin(inputs[0], 253);
          bin_input[1] = hd_dec2bin(inputs[1], 253);
          
          // var bin_or_result = bin_input[0].split('').map((digit, index) => {
          //   return (Math.floor(0.5 * (Number(digit) + Number(bin_input[1][index])))).toString();
          // }).join('');
          
          const bin_or_result = BigInt(inputs[0]) | BigInt(inputs[1])
          outputs = bin_or_result.toString();
          
        }
        if (op === '18') { // xor
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var bin_input = [];
          bin_input[0] = hd_dec2bin(inputs[0], 253);
          bin_input[1] = hd_dec2bin(inputs[1], 253);
          
          var bin_not_result = bin_input[0].split('').map((digit, index) => {
            return (Number(digit) + Number(bin_input[1][index])) % 2;
          }).join('');
          console.log('op 18')
          console.log('inputs[0]', inputs[0])
          console.log('bin_input[0]', bin_input[0])
          console.log('inputs[1]', inputs[1])
          console.log('bin_input[1]', bin_input[1])
          console.log(BigInt(inputs[0]) ^ BigInt(inputs[1]))
          console.log('')
          outputs = Number(bin2dec(bin_not_result));  
        }
        if (op === '19') { // not
          if (inputlen !== 1) throw new Error("Invalid input length");
          
          var bin_input = hd_dec2bin(inputs[0], 253);
          var bin_not_result = bin_input.split('').map((digit) => {
            return (Number(digit) + 1) % 2;
          }).join('');
          console.log('op 19')
          console.log('inputs', BigInt(inputs[0]).toString())
          console.log('inputs[0]', BigInt(inputs[0]).toString(2))
          console.log('bin_input[0]', hd_dec2bin(BigInt(inputs[0]).toString(), 253))
          console.log(~BigInt(inputs[0]))
          console.log('')
          outputs = Number(bin2dec(bin_not_result));
        }
        
        if (op === '20') {
          //padData.padStart(pc_len * 2, '0')
          const inputLen = inputs.length
          for (let i = 0; i < inputLen; i ++) {
            inputs[i] = inputs[i].toString().padStart(64, '0')
          }
          const input_con = Buffer.from(inputs.join(''), 'hex')
          const hex = bytesToHex(keccak256(input_con))
          outputs = hex
        } 
        if (op === '1a') {
          if (inputlen !== 2) throw new Error("Invalid input length");
          
          var hex_input2 = hd_dec2hex(inputs[1], 64);
          var input1 = Number(inputs[0]);
          
          if (input1 >= 32) {
            outputs = Number(0);
          } else {
            var pos = input1 * 2 + 1;
            outputs = Number(hex2dec(hex_input2.slice(pos, pos + 2)));
          }
        }
        if (op === '1b' || op === '1c1' || op === '1c2') {
          
          inputs[1] = typeof inputs[1] == 'bigint' ? Number(BigInt('0x' + inputs[1]).toString()) : inputs[1]
          // console.log(inputs)
          inputs[0] = inputs[0] % (2 ** 256)
          inputs[1] = inputs[1] % (2 ** 256)
          if (op === '1b') {
            outputs = inputs[1] * (2 ** inputs[0])
          } else if (op === '1c1') {
            outputs = Math.floor(inputs[1] / (2 ** inputs[0]))
          } if (op === '1c2') {
            return  Math.floor(inputs[1] / (2 ** (inputs[0] - 8)))
          }
        }
        // console.log('ouputsss', outputs, op_pointer, op)
        this.oplist[op_pointer - 1].outputs = outputs;
        return outputs;
      }

    } catch(e) {
      console.log(e)
    }
  }
}

function getNumberOfInputs (op) {
  const subcircuits = subcircuit['wire-list']
  for (let i = 0; i < subcircuits.length; i++) {
    const opcode = subcircuits[i].opcode;
    if (hexToInteger(opcode) === hexToInteger(op)) {
      return subcircuits[i].In_idx[1];
    } else if (op === '1c') {
      return 2
    }
  }
  return -1;
}