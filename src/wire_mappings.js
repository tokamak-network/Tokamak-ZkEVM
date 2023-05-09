export function wire_mapping (op, stack_pt, d, a, oplist, op_pointer) {

  if (op === '1c') {
    // const target_val = this.evalEVM(stack_pt[1])
  }

  for (let i=0; i<d; i++) {
    // console.log('stack_pt wire start', op_pointer, op ,stack_pt)

    oplist[0].opcode = 'fff'
    // console.log(stack_pt[i])
    if (stack_pt[i][0] === 0) {
      let data = stack_pt[i]
      // console.log('datas', data)
      let checks = 0
      // if (i==1 && (op === '1c1' || op === '1c2')) {
      //   let original_bytelength = data[2]
      //   if (op === '1c1') data[0] = data[0] + max(original_bytelength-data[2], 0)
      // }

      if (oplist[0].pt_outputs.length == 0) {
        checks = 0
      } else {
        oplist[0].pt_outputs.find(output => {
          if (output === data) {
            checks = checks + 1
          } 
        })
      }
      if (checks == 0) {
        oplist[0].pt_outputs.push(data)
        stack_pt[i] = [1, oplist[0].pt_outputs.length, 32]
      } else {
        stack_pt[i] = [1, checks, 32]
      }

      if (op === '20') {
        stack_pt[i][2] = data[2]
      }
    }
  }
  // if (oplist[])
  
  // console.log(oplist[0].pt_outputs)
  oplist[op_pointer].opcode = op
  oplist[op_pointer].pt_inputs.push(stack_pt.slice(0, d))
  oplist[op_pointer].pt_outputs=[op_pointer, 1, 32]
  
  return oplist
}
