import * as curves from './curves.js';
import * as polyUtils from './utils/poly_utils.js';
import chai from 'chai';
import {readR1csHeader} from 'r1csfile';
import {
  readBinFile,
  readSection,
  createBinFile,
  writeBigInt,
  startWriteSection,
  endWriteSection
} from '@iden3/binfileutils';
import {Scalar} from 'ffjavascript';
import {mkdir} from 'fs';
import path from 'path';
import * as timer from './utils/timer.js';


export default async function buildQAP(curveName, sD, minSMax, logger) {
  const startTime = timer.start();
  let partTime;

  // read debug mode from enviroment variable
  const TESTFLAG = process.env.TEST_MODE;
  const assert = chai.assert;
  const r1cs = [];
  const sR1cs = [];

  mkdir(
      path.join(
          `resource/subcircuits`, `QAP_${sD}_${minSMax}`,
      ), (err) => {},
  );
  const dirPath = `resource/subcircuits/QAP_${sD}_${minSMax}`;

  partTime = timer.start();
  for (let i=0; i<sD; i++) {
    if (logger) logger.debug(`Loading R1CSs...${i+1}/${sD}`);
    const r1csIdx = String(i);
    const {
      fd: fdR1cs,
      sections: sectionsR1cs,
    } = await readBinFile(
        'resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs',
        'r1cs',
        2,
        1<<22,
        1<<24,
    );
    r1cs.push(
        await readR1csHeader(fdR1cs, sectionsR1cs, false),
    );
    sR1cs.push(
        await readSection(fdR1cs, sectionsR1cs, 2),
    );
    await fdR1cs.close();
  }
  if (logger) logger.debug(`Loading R1CSs...Done`);
  const r1csTime = timer.end(partTime);

  const fdRS = await createBinFile(
      `resource/subcircuits/param_${sD}_${minSMax}.dat`,
      'zkey',
      1,
      2,
      1<<22,
      1<<24,
  );

  const curve = await curves.getCurveFromName(curveName);
  const Fr = curve.Fr;

  if (r1cs[0].prime != curve.r) {
    if (logger) logger.debug('r1cs_prime: ', r1cs[0].prime);
    if (logger) logger.debug('curve_r: ', curve.r);
    throw new Error(
        'r1cs curve does not match powers of tau ceremony curve',
    );
    // return -1
  }

  // Write Header
  // /////////
  await startWriteSection(fdRS, 1);
  await fdRS.writeULE32(1); // Groth
  await endWriteSection(fdRS);
  // End of the Header

  // Write parameters section
  // /////////
  await startWriteSection(fdRS, 2);
  const primeQ = curve.q;
  const n8q = (Math.floor( (Scalar.bitLength(primeQ) - 1) / 64) +1)*8;

  // Group parameters
  const primeR = curve.r;
  const n8r = (Math.floor( (Scalar.bitLength(primeR) - 1) / 64) +1)*8;

  await fdRS.writeULE32(n8q); // byte length of primeQ
  await writeBigInt(fdRS, primeQ, n8q);
  await fdRS.writeULE32(n8r); // byte length of primeR
  await writeBigInt(fdRS, primeR, n8r);

  // Instruction set constants
  await fdRS.writeULE32(sD);
  const m = []; // the numbers of wires
  const mPublic = []; // the numbers of public wires
  // (not including constant wire at zero index)
  const mPrivate = [];
  const nConstraints = [];
  for (let i=0; i<sD; i++) {
    m.push(r1cs[i].nVars);
    nConstraints.push(r1cs[i].nConstraints);
    mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs + r1cs[i].nPrvInputs);
    mPrivate.push(m[i] - mPublic[i]);
    await fdRS.writeULE32(m[i]);
    await fdRS.writeULE32(mPublic[i]);
    await fdRS.writeULE32(nConstraints[i]);
  }

  // QAP constants
  //   const sum_mPublic = mPublic.reduce((accu, curr) => accu + curr);
  //   const sum_mPrivate = mPrivate.reduce((accu, curr) => accu + curr);
  //   const NEqs = Math.max(
  //     mPublic.reduce((accu, curr) => accu + curr),
  //     mPrivate.reduce((accu, curr) => accu + curr));
  let n = Math.max(...nConstraints);

  const expon = Math.ceil(Math.log2(n));
  n = 2**expon;

  const omegaX = await Fr.exp(Fr.w[Fr.s], Scalar.exp(2, Fr.s-expon));

  const expos = Math.ceil(Math.log2(minSMax));
  const sMax = 2**expos;
  const omegaY = await Fr.exp(Fr.w[Fr.s], Scalar.exp(2, Fr.s-expos));

  // FIXME: chai should not be used for production code
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running Test 1`);
    assert(Fr.eq(await Fr.exp(Fr.e(n), primeR), Fr.e(n)));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaX), n), Fr.one));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaY), sMax), Fr.one));
    if (logger) logger.debug(`Test 1 finished`);
  }
  // End of test code 1 //

  // the maximum number of gates in each subcircuit:
  // n>=NEqs/3 and n|(r-1)
  await fdRS.writeULE32(n);

  // the maximum number of subcircuits in a p-code:
  // sMax>minSMax and sMax|(r-1)
  await fdRS.writeULE32(sMax);

  // Generator for evaluation points on X and Y
  await writeBigInt(fdRS, Fr.toObject(omegaX), n8r);
  await writeBigInt(fdRS, Fr.toObject(omegaY), n8r);

  // FIXME: Test code 2 //
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running Test 2`);
    assert(Fr.eq(omegaX, Fr.e(Fr.toObject(omegaX))));
    if (logger) logger.debug(`Test 2 finished`);
  }
  // End of test code 2 //

  await endWriteSection(fdRS);
  // / End of parameters section

  await fdRS.close();

  const rs = {};
  rs.curve = curve;
  rs.n = n;
  rs.sMax = sMax;
  rs.omegaX = omegaX;
  rs.omegaY = omegaY;

  partTime = timer.start();

  if (logger) logger.debug(
      `Generating Lagrange bases for X with ${n} evaluation points...`,
  );
  const lagrangeBasis = await polyUtils.buildCommonPolys(rs);
  if (logger) logger.debug(
      `Generating Lagrange bases for X with ${n} evaluation points...Done`,
  );

  let FSTimeAccum = 0;
  for (let k=0; k<sD; k++) {
    if (logger) logger.debug(`Interpolating ${3*m[k]} QAP polynomials...${k+1}/${sD}`);
    const {
      uX: uX,
      vX: vX,
      wX: wX,
    } = await polyUtils.buildR1csPolys(
        curve,
        lagrangeBasis,
        r1cs[k],
        sR1cs[k],
    );

    if (logger) logger.debug(`File writing the polynomials...`);
    const FSTime = timer.start();
    const fdQAP = await createBinFile(
        `${dirPath}/subcircuit${k}.qap`,
        'qapp',
        1,
        2,
        1<<22,
        1<<24,
    );

    await startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await endWriteSection(fdQAP);

    await startWriteSection(fdQAP, 2);
    for (let i=0; i<m[k]; i++) {
      const degree = uX[i].length;
      await fdQAP.writeULE32(degree);
      for (let xi=0; xi<degree; xi++) {
        if (typeof uX[i][xi][0] != 'bigint') {
          await fdQAP.write(uX[i][xi][0]);
        } else {
          await writeBigInt(fdQAP, uX[i][xi][0], n8r);
        }
      }
    }
    for (let i=0; i<m[k]; i++) {
      const degree = vX[i].length;
      await fdQAP.writeULE32(degree);
      for (let xi=0; xi<degree; xi++) {
        if (typeof vX[i][xi][0] != 'bigint') {
          await fdQAP.write(vX[i][xi][0]);
        } else {
          await writeBigInt(fdQAP, vX[i][xi][0], n8r);
        }
      }
    }
    for (let i=0; i<m[k]; i++) {
      const degree = wX[i].length;
      await fdQAP.writeULE32(degree);
      for (let xi=0; xi<degree; xi++) {
        if (typeof wX[i][xi][0] != 'bigint') {
          await fdQAP.write(wX[i][xi][0]);
        } else {
          await writeBigInt(fdQAP, wX[i][xi][0], n8r);
        }
      }
    }
    await endWriteSection(fdQAP);
    await fdQAP.close();
    FSTimeAccum += timer.end(FSTime);
  }
  const qapTime = timer.end(partTime);
  const totalTime = timer.end(startTime);

  if (logger) {
    logger.debug(' ');
    logger.debug('----- Build QAP Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${totalTime} [ms]`);
    logger.debug(` ## R1CS loading time: ${r1csTime} [ms] (${(r1csTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Total QAP time for ${m.reduce((accu, curr) => accu + curr)} wires: ${qapTime} [ms] (${(qapTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # QAP interpolation time: ${qapTime-FSTimeAccum} [ms] (${((qapTime-FSTimeAccum)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # QAP file writing time: ${FSTimeAccum} [ms] (${(FSTimeAccum/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Average QAP time per wire with ${n} interpolation points: ${qapTime/m.reduce((accu, curr) => accu + curr)} [ms]`);
  } 
  process.exit(0);
}
