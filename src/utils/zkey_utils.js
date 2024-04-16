// Format
// ======
// Header(1)
//      Prover Type 1 Groth
// HeaderGroth(2)
//      n8q
//      q
//      n8r
//      r
//      NVars
//      NPub
//      DomainSize  (multiple of 2
//      alpha1
//      beta1
//      delta1
//      beta2
//      gamma2
//      delta2
// IC(3)
// Coefs(4)
// PointsA(5)
// PointsB1(6)
// PointsB2(7)
// PointsC(8)
// PointsH(9)
// Contributions(10)

import {Scalar, F1Field, BigBuffer} from 'ffjavascript';
import * as binFileUtils from '@iden3/binfileutils';
import {getCurveFromQ as getCurve} from '../curves.js';

export async function readULE32(fd) {
  const b = await fd.read(4);
  const view = new Uint32Array(b.buffer);
  return view[0];
}

export async function writeULE32(fd, v) {
  const tmpBuff32 = new Uint8Array(4);
  const tmpBuff32v = new DataView(tmpBuff32.buffer);
  tmpBuff32v.setUint32(0, v, true);
  await fd.write(tmpBuff32);
}

export async function writeG1(fd, curve, p) {
  const buff = new Uint8Array(curve.G1.F.n8*2);
  curve.G1.toRprLEM(buff, 0, p);
  await fd.write(buff);
}

export async function writeG2(fd, curve, p) {
  const buff = new Uint8Array(curve.G2.F.n8*2);
  curve.G2.toRprLEM(buff, 0, p);
  await fd.write(buff);
}

export async function readG1(fd, curve, toObject) {
  const buff = await fd.read(curve.G1.F.n8*2);
  const res = curve.G1.fromRprLEM(buff, 0);
  return toObject ? curve.G1.toObject(res) : res;
}

export async function readG2(fd, curve, toObject) {
  const buff = await fd.read(curve.G2.F.n8*2);
  const res = curve.G2.fromRprLEM(buff, 0);
  return toObject ? curve.G2.toObject(res) : res;
}

/**
 *
 * @param {*} curve
 * @param {*} n  k-th subcircuit's constraints
 * @param {*} sR1cs  k-th subcircuit's r1cs
 * @returns
 */
export async function processConstraints(curve, n, sR1cs) {
  let r1csPos = 0;
  const results = {};

  const u = new Array(n);
  const uId = new Array(n);
  const v = new Array(n);
  const vId = new Array(n);
  const w = new Array(n);
  const wId = new Array(n);

  function r1csReadULE32toUInt() {
    const buff = sR1cs.slice(r1csPos, r1csPos + 4);
    r1csPos += 4;
    const buffV = new DataView(buff.buffer);
    return buffV.getUint32(0, true);
  }
  function r1csReadULE256toFr() {
    const buff = sR1cs.slice(r1csPos, r1csPos+32);
    r1csPos += 32;
    const buffV = curve.Fr.fromRprLE(buff);
    return buffV;
  }
  for (let c = 0; c < n; c++) {
    const nA = r1csReadULE32toUInt();
    const coefsA = new Array(nA);
    const idsA = new Array(nA);
    for (let i=0; i<nA; i++) {
      idsA[i] = r1csReadULE32toUInt();
      coefsA[i] = r1csReadULE256toFr();
    }
    u[c] = coefsA;
    uId[c] = idsA;

    const nB = r1csReadULE32toUInt();
    const coefsB = new Array(nB);
    const idsB = new Array(nB);
    for (let i=0; i<nB; i++) {
      idsB[i] = r1csReadULE32toUInt();
      coefsB[i] = r1csReadULE256toFr();
    }
    v[c] = coefsB;
    vId[c] = idsB;

    const nC = r1csReadULE32toUInt();
    const coefsC = new Array(nC);
    const idsC = new Array(nC);
    for (let i=0; i<nC; i++) {
      idsC[i] = r1csReadULE32toUInt();
      coefsC[i] = r1csReadULE256toFr();
    }
    w[c] = coefsC;
    wId[c] = idsC;
  }
  results.u = u;
  results.uId = uId;
  results.v = v;
  results.vId = vId;
  results.w = w;
  results.wId = wId;
  return results;
}

