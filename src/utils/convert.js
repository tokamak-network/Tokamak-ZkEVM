import path from 'path';
import fs from 'fs'
import { readFileSync } from "fs";
import os from 'os';
import glob from 'glob';


export function hexToInteger(hex) {
  return parseInt(hex, 16);
}  

export function decimalToHex(d) {
  let hex = Number(d).toString(16)
  let padding = 2
  while (hex.length < padding) {
    hex = "0" + hex
  }
  return hex
}

export function pop_stack (stack_pt, d) {
  return stack_pt.slice(d)
}

export function getSubcircuit () {
  const dir = fromDir(path.join('resource', 'subcircuits'), 'subcircuit_info.json')
  const fileUrl = new URL(dir[0], import.meta.url)
  const subcircuit = JSON.parse(readFileSync(fileUrl))
  return subcircuit['wire-list']
}

export function getWire(oplist) {
  const subcircuits = getSubcircuit()
  const NWires = []
  const wireIndex = []
  oplist.map((op) => {
    const wire = subcircuits.find(circuit => circuit.opcode === op.opcode)
    NWires.push(wire.Nwires)
    wireIndex.push(wire.id)
  })

  return { NWires, wireIndex }
}

export function getRangeCell(oplist_len, oplist, NWires, NCONSTWIRES, NINPUT) {
  let RangeCell = new Array(oplist_len)
  const maxNWires = Math.max(...NWires)
  const cellSize = Math.max(maxNWires, NCONSTWIRES + 2 * NINPUT) // NWires[0] -> max(NWires)?
  console.log("cellSize", cellSize)

  for (let i = 0; i < oplist_len; i++) {
    RangeCell[i] = new Array(cellSize);
  }

  // Load subcircuit with 32 inputs and 32 outputs, where every input refers
  // to the corresponding output
  for (let i = NCONSTWIRES; i < NINPUT + NCONSTWIRES; i++) {
    RangeCell[0][i] = [[1, i + 1], [1, i + 1 + NINPUT]];
  }

  for (let k = 1; k < oplist_len + 1; k++) {
    RangeCell[0][0] ? RangeCell[0][0].push([k, 1]) : RangeCell[0][0] = [[k, 1]]
  }
  
  for (let k = 1; k < oplist_len; k++) {
    let oplist_k = oplist[k];
    let k_pt_inputs = oplist_k.pt_inputs;
    let inlen = oplist_k.pt_inputs[0].length;
    let outlen = [oplist_k.pt_outputs].length;
    let NWires_k = NWires[k];
    for (let j = 0; j < NWires_k + 1; j++) {
      if ((j + 1 > NCONSTWIRES && j + 1 <= NCONSTWIRES + outlen) || j + 1 > NCONSTWIRES + outlen + inlen) {
        RangeCell[k][j] = [[k+1, j + 1]];
      }
    }
  }

  // Apply oplist into RangeCell
  for (let k = 1; k < oplist_len; k++) {
    let oplist_k = oplist[k];
    let k_pt_inputs = oplist_k.pt_inputs[0];
    let inlen = oplist_k.pt_inputs[0].length;
    let outlen = [oplist_k.pt_outputs].length;
    let NWires_k = NWires[k];
    
    for (let i = 0; i < inlen; i++) {
      const iIndex = k_pt_inputs[i][0] - 1
      const jIndex = NCONSTWIRES + k_pt_inputs[i][1] - 1
      const input = [k + 1, NCONSTWIRES + outlen + i + 1]
      // console.log(iIndex, jIndex)
      RangeCell[iIndex][jIndex] 
        ? RangeCell[iIndex][jIndex].push(input) 
        : RangeCell[iIndex][jIndex] = [[iIndex+1, jIndex+1], input];
    }
  }
  return RangeCell
}

