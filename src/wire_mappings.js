export function wire_mapping (op, stack_pt, d, a, oplist, op_pointer) {

  if (op === '1c') {
    // const target_val = this.evalEVM(stack_pt[1])
  }
  
  let checks = 0
  oplist[0].opcode = 'fff'
  // console.log(op, op_pointer ,stack_pt)
  for (let i=0; i<d; i++) {
    // console.log('stack_pt wire start', op_pointer, op ,stack_pt)

    if (stack_pt[i][0] === 0) {
      let data = stack_pt[i]
      // console.log('datas', data)
      let checkArray = []
      // if (i==1 && (op === '1c1' || op === '1c2')) {
      //   let original_bytelength = data[2]
      //   if (op === '1c1') data[0] = data[0] + max(original_bytelength-data[2], 0)
      // }
      // console.log('chec equal')
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
      // console.log('array', checkArray)
      // console.log('index',index)
      if (index == -1 || checks == 0) {
        oplist[0].pt_outputs = data
        stack_pt[i] = [1, oplist[0].pt_outputs.length, 32]
      } else {
        stack_pt[i] = [1, index + 1, 32]
      }

      if (op === '20') {
        stack_pt[i][2] = data[2]
      }
    }
  }
  // if (oplist[])
  
  
  oplist[op_pointer].opcode = op
  oplist[op_pointer].pt_inputs = [stack_pt.slice(0, d)]
  oplist[op_pointer].pt_outputs=[op_pointer + 1, 1, 32]

  // console.log(op_pointer + 1, oplist[op_pointer])
  // console.log(op_pointer + 1)
  // console.log(op_pointer + 1)
  // console.log('stack_pt', op, stack_pt)
  
  
  return oplist
}
