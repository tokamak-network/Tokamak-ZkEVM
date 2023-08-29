import { decimalToHex, hexToInteger } from "../utils/convert.js";
import { subcircuit } from "../../resource/subcircuits/subcircuit_info.js";
import {
  trap,
  mod,
  fromTwos,
  toTwos,
  exponentiation
} from './utils.js'

class Data {
  constructor(opIndex, outputIndex, byteSize, value) {
    this.opIndex = opIndex;
    this.outputIndex = outputIndex;
    this.byteSize = byteSize;
    this.value = value;
  }
  getOpIndex() {
    return this.opIndex;
  }
  getOutputIndex() {
    return this.outputIndex;
  }
  getByteSize() {
    return this.byteSize;
  }
}

export async function decodes(opts) {

  let { code, pc } = opts;
  // console.log(code)
  const wireMap = {
    'load': {
      inputs: [],
      outputs: []
    },
  };
  const stack = [];
  // code = code.toString()
  // console.log(code)
  while (pc < code.length) {
    // const op = code.slice(pc, pc + 2); // Get 1 byte from hex string
    const op = decimalToHex(code[pc])
    const numberOfInputs = getNumberOfInputs(op);
    // console.log(op, numberOfInputs)
    if (hexToInteger(op) - hexToInteger('60') >= 0 && 
        hexToInteger(op) - hexToInteger('60') < 32) { // PUSH1 - PUSH32
      
      const byteSize = hexToInteger(op) - hexToInteger('60') + 1; // Get byte size
      // console.log('bytesize', byteSize)
      // const value = code.slice(pc + 1, pc + 1 + byteSize ); // Get data from code
      const value = decimalToHex(code[pc + 1])

      const data = new Data(1, wireMap.load.outputs.length, byteSize, value); // Create stack data object
      
      wireMap.load.outputs.push(data); // Add data to wire map
      // console.log(data)
      stack.push(data); // Add data to stack
      // console.log(stack)
      pc += byteSize; // Move to next byte as many as byte size
    }
    
    else if (numberOfInputs === 1) { // Unary operators
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
    }
    else if (numberOfInputs === 2) { // Binary operators
      console.log('stack',stack)
      const a = stack.pop();
      const b = stack.pop(); 
      // FIXME: a, d 
      // FIXME: number of inputs 
      console.log('value', op, hexToInteger(a.value), hexToInteger(b.value))
      const value = hexBinaryOperators(op, a.value.toString(), b.value.toString());
      
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
      console.log('stack3',stack)
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
      
    pc += 1; // Move to next byte; 1 byte = 2 hex characters
  }
  // console.log(stack);
  console.log(wireMap)
  // console.log(wireMap[1])
  // console.log(wireMap.load)
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