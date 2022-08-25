import { readFileSync } from 'fs'

for (let i = 0; i < 24; i++ ) {
  const buffer = readFileSync(`resource/subcircuits/wasm/subcircuit${i}.wasm`)
  if(buffer) console.log(`subcircuit${i} is successfully read.`)
}