export function getWireList (NWires, RangeCell, oplist_len) {
  let wireList = [];
  for (let k = 0; k < oplist_len; k++) {
    let NWires_k = NWires[k];

    for (let i = 0; i < NWires_k; i++) {
      if (RangeCell[k][i] && RangeCell[k][i].length > 0) {
        wireList.push([k, i]);
      }
    }
  }
  
  return wireList
}


export function getIVIP (wireList, oplist, NINPUT, NCONSTWIRES, wireList_len, RangeCell) {
  let I_V = [];
  let I_P = [];

  for (let i = 0; i < wireList_len; i++) {
    let k = wireList[i][0];
    let wireIdx = wireList[i][1];
    let oplist_k = oplist[k];

    let inlen, outlen;

    if (k === 0) {
      inlen = NINPUT;
      outlen = NINPUT;
    } else {
      inlen = oplist_k.pt_inputs[0].length;
      outlen = oplist_k.pt_outputs[0][0] ? oplist_k.pt_outputs.length : 1;
    }

    if (wireIdx >= NCONSTWIRES && wireIdx < NCONSTWIRES + outlen) {
      I_V.push(i);
    } else {
      I_P.push(i);
    }
  }

  let I_V_len = I_V.length;
  let I_P_len = I_P.length;
  let rowInv_I_V = [];
  let rowInv_I_P = [];

  for (let i of I_V) {
    let k = wireList[i][0];
    let wireIdx = wireList[i][1];

    let InvSet = RangeCell[k][wireIdx].map(value => value.map(value => value -1))
    let NInvSet = InvSet.length;
    let temp = []
    InvSet.forEach(invs => invs.forEach(inv => {
      temp.push(inv)
    }))

    InvSet = temp
    rowInv_I_V.push(NInvSet, ...InvSet);
  }

  for (let i of I_P) {
    let k = wireList[i][0];
    let wireIdx = wireList[i][1];
    let InvSet = RangeCell[k][wireIdx].map(value => value.map(value => value -1))
    let NInvSet = InvSet.length;
    let temp = []
    InvSet.forEach(invs => invs.forEach(inv => {
      temp.push(inv)
    }))
    InvSet = temp
    rowInv_I_P.push(NInvSet, ...InvSet);
  }

  let SetData_I_V = [I_V_len, ...I_V, ...rowInv_I_V];
  let SetData_I_P = [I_P_len, ...I_P, ...rowInv_I_P];
  
  return { SetData_I_V, SetData_I_P }
}

//make Set_I_V(Set Input Value), Set_I_P(Set Input Pointer), Oplist and WireList bin file
export function makeBinFile (dir, SetData_I_V, SetData_I_P, OpLists, wireList) {
  
  // !fs.existsSync(dir) && fs.mkdirSync(dir)
  const system = os.platform()
  const slash = system === 'darwin' ? '/' : '\\'

  const fdset1 = fs.openSync(`${dir}${slash}Set_I_V.bin`, 'w');
  const fdset2 = fs.openSync(`${dir}${slash}Set_I_P.bin`, 'w');
  const fdOpList = fs.openSync(`${dir}${slash}OpList.bin`, 'w');
  const fdWireList = fs.openSync(`${dir}${slash}WireList.bin`, 'w');

  const setIDataBuffer = Buffer.from(Uint32Array.from(SetData_I_V).buffer);
  const setPDataBuffer = Buffer.from(Uint32Array.from(SetData_I_P).buffer);
  const opListDataBuffer = Buffer.from(Uint32Array.from([OpLists.length, ...OpLists]).buffer);
  const wireListDataBuffer = Buffer.from(Uint32Array.from([wireList.length, ...wireList.flat()]).buffer);

  fs.writeSync(fdset1, setIDataBuffer, 0, setIDataBuffer.length);
  fs.writeSync(fdset2, setPDataBuffer, 0, setPDataBuffer.length);
  fs.writeSync(fdOpList, opListDataBuffer, 0, opListDataBuffer.length);
  fs.writeSync(fdWireList, wireListDataBuffer, 0, wireListDataBuffer.length);

  fs.closeSync(fdset1);
  fs.closeSync(fdset2);
  fs.closeSync(fdOpList);
  fs.closeSync(fdWireList);

}

