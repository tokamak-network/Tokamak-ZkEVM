import { hexToInteger } from "./utils/convert.js"
import { Decoder } from "./decode.js"

export function wire_mapping (op, stack_pt, d, a, oplist, op_pointer, code) {
  const decoder = new Decoder({})
  decoder.getEnv(code)
  if (op === '1c') {
    const target_val = decoder.evalEVM(stack_pt[1])
    const threshold = 2**248
    const flag = target_val < threshold ? false : true
    const shiftamount = decoder.evalEVM(stack_pt[0])
    if (flag) {
      op = '1c1'
    } else if (!flag && shiftamount>=8) {
      op='1c2'
    } else {
      console.log('error')
      return
    }
  }
  // console.log('op',op, stack_pt)
  let checks = 0
  oplist[0].opcode = 'fff'
  for (let i = 0; i < d; i++) {
    
    // console.log(op, stack_pt[i][0])
    if (stack_pt[i][0] === 0) {
      let data = stack_pt[i]
      let checkArray = []
      if (i==1 && (op === '1c1' || op === '1c2')) {
        let original_bytelength = data[2]
        data[2] = Math.min(31, original_bytelength)
        if (op === '1c1') data[0] = data[0] + max(original_bytelength-data[2], 0)
      }

      if (oplist[0].pt_outputs.length == 0) {
        checks = 0
      } else {
        
        for (let i=0; i<oplist[0].pt_outputs.length; i ++) {
          if (oplist[0].pt_outputs[i] === data) {
            
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
  
  oplist[op_pointer].opcode = op
  oplist[op_pointer].pt_inputs.push(stack_pt.slice(0, d))
  oplist[op_pointer].pt_outputs.push(op_pointer + 1, 1, 32)
  
  return oplist
}
