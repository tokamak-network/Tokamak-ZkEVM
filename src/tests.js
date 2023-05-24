import * as binFileUtils from '@iden3/binfileutils';
import * as polyUtils from './utils/poly_utils.js';
import * as zkeyUtils from './utils/zkey_utils.js';
import * as wtnsUtils from './utils/wtns_utils.js';
import generateWitness from './generate_witness.js';
import * as fastFile from 'fastfile';
import * as misc from './misc.js';
import * as timer from './utils/timer.js';

import {Scalar, BigBuffer} from 'ffjavascript';


export default async function tests(logger) {
  const circuitReferenceString = `resource/circuits/test_transfer/test_transfer.crs`
  const circuitName = `resource/circuits/test_transfer`
  const instanceId = 1
  
  let EncTimeStart;
  let EncTimeAccum = 0;

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
  const m0 = (mPublic + mPrivate);
  const repeat = 7;
  const m = m0 * repeat;

  const orig1 = crs.vk1Uxy1d;
  const orig2 = crs.vk2Vxy1d;
  for (let i=1; i < repeat; i++){
    crs.vk1Uxy1d.push(... orig1);
    crs.vk2Vxy1d.push(... orig2);
  }
  

  // generate witness for each subcircuit
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

  // / arrange circuit witness
  const cWtns = new Array(m);
  const cWtns_buff = new BigBuffer(32*m);
  const buff = new Uint8Array(32);
  for (let i=0; i<m; i++) {
    const kPrime = WireList[i % m0][0];
    const idx = WireList[i % m0][1];
    cWtns[i] = Fr.e(wtns[kPrime][idx]);
    await Fr.toRprLE(buff, 0, cWtns[i]);
    cWtns_buff.set(buff, 32*i);
    if (cWtns[i] === undefined) {
      throw new Error(`Undefined cWtns value at i=${i}`);
    }
  }
      
  const vk1keys_buff = new BigBuffer(G1.F.n8*2*m);
  const vk2keys_buff = new BigBuffer(G2.F.n8*2*m);

  const buff1 = new Uint8Array(G1.F.n8*2);
  const buff2 = new Uint8Array(G2.F.n8*2);
  for (let i=0; i<m; i++) {    
    await G1.toRprLEM(buff1, 0, crs.vk1Uxy1d[i])
    await G2.toRprLEM(buff2, 0, crs.vk2Vxy1d[i])
    vk1keys_buff.set(buff1, G1.F.n8*2*i);
    vk2keys_buff.set(buff2, G2.F.n8*2*i);
  }

  //const nPoints = Math.floor(vk1keys_buff.byteLength / sGIn);


  let provingTime1 = timer.start();
  // Compute proof A
  let vk1AP2 = await mulFrInG1(buffG1, Fr.e(0));
  for (let i=0; i<m; i++) {
    const term = await mulFrInG1(crs.vk1Uxy1d[i], cWtns[i]);
    vk1AP2 = await G1.add(vk1AP2, term);
  }
  // Compute proof B_H
  let vk2BP2 = await mulFrInG2(buffG2, Fr.e(0));
  for (let i=0; i<m; i++) {
    const term = await mulFrInG2(crs.vk2Vxy1d[i], cWtns[i]);
    vk2BP2 = await G2.add(vk2BP2, term);
  }
  provingTime1 = timer.end(provingTime1);

  let provingTime2 = timer.start();
  const vk1AP2_buffed = await curve.G1.multiExpAffine(vk1keys_buff, cWtns_buff, false);
  const vk2BP2_buffed = await curve.G2.multiExpAffine(vk2keys_buff, cWtns_buff, false);
  provingTime2 = timer.end(provingTime2);

  const comp = await curve.pairingEq(
      vk1AP2,
      vk2BP2,
      await G1.neg(vk1AP2_buffed),
      vk2BP2_buffed
  );

  if (logger) {
    logger.debug('  ');
    logger.debug(`comp = ${comp}`);
    logger.debug(` ## Time for generating proofs with m=${m}, n=${n}, sMax=${sMax}: ${provingTime1} [ms]`);
    logger.debug(` ## Time for generating proofs with m=${m}, n=${n}, sMax=${sMax}: ${provingTime2} [ms]`);
  } 
  
  process.exit(0);

  async function mulFrInG1(point, fieldval) {
    EncTimeStart = timer.start();
    const out = await G1.timesFr(point, fieldval);
    EncTimeAccum += timer.end(EncTimeStart);
    return out;
  }
  async function mulFrInG2(point, fieldval) {
    EncTimeStart = timer.start();
    const out = await G2.timesFr(point, fieldval);
    EncTimeAccum += timer.end(EncTimeStart);
    return out;
  }
}
