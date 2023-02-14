import * as misc from './misc.js';
import * as zkeyUtils from './utils/zkey_utils.js';
import chai from 'chai';
import {
  readBinFile,
  createBinFile,
  startWriteSection,
  endWriteSection,
  copySection,
} from '@iden3/binfileutils';
import {mkdir} from 'fs';
import path from 'path';
import * as timer from './utils/timer.js';
import * as polyUtils from './utils/poly_utils.js';

export default async function setup(
  parameterFile, 
  universalReferenceStringFileName, 
  qapDirPath, 
  logger
) {
  const startTime = timer.start();
  let partTime;
  let EncTimeAccum1 = 0;
  let EncTimeAccum2 = 0;
  let EncTimeStart;
  let qapTimeStart;
  let qapTimeAccum = 0;

  const TESTFLAG = process.env.TEST_MODE;
  const assert = chai.assert;
  if (logger) logger.debug(`TEST_MODE = ${TESTFLAG}`);

  mkdir(
    path.join(
        'resource/universal_rs'
    ), (err) => {},
  );
  const {
    fd: fdParam,
    sections: sectionsParam,
  } = await readBinFile(
      parameterFile,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const param = await zkeyUtils.readRSParams(fdParam, sectionsParam);
  const sD = param.sD;

  const fdRS = await createBinFile(
    `resource/universal_rs/${universalReferenceStringFileName}.urs`,
      'zkey',
      1,
      4 + sD,
      1<<22,
      1<<24,
  );
  await copySection(fdParam, sectionsParam, fdRS, 1);
  await copySection(fdParam, sectionsParam, fdRS, 2);

  await fdParam.close();

  const curve = param.curve;
  const buffG1 = curve.G1.oneAffine;
  const buffG2 = curve.G2.oneAffine;
  const Fr = curve.Fr;
  const G1 = curve.G1;
  const G2 = curve.G2;
  const n8r = param.n8r;
  const NConstWires = 1;

  const n = param.n;
  const sMax = param.sMax;

  const r1cs = param.r1cs;

  // the numbers of wires
  const m = [];

  // the numbers of public wires
  // (not including constant wire at zero index)
  const mPublic = [];
  const mPrivate = [];
  const nConstraints = [];
  for (let i=0; i<sD; i++) {
    m.push(r1cs[i].m);
    nConstraints.push(r1cs[i].nConstraints);
    mPublic.push(r1cs[i].mPublic);
    mPrivate.push(r1cs[i].mPrivate);
  }

  // Generate tau
  const numKeys = 6; // the number of keys in tau
  const rng = new Array(numKeys);
  for (let i = 0; i < numKeys; i++) {
    rng[i] = await misc.getRandomRng(i + 1);
  }
  const tau = createTauKey(Fr, rng);

  // Write the sigmaG section
  partTime = timer.start();
  if (logger) logger.debug(`Generating sigmaG...`);
  await startWriteSection(fdRS, 3);

  EncTimeStart = timer.start();
  const vk1AlphaU = await G1.timesFr( buffG1, tau.alpha_u );
  const vk1AlphaV = await G1.timesFr( buffG1, tau.alpha_v );
  const vk1GammaA = await G1.timesFr( buffG1, tau.gamma_a );
  EncTimeAccum1 += timer.end(EncTimeStart);

  await zkeyUtils.writeG1(fdRS, curve, vk1AlphaU);
  await zkeyUtils.writeG1(fdRS, curve, vk1AlphaV);
  await zkeyUtils.writeG1(fdRS, curve, vk1GammaA);
  let x=tau.x;
  let y=tau.y;

  // FIXME: for testing
  if (TESTFLAG === 'true') {
    x = Fr.e(13);
    y = Fr.e(23);
  }

  const vk1XyPows = Array.from(
      Array(n),
      () => new Array(sMax),
  );
  const xyPows = Array.from(
      Array(n),
      () => new Array(2*sMax-1),
  ); // n by sMax 2d array

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2*sMax-1; j++) {
      xyPows[i][j] = await Fr.mul(await Fr.exp(x, i), await Fr.exp(y, j));
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < sMax; j++) {
      EncTimeStart = timer.start();
      vk1XyPows[i][j] = await G1.timesFr(buffG1, xyPows[i][j]);
      EncTimeAccum1 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1(fdRS, curve, vk1XyPows[i][j]);
      // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(sMax-1)], [x^1*y^0], ...
    }
  }

  const gammaAInv=Fr.inv(tau.gamma_a);
  let xyPowsT1g;
  const vk1XyPowsT1g = Array.from(Array(n-1), () => new Array(2*sMax-1));
  const t1X=Fr.sub(await Fr.exp(x, n), Fr.one);
  const t1XG=Fr.mul(t1X, gammaAInv);
  for (let i = 0; i < n-1; i++) {
    for (let j=0; j<2*sMax-1; j++) {
      xyPowsT1g= await Fr.mul(xyPows[i][j], t1XG);
      EncTimeStart = timer.start();
      vk1XyPowsT1g[i][j]= await G1.timesFr( buffG1, xyPowsT1g );
      EncTimeAccum1 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1( fdRS, curve, vk1XyPowsT1g[i][j] );
      // [x^0*y^0*t*g], [x^0*y^1*t*g], ...,
      // [x^0*y^(sMax-1)*t*g], [x^1*y^0*t*g], ...
    }
  }

  let xyPowsT2g;
  const vk1XyPowsT2g = Array.from(Array(n), () => new Array(sMax-1));
  const t2Y=Fr.sub(await Fr.exp(y, sMax), Fr.one);
  const t2YG=Fr.mul(t2Y, gammaAInv);
  for (let i = 0; i < n; i++) {
    for (let j=0; j<sMax-1; j++) {
      xyPowsT2g= await Fr.mul(xyPows[i][j], t2YG);
      EncTimeStart = timer.start();
      vk1XyPowsT2g[i][j]= await G1.timesFr( buffG1, xyPowsT2g );
      EncTimeAccum1 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1( fdRS, curve, vk1XyPowsT2g[i][j] );
      // [x^0*y^0*t*g], [x^0*y^1*t*g], ...,
      // [x^0*y^(sMax-1)*t*g], [x^1*y^0*t*g], ...
    }
  }

  await endWriteSection(fdRS);
  if (logger) logger.debug(`Generating sigmaG...Done`);
  // End of the sigmaG section


  // Write the sigmaH section

  if (logger) logger.debug(`Generating sigmaH...`);
  await startWriteSection(fdRS, 4);

  EncTimeStart = timer.start();
  const vk2AlphaU = await G2.timesFr( buffG2, tau.alpha_u );
  const vk2GammaZ = await G2.timesFr( buffG2, tau.gamma_z );
  const vk2GammaA = await G2.timesFr( buffG2, tau.gamma_a );
  EncTimeAccum1 += timer.end(EncTimeStart);
  await zkeyUtils.writeG2(fdRS, curve, vk2AlphaU);
  await zkeyUtils.writeG2(fdRS, curve, vk2GammaZ);
  await zkeyUtils.writeG2(fdRS, curve, vk2GammaA);

  let vk2XyPows;
  for (let i = 0; i < n; i++) {
    for (let j=0; j<sMax; j++) {
      EncTimeStart = timer.start();
      vk2XyPows= await G2.timesFr( buffG2, xyPows[i][j] );
      EncTimeAccum1 += timer.end(EncTimeStart);
      await zkeyUtils.writeG2(fdRS, curve, vk2XyPows );
      // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(sMax-1)], [x^1*y^0], ...
    }
  }
  await endWriteSection(fdRS);
  if (logger) logger.debug(`Generating sigmaH...Done`);
  const sigmaTime = timer.end(partTime);
  // End of the sigmaH section


  // Write the thetaG[k] sections for k in [0, 1, ..., sD]
  partTime = timer.start();
  for (let k=0; k<sD; k++) {
    if (logger) logger.debug(`Generating thetaG...${k+1}/${sD}`);
    if (logger) logger.debug(`  Loading ${3*m[k]} sub-QAP polynomials...`);
    qapTimeStart = timer.start();
    const {
      uX: uX,
      vX: vX,
      wX: wX,
    } = await polyUtils.readQAP(qapDirPath, k, m[k], n, n8r);
    qapTimeAccum += timer.end(qapTimeStart);

    const _ux = new Array(m[k]);
    const _vx = new Array(m[k]);
    const _wx = new Array(m[k]);
    const vk1UX = new Array(m[k]);
    const vk1VX = new Array(m[k]);
    const vk2VX = new Array(m[k]);
    const vk1ZX = [];
    const vk1AX = [];
    let combined;
    let zx;
    let ax;
    if (logger) logger.debug(`  Evaluating and combining the sub-QAP polynomials...`);
    for (let i=0; i<m[k]; i++) {
      _ux[i] = await polyUtils.evalPoly(Fr, uX[i], x, 0);
      _vx[i] = await polyUtils.evalPoly(Fr, vX[i], x, 0);
      _wx[i] = await polyUtils.evalPoly(Fr, wX[i], x, 0);
      EncTimeStart = timer.start();
      vk1UX[i] = await G1.timesFr(buffG1, _ux[i]);
      vk1VX[i] = await G1.timesFr(buffG1, _vx[i]);
      vk2VX[i] = await G2.timesFr(buffG2, _vx[i]);
      EncTimeAccum2 += timer.end(EncTimeStart);
      combined = Fr.add(
          Fr.add(
              Fr.mul(tau.alpha_u, _ux[i]),
              Fr.mul(tau.alpha_v, _vx[i]),
          ),
          _wx[i],
      );
      if (i>=NConstWires && i<NConstWires+mPublic[k]) {
        zx=Fr.mul(combined, Fr.inv(tau.gamma_z));
        EncTimeStart = timer.start();
        vk1ZX.push(await G1.timesFr(buffG1, zx));
        EncTimeAccum2 += timer.end(EncTimeStart);
      } else {
        ax=Fr.mul(combined, Fr.inv(tau.gamma_a));
        EncTimeStart = timer.start();
        vk1AX.push(await G1.timesFr(buffG1, ax));
        EncTimeAccum2 += timer.end(EncTimeStart);
      }
    }

    // FIXME: Test code 4//
    // To test [z^(k)_i(x)]_G and [a^(k)_i(x)]_G in sigmaG
    if (TESTFLAG === 'true') {
      if (logger) logger.debug(`Running Test 4`);
      const vk2AlphaV = await G2.timesFr(buffG2, tau.alpha_v);
      let vk1WX;
      let res=0;
      for (let i=0; i<m[k]; i++) {
        vk1WX = await G1.timesFr(buffG1, _wx[i]);
        if (i>=NConstWires && i<NConstWires+mPublic[k]) {
          res = await curve.pairingEq(
              vk1ZX[i-NConstWires],
              await G2.neg(vk2GammaZ),
              vk1UX[i], vk2AlphaU,
              vk1VX[i], vk2AlphaV,
              vk1WX, buffG2);
        } else {
          res = await curve.pairingEq(
              vk1AX[Math.max(0, i-mPublic[k])],
              await G2.neg(vk2GammaA),
              vk1UX[i], vk2AlphaU,
              vk1VX[i], vk2AlphaV,
              vk1WX, buffG2);
        }
        if (res == false) {
          if (logger) logger.debug('k: ', k);
          if (logger) logger.debug('i: ', i);
        }
        assert(res);
      }
      if (logger) logger.debug(`Test 4 finished`);
    }
    // End of the test code 4//

    await startWriteSection(fdRS, 5+k);
    let multiplier;
    let vk1Uxy2d;
    let vk1Vxy2d;
    let vk2Vxy2d;
    let vk1Zxy2d;
    let vk1Axy2d;
    if (logger) logger.debug(`  Encrypting and file writing ${4*m[k]} QAP keys...`);
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = timer.start();
      vk1Uxy2d= await G1.timesFr(vk1UX[i], multiplier);
      EncTimeAccum2 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1(fdRS, curve, vk1Uxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = timer.start();
        vk1Uxy2d= await G1.timesFr(vk1UX[i], multiplier);
        EncTimeAccum2 += timer.end(EncTimeStart);
        await zkeyUtils.writeG1(fdRS, curve, vk1Uxy2d);
      }
    }
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = timer.start();
      vk1Vxy2d= await G1.timesFr(vk1VX[i], multiplier);
      EncTimeAccum2 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1(fdRS, curve, vk1Vxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = timer.start();
        vk1Vxy2d= await G1.timesFr(vk1VX[i], multiplier);
        EncTimeAccum2 += timer.end(EncTimeStart);
        await zkeyUtils.writeG1(fdRS, curve, vk1Vxy2d);
      }
    }
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = timer.start();
      vk2Vxy2d= await G2.timesFr(vk2VX[i], multiplier);
      EncTimeAccum2 += timer.end(EncTimeStart);
      await zkeyUtils.writeG2(fdRS, curve, vk2Vxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = timer.start();
        vk2Vxy2d= await G2.timesFr(vk2VX[i], multiplier);
        EncTimeAccum2 += timer.end(EncTimeStart);
        await zkeyUtils.writeG2(fdRS, curve, vk2Vxy2d);
      }
    }
    for (let i=0; i < mPublic[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = timer.start();
      vk1Zxy2d= await G1.timesFr(vk1ZX[i], multiplier);
      EncTimeAccum2 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1(fdRS, curve, vk1Zxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = timer.start();
        vk1Zxy2d= await G1.timesFr(vk1ZX[i], multiplier);
        EncTimeAccum2 += timer.end(EncTimeStart);
        await zkeyUtils.writeG1(fdRS, curve, vk1Zxy2d);
      }
    }
    for (let i=0; i < mPrivate[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = timer.start();
      vk1Axy2d= await G1.timesFr(vk1AX[i], multiplier);
      EncTimeAccum2 += timer.end(EncTimeStart);
      await zkeyUtils.writeG1(fdRS, curve, vk1Axy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = timer.start();
        vk1Axy2d= await G1.timesFr(vk1AX[i], multiplier);
        EncTimeAccum2 += timer.end(EncTimeStart);
        await zkeyUtils.writeG1(fdRS, curve, vk1Axy2d);
      }
    }
    await endWriteSection(fdRS);
  }
  const thetaTime = timer.end(partTime);

  // FIXME: Test code 5//
  // k==6 --> MOD subcircuit,
  // c2 mod c3 = c1 <==> c4*c3+c1 = c2 <==> c4*c3 = -c1+c2
  if (TESTFLAG === 'true') {
    if (logger) logger.debug('Running Test 5');
    const res = [];
    res.push(await curve.pairingEq(vk1XyPowsT1g[1][1], vk2GammaA,
        await G1.timesFr(
            buffG1, Fr.mul(x, y)),
        await G2.neg(await G2.timesFr(buffG2, t1X)),
    ),
    );
    if (logger) logger.debug(res);

    if (!res[0]) {
      throw new Error('Test 5 failed');
    }
    if (logger) logger.debug(`Test 5 finished`);
  }
  // End of the test code 5//

  // End of the thetaG section

  await fdRS.close();

  const totalTime = timer.end(startTime);
  if (logger) {
    logger.debug('  ');
    logger.debug('----- Setup Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${totalTime} [ms]`);
    logger.debug(` ## Time for generating two sigmas with n=${n}, sMax=${sMax}: ${sigmaTime} [ms] (${((sigmaTime)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Encryption time: ${EncTimeAccum1} [ms] (${(EncTimeAccum1/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # File writing time: ${sigmaTime - EncTimeAccum1} [ms] (${((sigmaTime - EncTimeAccum1)/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Time for generating thetaG for ${sD} sub-QAPs with totally ${m.reduce((accu, curr) => accu + curr)} wires and sMax=${sMax} opcode slots: ${thetaTime} [ms] (${((thetaTime)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Sub-QAPs loading time: ${qapTimeAccum} [ms] (${(qapTimeAccum/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Encryption time: ${EncTimeAccum2} [ms] (${((EncTimeAccum2)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # File writing time: ${thetaTime - qapTimeAccum - EncTimeAccum2} [ms] (${((thetaTime - qapTimeAccum - EncTimeAccum2)/totalTime*100).toFixed(3)} %)`);
  }
  process.exit(0);


  function createTauKey(Field, rng) {
    if (rng.length != 6) {
      // if (logger) logger.debug(`checkpoint3`);
      throw new Error('It should have six elements.');
    }
    const key = {
      x: Field.fromRng(rng[0]),
      y: Field.fromRng(rng[1]),
      alpha_u: Field.fromRng(rng[2]),
      alpha_v: Field.fromRng(rng[3]),
      gamma_a: Field.fromRng(rng[4]),
      gamma_z: Field.fromRng(rng[5]),
    };
    return key;
  }
}
