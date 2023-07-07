import { hexToInteger } from "./utils/convert.js"
import { Decoder } from "./decode.js"

export function wire_mapping (op, stack_pt, d, a, oplist, op_pointer, code, config) {
  const decoder = new Decoder({})
  decoder.getEnv(code, config)
  if (op === '1c') {
    // console.log(stack_pt)
    const target_val = decoder.evalEVM(stack_pt[1])
    const threshold = 2**248
    const flag = Number(target_val) < threshold ? true : false
    const shiftamount = decoder.evalEVM(stack_pt[0])
    if (flag) {
      op = '1c1'
    } else if (!flag && Number(shiftamount)>=8) {
      op= '1c2'
    } else {
      console.log('error')
      return
    }
  }
  // console.log('op',op, stack_pt)
  let checks = 0
  oplist[0].opcode = 'fff'
  // console.log('stack_pt', op, stack_pt)
  for (let i = 0; i < d; i++) {
    if (stack_pt[i][0] === 0) {
      let data = stack_pt[i]
      let checkArray = []
      if (i==1 && (op === '1c1' || op === '1c2')) {
        let original_bytelength = data[2]
        data[2] = Math.min(31, original_bytelength)
        
        if (op === '1c1') {
          data[0] = data[0] + max(original_bytelength-data[2], 0)
        }
      }

      if (oplist[0].pt_outputs.length == 0) {
        checks = 0
      } else {
        for (let i = 0; i < oplist[0].pt_outputs.length; i ++) {
          // if (op === '03') console.log('pt_output',oplist[0].pt_outputs[i], data, oplist[0].pt_outputs[i] == data, compare(oplist[0].pt_outputs[i], data))
          if (compare(oplist[0].pt_outputs[i], data)) {
            checks = checks + 1
            checkArray.push(1)
          } else {
            checkArray.push(0)
          }
        }
      }
      
      const index = checkArray.findIndex(check => check === 1)
      
      if (index == -1 || checks == 0) {
        oplist[0].pt_outputs.push(data)
        stack_pt[i] = [1, oplist[0].pt_outputs.length, 32]
      } else {
        stack_pt[i] = [1, index + 1, 32]
      }

      if (hexToInteger(op) == hexToInteger('20')) {
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