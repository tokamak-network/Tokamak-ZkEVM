import * as zkeyUtils from './utils/zkey_utils.js';
import * as polyUtils from './utils/poly_utils.js';
import * as binFileUtils from '@iden3/binfileutils';
import {
  createBinFile,
  startWriteSection,
  endWriteSection,
} from '@iden3/binfileutils';
import * as fastFile from 'fastfile';
import * as timer from './utils/timer.js';

export default async function derive(rsName, cRSName, circuitName, qapName) {
  const startTime = timer.start();
  let partTime;
  let EncTimeStart;
  let EncTimeAccum = 0;
  let PolTimeStart;
  let PolTimeAccum = 0;
  let QAPWriteTimeStart;
  let QAPWriteTimeAccum = 0;

  // const TESTFLAG = process.env.TEST_MODE;
  const dirPath = `resource/circuits/${circuitName}`;

  const URS = 0;
  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils.readBinFile(
      `resource/universal_rs/${rsName}.urs`,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const urs = {};
  urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS);

  console.log(`Loading urs...`);
  partTime = timer.start();
  urs.content = await zkeyUtils.readRS(fdRS, sectionsRS, urs.param, URS);
  const ursLoadTime = timer.end(partTime);
  console.log(`Loading urs...Done`);

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

  const IdSetV = await zkeyUtils.readIndSet(fdIdV);
  const IdSetP = await zkeyUtils.readIndSet(fdIdP);
  const OpList = await zkeyUtils.readOpList(fdOpL);
  // IdSet#.set, IdSet#.PreImgs

  await fdIdV.close();
  await fdIdP.close();
  await fdOpL.close();

  const fdcRS = await createBinFile(
      `${dirPath}/${cRSName}.crs`,
      'zkey',
      1,
      5,
      1<<22,
      1<<24,
  );

  const ParamR1cs = urs.param.r1cs;
  const curve = urs.param.curve;
  const G1 = urs.param.curve.G1;
  const G2 = urs.param.curve.G2;
  const Fr = urs.param.curve.Fr;
  const n8r = urs.param.n8r;
  const n = urs.param.n;
  const buffG1 = curve.G1.oneAffine;
  const buffG2 = curve.G2.oneAffine;
  const sMax = urs.param.sMax;
  const sD = urs.param.sD;
  const sF = OpList.length;
  const omegaY = await Fr.e(urs.param.omegaY);

  // length of input instance + the total number of subcircuit outputs
  const mPublic = IdSetV.set.length;
  const mPrivate = IdSetP.set.length;
  const m = mPublic + mPrivate;
  const nZeroWires = 1;

  let PreImgSet;
  let PreImgSize;
  let mPublicK;
  let vk1Term;
  let vk2Term;
  let arrayIdx;
  let kPrime;
  let sKPrime;
  let iPrime;

  const OmegaFactors = new Array(sMax);
  OmegaFactors[0] = Fr.one;
  const omegaYInv = Fr.inv(omegaY);
  for (let j=1; j<sMax; j++) {
    OmegaFactors[j] = Fr.mul(OmegaFactors[j-1], omegaYInv);
  }

  if (Math.max(OpList) >= sD) {
    throw new Error('An opcode in the target EVM bytecode has no subcircuit');
  }

  console.log('Deriving crs...');
  let crsTime = timer.start();
  console.log(`  Deriving crs: [z_i(x,y)]_G for i upto ${mPublic}...`);
  const vk1Zxy = new Array(mPublic);
  for (let i=0; i<mPublic; i++) {
    PreImgSet = IdSetV.PreImgs[i];
    PreImgSize = IdSetV.PreImgs[i].length;
    vk1Zxy[i] = await mulFrInG1(buffG1, Fr.zero);
    for (let j=0; j<sMax; j++) {
      for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
        kPrime = PreImgSet[PreImgIdx][0];
        sKPrime = OpList[kPrime];
        iPrime = PreImgSet[PreImgIdx][1];
        mPublicK = ParamR1cs[sKPrime].mPublic;

        if (!(iPrime >= nZeroWires && iPrime < nZeroWires+mPublicK)) {
          throw new Error('invalid access to vk1_zxy_kij');
        }
        arrayIdx = iPrime-nZeroWires;
        vk1Term = urs.content.thetaG.vk1Zxy[sKPrime][arrayIdx][j];
        vk1Term = await mulFrInG1(vk1Term, OmegaFactors[(kPrime*j)%sMax]);
        vk1Zxy[i] = await G1.add(vk1Zxy[i], vk1Term);
      }
    }
  }

  console.log(`  Deriving crs: [a_i(x,y)]_G for i upto ${mPrivate}...`);
  const vk1Axy = new Array(mPrivate);
  for (let i=0; i<mPrivate; i++) {
    PreImgSet = IdSetP.PreImgs[i];
    PreImgSize = IdSetP.PreImgs[i].length;
    vk1Axy[i] = await mulFrInG1(buffG1, Fr.zero);
    for (let j=0; j<sMax; j++) {
      for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
        kPrime = PreImgSet[PreImgIdx][0];
        sKPrime = OpList[kPrime];
        iPrime = PreImgSet[PreImgIdx][1];
        mPublicK = ParamR1cs[sKPrime].mPublic;

        if (iPrime < nZeroWires) {
          arrayIdx = iPrime;
        } else if (iPrime >= nZeroWires+mPublicK) {
          arrayIdx = iPrime-mPublicK;
        } else {
          console.log(`i: ${i}, PreImgIdx: ${PreImgIdx}`);
          throw new Error('invalid access to vk1_axy_kij');
        }
        vk1Term = urs.content.thetaG.vk1Axy[sKPrime][arrayIdx][j];
        vk1Term = await mulFrInG1(vk1Term, OmegaFactors[(kPrime*j)%sMax]);
        vk1Axy[i] = await G1.add(vk1Axy[i], vk1Term);
      }
    }
  }

  console.log(`  Deriving crs: [u_i(x,y)]_G for i upto ${m}...`);
  const vk1Uxy = new Array(m);
  for (let i=0; i<m; i++) {
    if (IdSetV.set.indexOf(i) > -1) {
      arrayIdx = IdSetV.set.indexOf(i);
      PreImgSet = IdSetV.PreImgs[arrayIdx];
    } else {
      arrayIdx = IdSetP.set.indexOf(i);
      PreImgSet = IdSetP.PreImgs[arrayIdx];
    }
    PreImgSize = PreImgSet.length;
    vk1Uxy[i] = await mulFrInG1(buffG1, Fr.zero);
    for (let j=0; j<sMax; j++) {
      for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
        kPrime = PreImgSet[PreImgIdx][0];
        sKPrime = OpList[kPrime];
        iPrime = PreImgSet[PreImgIdx][1];
        vk1Term = urs.content.thetaG.vk1Uxy[sKPrime][iPrime][j];
        vk1Term = await mulFrInG1(vk1Term, OmegaFactors[(kPrime*j)%sMax]);
        vk1Uxy[i] = await G1.add(vk1Uxy[i], vk1Term);
      }
    }
  }

  console.log(`  Deriving crs: [v_i(x,y)]_G for i upto ${m}...`);
  const vk1Vxy = new Array(m);
  for (let i=0; i<m; i++) {
    if (IdSetV.set.indexOf(i) > -1) {
      arrayIdx = IdSetV.set.indexOf(i);
      PreImgSet = IdSetV.PreImgs[arrayIdx];
    } else {
      arrayIdx = IdSetP.set.indexOf(i);
      PreImgSet = IdSetP.PreImgs[arrayIdx];
    }
    PreImgSize = PreImgSet.length;
    vk1Vxy[i] = await mulFrInG1(buffG1, Fr.zero);
    for (let j=0; j<sMax; j++) {
      for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
        kPrime = PreImgSet[PreImgIdx][0];
        sKPrime = OpList[kPrime];
        iPrime = PreImgSet[PreImgIdx][1];

        vk1Term = urs.content.thetaG.vk1Vxy[sKPrime][iPrime][j];
        vk1Term = await mulFrInG1(vk1Term, OmegaFactors[(kPrime*j)%sMax]);
        vk1Vxy[i] = await G1.add(vk1Vxy[i], vk1Term);
      }
    }
  }

  console.log(`  Deriving crs: [v_i(x,y)]_H for i upto ${m}...`);
  const vk2Vxy = new Array(m);
  for (let i=0; i<m; i++) {
    if (IdSetV.set.indexOf(i) > -1) {
      arrayIdx = IdSetV.set.indexOf(i);
      PreImgSet = IdSetV.PreImgs[arrayIdx];
    } else {
      arrayIdx = IdSetP.set.indexOf(i);
      PreImgSet = IdSetP.PreImgs[arrayIdx];
    }
    PreImgSize = PreImgSet.length;
    vk2Vxy[i] = await mulFrInG2(buffG2, Fr.zero);
    for (let j=0; j<sMax; j++) {
      for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
        kPrime = PreImgSet[PreImgIdx][0];
        sKPrime = OpList[kPrime];
        iPrime = PreImgSet[PreImgIdx][1];

        vk2Term = urs.content.thetaG.vk2Vxy[sKPrime][iPrime][j];
        vk2Term = await mulFrInG2(vk2Term, OmegaFactors[(kPrime*j)%sMax]);
        vk2Vxy[i] = await G2.add(vk2Vxy[i], vk2Term);
      }
    }
  }

  await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 1);
  await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 2);
  await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 3);
  await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 4);

  await fdRS.close();

  console.log(`  Writing crs file...`);
  partTime = timer.start();
  await startWriteSection(fdcRS, 5);
  await fdcRS.writeULE32(m);
  await fdcRS.writeULE32(mPublic);
  await fdcRS.writeULE32(mPrivate);
  for (let i=0; i<m; i++) {
    await zkeyUtils.writeG1(fdcRS, curve, vk1Uxy[i]);
  }
  for (let i=0; i<m; i++) {
    await zkeyUtils.writeG1(fdcRS, curve, vk1Vxy[i]);
  }
  for (let i=0; i<mPublic; i++) {
    await zkeyUtils.writeG1(fdcRS, curve, vk1Zxy[i]);
  }
  // vk1Zxy[i] is for the IdSetV.set[i]-th wire of circuit
  for (let i=0; i<mPrivate; i++) {
    await zkeyUtils.writeG1(fdcRS, curve, vk1Axy[i]);
  }
  // vk1Axy[i] is for the IdSetP.set[i]-th wire of circuit
  for (let i=0; i<m; i++) {
    await zkeyUtils.writeG2(fdcRS, curve, vk2Vxy[i]);
  }
  await endWriteSection(fdcRS);
  const crsWriteTime = timer.end(partTime);

  await fdcRS.close();

  crsTime = timer.end(crsTime);
  console.log(`Deriving crs...Done`);

  console.log(`Deriving QAP...`);
  let qapTime = timer.start();
  console.log(`  Loading sub-QAPs...`);
  partTime = timer.start();
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
  console.log(`  Loading ${uXK.length} sub-QAPs...Done`);
  const subQapLoadTime = timer.end(partTime);

  const fdQAP = await createBinFile(
      `${dirPath}/circuitQAP.qap`,
      'qapp',
      1,
      1+m,
      1<<22,
      1<<24,
  );

  await startWriteSection(fdQAP, 1);
  await fdQAP.writeULE32(1); // Groth
  await endWriteSection(fdQAP);

  console.log(`  Generating f_k(Y) of degree ${sMax-1} for k upto ${sF}...`);
  const fYK = new Array(sF);
  const fY = Array.from(Array(1), () => new Array(sMax));
  const FrSMaxInv = Fr.inv(Fr.e(sMax));
  for (let k=0; k<sF; k++) {
    const invOmegaYK = new Array(sMax);
    invOmegaYK[0] = Fr.one;
    for (let i=1; i<sMax; i++) {
      invOmegaYK[i] = Fr.mul(invOmegaYK[i-1], await Fr.exp(Fr.inv(omegaY), k));
    }
    PolTimeStart = timer.start();
    const LagY = await polyUtils.filterPoly(Fr, fY, invOmegaYK, 1);
    fYK[k] = await polyUtils.scalePoly(Fr, LagY, FrSMaxInv);
    PolTimeAccum += timer.end(PolTimeStart);
  }

  console.log(`  Deriving u_i(X,Y), v_i(X,Y), w_i(X,Y) for i upto ${m}...`);
  for (let i=0; i<m; i++) {
    await startWriteSection(fdQAP, 2+i);
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
    let uXY = [[Fr.zero]];
    let vXY = [[Fr.zero]];
    let wXY = [[Fr.zero]];
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];

      PolTimeStart = timer.start();
      const uTerm = await polyUtils.tensorProduct(
          Fr,
          uXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      uXY = await polyUtils.addPoly(Fr, uXY, uTerm);

      const vTerm = await polyUtils.tensorProduct(
          Fr,
          vXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      vXY = await polyUtils.addPoly(Fr, vXY, vTerm);

      const wTerm = await polyUtils.tensorProduct(
          Fr,
          wXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      wXY = await polyUtils.addPoly(Fr, wXY, wTerm);
      PolTimeAccum += timer.end(PolTimeStart);
    }

    QAPWriteTimeStart = timer.start();
    await fdQAP.writeULE32(uXY.length);
    await fdQAP.writeULE32(uXY[0].length);
    for (let xi=0; xi<uXY.length; xi++) {
      for (let yi=0; yi<uXY[0].length; yi++) {
        await fdQAP.write(uXY[xi][yi]);
      }
    }
    await fdQAP.writeULE32(vXY.length);
    await fdQAP.writeULE32(vXY[0].length);
    for (let xi=0; xi<vXY.length; xi++) {
      for (let yi=0; yi<vXY[0].length; yi++) {
        await fdQAP.write(vXY[xi][yi]);
      }
    }
    await fdQAP.writeULE32(wXY.length);
    await fdQAP.writeULE32(wXY[0].length);
    for (let xi=0; xi<wXY.length; xi++) {
      for (let yi=0; yi<wXY[0].length; yi++) {
        await fdQAP.write(wXY[xi][yi]);
      }
    }
    QAPWriteTimeAccum += timer.end(QAPWriteTimeStart);
    await endWriteSection(fdQAP);
  }
  await fdQAP.close();
  qapTime = timer.end(qapTime);
  console.log('Deriving QAP...Done');
  console.log('  ');

  const totalTime = timer.end(startTime);
  console.log(`-----Derive Time Analyzer-----`);
  console.log(`###Total ellapsed time: ${totalTime} [ms]`);
  console.log(` ##Time for deriving crs for ${m} wires (${4*m} keys): ${crsTime} [ms] (${((crsTime)/totalTime*100).toFixed(3)} %)`);
  console.log(`  #urs loading time: ${ursLoadTime} [ms] (${(ursLoadTime/totalTime*100).toFixed(3)} %)`);
  console.log(`  #Encryption time: ${EncTimeAccum} [ms] (${(EncTimeAccum/totalTime*100).toFixed(3)} %)`);
  console.log(`  #File writing time: ${crsWriteTime} [ms] (${(crsWriteTime/totalTime*100).toFixed(3)} %)`);
  console.log(` ##Time for deriving ${3*m} QAP polynomials of degree (${n},${sMax}): ${qapTime} [ms] (${(qapTime/totalTime*100).toFixed(3)} %)`);
  console.log(`  #Sub-QAPs loading time: ${subQapLoadTime} [ms] (${(subQapLoadTime/totalTime*100).toFixed(3)} %)`);
  console.log(`  #Polynomial multiplication time: ${PolTimeAccum} [ms] (${(PolTimeAccum/totalTime*100).toFixed(3)} %)`);
  console.log(`  #file writing time: ${QAPWriteTimeAccum} [ms] (${(QAPWriteTimeAccum/totalTime*100).toFixed(3)} %)`);


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
//   async function polyUtils_mulPoly(Fr, coef1, coef2) {
//     PolTimeStart = timer.start();
//     const out = await polyUtils.mulPoly(Fr, coef1, coef2);
//     PolTimeAccum += timer.end(PolTimeStart);
//     return out;
//   }
}