export async function readWtnsHeader(fd, sections) {
  await binFileUtils.startReadUniqueSection(fd, sections, 1);
  const n8 = await fd.readULE32();
  const q = await binFileUtils.readBigInt(fd, n8);
  const nWitness = await fd.readULE32();
  await binFileUtils.endReadSection(fd);

  return {n8, q, nWitness};
}

export async function readWtns(fileName) {
  const {fd, sections} = await binFileUtils.readBinFile(fileName, 'wtns', 2);

  const {n8, nWitness} = await readWtnsHeader(fd, sections);

  await binFileUtils.startReadUniqueSection(fd, sections, 2);
  const res = [];
  for (let i=0; i<nWitness; i++) {
    const v = await binFileUtils.readBigInt(fd, n8);
    res.push(v);
  }
  await binFileUtils.endReadSection(fd);

  await fd.close();

  return res;
}

export async function readOpList(fd) {
  const ListSize = await fd.readULE32();
  const OpList = new Array(ListSize);

  for (let k=0; k<ListSize; k++) {
    OpList[k] = await fd.readULE32();
  }

  return OpList;
}

export async function readWireList(fd) {
  const listSize = await fd.readULE32();
  const result = new Array(listSize);
  for (let i=0; i<listSize; i++) {
    result[i] = [await fd.readULE32(), await fd.readULE32()];
  }

  return result;
}

export async function readIndSet(fd) {
  const setSize = await fd.readULE32();
  const IndSet = {};
  IndSet.set=[];
  for (let i=0; i<setSize; i++) {
    IndSet.set.push(await fd.readULE32());
  }
  // PreImages[i] = row^(-1)[m_i] = {(k1, i1), (k2, i2), (k3, i3), ...},
  // where the index i denotes the i-th wire of a derived (chained) circuit,
  // and m_i = (k', i') denotes the i'-th (output) wire in the k'-th subcircuit,
  // which is a linear combination of the i1-th, i2-th, i3-th,
  // and input wires respectively from the k1-th, k2-th, k3-th, and subcircuits.
  const PreImages = new Array(setSize);
  let PreImgSize;
  for (let i=0; i<setSize; i++) {
    PreImgSize = await fd.readULE32();
    PreImages[i] = new Array(PreImgSize);
    for (let j=0; j<PreImgSize; j++) {
      PreImages[i][j] = [await fd.readULE32(), await fd.readULE32()];
    }
  }
  IndSet.PreImgs=PreImages;

  return IndSet;
}

// read only urs params from urs or crs file
// crs params are read by readRS()
export async function readRSParams(fd, sections) {
  const rs = {};

  rs.protocol = 'groth16';

  // Read parameters
  await binFileUtils.startReadUniqueSection(fd, sections, 2);

  // Group parameters
  const n8q = await fd.readULE32();
  rs.n8q = n8q;
  rs.q = await binFileUtils.readBigInt(fd, n8q);

  const n8r = await fd.readULE32();
  rs.n8r = n8r;
  rs.r = await binFileUtils.readBigInt(fd, n8r);
  rs.curve = await getCurve(rs.q);

  // Instruction set constants
  const sD = await fd.readULE32();
  rs.sD = sD;
  rs.r1cs = new Array(sD);
  for (let i=0; i<sD; i++) {
    rs.r1cs[i] = {};
    rs.r1cs[i].m = await fd.readULE32();
    rs.r1cs[i].mPublic = await fd.readULE32();
    rs.r1cs[i].mPrivate = rs.r1cs[i].m - rs.r1cs[i].mPublic;
    rs.r1cs[i].nConstraints = await fd.readULE32();
  }

  // QAP constants
  rs.n = await fd.readULE32();
  rs.sMax = await fd.readULE32();
  rs.omegaX = rs.curve.Fr.e(await binFileUtils.readBigInt(fd, n8r));
  rs.omegaY = rs.curve.Fr.e(await binFileUtils.readBigInt(fd, n8r));

  await binFileUtils.endReadSection(fd);

  return rs;
}

