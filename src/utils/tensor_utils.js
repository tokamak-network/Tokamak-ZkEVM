import fs from 'fs'
import * as binFileUtils from '@iden3/binfileutils';
import util from 'util'
import { exec } from 'child_process';

export async function fileCreator(filePath, data, dataLength, type) {
  const input = await binFileUtils.createBinFile(
    filePath,
    'zkey',
    1,
    2,
    1<<22,
    1<<24
  )
  await binFileUtils.startWriteSection(input, 1);
  await input.writeULE32(1)
  await binFileUtils.endWriteSection(input)

  await binFileUtils.startWriteSection(input, 2);
  for (let i = 0; i < dataLength; i++) {
    await input.write(type === 'scaled' ? data[i][0] : data[0][i] )
  }
  await binFileUtils.endWriteSection(input);
  await input.close();
}

export function bigIntToUint8Array(bigIntValue, bufferSize) {
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  let remainder = BigInt(bigIntValue);

  for (let i = 0; i < bufferSize; i++) {
      const byte = remainder & BigInt(0xff);
      view.setUint8(i, Number(byte)); 
      remainder = remainder >> BigInt(8);
  }

  return new Uint8Array(buffer);
}

export async function runTensorProduct(scaled, fYK, type, path, i, PreImgIdx) {
  const execs = util.promisify(exec)
  if (scaled.length == 1 && scaled[0].length == 1) {

  } else if (fYK.length == 1 && fYK[0].length == 1) {

  } else {
    const file1 = `${path}/resource/circuits/test_transfer/parallel/${type}_${i}_${PreImgIdx}.zkey`
    const file2 = `${path}/resource/circuits/test_transfer/parallel/fYK_${i}_${PreImgIdx}.zkey`
    const file3 = `${path}/resource/circuits/test_transfer/parallel/output/${type}_${i}_${PreImgIdx}_output.json`
    try {
      const {stdout, stderr} = await execs(`/home/ubuntu/rapidsnark/build/tensorProduct ${file1} ${file2} ${file3}`)
      if (stdout) {
        // const colon = stdout.indexOf(':')
        // proveTime += Number(stdout.slice(colon+2))
        // count += 1
        // console.log('stdout',stdout)
      }
      if (stderr) console.log('stderr', stderr)
    } catch (e) {
      console.log(e)
    }
  }
}

export async function getJsonOutput(Fr, scaled, fYK, path, type, i, PreImgIdx) {
  if (scaled.length == 1 && scaled[0].length == 1) {
    if (Fr.eq(scaled[0][0], Fr.zero)){
      return [[Fr.zero]];
    }
  }  
  if (fYK.length == 1 && fYK[0].length == 1) {
    if (Fr.eq(fYK[0][0], Fr.zero)){
      return [[Fr.zero]];
    }
  }  
  
  const file3 = `${path}/resource/circuits/test_transfer/parallel/output/${type}_${i}_${PreImgIdx}_output.json`
  const json = JSON.parse(fs.readFileSync(file3));
  let bufferArray = []
  for (let i = 0; i < json.length; i ++) {
    let buffer = []
    for (let j = 0; j < json[0].length; j++){
      buffer.push(bigIntToUint8Array(json[i][j], 32))
    }
    bufferArray.push(buffer)
  }
  return bufferArray

}
