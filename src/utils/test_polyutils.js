import * as polyUtils from './poly_utils.js';
import * as binFileUtils from '@iden3/binfileutils';
import * as zkeyUtils from './zkey_utils.js';
import * as wtnsUtils from './wtns_utils.js';
import {Scalar, BigBuffer, utils} from 'ffjavascript';
const {stringifyBigInts} = utils;

async function testTensorProduct (Fr) {
  const sample1_1 = bigIntToUint8Array('1626275109576878988287730541908027724405348106427831594181487487855202143055', 32)
  const sample1_2 = bigIntToUint8Array('18706364085805828895917702468512381358405767972162700276238017959231481018884', 32)
  const sample1_3 = bigIntToUint8Array('17245156998235704504461341147511350131061011207199931581281143511105381019978', 32)
  const sample1_4 = bigIntToUint8Array('3858908536032228066651712470282632925312300188207189106507111128103204506804', 32)

  const sample2_1 = bigIntToUint8Array('1', 32)
  const sample2_2 = bigIntToUint8Array('20187316456970436521602619671088988952475789765726813868033071292105413408473', 32)
  const sample2_3 = bigIntToUint8Array('9163953212624378696742080269971059027061360176019470242548968584908855004282', 32)
  const sample2_4 = bigIntToUint8Array('20922060990592511838374895951081914567856345629513259026540392951012456141360', 32)

  // let array1 = []
  // let array2 = []
  // console.log(sample2_2)
  const test = Fr.mul(sample2_1, sample1_1)
  console.log(stringifyBigInts(test))
  let array2 =[ [ sample2_1, sample2_2, sample2_3, sample2_4 ] ]
  let array1 = [ [ sample1_1 ], [ sample1_2 ], [ sample1_3 ], [ sample1_4 ] ]

  const result = await polyUtils.tensorProduct(Fr, array1, array2)
  // console.log(result)
  for (let i = 0; i < 4; i ++) {
    for (let j = 0; j < 4; j ++) {
      // console.log(i,j, stringifyBigInts(result[i][j]))
    }
  }
}

async function polyTest() {
  const path = '/Users/hwangjaeseung/workspace/zkp/UniGro16js'
  const qapName = `${path}/resource/subcircuits/QAP_26_21`
  const circuitReferenceString = `${path}/resource/circuits/test_transfer/test_transfer.crs`
  const CRS = 1;
  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils.readBinFile(
      circuitReferenceString,
      'zkey',
      2,
      1<<25,
      1<<23,
  );

  const urs = {};
  const crs = {};
  urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS);

  const rs = await zkeyUtils.readRS(
      fdRS,
      sectionsRS,
      urs.param,
      CRS,
  );
  const Fr = urs.param.curve.Fr;

  await testTensorProduct (Fr);

  process.exit(0);
}



function bigIntToUint8Array(bigIntValue, bufferSize) {
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

polyTest()