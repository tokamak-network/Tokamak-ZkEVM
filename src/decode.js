// import transaction from '../resource/circuits/schnorr_prove/transaction1.json' assert {type: 'json'};
import { subcircuit } from '../resource/subcircuits/subcircuit_info.js'
import {
  trap,
  mod,
  fromTwos,
  toTwos,
  exponentiation
} from './evm/utils.js'
import { wire_mapping } from './wire_mappings.js';

export class Decoder {
  // constructor(opIndex, outputIndex, byteSize, value) {
  //   this.opIndex = opIndex;
  //   this.outputIndex = outputIndex;
  //   this.byteSize = byteSize;
  //   this.value = value;
  // }
  // getOpIndex() {
  //   return this.opIndex;
  // }
  // getOutputIndex() {
  //   return this.outputIndex;
  // }
  // getByteSize() {
  //   return this.byteSize;
  // }
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
    // const storage_pts = [422, 423, 424, 425]
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
      pt_inputs: '',
      pt_outputs: '',
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
      pc_pt,
      pc_len,
      Iv_pt,
      Iv_len,
      Id_pt,
      Id_len,
      Id_len_info_pt,
      Id_len_info_len,
      Is_pt,
      Is_len,
      od_pt,
      od_len,
      od_len_info_pt,
      od_len_info_len,
      sd_pt,
      sd_len,
      calldepth_pt,
      calldepth_len,
      balance_pt,
      balance_len,
      zero_pt,
      zero_len,
      storage_pts,
      storage_lens
    } = this.environ_pts
    
    let storage_pt = this.storage_pt
    let call_pt = this.call_pt
    let calldepth = this.callDepth
    let codelen = code.length
    const codewdata = this.codewdata
    let mem_pt = {}

    let pc = 0;

    while (pc < codelen) {
      const op = code[pc].toString(16)
      pc = pc + 1
      
      let d = 0
      let a = 0
      const prev_stack_size = stack_pt.length
      // console.log('op', op, stack_pt)
      if (hexToInteger(op) - hexToInteger('60') >= 0 
        && hexToInteger(op) - hexToInteger('60') < 32) {
        const pushlen = hexToInteger(op) - hexToInteger('60') + 1
        // console.log(call_pt[calldepth - 1][0])
        // console.log(pc)
        // console.log('push', [0, pc+call_pt[calldepth - 1][0], pushlen])
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
        // console.log('addr',addr)
        // console.log('stack_pt',stack_pt)
        // console.log('mem_pt[addr]',mem_pt[addr])
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
        // console.log('before unshift 54', stack_pt)
        // console.log('54 sdata_pt', sdata_pt)
        stack_pt.unshift(sdata_pt)
        // console.log('after unshift 54', stack_pt)
      } else if (hexToInteger(op) === hexToInteger('55')) { // store
        d=2;
        a=0;

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
        // console.log(duplen, '80', stack_pt)
        // console.log('80', stack_pt[duplen])
        stack_pt.unshift(stack_pt[duplen]) // duplen 길어지면 수정 필ㅛㅏㄹ듯
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
          case ['10', '1b', '1c', '14', '1', '2', '3', '4', '16', '17', '18', 'a', '12', '11', '6', '5', '7', 'b', '13', '1a', '1d'].includes(op):
            d=2
            a=1
          case ['08', '09'].includes(op):
            d=3;
            a=1;
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
  
    // console.log(this.oplist)
    for (let i = 0; i < this.oplist.length; i++) {
      console.log(this.oplist[i])
      console.log(this.oplist[i].pt_inputs)
    }
    return outputs_pt
  }

  

  evalEVM (pt) {

    const codewdata = this.codewdata
    const op_pointer = pt[0]
    const wire_pointer = pt[1]
    const byte_size = pt[3]

    if (op_pointer == 0) {
      return codewdata[wire_pointer - 1]
    }
  }
}

function display (param) {
  console.log(param)
}

function pop_stack (stack_pt, d) {
  return stack_pt.slice(d)
}


function hexToInteger(hex) {
  return parseInt(hex, 16);
}  

// TODO: Underflow and Overflow check; there's no negative number in EVM

/**
 * 
 * @param {String} op hex string of opcode
 * @param {String} a  hex string of data
 * @returns 
 */
function hexUnaryOperators (op, a) {
  if (op === '15') { // ISZERO
    const res = hexToInteger(a) === 0
    return res ? '1' : '0';
  }
  if (op === '19') { // FIXME: NOT
    return (~hexToInteger(a)).toString(16);
  }
}


/**
 * 
 * @param {String} op hex string of opcode
 * @param {String} a  hex string of data
 * @param {String} b  hex string of data
 * @returns 
 */
function hexBinaryOperators (op, a, b) {
  if (op === '01') { // ADD
    return (hexToInteger(a) + hexToInteger(b)).toString(16);
  }
  if (op === '02') { // SUB
    return (hexToInteger(a) - hexToInteger(b)).toString(16);
  }
  if (op === '03') { // MUL
    return (hexToInteger(a) * hexToInteger(b)).toString(16);
  }
  if (op === '04') { // DIV
    return (Math.floor(hexToInteger(a) / hexToInteger(b))).toString(16);
  }
  if (op === '05') { // SDIV
    let r
      if (b === BigInt(0)) {
        r = BigInt(0)
      } else {
        r = toTwos(fromTwos(a) / fromTwos(b))
      }
    return  r
  }
  if (op === '06') { // MOD
    let r
    if (b === BigInt(0)) {
      r = b
    } else {
      r = mod(a, b)
    }
  }
  if (op === '04') { // DIV
  }
}
/**
 * 
 * @param {String} op hex string of opcode
 * @param {String} a  hex string of data
 * @param {String} b  hex string of data
 * @returns 
 */
function hexTernaryOperators (op, a, b, c) {
  if (op === '08') { // ADDMOD
    return ((hexToInteger(a) + hexToInteger(b)) % hexToInteger(c)).toString(16);
  }
  if (op === '09') { // MULMOD
    return ((hexToInteger(a) * hexToInteger(b)) % hexToInteger(c)).toString(16);
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