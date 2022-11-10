import * as zkeyUtils from './utils/zkey_utils.js';
import * as polyUtils from './utils/poly_utils.js';
import chai from 'chai';
const assert = chai.assert;
import {
  readBinFile,
  readSection,
  createBinFile,
  writeBigInt,
  startWriteSection,
  endWriteSection,
} from '@iden3/binfileutils';
import {Scalar} from 'ffjavascript';
import {mkdir} from 'fs';
import path from 'path';


export default async function buildSingleQAP(paramName, id) {
  const TESTFLAG = process.env.TEST_MODE;

  const QAPName = `QAP${paramName.slice(5)}`;
  mkdir(
      path.join(
          `resource/subcircuits`,
          QAPName,
      ),
      (err) => {},
  );
  const dirPath = `resource/subcircuits/` + QAPName;

  const {
    fd: fdParam,
    sections: sectionsParam,
  } = await readBinFile(
      `resource/subcircuits/${paramName}.dat`,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const param = await zkeyUtils.readRSParams(fdParam, sectionsParam);
  await fdParam.close();

  const r1csIdx = String(id);
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
  const sR1cs = await readSection(fdR1cs, sectionsR1cs, 2);
  await fdR1cs.close();

  // console.log('checkpoint0');

  const curve = param.curve;
  const Fr = curve.Fr;
  const r1cs = param.r1cs[id];
  if (r1cs === undefined) {
    throw new Error(
        `Parameters in ${paramName}.dat do not support Subcircuit${id}.`,
    );
  }

  // Write parameters section
  // /////////
  // console.log(`checkpoint4`);

  // Group parameters
  const primeR = curve.r;
  const n8r = (Math.floor( (Scalar.bitLength(primeR) - 1) / 64) +1)*8;

  const mK = r1cs.m;

  // QAP constants
  const n = param.n;

  const omegaX = param.omegaX;

  const sMax = param.sMax;
  const omegaY = param.sMax;

  // Test code 1 // --> DONE
  if (TESTFLAG) {
    console.log(`Running Test 1`);
    assert(Fr.eq(await Fr.exp(Fr.e(n), primeR), Fr.e(n)));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaX), n), Fr.one));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaY), sMax), Fr.one));
    console.log(`Test 1 finished`);
  }
  // End of test code 1 //


  // console.log(`checkpoint5`);

  // Test code 2 //
  if (TESTFLAG) {
    console.log(`Running Test 2`);
    assert(Fr.eq(omegaX, Fr.e(Fr.toObject(omegaX))));
    console.log(`Test 2 finished`);
  }
  // End of test code 2 //

  // / End of parameters section

  const rs={};
  rs.curve = curve;
  rs.n = n;
  rs.sMax = sMax;
  rs.omegaX = omegaX;
  rs.omegaY = omegaY;
  const lagrangeBasis = await polyUtils.buildCommonPolys(rs, true);

  console.log(`k: ${id}`);
  const {
    uX: uX,
    vX: vX,
    wX: wX,
  } = await polyUtils.buildR1csPolys(
      curve,
      lagrangeBasis,
      r1cs,
      sR1cs,
      true,
  );
  const fdQAP = await createBinFile(
      `${dirPath}/subcircuit${id}.qap`,
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
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof uX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of uX at k: ${id}, i: ${i}`);
      }
      await writeBigInt(fdQAP, uX[i][xi][0], n8r);
    }
  }
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof vX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of vX at k: ${id}, i: ${i}`);
      }
      await writeBigInt(fdQAP, vX[i][xi][0], n8r);
    }
  }
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof wX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of wX at k: ${id}, i: ${i}`);
      }
      await writeBigInt(fdQAP, wX[i][xi][0], n8r);
    }
  }
  await endWriteSection(fdQAP);
  await fdQAP.close();
}
