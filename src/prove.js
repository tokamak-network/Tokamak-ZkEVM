import * as binFileUtils from '@iden3/binfileutils';
import * as polyUtils from './utils/poly_utils.js';
import * as zkeyUtils from './utils/zkey_utils.js';
import * as wtnsUtils from './utils/wtns_utils.js';
import generateWitness from './generate_witness.js';
import * as fastFile from 'fastfile';
import * as misc from './misc.js';
import * as timer from './utils/timer.js';
import {Scalar, BigBuffer} from 'ffjavascript';

export default async function groth16Prove(
    circuitReferenceString,
    proofName,
    circuitName,
    instanceId,
    logger
) {
  const startTime = timer.start();
  let qapLoadTimeStart;
  let qapLoadTimeAccum = 0;

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
  let qapSolveTime = timer.start();
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

  // TEST CODE 2
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running test 2`);
    const sR1cs = [];
    for (let k=0; k<sD; k++) {
      const {
        fd: fdR1cs,
        sections: sectionsR1cs,
      } = await binFileUtils.readBinFile(
          `resource/subcircuits/r1cs/subcircuit${k}.r1cs`,
          'r1cs',
          1,
          1<<22,
          1<<24,
      );
      sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
      await fdR1cs.close();
    }
    for (let k=0; k<OpList.length; k++) {
      const kPrime = OpList[k];
      const processResultsK = await zkeyUtils.processConstraints(
          curve,
          ParamR1cs[kPrime].nConstraints,
          sR1cs[kPrime],
      ); // to fill U, V, W
      const u = processResultsK.u;
      const uId = processResultsK.uId;
      const v = processResultsK.v;
      const vId = processResultsK.vId;
      const w = processResultsK.w;
      const wId = processResultsK.wId;
      const wtnsK = wtns[k];

      let uIdArray;
      let uCoefArray;
      let vIdArray;
      let vCoefArray;
      let wIdArray;
      let wCoefArray;

      for (let i=0; i<ParamR1cs[kPrime].nConstraints; i++) {
        uIdArray=uId[i];
        uCoefArray=u[i];
        vIdArray=vId[i];
        vCoefArray=v[i];
        wIdArray=wId[i];
        wCoefArray=w[i];

        let constraintU = Fr.e(0);
        for (let j=0; j<uIdArray.length; j++) {
          const term = Fr.mul(uCoefArray[j], Fr.e(wtnsK[uIdArray[j]]));
          constraintU = Fr.add(constraintU, term);
        }
        let constraintV = Fr.e(0);
        for (let j=0; j<vIdArray.length; j++) {
          const term = Fr.mul(vCoefArray[j], Fr.e(wtnsK[vIdArray[j]]));
          constraintV = Fr.add(constraintV, term);
        }
        let constraintW = Fr.mul(constraintU, constraintV);
        for (let j=0; j<wIdArray.length; j++) {
          const term = Fr.mul(wCoefArray[j], Fr.e(wtnsK[wIdArray[j]]));
          constraintW = Fr.sub(constraintW, term);
        }
        if (!Fr.eq(constraintW, Fr.e(0))) {
          if (logger) logger.debug(`uIdArray: ${uIdArray}`);
          if (logger) logger.debug(`uCoefArray: ${uCoefArray}`);
          if (logger) logger.debug(`vIdArray: ${vIdArray}`);
          if (logger) logger.debug(`vCoefArray: ${vCoefArray}`);
          if (logger) logger.debug(`wIdArray: ${wIdArray}`);
          if (logger) logger.debug(`wCoefArray: ${wCoefArray}`);
          if (logger) logger.debug(`wtnsK: ${wtnsK}`);
          throw new Error(
              `assertion not passed at k: ${k}, i: ${i}, 
              constraint: ${Fr.toObject(constraintW)}`,
          );
        }
      }
    }
    if (logger) logger.debug(`Test 2 finished`);
  }
  // / END of TEST CODE 2

  // / arrange circuit witness
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
    cWtns_private_buff.set(cWtns[ii], Fr.n8*i);
  }

  let tX = Array.from(Array(n+1), () => new Array(1));
  let tY = Array.from(Array(1), () => new Array(sMax+1));
  tX = await polyUtils.scalePoly(Fr, tX, Fr.zero);
  tY = await polyUtils.scalePoly(Fr, tY, Fr.zero);
  tX[0][0] = Fr.negone;
  tX[n][0] = Fr.one;
  tY[0][0] = Fr.negone;
  tY[0][sMax] = Fr.one;
  // t(X,Y) = (X^n-1) * (X^sMax-1) = PI(X-omegaX^i)
  // for i=0,...,n * PI(Y-omegaY^j) for j =0,...,sMax
  // P(X,Y) = (SUM c_i*u_i(X,Y))*(SUM c_i*v_i(X,Y))-(SUM c_i*w_i(X,Y))=0
  // at X=omegaX^i, Y=omegaY^j
  // <=> P(X,Y) has zeros at least the points omegaX^i and omegaY^j
  // <=> there exists h(X,Y) such that p(X,Y) = t(X,Y) * h(X,Y)
  // <=> finding h(X,Y) is the goal of Prove algorithm

  // / compute p(X,Y)
  if (logger) logger.debug(`  Computing p(X,Y)...`);
  const {
    fd: fdQAP,
    sections: sectionsQAP,
  } = await binFileUtils.readBinFile(
      `${circuitName}/circuitQAP.qap`,
      'qapp',
      1,
      1<<22,
      1<<24,
  );
  let pxyTime = timer.start();

  qapLoadTimeStart = timer.start();
  const {
    uXY_buff,
    vXY_buff,
    wXY_buff,
  } = await polyUtils.readCircuitQAP(
      fdQAP,
      sectionsQAP,
      m,
      n,
      sMax,
      Fr.n8,
  );
  await fdQAP.close();
  qapLoadTimeAccum += timer.end(qapLoadTimeStart);
  
  const p1XY = Array.from(Array(n), () => new Array(sMax));
  const p2XY = Array.from(Array(n), () => new Array(sMax));
  const p3XY = Array.from(Array(n), () => new Array(sMax));
  for (let ii=0; ii<n; ii++){
    for (let jj=0; jj<sMax; jj++){
      p1XY[ii][jj] = Uint8Array(Fr.n8);
      Fr.toRprLE(p1XY[ii][jj],0,Fr.zero);
      p2XY[ii][jj] = Uint8Array(Fr.n8);
      Fr.toRprLE(p1XY[ii][jj],0,Fr.zero);
      p3XY[ii][jj] = Uint8Array(Fr.n8);
      Fr.toRprLE(p1XY[ii][jj],0,Fr.zero);
    }
  }
  for (let i=0; i<m; i++){
    const coefs_i = coefs_buff.slice(i*Fr.n8, i*Fr.n8 + Fr.n8);
    const uXY_i = uXY_buff.slice(i*n*sMax*Fr.n8, i*n*sMax*Fr.n8 + n*sMax*Fr.n8);
    const vXY_i = vXY_buff.slice(i*n*sMax*Fr.n8, i*n*sMax*Fr.n8 + n*sMax*Fr.n8);
    const wXY_i = wXY_buff.slice(i*n*sMax*Fr.n8, i*n*sMax*Fr.n8 + n*sMax*Fr.n8);

    for (let ii=0; ii<n; ii++){
      for (let jj=0; jj<sMax; jj++){
        const uXY_i_ii_jj = uXY_i.slice((sMax*ii+jj)*Fr.n8, (sMax*ii+jj)*Fr.n8+Fr.n8);
        p1XY[ii][jj].set(Fr.add(p1XY[ii][jj], Fr.mul(uXY_i_ii_jj, coefs_i)), 0);
        const vXY_i_ii_jj = vXY_i.slice((sMax*ii+jj)*Fr.n8, (sMax*ii+jj)*Fr.n8+Fr.n8);
        p2XY[ii][jj].set(Fr.add(p2XY[ii][jj], Fr.mul(vXY_i_ii_jj, coefs_i)), 0);
        const wXY_i_ii_jj = wXY_i.slice((sMax*ii+jj)*Fr.n8, (sMax*ii+jj)*Fr.n8+Fr.n8);
        p3XY[ii][jj].set(Fr.add(p3XY[ii][jj], Fr.mul(wXY_i_ii_jj, coefs_i)), 0);
      }
    }
  }

  let qapMulTime = timer.start();
  const temp = await polyUtils.fftMulPoly(Fr, p1XY, p2XY);
  qapMulTime = timer.end(qapMulTime);
  const pXY = await polyUtils.subPoly(Fr, temp, p3XY);
  pxyTime = timer.end(pxyTime);

  // compute H
  if (logger) logger.debug(`  Finding h1(X,Y)...`);
  let PolDivTime = timer.start();
/*
  const {res: h1XY, finalrem: rem1} = await polyUtils.divPolyByX(Fr, pXY, tX);
  if (logger) logger.debug(`  Finding h2(X,Y)...`);
  const {res: h2XY, finalrem: rem2} = await polyUtils.divPolyByY(Fr, rem1, tY);
*/
    // h1XY = HX(X,Y), h2XY = HY(X,Y)
  const {HX_buff: h1XY, HY_buff: h2XY} = await polyUtils.QapDiv(Fr, pXY);
/*
  let test1 = await polyUtils.fftMulPoly(Fr, h1XY, tX);
  let test2 = await polyUtils.fftMulPoly(Fr, h2XY, tY);
  let test3 = await polyUtils.addPoly(Fr, test1, test2);
  let test4 = await polyUtils.subPoly(Fr, pXY, test3);
  console.log(await polyUtils._transToObject(Fr, test4));
*/


  PolDivTime = timer.end(PolDivTime);
  qapSolveTime = timer.end(qapSolveTime);
  if (logger) logger.debug(`Solving QAP...Done`);

  // console.log(`rem: ${rem2}`)
  // if (TESTFLAG === 'true') {
    // if (logger) logger.debug(`rem: ${rem2}`);
  // }

  if (TESTFLAG === 'true') {
    // if (logger) logger.debug(`rem2: ${polyUtils._transToObject(Fr, rem2)}`)
    const {
      xOrder: h1XOrder,
      yOrder: h1YOrder,
    } = polyUtils._orderPoly(Fr, h1XY);
    const {
      xOrder: h2XOrder,
      yOrder: h2YOrder,
    } = polyUtils._orderPoly(Fr, h2XY);
    if (logger) logger.debug(`h1_x_order: ${h1XOrder}, h1_y_order: ${h1YOrder}`);
    if (logger) logger.debug(`h2_x_order: ${h2XOrder}, h2_y_order: ${h2YOrder}`);
    if (logger) logger.debug(`n: ${n}, sMax: ${sMax}`);
  }

  // / TEST CODE 3
  if (TESTFLAG === 'true') {
    if (logger) logger.debug('Running Test 3');
    for (let i=0; i<n; i++) {
      for (let j=0; j<sMax; j++) {
        const evalPointX = await Fr.exp(omegaX, i);
        const evalPointY = await Fr.exp(omegaY, j);
        const flag = await polyUtils.evalPoly(
            Fr,
            pXY,
            evalPointX,
            evalPointY,
        );
        if ( !Fr.eq(flag, Fr.zero) ) {
          throw new Error('Error in pXY');
        }
      }
    }
    let res = pXY;
    const temp1 = await polyUtils.fftMulPoly(Fr, h1XY, tX);
    const temp2 = await polyUtils.fftMulPoly(Fr, h2XY, tY);
    res= await polyUtils.subPoly(Fr, res, temp1);
    res= await polyUtils.subPoly(Fr, res, temp2);
    if (!Fr.eq(
        await polyUtils.evalPoly(Fr, res, Fr.one, Fr.one),
        Fr.zero)
    ) {
      throw new Error('Error in pXY=h1t+h2t');
    }

    if (logger) logger.debug(`Test 3 finished`);
  }
  // / End of TEST CODE 3

  // Generate r and s
  const rawr = await misc.getRandomRng(1);
  const raws = await misc.getRandomRng(2);
  const r = Fr.fromRng(rawr);
  const s = Fr.fromRng(raws);

  if (logger) logger.debug(`Generating Proofs...`);
  let provingTime = timer.start();
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
  provingTime = timer.end(provingTime);
  if (logger) logger.debug(`Generating Proofs...Done`);

  // / TEST CODE 4
  if (TESTFLAG === 'true') {
    if (logger) logger.debug('Running Test 4');
    const x = Fr.e(13);
    const y = Fr.e(23);
    const res = [];

    res.push(await curve.pairingEq(
        urs.sigmaG.vk1XyPows[1][0],
        urs.sigmaH.vk2XyPows[0][1],
        await G1.timesFr(buffG1, Fr.mul(x, y)),
        await G2.neg(buffG2),
    ));

    const p1xy = await polyUtils.evalPoly(Fr, p1XY, x, y);
    const p2xy = await polyUtils.evalPoly(Fr, p2XY, x, y);
    const p3xy = await polyUtils.evalPoly(Fr, p3XY, x, y);
    const tempVk1U = await G1.timesFr(buffG1, p1xy);
    // const test_vk1_V = await G1.timesFr(buffG1, p2xy);
    const tempVk2U = await G2.timesFr(buffG2, p2xy);
    const tempVk1W = await G1.timesFr(buffG1, p3xy);

    res.push(await curve.pairingEq(
        await G1.neg(tempVk1U),
        tempVk2U,
        vk1AP2,
        vk2BP2,
    ));

    let vk1D;
    vk1D = await G1.timesFr(buffG1, Fr.e(0));
    for (let i=0; i<mPublic; i++) {
      const term = await G1.timesFr(
          crs.vk1Zxy1d[i],
          cWtns[IdSetV.set[i]],
      );
      vk1D = await G1.add(vk1D, term);
    }

    res.push(await curve.pairingEq(
        tempVk1U,
        urs.sigmaH.vk2AlphaU,
        urs.sigmaG.vk1AlphaV,
        tempVk2U,
        tempVk1W,
        buffG2,
        vk1CP[0],
        await G2.neg(urs.sigmaH.vk2GammaA),
        vk1D,
        await G2.neg(urs.sigmaH.vk2GammaZ),
    ));

    const tx= await polyUtils.evalPoly(Fr, tX, x, Fr.one);
    const ty= await polyUtils.evalPoly(Fr, tY, Fr.one, y);
    const h1xy = await polyUtils.evalPoly(Fr, h1XY, x, y);
    const h2xy = await polyUtils.evalPoly(Fr, h2XY, x, y);
    const h1txh2ty = await Fr.add(Fr.mul(tx, h1xy), Fr.mul(ty, h2xy));
    const tempVk1H1txh2ty = await G1.timesFr(buffG1, h1txh2ty);

    res.push(await curve.pairingEq(
        urs.sigmaG.vk1XyPowsT1g[1][1],
        urs.sigmaH.vk2GammaA,
        await G1.timesFr(buffG1, Fr.mul(x, y)),
        await G2.neg(await G2.timesFr(buffG2, tx)),
    ));

    res.push(await curve.pairingEq(
        vk1AP2,
        vk2BP2,
        await G1.neg(tempVk1W),
        buffG2,
        tempVk1H1txh2ty,
        await G2.neg(buffG2),
    ));

    res.push(await curve.pairingEq(
        vk1AP2,
        vk2BP2,
        await G1.neg(tempVk1W),
        buffG2,
        G1.add(vk1CP[1], vk1CP[2]),
        await G2.neg(urs.sigmaH.vk2GammaA),
    ));

    for (let i=0; i<res.length; i++) {
      if (!res[i]) {
        throw new Error(`Error in TEST CODE 4 at i=${i}`);
      }
    }
    if (logger) logger.debug(`Test 4 finished`);
  }
  // / End of TEST CODE 4

  // / TEST CODE 5
  if (TESTFLAG === 'true') {
    if (logger) logger.debug('Running Test 5');
    let vk1D;
    vk1D = await G1.timesFr(buffG1, Fr.e(0));
    for (let i=0; i<mPublic; i++) {
      const term = await G1.timesFr(crs.vk1Zxy1d[i], cWtns[IdSetV.set[i]]);
      vk1D = await G1.add(vk1D, term);
    }

    // / Verify
    const res = await curve.pairingEq(
        urs.sigmaG.vk1AlphaV,
        urs.sigmaH.vk2AlphaU,
        vk1D, urs.sigmaH.vk2GammaZ,
        vk1C, urs.sigmaH.vk2GammaA,
        await G1.neg(vk1A), vk2B);
    if (!res) {
      throw new Error(`Error in TEST CODE 5`);
    }
    if (logger) logger.debug(`Test 5 finished`);
  }
  // / END of TEST CODE 5

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

  const totalTime = timer.end(startTime);
  if (logger) {
    logger.debug('  ');
    logger.debug('----- Prove Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${totalTime} [ms]`);
    logger.debug(` ## Time for solving QAP of degree (${n},${sMax}) with ${m} wires: ${qapSolveTime} [ms] (${(qapSolveTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Loading QAP time: ${qapLoadTimeAccum} [ms] (${(qapLoadTimeAccum/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Polynomial scaling and adding time: ${pxyTime-qapLoadTimeAccum-qapMulTime} [ms] (${((pxyTime-qapLoadTimeAccum-qapMulTime)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Polynomial multiplication time: ${qapMulTime} [ms] (${(qapMulTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Finding h1(X,Y) and h2(X,Y) time (two divisions): ${PolDivTime} [ms] (${(PolDivTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Time for MSM with m=${m}, n=${n}, sMax=${sMax}: ${provingTime} [ms] (${(provingTime/totalTime*100).toFixed(3)} %)`);
  } 
  process.exit(0);
}
