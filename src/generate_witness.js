import wc from './witness_calculator.js'
import * as fastFile from 'fastfile'
import { readOpList } from './uni_zkey_utils.js'
import { readFileSync, writeFile, mkdir } from 'fs'
import path from "path"

// Example: generateWitness('test_transfer')
/**
 * 
 * @param {resource/circuits/서킷명} circuitName 
 */
export default async function generateWitness(circuitName){
	// @TODO: __dirPath 를 사용해서 사용자가 어떤 dir에서 명령어를 실행해도 실행되도록 수정해야 함.
  const dirPath = `resource/circuits/${circuitName}`
	const fdOpL = await fastFile.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23)
  const opList = await readOpList(fdOpL)
	await fdOpL.close()

	mkdir(path.join(dirPath, 'witness'), (err) => {})

	for (const index in opList) {
		const buffer = readFileSync(`resource/subcircuits/wasm/subcircuit${opList[index]}.wasm`)
		const input = JSON.parse(readFileSync(`${dirPath}/instance/Input_opcode${index}.json`, "utf8"))
		const witnessCalculator = await wc(buffer)
		const buff = await witnessCalculator.calculateWTNSBin(input, 0)
		writeFile(`${dirPath}/witness/witness${index}.wtns`, buff, function(err) {
			if (err) throw err
		})
	}
}