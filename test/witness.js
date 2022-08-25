import generateWitness from "../src/generate_witness.js"
import { read } from "../src/wtns_utils.js";
// groth16Prove("crs", "proof", "test_simple", "1")

await generateWitness('test_simple')

const wtns_0 = await read(`resource/circuits/test_simple/witness/witness0.wtns`)
const wtns_1 = await read(`resource/circuits/test_simple/witness/witness1.wtns`)
const wtns_2 = await read(`resource/circuits/test_simple/witness/witness2.wtns`)
const wtns_3 = await read(`resource/circuits/test_simple/witness/witness3.wtns`)
const wtns_4 = await read(`resource/circuits/test_simple/witness/witness4.wtns`)
console.log(wtns_0)
console.log(wtns_1)
console.log(wtns_2)
console.log(wtns_3)
console.log(wtns_4)