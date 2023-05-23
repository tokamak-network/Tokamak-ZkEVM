// import transaction from '../resource/circuits/schnorr_prove/transaction1.json' assert {type: 'json'};
import { subcircuit } from '../resource/subcircuits/subcircuit_info.js'
import {
  trap,
  mod,
  fromTwos,
  toTwos,
  exponentiation,
} from './evms/utils.js'
import { wire_mapping } from './wire_mappings.js';
import { Stack } from './evms/stack.js';
import { Memory } from './evms/memory.js';
import { handlers } from './evms/functions.js';
import { keccak256 } from 'ethereum-cryptography/keccak.js'
import { bytesToHex } from 'ethereum-cryptography/utils.js'

import { 
  hexToInteger, 
  decimalToHex, 
  pop_stack, 
  getWire, 
  getRangeCell, 
  getWireList, 
  getIVIP, 
  makeBinFile, 
  makeJsonFile 
} from './utils/convert.js';

export class Decoder {
  constructor () {

  }

  getEnv(code) {
    const codelen = code.length
    const callcode_suffix_raw = '63fffffffd5447101561040163fffffffe541016';
    const callcode_suffix_pt = codelen + 1;
    
    const callcode_suffix = Buffer.from(callcode_suffix_raw, 'hex') 
    const callcode_suffix_len = callcode_suffix_raw.length / 2
  
    const Iddata = '45152ae300000000000000000000000000000000000000000000000000000000'
  
    const pc_pt = callcode_suffix_pt + callcode_suffix_len
    const pc_len = 4
    
    const Iv_pt = pc_pt + pc_len
    const Iv_len = 32
    const Id_pt = Iv_pt + Iv_len
    const Id_len = Iddata.length / 2
    const Id_lendata = '0020' // TODO: lower(dec2hex(environ_pts.Id_len,environ_pts.Id_len_info_len*2));
    
    const Id_len_info_pt = Id_pt + Id_len
    const Id_len_info_len = 2
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
  
    const storagedata = ['03', '06',  '05', '11'];
    let storage_pts = [0, 0, 0, 0]
    let storage_lens = [0, 0, 0, 0]
    
    storage_pts[0] = zero_pt + zero_len
    storage_lens[0] = storagedata[0].length / 2
    
    for (let i=1; i < storagedata.length ; i++) {
      storage_pts[i] = storage_pts[i-1] + storage_lens[i-1]
      storage_lens[i] = storagedata[i].length / 2
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
    
    const Isdata = '0000000000000000000000005B38Da6a701c568545dCfcB03FcB875f56beddC4'
    const padData = '' 
    const od_lendata = od_len.toString(16)
    const pcdata = padData.padStart(pc_len * 2, '0')
    const Ivdata = padData.padStart(Iv_len*2, '0')
    const oddData = padData.padStart(od_len * 2, '0')
    const sddata = '55'.padStart(sd_len * 2, '0')
    const calldepthdata = padData.padStart(calldepth_len * 2, '0')
    const balance = 1000000
    const balancedata = balance.toString(16).padStart(balance_len * 2, '0')
  
    const storage_keys = [
      '0000000000000000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000001',
      '0000000000000000000000000000000000000000000000000000000000000002',
      '0000000000000000000000000000000000000000000000000000000000000003'
    ]
    
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

  runCode (code) {
    let outputs_pt = []
    let stack_pt = []
    this.getEnv(code)
    const {
      Iv_pt,
      Iv_len,
      Id_len_info_pt,
      Id_len_info_len,
      Is_pt,
      Is_len,
      balance_pt,
      balance_len,
      zero_pt,
      zero_len,
    } = this.environ_pts
    
    let storage_pt = this.storage_pt
    let call_pt = this.call_pt
    let calldepth = this.callDepth
    let codelen = code.length
    console.log('codelen', codelen)
    const codewdata = this.codewdata
    let mem_pt = {}

    let pc = 0;

    while (pc < codelen) {
      const op = decimalToHex(code[pc])
      pc = pc + 1
      
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
        const addr = this.evalEVM(stack_pt[0]) + 1
        // console.log(addr)
        stack_pt = pop_stack(stack_pt,d)

        // if (mem_pt.length === 0) {

        // }
        // console.log('51', addr, mem_pt[addr])
        stack_pt.unshift(mem_pt[addr])
      } else if (hexToInteger(op) === hexToInteger('52')) { //mstore
        d = 2
        a = 0
        const addr = this.evalEVM(stack_pt[0]) + 1
        const data = stack_pt[1]
        mem_pt[addr] = data

        stack_pt = pop_stack(stack_pt, d)
      } else if (hexToInteger(op) === hexToInteger('53')) {
        d = 2;
        a = 0;
        const addr = this.evalEVM(stack_pt[0]) + 1
        // console.log('addr',addr)
        const data = stack_pt[1]
        data[2] = 1
        mem_pt[addr] = data
        
        stack_pt = pop_stack(stack_pt, d)
      }
      else if (hexToInteger(op) === hexToInteger('54')) { //sload
        d = 1
        a = 1

        const addr = this.evalEVM(stack_pt[0]).toString().padStart(64, '0')
        stack_pt = pop_stack(stack_pt, d)
        
        let sdata_pt;
        if (storage_pt[addr]) {
          sdata_pt = storage_pt[addr]
        } else {
          sdata_pt = [0, zero_pt, zero_len]
        }
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

        stack_pt.unshift([0, Is_pt, Is_len])
      } else if (hexToInteger(op) === hexToInteger('36')) { // calldatasize
        d = 0;
        a = 1
        // console.log('36', [0, Id_len_info_pt, Id_len_info_len])
        stack_pt.unshift([0, Id_len_info_pt, Id_len_info_len])
      } else if (hexToInteger(op) === hexToInteger('47')) { // selfbalance
        d = 0;
        a = 1

        // console.log('47', [0, balance_pt, balance_len])
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
      else if (hexToInteger(op) < hexToInteger('11') 
          || (hexToInteger(op) >= hexToInteger('16') && hexToInteger(op) <= hexToInteger('29'))
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
            const addr = this.evalEVM(stack_pt[0]) + 1
            const len = this.evalEVM(stack_pt[1])

            stack_pt = pop_stack(stack_pt, 2)

            let len_left = len
            let data_lengths = [];
            let target_mem = []
            let target_addr = addr

            while (len_left > 0) {
              const target = mem_pt[target_addr]
              target_mem.push(target)
              len_left = len_left - 32
              target_addr = target_addr + 32
            }

            d = target_mem.length
            for (let i = 0; i < target_mem.length; i ++) {
              stack_pt.push(target_mem[i])
            }
        }
        
        this.op_pointer = this.op_pointer + 1
        this.oplist.push({
          opcode: '',
          pt_inputs: [],
          pt_outputs: [],
          inputs: [],
          outputs: [],
        })
        
        this.oplist = wire_mapping(op, stack_pt, d, a, this.oplist, this.op_pointer)

        stack_pt = pop_stack(stack_pt, d)
        stack_pt.unshift(this.oplist[this.op_pointer].pt_outputs)
      }
      else if (hexToInteger(op) == hexToInteger('f3') || hexToInteger(op) == hexToInteger('fd')) {
        d=2
        a=0

        const addr_offset = this.evalEVM(stack_pt[0]) + 1
        const addr_len = this.evalEVM(stack_pt[1])

        outputs_pt = []
        let len_left = addr_len
        let addr = addr_offset

        while (len_left > 0) {
          let target_data = mem_pt[addr]
          outputs_pt.push(target_data)
          len_left = len_left - target_data[2]
          addr = addr_offset + target_data[2]
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
      }

      // const newStackSize = stack_pt.length
      // if (newStackSize - prev_stack_size !== a-d) {

      // }
      this.vmTraceStep = this.vmTraceStep + 1
    }
    this.oplist[0].pt_inputs = outputs_pt[0]
    
    for (let i = 0; i < this.oplist.length ;i ++) {
      let k_pt_inputs = this.oplist[i].pt_inputs

      k_pt_inputs = k_pt_inputs[0][0] ? k_pt_inputs[0] : [k_pt_inputs]
      let k_inputs = []

      for (let j=0; j<k_pt_inputs.length ; j++) {
        const a = this.evalEVM(k_pt_inputs[j])
        k_inputs.push(a)
      }
      let k_pt_outputs = this.oplist[i].pt_outputs;
      const opcode = this.oplist[i].opcode

      k_pt_outputs = opcode === 'fff' ? k_pt_outputs : [k_pt_outputs]
      let k_outputs = []
      for (let j = 0; j < k_pt_outputs.length ; j ++) {
        let k_output = this.evalEVM(k_pt_outputs[j])
        k_outputs.push(k_output)
      }
      this.oplist[i].inputs=k_inputs
      this.oplist[i].outputs=k_outputs

    }
    // console.log(this.oplist)
    const listLength = this.oplist.length
    const oplist = this.oplist
    const { NWires, wireIndex } = getWire(this.oplist)
    
    const NCONSTWIRES=1
    const NINPUT = (NWires[0] - NCONSTWIRES)/2

    const RangeCell = getRangeCell(listLength, oplist, NWires, NCONSTWIRES, NINPUT)

    const WireListm = getWireList(NWires, RangeCell, listLength) // wirelistM 값들 수정해야함


    let mWires = WireListm.length;
    
    const { SetData_I_V, SetData_I_P } = getIVIP(WireListm, oplist, NINPUT, NCONSTWIRES, mWires, RangeCell)

    const dir = `${process.cwd()}/resource/circuits/schnorr_prove2`
    makeBinFile(dir, SetData_I_V, SetData_I_P, wireIndex, WireListm)
    makeJsonFile (dir, oplist, NINPUT, this.codewdata)
    
    
    

    return outputs_pt
  }

  evalEVM (pt) {
    const codewdata = this.codewdata
    // console.log(pt)
    const op_pointer = pt[0]
    const wire_pointer = pt[1]
    const byte_size = pt[3]

    if (op_pointer == 0) {
      return codewdata[wire_pointer - 1]
    }
    
    let t_oplist = this.oplist[op_pointer - 1]

    const op = t_oplist.opcode
    if (t_oplist.outputs.length !== 0) {
      return t_oplist.outputs[wire_pointer - 1]
    }
    
    try {
      const RunState = {
        opcode: 0x00,
        programCounter: -1,
        stack: new Stack(),
        memory: new Memory(),
        code: [],
      }

      if (hexToInteger(op) == hexToInteger('fff')) {
        let new_pt = t_oplist.pt_outputs[wire_pointer - 1]
        const value = this.evalEVM(new_pt)
        return value
      } else {
        let inputlen = t_oplist.pt_inputs[0].length
        let inputs = []
        let pt_inputs = t_oplist.pt_inputs[0][0][0] ? t_oplist.pt_inputs[0] : t_oplist.pt_inputs
        for (let i=0; i < inputlen; i ++) {
          inputs.push(this.evalEVM(pt_inputs[i]))
        }
        if (op === '01') {
          return inputs[0] + inputs[1]
        }
        if (op === '02') {
          return inputs[0] * inputs[1]
        }
        if (op === '03') {
          return inputs[0] - inputs[1]
        }
        if (op === '04') {
          return inputs[0] / inputs[1]
        }
        if (op === '05') {
          const result = inputs[1] === 0 ? 0 : inputs[0] / inputs[1]
          return result
        }
        if (op === '06') {
          const result = inputs[1] === 0 ? inputs[1] : inputs[0] % inputs[1]
          return result
        }
        if (op === '0a') {
          return inputs[0] ** inputs[1]
        }
        if (op === '20') {
          //padData.padStart(pc_len * 2, '0')
          const inputLen = inputs.length
          for (let i = 0; i < inputLen; i ++) {
            inputs[i] = inputs[i].toString().padStart(64, '0')
          }
          const input_con = Buffer.from(inputs.join(''), 'hex')
          const hex = bytesToHex(keccak256(input_con))
          return hex
        }  
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
    }
  }
  return -1;
}