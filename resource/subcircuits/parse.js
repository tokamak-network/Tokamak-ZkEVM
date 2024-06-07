import { opcodeDictionary } from './opcode.js'
import fs from 'fs'

fs.readFile('./temp.txt', 'utf8', function(err, data) {
  if (err) throw err;

  const subcircuitJson = {'wire-list': []}
  const output = data.split('\n')

  output.forEach((line, index) => {
    if(line.startsWith('id[')) {
      const id = parseInt(line.match(/id\[(\d+)\]/)[1]);
      const name = line.split('=')[1].trim().toUpperCase();

      const opcode = opcodeDictionary[name];

      const numWires = parseInt(output[index + 7].match(/wires: (\d+)/)[1]);
      const publicOutputs = parseInt(output[index + 6].match(/public outputs: (\d+)/)[1]);
      const publicInputs = parseInt(output[index + 4].match(/public inputs: (\d+)/)[1]);

      const subcircuit = {
        id: id,
        opcode: opcode,
        name: name,
        Nwires: numWires,
        Out_idx: [1, publicOutputs],
        In_idx: [publicOutputs + 1, publicInputs]
      }
      subcircuitJson['wire-list'].push(subcircuit)
    }
  })

  fs.writeFile('./subcircuit_info.json', JSON.stringify(subcircuitJson, null, "\t"), err => {
    if (err) {
      console.log('Error occurs while writing a file.', err)
    } else {
      console.log('subcircuit_info.json has been successfully updated.')
    }
  })
})