// rsType?crs:urs
export async function readRS(fd, sections, rsParam, rsType, toObject) {
  const curve = rsParam.curve;
  const n = rsParam.n;
  const sMax = rsParam.sMax;
  const sD = rsParam.sD;
  const rsContent = {};

  // Read sigmaG section
  await binFileUtils.startReadUniqueSection(fd, sections, 3);
  rsContent.sigmaG = {};
  rsContent.sigmaG.vk1AlphaU = await readG1(fd, curve, toObject);
  rsContent.sigmaG.vk1AlphaV = await readG1(fd, curve, toObject);
  rsContent.sigmaG.vk1GammaA = await readG1(fd, curve, toObject);

  const vk1XyPows = Array.from(Array(n), () => new Array(sMax));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < sMax; j++) {
      vk1XyPows[i][j] = await readG1(fd, curve, toObject);
    }
  }
  rsContent.sigmaG.vk1XyPows = vk1XyPows;

  const vk1XyPowsT1g = new BigBuffer((n-1)*sMax*curve.G1.F.n8*2);
  await fd.readToBuffer(vk1XyPowsT1g, 0, (n-1)*sMax*curve.G1.F.n8*2);
  /*
  const vk1XyPowsT1g = Array.from(Array(n-1), () => new Array(sMax));
  for (let i = 0; i < n-1; i++) {
    for (let j=0; j<sMax; j++) {
      vk1XyPowsT1g[i][j] = await readG1(fd, curve, toObject);
    }
  }
  */
  rsContent.sigmaG.vk1XyPowsT1g = vk1XyPowsT1g;

  const vk1XyPowsT2g = new BigBuffer((2*n-1)*(sMax-1)*curve.G1.F.n8*2);
  await fd.readToBuffer(vk1XyPowsT2g, 0, (2*n-1)*(sMax-1)*curve.G1.F.n8*2)
  /*
  const vk1XyPowsT2g = Array.from(Array(2*n-1), () => new Array(sMax-1));
  for (let i = 0; i < 2*n-1; i++) {
    for (let j=0; j<sMax-1; j++) {
      vk1XyPowsT2g[i][j] = await readG1(fd, curve, toObject);
    }
  }
  */
  rsContent.sigmaG.vk1XyPowsT2g = vk1XyPowsT2g;

  await binFileUtils.endReadSection(fd);
  // End of reading sigmaG

  // Read sigmaH section
  const a = await binFileUtils.startReadUniqueSection(fd, sections, 4);
  rsContent.sigmaH = {};
  rsContent.sigmaH.vk2AlphaU = await readG2(fd, curve, toObject);
  rsContent.sigmaH.vk2GammaZ = await readG2(fd, curve, toObject);
  rsContent.sigmaH.vk2GammaA = await readG2(fd, curve, toObject);
  const vk2XyPows = Array.from(Array(n), () => new Array(sMax));
  for (let i = 0; i < n; i++) {
    for (let j=0; j<sMax; j++) {
      vk2XyPows[i][j] = await readG2(fd, curve, toObject);
    }
  }
  rsContent.sigmaH.vk2XyPows = vk2XyPows;
  await binFileUtils.endReadSection(fd);
  // End of reading sigmaH

  if (!rsType) { // urs
    // Read thetaG[k] sections for k in [0, 1, ..., sD]
    rsContent.thetaG = {};
    const vk1Uxy = new Array(sD);
    const vk1Vxy = new Array(sD);
    const vk2Vxy = new Array(sD);
    const vk1Zxy = new Array(sD);
    const vk1Axy = new Array(sD);
    for (let k=0; k<sD; k++) {
      const mK = rsParam.r1cs[k].m;
      const mPublic = rsParam.r1cs[k].mPublic;
      const mPrivate = rsParam.r1cs[k].mPrivate;
      const vk1Uxy2d = Array.from(Array(mK), () => new Array(sMax));
      const vk1Vxy2d = Array.from(Array(mK), () => new Array(sMax));
      const vk2Vxy2d = Array.from(Array(mK), () => new Array(sMax));
      const vk1Zxy2d = Array.from(Array(mPublic), () => new Array(sMax));
      const vk1Axy2d = Array.from(Array(mPrivate), () => new Array(sMax));
      await binFileUtils.startReadUniqueSection(fd, sections, 5+k);
      for (let i=0; i < mK; i++) {
        for (let j=0; j < sMax; j++) {
          vk1Uxy2d[i][j] = await readG1(fd, curve, toObject);
        }
      }
      for (let i=0; i < mK; i++) {
        for (let j=0; j < sMax; j++) {
          vk1Vxy2d[i][j] = await readG1(fd, curve, toObject);
        }
      }
      for (let i=0; i < mK; i++) {
        for (let j=0; j < sMax; j++) {
          vk2Vxy2d[i][j] = await readG2(fd, curve, toObject);
        }
      }
      for (let i=0; i < mPublic; i++) {
        for (let j=0; j < sMax; j++) {
          vk1Zxy2d[i][j] = await readG1(fd, curve, toObject);
        }
      }
      for (let i=0; i < mPrivate; i++) {
        for (let j=0; j < sMax; j++) {
          vk1Axy2d[i][j] = await readG1(fd, curve, toObject);
        }
      }
      await binFileUtils.endReadSection(fd);
      vk1Uxy[k] = vk1Uxy2d;
      vk1Vxy[k] = vk1Vxy2d;
      vk2Vxy[k] = vk2Vxy2d;
      vk1Zxy[k] = vk1Zxy2d;
      vk1Axy[k] = vk1Axy2d;
    }
    rsContent.thetaG.vk1Uxy = vk1Uxy;
    rsContent.thetaG.vk1Vxy = vk1Vxy;
    rsContent.thetaG.vk2Vxy = vk2Vxy;
    rsContent.thetaG.vk1Zxy = vk1Zxy;
    rsContent.thetaG.vk1Axy = vk1Axy;
  } else if (rsType==1) { // crs
    rsContent.crs ={};
    await binFileUtils.startReadUniqueSection(fd, sections, 5);
    rsContent.crs.param={};
    const m = await fd.readULE32();
    rsContent.crs.param.m = m;
    const mPublic = await fd.readULE32();
    rsContent.crs.param.mPublic = mPublic;
    const mPrivate = await fd.readULE32();
    rsContent.crs.param.mPrivate = mPrivate;

    /*
    const vk1Uxy1d = new Array(m);
    const vk1Vxy1d = new Array(m);
    const vk1Zxy1d = new Array(mPublic);
    const vk1Axy1d = new Array(mPrivate);
    const vk2Vxy1d = new Array(m);

    for (let i=0; i<m; i++) {
      vk1Uxy1d[i] = await readG1(fd, curve, toObject);
    }
    for (let i=0; i<m; i++) {
      vk1Vxy1d[i] = await readG1(fd, curve, toObject);
    }
    for (let i=0; i<mPublic; i++) {
      vk1Zxy1d[i] = await readG1(fd, curve, toObject);
    }
    // vk1_zxy[i] represents the IdSetV.set(i)-th wire of circuit
    for (let i=0; i<mPrivate; i++) {
      vk1Axy1d[i] = await readG1(fd, curve, toObject);
    }
    // vk1_axy[i] represents the IdSetP.set(i)-th wire of circuit
    for (let i=0; i<m; i++) {
      vk2Vxy1d[i] = await readG2(fd, curve, toObject);
    }
    */

    const vk1Uxy1d = new BigBuffer(m*curve.G1.F.n8*2);
    const vk1Vxy1d = new BigBuffer(m*curve.G1.F.n8*2);
    const vk1Zxy1d = new BigBuffer(mPublic*curve.G1.F.n8*2);
    const vk1Axy1d = new BigBuffer(mPrivate*curve.G1.F.n8*2);
    const vk2Vxy1d = new BigBuffer(m*curve.G2.F.n8*2);
    await fd.readToBuffer(vk1Uxy1d, 0, m*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Vxy1d, 0, m*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Zxy1d, 0, mPublic*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Axy1d, 0, mPrivate*curve.G1.F.n8*2);
    await fd.readToBuffer(vk2Vxy1d, 0, m*curve.G2.F.n8*2);
    

    await binFileUtils.endReadSection(fd);

    rsContent.crs.vk1Uxy1d = vk1Uxy1d;
    rsContent.crs.vk1Vxy1d = vk1Vxy1d;
    rsContent.crs.vk1Zxy1d = vk1Zxy1d;
    rsContent.crs.vk1Axy1d = vk1Axy1d;
    rsContent.crs.vk2Vxy1d = vk2Vxy1d;
  }

  return rsContent;
}