//make Instance: Input, Output json file
export function makeJsonFile (dir, oplist, NINPUT, codewdata, instanceId) {
  const InstanceFormatIn = [];
  const InstanceFormatOut = [];

  for (let k = 0; k < oplist.length; k++) {
    const outputs = oplist[k].outputs;
    let inputs, inputs_hex, outputs_hex;

    if (k === 0) {
      inputs = outputs;
      inputs_hex = new Array(NINPUT).fill('0x0');
      outputs_hex = new Array(NINPUT).fill('0x0');
    } else {
      inputs = oplist[k].inputs;
      inputs_hex = new Array(inputs.length).fill('0x0');
      outputs_hex = new Array(outputs.length).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
    }

    if (inputs.length > NINPUT) {
      throw new Error('Too many inputs');
    }

    for (let i = 0; i < inputs_hex.length; i++) {
      if (i < inputs.length) {
        inputs_hex[i] = '0x' + BigInt(inputs[i]).toString(16).padStart(64, '0');
      }
    }

    for (let i = 0; i < outputs_hex.length; i++) {
      if (i <= outputs.length) {
        if (outputs[i]) {
          if(oplist[k].opcode === '20') {
            outputs_hex[i] = '0x' + outputs[i].padStart(64, '0')
          } else {
            outputs_hex[i] = '0x' + BigInt(outputs[i]).toString(16).padStart(64, '0')
          }
        }
      } else {
        outputs_hex[i] = '0x0'
      }
    }
    // console.log(outputs)
    if (k === 0) {
      // console.log(inputs.length)
      for (let i = 0; i < inputs.length; i++) {
        let output = oplist[k].pt_outputs[i][1]
        let next = oplist[k].pt_outputs[i][2]
        let sourcevalue = codewdata.slice(output - 1, output + next - 1 )

        let slice = ''
        for (let i=0; i < sourcevalue.length; i ++){
          slice = slice + decimalToHex(sourcevalue[i]).toString(16)
        }
        sourcevalue = '0x' + slice.toString().padStart(64, '0');
        console.log(i, sourcevalue, outputs_hex[i])
        if (sourcevalue !== outputs_hex[i]) throw new Error('source value mismatch');
      }
    }

    const split128Bit = (hex) => {
      const high = '0x' + hex.slice(2, 34).padStart(32, '0');
      const low = '0x' + hex.slice(34).padStart(32, '0');
      return [high, low];
    }

    const inputs_hex_128 = [];
    const outputs_hex_128 = [];

    inputs_hex.forEach(hex => {
      const [high, low] = split128Bit(hex);
      inputs_hex_128.push(high, low);
    });

    outputs_hex.forEach(hex => {
      const [high, low] = split128Bit(hex);
      outputs_hex_128.push(high, low);
    });

    InstanceFormatIn.push({ in: inputs_hex_128 });
    InstanceFormatOut.push({ out: outputs_hex_128 });

    !fs.existsSync(path.join(dir, `instance${instanceId}`)) && fs.mkdirSync(path.join(dir, `instance${instanceId}`))
    const fdInput = fs.openSync(path.join(dir, `instance${instanceId}`, `Input_opcode${k}.json`), 'w');
    const fdOutput = fs.openSync(path.join(dir, `instance${instanceId}`, `Output_opcode${k}.json`), 'w');

    fs.writeSync(fdInput, JSON.stringify(InstanceFormatIn[k]));
    fs.writeSync(fdOutput, JSON.stringify(InstanceFormatOut[k]));

    fs.closeSync(fdInput);
    fs.closeSync(fdOutput);
  }
}

