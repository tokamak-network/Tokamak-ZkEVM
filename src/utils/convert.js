import { subcircuit } from "../../resource/subcircuits/subcircuit_info.js"
import fs from 'fs'



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

export function getWire(oplist) {
  const subcircuits = subcircuit['wire-list']
  const NWires = []
  const wireIndex = []
  oplist.map((op) => {
    const wire = subcircuits.find(circuit => {
      if (circuit.opcode === op.opcode) return true
    })
    NWires.push(wire.Nwires)
    wireIndex.push(wire.id)
  })
  
  return { NWires, wireIndex }
}

export function getRangeCell(listLength, oplist, NWires, NCONSTWIRES, NINPUT) {
  let RangeCell = new Array(listLength);
  const cellSize = Math.max(NWires[0], NCONSTWIRES + 2 * NINPUT)

  for (let i = 0; i < listLength; i++) {
    RangeCell[i] = new Array(cellSize);
  }

  // Load subcircuit with 32 inputs and 32 outputs, where every input refers
  // to the corresponding output
  for (let i = NCONSTWIRES; i <= NINPUT + NCONSTWIRES - 1; i++) {
    RangeCell[0][i] = [[1, i + 1], [1, i + 1 + NINPUT]];
  }

  for (let k = 1; k < listLength + 1; k++) {
    RangeCell[0][0] ? RangeCell[0][0].push([k, 1]) : RangeCell[0][0] = [[k, 1]]
  }
  
  for (let k = 1; k < listLength; k++) {
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
  for (let k = 1; k < listLength; k++) {
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

export function getWireList (NWires, RangeCell, listLength) {
  let WireListm = [];
  for (let k = 0; k < listLength; k++) {
    let NWires_k = NWires[k];

    for (let i = 0; i < NWires_k; i++) {
      if (RangeCell[k][i] && RangeCell[k][i].length > 0) {
        WireListm.push([k, i]);
      }
    }
  }
  
  return WireListm
}


export function getIVIP (WireListm, oplist, NINPUT, NCONSTWIRES, mWires, RangeCell) {
  let I_V = [];
  let I_P = [];

  for (let i = 0; i < mWires; i++) {
    let k = WireListm[i][0];
    let wireIdx = WireListm[i][1];
    let oplist_k = oplist[k];

    let inlen, outlen;

    if (k === 0) {
      inlen = NINPUT;
      outlen = NINPUT;
    } else {
      inlen = oplist_k.pt_inputs.length;
      outlen = oplist_k.pt_outputs.length;
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
    let k = WireListm[i][0];
    let wireIdx = WireListm[i][1];

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
    let k = WireListm[i][0];
    let wireIdx = WireListm[i][1];
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

export function makeBinFile (dir, SetData_I_V, SetData_I_P, OpLists, WireListm) {
  
  !fs.existsSync(dir) && fs.mkdirSync(dir)

  const fdset1 = fs.openSync(`${dir}/Set_I_V.bin`, 'w');
  const fdset2 = fs.openSync(`${dir}/Set_I_P.bin`, 'w');
  const fdOpList = fs.openSync(`${dir}/OpList.bin`, 'w');
  const fdWireList = fs.openSync(`${dir}/WireList.bin`, 'w');

  const setIDataBuffer = Buffer.from(Uint32Array.from(SetData_I_V).buffer);
  const setPDataBuffer = Buffer.from(Uint32Array.from(SetData_I_P).buffer);
  const opListDataBuffer = Buffer.from(Uint32Array.from([OpLists.length, ...OpLists]).buffer);
  const wireListDataBuffer = Buffer.from(Uint32Array.from([WireListm.length, ...WireListm.flat()]).buffer);

  fs.writeSync(fdset1, setIDataBuffer, 0, setIDataBuffer.length);
  fs.writeSync(fdset2, setPDataBuffer, 0, setPDataBuffer.length);
  fs.writeSync(fdOpList, opListDataBuffer, 0, opListDataBuffer.length);
  fs.writeSync(fdWireList, wireListDataBuffer, 0, wireListDataBuffer.length);

  fs.closeSync(fdset1);
  fs.closeSync(fdset2);
  fs.closeSync(fdOpList);
  fs.closeSync(fdWireList);

}

export function makeJsonFile (dir, oplist, NINPUT, codewdata) {
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
      outputs_hex = new Array(outputs.length).fill('0x0');
    }

    if (inputs.length > NINPUT) {
      throw new Error('Too many inputs');
    }

    for (let i = 0; i < inputs_hex.length; i++) {
      if (i < inputs.length) {
        inputs_hex[i] = '0x' + decimalToHex(inputs[i]).toString().padStart(64, '0');
      }
    }

    for (let i = 0; i < outputs_hex.length; i++) {
      if (i < outputs.length) {
        oplist[k].opcode === '20' 
          ? outputs_hex[i] = '0x' + outputs[i].padStart(64, '0')
          : outputs_hex[i] = '0x' + decimalToHex(outputs[i]).toString().padStart(64, '0');
      }
    }

    if (k === 0) {
      for (let i = 0; i < inputs.length; i++) {
        let sourcevalue = codewdata[oplist[k].pt_outputs[i][1] - 1]
        sourcevalue = '0x' + decimalToHex(sourcevalue).toString().padStart(64, '0');

        if (sourcevalue !== outputs_hex[i]) {
          throw new Error('source value mismatch');
        }
      }
    }

    InstanceFormatIn.push({ in: inputs_hex });
    InstanceFormatOut.push({ out: outputs_hex });
    !fs.existsSync(`${dir}/instance`) && fs.mkdirSync(`${dir}/instance`)
    const fdInput = fs.openSync(`${dir}/instance/Input_opcode${k}.json`, 'w');
    const fdOutput = fs.openSync(`${dir}/instance/Output_opcode${k}.json`, 'w');

    fs.writeSync(fdInput, JSON.stringify(InstanceFormatIn[k]));
    fs.writeSync(fdOutput, JSON.stringify(InstanceFormatOut[k]));

    fs.closeSync(fdInput);
    fs.closeSync(fdOutput);
  }
}