export async function readZKey(fileName, toObject) {
  const {fd, sections} = await binFileUtils.readBinFile(fileName, 'zkey', 1);

  const zkey = await readHeader(fd, sections, toObject);

  const Fr = new F1Field(zkey.r);
  const Rr = Scalar.mod(Scalar.shl(1, zkey.n8r*8), zkey.r);
  const Rri = Fr.inv(Rr);
  const Rri2 = Fr.mul(Rri, Rri);

  const curve = await getCurve(zkey.q);

  // Read IC Section
  await binFileUtils.startReadUniqueSection(fd, sections, 3);
  zkey.IC = [];
  for (let i=0; i<= zkey.nPublic; i++) {
    const P = await readG1(fd, curve, toObject);
    zkey.IC.push(P);
  }
  await binFileUtils.endReadSection(fd);


  // Read Coefs
  await binFileUtils.startReadUniqueSection(fd, sections, 4);
  const nCCoefs = await fd.readULE32();
  zkey.ccoefs = [];
  for (let i=0; i<nCCoefs; i++) {
    const m = await fd.readULE32();
    const c = await fd.readULE32();
    const s = await fd.readULE32();
    const v = await readFr2(toObject);
    zkey.ccoefs.push({
      matrix: m,
      constraint: c,
      signal: s,
      value: v,
    });
  }
  await binFileUtils.endReadSection(fd);

  // Read A points
  await binFileUtils.startReadUniqueSection(fd, sections, 5);
  zkey.A = [];
  for (let i=0; i<zkey.nVars; i++) {
    const A = await readG1(fd, curve, toObject);
    zkey.A[i] = A;
  }
  await binFileUtils.endReadSection(fd);


  // Read B1
  await binFileUtils.startReadUniqueSection(fd, sections, 6);
  zkey.B1 = [];
  for (let i=0; i<zkey.nVars; i++) {
    const B1 = await readG1(fd, curve, toObject);

    zkey.B1[i] = B1;
  }
  await binFileUtils.endReadSection(fd);


  // Read B2 points
  await binFileUtils.startReadUniqueSection(fd, sections, 7);
  zkey.B2 = [];
  for (let i=0; i<zkey.nVars; i++) {
    const B2 = await readG2(fd, curve, toObject);
    zkey.B2[i] = B2;
  }
  await binFileUtils.endReadSection(fd);


  // Read C points
  await binFileUtils.startReadUniqueSection(fd, sections, 8);
  zkey.C = [];
  for (let i=zkey.nPublic+1; i<zkey.nVars; i++) {
    const C = await readG1(fd, curve, toObject);

    zkey.C[i] = C;
  }
  await binFileUtils.endReadSection(fd);


  // Read H points
  await binFileUtils.startReadUniqueSection(fd, sections, 9);
  zkey.hExps = [];
  for (let i=0; i<zkey.domainSize; i++) {
    const H = await readG1(fd, curve, toObject);
    zkey.hExps.push(H);
  }
  await binFileUtils.endReadSection(fd);

  await fd.close();

  return zkey;

  async function readFr2(/* toObject */) {
    const n = await binFileUtils.readBigInt(fd, zkey.n8r);
    return Fr.mul(n, Rri2);
  }
}
