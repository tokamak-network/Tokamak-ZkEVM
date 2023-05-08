// import transaction from '../resource/circuits/schnorr_prove/transaction1.json' assert {type: 'json'};
import { subcircuit } from '../resource/subcircuits/subcircuit_info.js'
import {
  trap,
  mod,
  fromTwos,
  toTwos,
  exponentiation
} from './evm/utils.js'

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
    
    this.call_pt = call_pt
    this.codewdata = codewdata
    this.callDepth = callDepth
    this.environData = environData
    this.storage_keys = storage_keys
    this.environ_pts = environ_pts
    this.op_pointer = 1
    this.cjmp_pointer = 0;
    this.storage_pt = storage_pt
    this.storage_pts = storage_pts
    this.callcode_suffix = callcode_suffix
    this.callcode_suffix_pt = callcode_suffix_pt
    this.callresultlist = []
    this.vmTraceStep = 0

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
    let mem_pt = []

    let pc = 0;

    while (pc < codelen) {
      const op = code[pc].toString(16)
      pc = pc + 1
      
      // console.log('op', op)
      // console.log(hexToInteger('60'))
      // console.log(op - hexToInteger('60'))
      let d = 0
      let a = 0
      const prev_stack_size = stack_pt.length

      
      if (op - '60' >= 0 && op - 60 < 32) {
        const pushlen = hexToInteger(op) - hexToInteger('60') + 1
        // console.log(call_pt[calldepth - 1][0])
        // console.log(pc)
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
        const addr = (this.evalEVM(stack_pt[0]) + 1)
        // console.log(addr)
        stack_pt = pop_stack(stack_pt,d)

        // if (mem_pt.length === 0) {

        // }
        // stack_pt.unshift(mem_pt(addr))
      } else if (hexToInteger(op) === hexToInteger('52')) {
        d = 2
        a = 0
        const addr = (this.evalEVM(stack_pt[0]) + 1)
        const data = stack_pt[1]
        mem_pt[addr - 1] = data
      } else if (hexToInteger(op) === hexToInteger('53')) {
        d = 2;
        a = 0;
        const addr = (this.evalEVM(stack_pt[0]) + 1)
        const data = stack_pt[1]
        data[2] = 1
        mem_pt[addr - 1] = data
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
      } else if (hexToInteger(op) === 54) {
        d=1;
        a=1;
      }

    }

    // console.log(stack_pt)
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


export default async function decode(opts) {
  let { code, pc } = opts
  const codeLen = code.length
  let stack_pt = []
  let ouputs_pt = []
  pc = 0
  // code = code.toString()
  while (pc < codeLen) {
    let d
    let a
    pc = pc + 1
    op = code[pc]
    let prev_stack_size = stack_pt.length

    switch (op) {
      case 'push' :
      case '50':
        d = 1;
        a = 0;

        stack_pt = pop_stack(stack_pt, d)
      case '51': // mload
        d = 1;
        a = 0

        addr = stack_pt[0][0] === 0 ? opPointer(stack_pt[0][1]) : ''
    }
  }
}

function opPointer (wire_pointer) {
  // ROM_value=vpa(hd_hex2dec(cell2mat(codewdata(wire_pointer:wire_pointer+byte_size-1))));
  return 0
}

function pop_stack (stack_pt, d) {
  const stackLen = stack_pt.length
  if (stackLen >= d) {
    return stackLen > d ? stack_pt.slice(d, stackLen - 1 ) : []
  }
}

export async function decodes(opts) {

  let { code, pc } = opts;
  const bufferCode = Buffer.from(code, 'hex')
  // console.log(environ_pts)
  // console.log(callcode_suffix)
  // console.log(code.toString())
  const wireMap = {
    'load': {
      inputs: [],
      outputs: []
    },
  };
  const stack = [];
  code = code.toString()
  while (pc < code.length) {
    const op = code.slice(pc, pc + 2); // Get 1 byte from hex string
    const numberOfInputs = getNumberOfInputs(op);
    // console.log(op, numberOfInputs)
    if (hexToInteger(op) - hexToInteger('60') >= 0 && 
        hexToInteger(op) - hexToInteger('60') < 32) { // PUSH1 - PUSH32
      
      const byteSize = hexToInteger(op) - hexToInteger('60') + 1; // Get byte size
      
      const value = code.slice(pc + 2, pc + 2 + byteSize * 2); // Get data from code
      
      const data = new Data(1, wireMap.load.outputs.length, byteSize, value); // Create stack data object
      
      wireMap.load.outputs.push(data); // Add data to wire map
      
      stack.push(data); // Add data to stack
      // console.log(stack)
      pc += byteSize * 2; // Move to next byte as many as byte size
    } else if (numberOfInputs === 1) { // Unary operators
      const a = stack.pop();
      const value = hexUnaryOperators(op, a.value);
      
      const length = Object.keys(wireMap).length;
      
      const data = new Data (
        length + 1, // opIndex
        0, // outputIndex
        a.byteSize, // FIXME: byteSize
        value // value
      )
      wireMap[length] = {
        inputs: [a],
        outputs: [data]
      }
      stack.push(data); // Add data to stack
    } else if (numberOfInputs === 2) { // Binary operators
      const a = stack.pop();
      const b = stack.pop(); 
      // FIXME: a, d 
      // FIXME: number of inputs 
      // console.log(op, a.value, b.value)
      const value = hexBinaryOperators(op, a.value, b.value);
      // console.log(value)
      const length = Object.keys(wireMap).length;
      
      const data = new Data(
        length + 1, // opIndex
        0, // outputIndex
        Math.max(a.byteSize, b.byteSize), // FIXME: byteSize
        value // value
      )
      wireMap[length] = {
        inputs: [a, b],
        outputs: [data]
      }
      stack.push(data); // Add data to stack
    }
  
    else if (numberOfInputs === 3) { // Ternary operators
      const a = stack.pop();
      const b = stack.pop();
      const c = stack.pop();
      
      const value = hexTernaryOperators(op, a.value, b.value, c.value);
      
      const length = Object.keys(wireMap).length;
      
      const data = new Data(
        length + 1, // opIndex
        0, // outputIndex
        Math.max(a.byteSize, b.byteSize, c.byteSize), // FIXME: byteSize
        value // value
      )
      wireMap[length] = {
        inputs: [a, b, c],
        outputs: [data]
      }
      stack.push(data); // Add data to stack
    }
      
    pc += 2; // Move to next byte; 1 byte = 2 hex characters
  }
  // console.log('stack', stack);
  // console.log('wireMap',wireMap)
  // console.log('wireMap[1].inputs', wireMap[1].inputs)
  // console.log('wireMap[load].outputs', wireMap['load'].outputs)
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
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
  }
  if (op === '04') { // DIV
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