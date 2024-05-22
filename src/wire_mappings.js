import { hexToInteger } from "./utils/convert.js"
import { Decoder } from "./decode.js"

export function wire_mapping (op, stack_pt, d, a, oplist, op_pointer, code, config) {
  const decoder = new Decoder({})
  decoder.getEnv(code, config)
  let checks = 0
  oplist[0].opcode = 'fff'

  for (let i = 0; i < d; i++) {
    if (stack_pt[i][0] === 0) {
      let data = stack_pt[i]

      let checkArray = []

      if (oplist[0].pt_outputs.length == 0) {
        checks = 0
      } else {
        for (let i = 0; i < oplist[0].pt_outputs.length; i ++) {
          // if (op === 'fff') console.log('pt_output',oplist[0].pt_outputs[i], data, oplist[0].pt_outputs[i] == data, compare(oplist[0].pt_outputs[i], data))
          if (compare(oplist[0].pt_outputs[i], data)) {
            checks = checks + 1
            checkArray.push(1)
          } else {
            checkArray.push(0)
          }
        }
      }
      
      const index = checkArray.findIndex(check => check === 1)
      if (op === 'fff') console.log('pt_output',oplist[0].pt_outputs[i], data, oplist[0].pt_outputs[i] == data, compare(oplist[0].pt_outputs[i], data))
      if (index == -1 || checks == 0) {
        oplist[0].pt_outputs.push(data)
        stack_pt[i] = [1, oplist[0].pt_outputs.length, 32]
      } else {
        stack_pt[i] = [1, index + 1, 32]
      }

      if (op === '20') {//SHA3
        stack_pt[i][2] = data[2]
      }
    }
  }

  // console.log('wire_map', op, stack_pt.slice(0, d), op_pointer + 1, 1, 32)
  oplist[op_pointer].opcode = op
  oplist[op_pointer].pt_inputs.push(stack_pt.slice(0, d))
  oplist[op_pointer].pt_outputs.push(op_pointer + 1, 1, 32)
  
  return oplist
}

function compare(output, data) {
  let values = []
  for (let i=0; i<output.length; i ++) {
    const value = output[i] === data[i]
    values.push(value)
  }
  return values[0] && values[1] && values[2]
}