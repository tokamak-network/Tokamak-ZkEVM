import transaction from '../resource/circuits/schnorr_prove/transaction1.json' assert {type: 'json'};
import subcircuitInfo from '../resource/subcircuits/subcircuit_info.json' assert {type: 'json'};

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

const { bytecode } = transaction;
let pc = 0;
const wireMap = {
  'load': {
    inputs: [],
    outputs: []
  },
};
const stack = [];

while (pc < bytecode.length) {
  const op = bytecode.slice(pc, pc + 2); // Get 1 byte from hex string
  const numberOfInputs = getNumberOfInputs(op);

  if (hexToInteger(op) - hexToInteger('60') >= 0 && 
      hexToInteger(op) - hexToInteger('60') < 32) { // PUSH1 - PUSH32
    
    const byteSize = hexToInteger(op) - hexToInteger('60') + 1; // Get byte size
    
    const value = bytecode.slice(pc + 2, pc + 2 + byteSize * 2); // Get data from bytecode
    
    const data = new Data(1, wireMap.load.outputs.length, byteSize, value); // Create stack data object
    
    wireMap.load.outputs.push(data); // Add data to wire map
    
    stack.push(data); // Add data to stack
    pc += byteSize * 2; // Move to next byte as many as byte size
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
    const a = stack.pop();
    const b = stack.pop(); 
    // FIXME: a, d 
    // FIXME: number of inputs 
    const value = hexBinaryOperators(op, a.value, b.value);
    
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
console.log(stack);


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
  const subcircuits = subcircuitInfo['wire-list']
  for (let i = 0; i < subcircuits.length; i++) {
    const opcode = subcircuits[i].opcode;
    if (hexToInteger(opcode) === hexToInteger(op)) {
      return subcircuits[i].In_idx[1];
    }
  }
  return -1;
}