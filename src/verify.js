import * as binFileUtils from '@iden3/binfileutils';
import * as zkeyUtils from './utils/zkey_utils.js';
import * as fastFile from 'fastfile';
import {readFileSync} from 'fs';
import hash from 'js-sha3';
import * as timer from './utils/timer.js';

export default async function groth16Verify(
    proofFile,
    circuitReferenceStringFile,
    circuitDirectory,
    instanceId,
    logger
) {
  const startTime = timer.start();
  const ID_KECCAK = 5;

  const dirPath = circuitDirectory;
  const CRS = 1;

  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils.readBinFile(
      circuitReferenceStringFile,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const fdIdV = await fastFile.readExisting(
      `${dirPath}/Set_I_V.bin`,
      1<<25,
      1<<23,
  );
  const fdIdP = await fastFile.readExisting(
      `${dirPath}/Set_I_P.bin`,
      1<<25,
      1<<23,
  );
  const fdOpL = await fastFile.readExisting(
      `${dirPath}/OpList.bin`,
      1<<25,
      1<<23,
  );
  const fdWrL = await fastFile.readExisting(
      `${dirPath}/WireList.bin`,
      1<<25,
      1<<23,
  );
  const {
    fd: fdPrf,
    sections: sectionsPrf,
  } = await binFileUtils.readBinFile(
      proofFile,
      'prof',
      2,
      1<<22,
      1<<24,
  );

  const urs = {};
  const crs = {};
  urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS);
  const rs = await zkeyUtils.readRS(fdRS, sectionsRS, urs.param, CRS);
  const IdSetV = await zkeyUtils.readIndSet(fdIdV);
  const IdSetP = await zkeyUtils.readIndSet(fdIdP);
  const OpList = await zkeyUtils.readOpList(fdOpL);
  const WireList = await zkeyUtils.readWireList(fdWrL);
  await fdRS.close();
  await fdIdV.close();
  await fdIdP.close();
  await fdOpL.close();
  await fdWrL.close();


  urs.sigmaG = rs.sigmaG;
  urs.sigmaH = rs.sigmaH;
  crs.param = rs.crs.param;
  crs.vk1Uxy1d = rs.crs.vk1Uxy1d;
  crs.vk1Vxy1d = rs.crs.vk1Vxy1d;
  crs.vk1Zxy1d = rs.crs.vk1Zxy1d;
  crs.vk1Axy1d = rs.crs.vk1Axy1d;
  crs.vk2Vxy1d = rs.crs.vk2Vxy1d;

  const ParamR1cs = urs.param.r1cs;
  const curve = urs.param.curve;
  const G1 = urs.param.curve.G1;
  const G2 = urs.param.curve.G2;
  const Fr = urs.param.curve.Fr;
  const buffG1 = curve.G1.oneAffine;
  const mPublic = crs.param.mPublic;
  const mPrivate = crs.param.mPrivate;
  const nConstWires = 1;

  if (!(
    (mPublic == IdSetV.set.length) && (mPrivate == IdSetP.set.length)
  )) {
    throw new Error(
        `Error in crs file: invalid crs parameters. 
        mPublic: ${mPublic}, 
        IdSetV: ${IdSetV.set.length}, 
        mPrivate: ${mPrivate}, 
        IdSetP: ${IdSetP.set.length},`,
    );
  }

  // list keccak instances
  const keccakList = [];
  for (let k=0; k<OpList.length; k++) {
    const kPrime = OpList[k];
    if (kPrime == ID_KECCAK) {
      keccakList.push(k);
    }
  }

  // / generate instance for each subcircuit
  const hexKeccakInstance = [];
  const subInstance = new Array(OpList.length);
  OpList.forEach((kPrime, index) => {
    const inputs = JSON.parse(
        readFileSync(
            `${dirPath}/instance${instanceId}/Input_opcode${index}.json`,
            'utf8',
        ),
    );
    const outputs = JSON.parse(
        readFileSync(
            `${dirPath}/instance${instanceId}/Output_opcode${index}.json`,
            'utf8',
        ),
    );
    const instanceKHex = [];
    for (let i=0; i<nConstWires; i++) {
      instanceKHex.push('0x01');
    }
    if (keccakList.indexOf(index)>-1) {
      instanceKHex.push('0x01');
    } else {
      instanceKHex.push(...outputs.out);
    }
    instanceKHex.push(...inputs.in);
    if (instanceKHex.length != ParamR1cs[kPrime].mPublic+nConstWires) {
      throw new Error(`Error in loading subinstances: wrong instance size`);
    }
    if (keccakList.indexOf(index)>-1) {
      const keccakItems = [];
      keccakItems.push('0x01');
      keccakItems.push(...outputs.out);
      keccakItems.push(...inputs.in);
      hexKeccakInstance.push(keccakItems);
    }
    const instanceK = new Array(ParamR1cs[kPrime].mPublic+nConstWires);
    for (let i=0; i<instanceK.length; i++) {
      instanceK[i] = BigInt(instanceKHex[i]);
    }
    subInstance[index] = instanceK;
  });

  // arrange circuit instance accroding to Set_I_V.bin (= IdSetV),
  // which ideally consists of only subcircuit outputs
  const cInstance = new Array(IdSetV.set.length);
  for (let i=0; i<IdSetV.set.length; i++) {
    const kPrime = WireList[IdSetV.set[i]][0];
    const iPrime = WireList[IdSetV.set[i]][1];
    if (
      iPrime<nConstWires ||
        iPrime>=nConstWires+ParamR1cs[OpList[kPrime]].mPublic
    ) {
      throw new Error(
          'Error in arranging circuit instance: containing a private wire.',
      );
    }
    cInstance[i] = subInstance[kPrime][iPrime];
  }
  if (cInstance.length != mPublic) {
    throw new Error(
        'Error in arranging circuit instance: wrong instance size.',
    );
  }


  // / read proof
  await binFileUtils.startReadUniqueSection(fdPrf, sectionsPrf, 2);
  const vk1A = await zkeyUtils.readG1(fdPrf, curve);
  const vk2B = await zkeyUtils.readG2(fdPrf, curve);
  const vk1C = await zkeyUtils.readG1(fdPrf, curve);
  await binFileUtils.endReadSection(fdPrf);
  await fdPrf.close();

  // / Compute term D
  let EncTime = timer.start();
  let vk1D;
  vk1D = await G1.timesFr(buffG1, Fr.e(0));
  for (let i=0; i<mPublic; i++) {
    const term = await G1.timesFr(crs.vk1Zxy1d[i], Fr.e(cInstance[i]));
    vk1D = await G1.add(vk1D, term);
  }
  EncTime = timer.end(EncTime);

  // / Verify
  let PairingTime = timer.start();
  const res = await curve.pairingEq(urs.sigmaG.vk1AlphaV, urs.sigmaH.vk2AlphaU,
      vk1D, urs.sigmaH.vk2GammaZ,
      vk1C, urs.sigmaH.vk2GammaA,
      vk1A, await G2.neg(vk2B));
  PairingTime = timer.end(PairingTime);
  if (logger) logger.debug(`Circuit verification result = ${res}`);

  let HashTime = timer.start();
  const {keccak256} = hash;
  let res2 = true;
  for (let i=0; i<keccakList.length; i++) {
    // keccak has two inputs and one output
    const hexExpected = hexKeccakInstance[i][1].slice(2);
    const hexInputArray=[];
    hexInputArray[0] = hexKeccakInstance[i][2].slice(2);
    hexInputArray[1] = hexKeccakInstance[i][3].slice(2);
    const conHexIn = hexInputArray[0] + hexInputArray[1];
    const strInput = hexToString(conHexIn);

    const hexHashOut = keccak256(strInput);
    res2 = res2 && (hexExpected == hexHashOut);
  }
  HashTime = timer.end(HashTime);
  if (keccakList.length>0) {
    if (logger) logger.debug(`Keccak verification result = ${res2}`);
  }

  const totalTime = timer.end(startTime);
  if (logger) {
    logger.debug('  ');
    logger.debug('----- Verify Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${totalTime} [ms]`);
    logger.debug(` ## Encryption time: ${EncTime} [ms] (${(EncTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Pairing time: ${PairingTime} [ms] (${(PairingTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Hashing time: ${HashTime} [ms] (${(HashTime/totalTime*100).toFixed(3)} %)`);
  }
  if (res && res2) {
    console.log('VALID');
  } else {
    console.log('INVALID');
  }
  process.exit(0);
  // return res && res2;
}
function hexToString(hex) {
  if (!hex.match(/^[0-9a-fA-F]+$/)) {
    throw new Error('is not a hex string.');
  }
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  const bytes = [];
  for (let n = 0; n < hex.length; n += 2) {
    const code = parseInt(hex.substr(n, 2), 16);
    bytes.push(code);
  }
  return bytes;
}
