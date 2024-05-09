import * as binFileUtils from '@iden3/binfileutils';
import * as polyUtils from './utils/poly_utils.js';
import * as zkeyUtils from './utils/zkey_utils.js';
import * as wtnsUtils from './utils/wtns_utils.js';
import * as tensorUtils from './utils/tensor_utils.js';
import generateWitness from './generate_witness.js';
import * as fastFile from 'fastfile';
import * as misc from './misc.js';
import * as timer from './utils/timer.js';
import {Scalar, BigBuffer, utils} from 'ffjavascript';
import Logger from 'logplease';


const logger = Logger.create('UniGro16js', {showTimestamp: false});

export default async function groth16Prove(
) {
  // const path = '/home/ubuntu/UniGro16js'
  const path = '/Users/hwangjaeseung/workspace/zkp/UniGro16js'
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
  const n8 = curve.Fr.n8;
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
  const cWtns_private_buff = new BigBuffer(mPrivate * Fr.n8);
  for (let i=0; i<mPrivate; i++) {
    const ii = IdSetP.set[i];
    const kPrime = WireList[ii][0];
    const idx = WireList[ii][1];
    const cWtns_ii = wtns[kPrime][idx]; // Uint8Array buffer
    cWtns_private_buff.set(cWtns_ii, Fr.n8*i);
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

  for (let i=0; i<m; i++) {
    const cWtns_i = Fr.fromRprLE(cWtns_buff.slice(i*Fr.n8, i*Fr.n8 + Fr.n8), 0, Fr.n8);
    if (m===1) console.log(cWtns_buff.slice(i*Fr.n8, i*Fr.n8 + Fr.n8), 0, Fr.n8)
    if (m===1) console.log(cWtns_i)
    
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
    
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];

      timertemp = timer.start();
      const scaled_uXK = await polyUtils.scalePoly(Fr, uXK[sKPrime][iPrime], cWtns_i);
      const scaled_vXK = await polyUtils.scalePoly(Fr, vXK[sKPrime][iPrime], cWtns_i);
      const scaled_wXK = await polyUtils.scalePoly(Fr, wXK[sKPrime][iPrime], cWtns_i);
      timers.polScalingAccum += timer.end(timertemp);

      if (PreImgIdx === 1 && i === 4) console.log(vXK[sKPrime][iPrime])
      if (PreImgIdx === 1 && i === 4) console.log(cWtns_i)
      if (PreImgIdx === 1 && i === 4) console.log(scaled_vXK)
      
      // await tensorUtils.fileCreator(
      //   `${dirPath}/parallel/scaledUXK_${i}_${PreImgIdx}.zkey`,
      //   scaled_uXK,
      //   scaled_uXK.length,
      //   'scaled'
      // )
      // await tensorUtils.fileCreator(
      //   `${dirPath}/parallel/scaledVXK_${i}_${PreImgIdx}.zkey`,
      //   scaled_vXK,
      //   scaled_vXK.length,
      //   'scaled'
      // )
      // await tensorUtils.fileCreator(
      //   `${dirPath}/parallel/scaledWXK_${i}_${PreImgIdx}.zkey`,
      //   scaled_wXK,
      //   scaled_wXK.length,
      //   'scaled'
      // )
      // await tensorUtils.fileCreator(
      //   `${dirPath}/parallel/fYK_${i}_${PreImgIdx}.zkey`,
      //   fYK[kPrime],
      //   fYK[kPrime][0].length,
      //   'fYK'
      // )

      timertemp = timer.start();
    
      // await tensorUtils.runTensorProduct(scaled_uXK, fYK[kPrime], 'scaledUXK', path, i, PreImgIdx)
      // await tensorUtils.runTensorProduct(scaled_vXK, fYK[kPrime], 'scaledVXK', path, i, PreImgIdx)
      // await tensorUtils.runTensorProduct(scaled_wXK, fYK[kPrime], 'scaledWXK', path, i, PreImgIdx)
    
      // const uTerm = await tensorUtils.getJsonOutput(Fr, scaled_uXK, fYK[kPrime], path, 'scaledUXK', i, PreImgIdx)
      // const vTerm = await tensorUtils.getJsonOutput(Fr, scaled_vXK, fYK[kPrime], path, 'scaledVXK', i, PreImgIdx)
      // const wTerm = await tensorUtils.getJsonOutput(Fr, scaled_wXK, fYK[kPrime], path, 'scaledWXK', i, PreImgIdx)

    const uTerm = await polyUtils.tensorProduct(Fr, scaled_uXK, fYK[kPrime]);
    // const vTerm = await polyUtils.tensorProduct(Fr, scaled_vXK, fYK[kPrime]);
    // const wTerm = await polyUtils.tensorProduct(Fr, scaled_wXK, fYK[kPrime]);
     
      timers.polTensorAccum += timer.end(timertemp);

      timertemp = timer.start();
      p1XY = await polyUtils.addPoly(Fr, p1XY, uTerm);
      if (PreImgIdx === 1 && i === 4) console.log(p1XY)
      // p2XY = await polyUtils.addPoly(Fr, p2XY, vTerm);
      // p3XY = await polyUtils.addPoly(Fr, p3XY, wTerm);
      timers.polAddAccum += timer.end(timertemp);
    }
  }
  timers.polMul = timer.start();
  const temp = await polyUtils.fftMulPoly(Fr, p1XY, p2XY);
  console.log(temp)
  timers.polMul = timer.end(timers.polMul);
  timertemp = timer.start();
  const pXY = await polyUtils.subPoly(Fr, temp, p3XY);
  timers.polAddAccum += timer.end(timertemp);

  // compute H
  if (logger) logger.debug(`  Finding h1(X,Y) and h2(X,Y)...`);
  timers.polDiv = timer.start();
  // h1XY = HX(X,Y), h2XY = HY(X,Y)
  const {HX_buff: h1XY, HY_buff: h2XY} = await polyUtils.QapDiv(Fr, pXY);
  timers.polDiv = timer.end(timers.polDiv);
  timers.qapSolve = timer.end(timers.qapSolve);
  if (logger) logger.debug(`Solving QAP...Done`);

  // Generate r and s
  const rawr = await misc.getRandomRng(1);
  const raws = await misc.getRandomRng(2);
  const r = Fr.fromRng(rawr);
  const s = Fr.fromRng(raws);

  if (logger) logger.debug(`Generating Proofs...`);
  timers.proving = timer.start();
  if (logger) logger.debug(`  Generating Proof A...`);
  // Compute proof A
  const vk1AP1 = urs.sigmaG.vk1AlphaV;
  const vk1AP3 = await G1.timesFr(urs.sigmaG.vk1GammaA, r);
  const vk1AP2 = await G1.multiExpAffine(crs.vk1Uxy1d, cWtns_buff, false);
  const vk1A = await G1.add(await G1.add(vk1AP1, vk1AP2), vk1AP3);

  if (logger) logger.debug(`  Generating Proof B...`);
  // Compute proof B_H
  const vk2BP1 = urs.sigmaH.vk2AlphaU;
  const vk2BP3 = await G2.timesFr(urs.sigmaH.vk2GammaA, s);
  const vk2BP2 = await G2.multiExpAffine(crs.vk2Vxy1d, cWtns_buff, false);
  const vk2B = await G2.add(await G2.add(vk2BP1, vk2BP2), vk2BP3);

  if (logger) logger.debug(`  Generating Proof C...`);
  // Compute proof B_G
  const vk1BP1 = urs.sigmaG.vk1AlphaU;
  const vk1BP3 = await G1.timesFr(urs.sigmaG.vk1GammaA, s);
  const vk1BP2 = await G1.multiExpAffine(crs.vk1Vxy1d, cWtns_buff, false);
  const vk1B = await G1.add(await G1.add(vk1BP1, vk1BP2), vk1BP3);

  // Compute proof C_G
  const vk1CP = new Array(6);
  vk1CP[0] = await G1.multiExpAffine(crs.vk1Axy1d, cWtns_private_buff, false);
  vk1CP[1] = await G1.multiExpAffine(urs.sigmaG.vk1XyPowsT1g, h1XY, false);
  vk1CP[2] = await G1.multiExpAffine(urs.sigmaG.vk1XyPowsT2g, h2XY, false)
  vk1CP[3] = await G1.timesFr(vk1A, s);
  vk1CP[4] = await G1.timesFr(vk1B, r);
  vk1CP[5] = await G1.timesFr( urs.sigmaG.vk1GammaA, Fr.neg(Fr.mul(r, s)) );
  let vk1C = vk1CP[0];
  for (let i=1; i<6; i++) {
    vk1C = await G1.add(vk1C, vk1CP[i]);
  }
  timers.proving = timer.end(timers.proving);
  if (logger) logger.debug(`Generating Proofs...Done`);

  // Write Header
  // /////////
  await binFileUtils.startWriteSection(fdPrf, 1);
  await fdPrf.writeULE32(1); // Groth
  await binFileUtils.endWriteSection(fdPrf);
  // End of the Header

  await binFileUtils.startWriteSection(fdPrf, 2);
  await zkeyUtils.writeG1(fdPrf, curve, vk1A);
  await zkeyUtils.writeG2(fdPrf, curve, vk2B);
  await zkeyUtils.writeG1(fdPrf, curve, vk1C);

  await binFileUtils.endWriteSection(fdPrf);

  await fdPrf.close();

  timers.total = timer.end(timers.total);
  if (logger) {
    logger.debug('  ');
    logger.debug('----- Prove Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${(timers.total/1000).toFixed(3)} [sec]`);
    logger.debug(` ## Time for solving QAP of degree (${n},${sMax}) with ${m} wires: ${(timers.qapSolve/1000).toFixed(3)} [sec] (${(timers.qapSolve/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Loading sub-QAP time: ${(timers.subQAPLoad/1000).toFixed(3)} [sec] (${(timers.subQAPLoad/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Univariate polynomial scaling time: ${(timers.polScalingAccum/1000).toFixed(3)} [sec] (${(timers.polScalingAccum/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Univariate polynomial tensor product time: ${(timers.polTensorAccum/1000).toFixed(3)} [sec] (${(timers.polTensorAccum/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Bivariate polynomial addition time: ${(timers.polAddAccum/1000).toFixed(3)} [sec] (${(timers.polAddAccum/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Bivariate polynomial multiplication time: ${(timers.polMul/1000).toFixed(3)} [sec] (${(timers.polMul/timers.total*100).toFixed(3)} %)`);
    logger.debug(`  # Bivariate polynomial division time time: ${(timers.polDiv/1000).toFixed(3)} [sec] (${(timers.polDiv/timers.total*100).toFixed(3)} %)`);
    logger.debug(` ## Time for group exponentiations with m=${m}, n=${n}, sMax=${sMax}: ${(timers.proving/1000).toFixed(3)} [sec] (${(timers.proving/timers.total*100).toFixed(3)} %)`);
  } 
  process.exit(0);
}


groth16Prove();