export function hd_dec2bin(d, n) {
  // Input checking
  if (arguments.length < 1 || arguments.length > 2) {
    throw new Error('Invalid number of arguments');
  }
  if (d === null || d === undefined || d === '') {
    return '';
  }

  if (n === undefined) {
    n = 1; // Need at least one digit even for 0.
  } else {
    if (typeof n !== 'number' && typeof n !== 'string' || isNaN(Number(n)) || Number(n) < 0) {
      throw new Error('Invalid bit argument');
    }
    n = Math.round(Number(n)); // Make sure n is an integer.
  }
  let e = Math.ceil(Math.log2(Math.max(Number(d))));

  return BigInt(d).toString(2).padStart(Math.max(n, e), '0');
}

export function dec2bin(d, n) {
  // Input checking
  if (arguments.length < 1 || arguments.length > 2) {
      throw new Error('Invalid number of arguments');
  }
  
  if (d === null || d === undefined || d === '') {
      return '';
  }
  
  if (typeof d !== 'number' || d < 0 || !isFinite(d)) {
      throw new Error('Input must be a non-negative finite integer');
  }
  
  // Convert d to a column vector
  d = [d];
  
  if (n === undefined) {
      n = 1; // Need at least one digit even for 0.
  } else {
      if (typeof n !== 'number' || !isFinite(n) || n < 0 || n % 1 !== 0) {
          throw new Error('Invalid bit argument');
      }
      n = Math.round(n); // Make sure n is an integer.
  }
  
  // Actual algorithm
  var e = Math.ceil(Math.log2(Math.max.apply(null, d))); // How many digits do we need to represent the numbers?
  var s = '';
  
  for (var i = 0; i < d.length; i++) {
      var binary = '';
      for (var j = 1 - Math.max(n, e); j <= 0; j++) {
          binary += Math.floor(d[i] * Math.pow(2, j)) % 2;
      }
      s += binary.split('').reverse().join(''); // Reverse the binary string and append it to s
  }
  
  return s;
}

export function bin2dec(str) {
  if (typeof str === 'string') {
      return bin2decImpl(str);
  } else if (Array.isArray(str) && str.every(item => typeof item === 'string')) {
      const binaryStrings = str.map(item => bin2decImpl(item));
      return binaryStrings;
  } else {
      throw new Error('Invalid input. Expected a string or an array of strings.');
  }
}

function bin2decImpl(s) {
  if (s.length === 0) {
      return null;
  }
  // Remove significant spaces
  let trimmed = s.replace(/\s/g, '');
  const leadingZeros = s.length - trimmed.length;
  trimmed = '0'.repeat(leadingZeros) + trimmed;
  
  // Check for illegal binary strings
  if (!/^[01]+$/.test(trimmed)) {
      throw new Error('Illegal binary string');
  }

  const n = trimmed.length;
  let x = 0;

  for (let i = 0; i < n; i++) {
      const digit = parseInt(trimmed.charAt(i), 10);
      x += digit * Math.pow(2, n - 1 - i);
  }

  return x;
}

export function bin2decimal(binStr) {
  const lastIndex = binStr.length - 1;

  return Array.from(binStr).reduceRight((total, currValue, index) => (
      (currValue === '1') ? total + (BigInt(2) ** BigInt(lastIndex - index)) : total
  ), BigInt(0));
}

export function hexToString(hex) {
  if (!hex.match(/^[0-9a-fA-F]+$/)) {
    throw new Error('is not a hex string.');
  }
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  const bytes = [];
  for (let n = 0; n < hex.length; n += 2) {
    const code = parseInt(hex.substr(n, 2), 16);
    bytes.push(code);
  }
  return bytes;
}

function fromDir (directory = '', filter = '/*') {
  const __dirname = path.resolve();
  const __searchkey = path.join(__dirname, directory, filter)
  const res = glob.sync(__searchkey.replace(/\\/g, '/'));
  return res;
}