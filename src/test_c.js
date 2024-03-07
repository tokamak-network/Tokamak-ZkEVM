import * as binFileUtils from '@iden3/binfileutils';
import * as polyUtils from './utils/poly_utils.js';
import * as zkeyUtils from './utils/zkey_utils.js';
import * as wtnsUtils from './utils/wtns_utils.js';
import generateWitness from './generate_witness.js';
import * as fastFile from 'fastfile';
import * as misc from './misc.js';
import * as timer from './utils/timer.js';
import {Scalar, BigBuffer} from 'ffjavascript';
import { BigNumber } from 'ethers'
import Logger from 'logplease';
import { exec, execSync } from 'child_process';
import util from 'util'

const logger = Logger.create('UniGro16js', {showTimestamp: false});

export default async function groth16Prove(
) {
  const path = '/home/ubuntu/UniGro16js'
  // const path = '/Users/hwangjaeseung/workspace/zkp/UniGro16js'
  const qapName = `${path}/resource/subcircuits/QAP_26_21`
  const circuitReferenceString = `${path}/resource/circuits/test_transfer/test_transfer.crs`
  const proofName = 'proof'
  const circuitName = `${path}/resource/circuits/test_transfer`
  const instanceId = ''
  // console.log(qapName, circuitReferenceString, proofName, circuitNam)
  let timers = {};
  timers.total = timer.start();
  const dirPath = circuitName;
  const TESTFLAG = process.env.TEST_MODE;
  const CRS = 1;

  if (logger) logger.debug(`TESTMODE = ${TESTFLAG}`);

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

  const urs = {};
  const crs = {};
  urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS);
  const rs = await zkeyUtils.readRS(
      fdRS,
      sectionsRS,
      urs.param,
      CRS,
  );
  const IdSetV = await zkeyUtils.readIndSet(fdIdV);
  const IdSetP = await zkeyUtils.readIndSet(fdIdP);
  const OpList = await zkeyUtils.readOpList(fdOpL);
  const WireList = await zkeyUtils.readWireList(fdWrL);
  await fdRS.close();
  await fdIdV.close();
  await fdIdP.close();
  await fdOpL.close();
  await fdWrL.close();

  const fdPrf = await binFileUtils.createBinFile(
      `${dirPath}/${proofName}.proof`,
      'prof',
      1,
      2,
      1<<22,
      1<<24,
  );

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
  //   const n8 = curve.Fr.n8;
  const buffG1 = curve.G1.oneAffine;
  const buffG2 = curve.G2.oneAffine;
  const n = urs.param.n;
  const n8r = urs.param.n8r;
  const sMax = urs.param.sMax;
  const sD = urs.param.sD;
  const sF = OpList.length;
  // const s_F = OpList.length;
  const omegaX = await Fr.e(urs.param.omegaX);
  const omegaY = await Fr.e(urs.param.omegaY);

  const mPublic = crs.param.mPublic;
  const mPrivate = crs.param.mPrivate;
  const m = mPublic + mPrivate;

  if (
    !((mPublic == IdSetV.set.length) &&
        (mPrivate == IdSetP.set.length))
  ) {
    throw new Error(`Error in crs file: invalid crs parameters.
                        mPublic: ${mPublic},
                        IdSetV: ${IdSetV.set.length},
                        mPrivate: ${mPrivate},
                        IdSetP: ${IdSetP.set.length},`,
    );
  }


  // generate witness for each subcircuit
  if (logger) logger.debug(`Solving QAP...`);
  timers.qapSolve = timer.start();
  if (logger) logger.debug(`  Generating circuit witness...`);
  await generateWitness(circuitName, instanceId);
  const wtns = [];
  for (let k=0; k<OpList.length; k++ ) {
    const wtnsK = await wtnsUtils.read(
        `${dirPath}/witness${instanceId}/witness${k}.wtns`,
    );
    const kPrime = OpList[k];
    const mK = ParamR1cs[kPrime].m;
    if (wtnsK.length != mK) {
      throw new Error(`Invalid witness length.
                            Circuit: ${mK},
                            witness: ${wtns.length}`,
      );
    }
    wtns.push(wtnsK);
  }


  // arrange circuit witness
  const cWtns_buff = new BigBuffer(WireList.length * Fr.n8);
  //const cWtns = new Array(WireList.length);
  for (let i=0; i<WireList.length; i++) {
    const kPrime = WireList[i][0];
    const idx = WireList[i][1];
    //cWtns[i] = wtns[kPrime][idx]; // Uint8Array buffer
    const cWtns_i = wtns[kPrime][idx]; // Uint8Array buffer
    if (cWtns_i === undefined) {
      throw new Error(`Undefined cWtns value at i=${i}`);
    }
    cWtns_buff.set(cWtns_i, Fr.n8*i);
  }

  if (logger) logger.debug(`  Loading sub-QAPs...`);
  timers.subQAPLoad = timer.start();
  const uXK = new Array(sD);
  const vXK = new Array(sD);
  const wXK = new Array(sD);
  for (let i=0; i<sF; i++) {
    const k = OpList[i];
    if ( (uXK[k] === undefined) ) {
      const mK = ParamR1cs[k].m;
      const {
        uX: _uX,
        vX: _vX,
        wX: _wX,
      } = await polyUtils.readQAP(qapName, k, mK, n, n8r);
      uXK[k] = _uX;
      vXK[k] = _vX;
      wXK[k] = _wX;
    }
  }
  if (logger) logger.debug(`  Loading ${uXK.length} sub-QAPs...Done`);
  timers.subQAPLoad= timer.end(timers.subQAPLoad);

  if (logger) logger.debug(`  Preparing f_k(Y) of degree ${sMax-1} for k upto ${sF}...`);
  timers.LagY = timer.start();
  const fYK = new Array(sF);
  //const fY = Array.from(Array(1), () => new Array(sMax));
  const FrSMaxInv = Fr.inv(Fr.e(sMax));
  const FrOmegaInv = Fr.inv(omegaY);
  for (let k=0; k<sF; k++) {
    const invOmegaYK = new Array(sMax);
    invOmegaYK[0] = FrSMaxInv;
    for (let i=1; i<sMax; i++) {
      invOmegaYK[i] = Fr.mul(invOmegaYK[i-1], await Fr.exp(FrOmegaInv, k));
    }
    fYK[k] = [invOmegaYK]; // 사용
  }
  timers.LagY = timer.end(timers.LagY);

  if (logger) logger.debug(`  Computing p(X,Y) for ${m} wires...`);
  timers.polScalingAccum = 0;
  timers.polTensorAccum = 0;
  timers.polAddAccum = 0;

  let timertemp;
  let p1XY = [[Fr.zero]];
  let p2XY = [[Fr.zero]];
  let p3XY = [[Fr.zero]];

  let proveTime = 0
  let count = 0
  console.log('m:', m)
  const execs = util.promisify(exec)
  for (let i=0; i<m; i++) {
    const cWtns_i = Fr.fromRprLE(cWtns_buff.slice(i*Fr.n8, i*Fr.n8 + Fr.n8), 0, Fr.n8);

    let arrayIdx;
    let PreImgSet;
    if (IdSetV.set.indexOf(i) > -1) {
      arrayIdx = IdSetV.set.indexOf(i);
      PreImgSet = IdSetV.PreImgs[arrayIdx];
    } else {
      arrayIdx = IdSetP.set.indexOf(i);
      PreImgSet = IdSetP.PreImgs[arrayIdx];
    }
    const PreImgSize = PreImgSet.length;
    // console.log(PreImgSize)
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];



      timertemp = timer.start();
      const scaled_uXK = await polyUtils.scalePoly(Fr, uXK[sKPrime][iPrime], cWtns_i);
      const scaled_vXK = await polyUtils.scalePoly(Fr, vXK[sKPrime][iPrime], cWtns_i);
      const scaled_wXK = await polyUtils.scalePoly(Fr, wXK[sKPrime][iPrime], cWtns_i);
      timers.polScalingAccum += timer.end(timertemp);

      // const a = await binFileUtils.createBinFile(
      //   `${dirPath}/parallel/test_${i}_${PreImgIdx}.zkey`,
      //   'zkey',
      //   1,
      //   2,
      //   1<<22,
      //   1<<24
      // )
      // await binFileUtils.startWriteSection(a, 1);
      // await a.writeULE32(1)
      // await binFileUtils.endWriteSection(a)
      // await binFileUtils.startWriteSection(a, 2);
      // await a.writeULE32(scaled_uXK)
      // await binFileUtils.endWriteSection(a);
      // await a.close();
      
      // const b = await binFileUtils.createBinFile(
      //   1<<22,
      //   1<<24
      // )
      // await binFileUtils.startWriteSection(b, 1);
      // await b.writeULE32(1)
      // await binFileUtils.endWriteSection(b);
      // await binFileUtils.startWriteSection(b, 2);
      // await b.writeULE32(fYK[kPrime])
      // await binFileUtils.endWriteSection(b);
      // await b.close();

      timertemp = timer.start();

      // if (scaled_uXK.length == 1 && scaled_uXK[0].length == 1) {

      // } else if (fYK[kPrime].length == 1 && fYK[kPrime][0].length == 1) {

      // } else {
      //   const file1 = `/home/ubuntu/UniGro16js/resource/circuits/test_transfer/parallel/test_${i}_${PreImgIdx}.zkey`
      //   const file2 = `/home/ubuntu/UniGro16js/resource/circuits/test_transfer/parallel/test_wtns_${i}.zkey`
      //   try {
      //     const {stdout, stderr} = await execs(`/home/ubuntu/rapidsnark/build/tensorProduct ${file1} ${file2}`)
      //     if (stdout) {
      //       const colon = stdout.indexOf(':')
      //       proveTime += Number(stdout.slice(colon+2))
      //       count += 1
      //       console.log('stdout',stdout)
      //     }
      //     if (stderr) console.log('stderr', stderr)
      //   } catch (e) {
      //     console.log(e)
      //   }
      // }


     const { uTerm, convert } = await polyUtils.tensorProduct(Fr, scaled_uXK, fYK[kPrime]);
     // const vTerm = await polyUtils.tensorProduct(Fr, scaled_vXK, fYK[kPrime]);
     // const wTerm = await polyUtils.tensorProduct(Fr, scaled_wXK, fYK[kPrime]);
     
     if (convert) {
      count += 1
      proveTime += convert
    }
      timers.polTensorAccum += timer.end(timertemp);


      // timertemp = timer.start();
      // p1XY = await polyUtils.addPoly(Fr, p1XY, uTerm);
      // p2XY = await polyUtils.addPoly(Fr, p2XY, vTerm);
      // p3XY = await polyUtils.addPoly(Fr, p3XY, wTerm);
      // timers.polAddAccum += timer.end(timertemp);
    }
  }
  console.log('proveTime: ',proveTime, count)

  if (logger) {
    logger.debug('  ');
    logger.debug('----- Prove Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${(timers.total/1000).toFixed(3)} [sec]`);
    logger.debug(` ## Time for solving QAP of degree (${n},${sMax}) with ${m} wires: ${(timers.qapSolve/1000).toFixed(3)} [sec] (${(timers.qapSolve/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Loading sub-QAP time: ${(timers.subQAPLoad/1000).toFixed(3)} [sec] (${(timers.subQAPLoad/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Univariate polynomial scaling time: ${(timers.polScalingAccum/1000).toFixed(3)} [sec] (${(timers.polScalingAccum/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Univariate polynomial tensor product time: ${(timers.polTensorAccum/1000).toFixed(3)} [sec] (${(timers.polTensorAccum/timers.total*100).toFixed(3)} %)`);

  }
  process.exit(0);
}

groth16Prove();
