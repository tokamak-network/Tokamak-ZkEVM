'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Blake2b = require('blake2b-wasm');
var readline = require('readline');
var ffjavascript = require('ffjavascript');
var crypto = require('crypto');
var binFileUtils = require('@iden3/binfileutils');
var chai = require('chai');
var fs = require('fs');
var path = require('path');
var fastFile = require('fastfile');
var appRootPath = require('app-root-path');
var hash = require('js-sha3');
var r1csfile = require('r1csfile');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var Blake2b__default = /*#__PURE__*/_interopDefaultLegacy(Blake2b);
var readline__default = /*#__PURE__*/_interopDefaultLegacy(readline);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var binFileUtils__namespace = /*#__PURE__*/_interopNamespace(binFileUtils);
var chai__default = /*#__PURE__*/_interopDefaultLegacy(chai);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fastFile__namespace = /*#__PURE__*/_interopNamespace(fastFile);
var appRootPath__default = /*#__PURE__*/_interopDefaultLegacy(appRootPath);
var hash__default = /*#__PURE__*/_interopDefaultLegacy(hash);

/* global window */


function askEntropy() {
  if (process.browser) {
    return window.prompt('Enter a random text. (Entropy): ', '');
  } else {
    const rl = readline__default["default"].createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
          'Enter a random text. (Entropy): ',
          (input) => resolve(input),
      );
    });
  }
}

async function getRandomRng(entropy) {
  // Generate a random Rng
  while (!entropy) {
    entropy = await askEntropy();
  }
  const hasher = Blake2b__default["default"](64);
  hasher.update(crypto__default["default"].randomBytes(64));
  const enc = new TextEncoder(); // always utf-8
  hasher.update(enc.encode(entropy));
  const hash = Buffer.from(hasher.digest());

  const seed = [];
  for (let i=0; i<8; i++) {
    seed[i] = hash.readUInt32BE(i*4);
  }
  const rng = new ffjavascript.ChaCha(seed);
  return rng;
}

ffjavascript.Scalar.e('73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001', 16);
ffjavascript.Scalar.e('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const bls12381q = ffjavascript.Scalar.e('1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab', 16);
const bn128q = ffjavascript.Scalar.e('21888242871839275222246405745257275088696311157297823662689037894645226208583');

async function getCurveFromQ(q) {
  let curve;
  if (ffjavascript.Scalar.eq(q, bn128q)) {
    curve = await ffjavascript.buildBn128();
  } else if (ffjavascript.Scalar.eq(q, bls12381q)) {
    curve = await ffjavascript.buildBls12381();
  } else {
    throw new Error(`Curve not supported: ${ffjavascript.Scalar.toString(q)}`);
  }
  return curve;
}

async function getCurveFromName(name) {
  let curve;
  const normName = normalizeName(name);
  if (['BN128', 'BN254', 'ALTBN128'].indexOf(normName) >= 0) {
    curve = await ffjavascript.buildBn128();
  } else if (['BLS12381'].indexOf(normName) >= 0) {
    curve = await ffjavascript.buildBls12381();
  } else {
    throw new Error(`Curve not supported: ${name}`);
  }
  return curve;

  function normalizeName(n) {
    return n.toUpperCase().match(/[A-Za-z0-9]+/g).join('');
  }
}

// Format

async function writeG1(fd, curve, p) {
  const buff = new Uint8Array(curve.G1.F.n8*2);
  curve.G1.toRprLEM(buff, 0, p);
  await fd.write(buff);
}

async function writeG2(fd, curve, p) {
  const buff = new Uint8Array(curve.G2.F.n8*2);
  curve.G2.toRprLEM(buff, 0, p);
  await fd.write(buff);
}

async function readG1(fd, curve, toObject) {
  const buff = await fd.read(curve.G1.F.n8*2);
  const res = curve.G1.fromRprLEM(buff, 0);
  return toObject ? curve.G1.toObject(res) : res;
}

async function readG2(fd, curve, toObject) {
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
async function processConstraints(curve, n, sR1cs) {
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

async function readOpList(fd) {
  const ListSize = await fd.readULE32();
  const OpList = new Array(ListSize);

  for (let k=0; k<ListSize; k++) {
    OpList[k] = await fd.readULE32();
  }

  return OpList;
}

async function readWireList(fd) {
  const listSize = await fd.readULE32();
  const result = new Array(listSize);
  for (let i=0; i<listSize; i++) {
    result[i] = [await fd.readULE32(), await fd.readULE32()];
  }

  return result;
}

async function readIndSet(fd) {
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
async function readRSParams(fd, sections) {
  const rs = {};

  rs.protocol = 'groth16';

  // Read parameters
  await binFileUtils__namespace.startReadUniqueSection(fd, sections, 2);

  // Group parameters
  const n8q = await fd.readULE32();
  rs.n8q = n8q;
  rs.q = await binFileUtils__namespace.readBigInt(fd, n8q);

  const n8r = await fd.readULE32();
  rs.n8r = n8r;
  rs.r = await binFileUtils__namespace.readBigInt(fd, n8r);
  rs.curve = await getCurveFromQ(rs.q);

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
  rs.omegaX = rs.curve.Fr.e(await binFileUtils__namespace.readBigInt(fd, n8r));
  rs.omegaY = rs.curve.Fr.e(await binFileUtils__namespace.readBigInt(fd, n8r));

  await binFileUtils__namespace.endReadSection(fd);

  return rs;
}

// rsType?crs:urs
async function readRS(fd, sections, rsParam, rsType, toObject) {
  const curve = rsParam.curve;
  const n = rsParam.n;
  const sMax = rsParam.sMax;
  const sD = rsParam.sD;
  const rsContent = {};

  // Read sigmaG section
  await binFileUtils__namespace.startReadUniqueSection(fd, sections, 3);
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

  const vk1XyPowsT1g = new ffjavascript.BigBuffer((n-1)*sMax*curve.G1.F.n8*2);
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

  const vk1XyPowsT2g = new ffjavascript.BigBuffer((2*n-1)*(sMax-1)*curve.G1.F.n8*2);
  await fd.readToBuffer(vk1XyPowsT2g, 0, (2*n-1)*(sMax-1)*curve.G1.F.n8*2);
  /*
  const vk1XyPowsT2g = Array.from(Array(2*n-1), () => new Array(sMax-1));
  for (let i = 0; i < 2*n-1; i++) {
    for (let j=0; j<sMax-1; j++) {
      vk1XyPowsT2g[i][j] = await readG1(fd, curve, toObject);
    }
  }
  */
  rsContent.sigmaG.vk1XyPowsT2g = vk1XyPowsT2g;

  await binFileUtils__namespace.endReadSection(fd);
  // End of reading sigmaG

  // Read sigmaH section
  await binFileUtils__namespace.startReadUniqueSection(fd, sections, 4);
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
  await binFileUtils__namespace.endReadSection(fd);
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
      await binFileUtils__namespace.startReadUniqueSection(fd, sections, 5+k);
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
      await binFileUtils__namespace.endReadSection(fd);
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
    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 5);
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

    const vk1Uxy1d = new ffjavascript.BigBuffer(m*curve.G1.F.n8*2);
    const vk1Vxy1d = new ffjavascript.BigBuffer(m*curve.G1.F.n8*2);
    const vk1Zxy1d = new ffjavascript.BigBuffer(mPublic*curve.G1.F.n8*2);
    const vk1Axy1d = new ffjavascript.BigBuffer(mPrivate*curve.G1.F.n8*2);
    const vk2Vxy1d = new ffjavascript.BigBuffer(m*curve.G2.F.n8*2);
    await fd.readToBuffer(vk1Uxy1d, 0, m*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Vxy1d, 0, m*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Zxy1d, 0, mPublic*curve.G1.F.n8*2);
    await fd.readToBuffer(vk1Axy1d, 0, mPrivate*curve.G1.F.n8*2);
    await fd.readToBuffer(vk2Vxy1d, 0, m*curve.G2.F.n8*2);
    

    await binFileUtils__namespace.endReadSection(fd);

    rsContent.crs.vk1Uxy1d = vk1Uxy1d;
    rsContent.crs.vk1Vxy1d = vk1Vxy1d;
    rsContent.crs.vk1Zxy1d = vk1Zxy1d;
    rsContent.crs.vk1Axy1d = vk1Axy1d;
    rsContent.crs.vk2Vxy1d = vk2Vxy1d;
  }

  return rsContent;
}

/**
 * Start off a timer
 * @return {Date}
 */
function start() {
  return new Date();
}
/**
 * Get the elapsed time since starttime
 * @param  {Date} startTime
 * @return {number}
 */
function end(startTime) {
  return new Date() - startTime;
}

/**
 *
 * @param {*} curve
 * @param {*} lagrangeBasis
 * @param {*} r1cs
 * @param {*} sR1cs
 * @returns
 */
async function buildR1csPolys(curve, lagrangeBasis, r1cs, sR1cs) {
  const Fr = curve.Fr;
  const ParamR1cs = r1cs;

  let lagrangePoly;

  let m;
  if (ParamR1cs.nVars === undefined) {
    m = ParamR1cs.m;
  } else {
    m = ParamR1cs.nVars;
  }
  const n = ParamR1cs.nConstraints;

  const uX = new Array(m);
  const vX = new Array(m);
  const wX = new Array(m);

  const constraints = await processConstraints(curve, n, sR1cs);
  const u = constraints.u;
  const uId = constraints.uId;
  const v = constraints.v;
  const vId = constraints.vId;
  const w = constraints.w;
  const wId = constraints.wId;

  for (let i=0; i<m; i++) {
    uX[i] = [[Fr.zero]];
    vX[i] = [[Fr.zero]];
    wX[i] = [[Fr.zero]];
  }
  for (let i=0; i<ParamR1cs.nConstraints; i++) {
    const uIdElement = uId[i];
    const uCoefs = u[i];
    const vIdElement = vId[i];
    const vCoefs = v[i];
    const wIdElement = wId[i];
    const wCoefs = w[i];
    for (let j=0; j<uIdElement.length; j++) {
      const uIndex=uIdElement[j];
      if (uIndex>=0) {
        lagrangePoly = await scalePoly(Fr, lagrangeBasis[i], uCoefs[j]);
        uX[uIndex] = await addPoly(Fr, uX[uIndex], lagrangePoly);
      }
    }
    for (let j=0; j<vIdElement.length; j++) {
      const vIndex=vIdElement[j];
      if (vIndex>=0) {
        lagrangePoly = await scalePoly(Fr, lagrangeBasis[i], vCoefs[j]);
        vX[vIndex] = await addPoly(Fr, vX[vIndex], lagrangePoly);
      }
    }
    for (let j=0; j<wIdElement.length; j++) {
      const wIndex=wIdElement[j];
      if (wIndex>=0) {
        lagrangePoly = await scalePoly(Fr, lagrangeBasis[i], wCoefs[j]);
        wX[wIndex] = await addPoly(Fr, wX[wIndex], lagrangePoly);
      }
    }
  }

  return {uX, vX, wX};
}

async function buildCommonPolys(rs) {
  const curve = rs.curve;
  const Fr = curve.Fr;
  const n = rs.n;
  const omegaX = await Fr.e(rs.omegaX);

  const lagrangeBasis = new Array(n);
  for (let i = 0; i < n; i++) {
    const terms = Array.from(Array(n), () => new Array(1));
    const multiplier = await Fr.exp(Fr.inv(omegaX), i);
    terms[0][0] = Fr.one;
    for (let j = 1; j < n; j++) {
      terms[j][0] = await Fr.mul(terms[j - 1][0], multiplier);
    }
    lagrangeBasis[i] = await scalePoly(Fr, terms, Fr.inv(Fr.e(n)));
  }

  return lagrangeBasis;
}

/**
 *
 * @param {*} coefs a matrix of Fr elements
 * @returns
 */
function _polyCheck(coefs) {
  let numVars = 0;
  let currObject = coefs;
  while (Array.isArray(currObject)) {
    numVars += 1;
    currObject = currObject[0];
  }
  if (numVars != 2) {
    throw new Error(
        `A polynomial is not bivariate (coefs is ${numVars}-dimensional)`,
    );
  }
  const N_X = coefs.length;
  const N_Y = coefs[0].length;
  for (let i=1; i<N_X; i++) {
    if (N_Y != coefs[i].length) {
      throw new Error(`Invalid format of coefficient matrix for a polynomial`);
    }
  }
  return {N_X, N_Y};
}

async function evalPoly(Fr, coefs, x, y) {
  const {N_X: N_X, N_Y: N_Y} = _polyCheck(coefs);

  coefs = _autoTransFromObject(Fr, coefs);
  let sum = Fr.zero;
  for (let i = 0; i < N_X; i++) {
    for (let j = 0; j < N_Y; j++) {
      const xyPows = Fr.mul(await Fr.exp(x, i), await Fr.exp(y, j));
      const term = Fr.mul(xyPows, coefs[i][j]);
      sum = Fr.add(sum, term);
    }
  }
  return sum;
}

/**
 * Elemetwise multiplication of the coefficients
 * of a polynomial along with a directed variable with a filtering vector
 * @param {*} Fr
 * @param {*} coefs1
 * @param {*} vect
 * @param {*} dir Y:X
 * @returns
 */
async function filterPoly(Fr, coefs1, vect, dir) {
  const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
  if ( !((!dir) && (N1_X == vect.length) || (dir) && (N1_Y == vect.length)) ) {
    throw new Error(
        'filterPoly: the lengths of two coefficients are not equal',
    );
  }

  coefs1 = _autoTransFromObject(Fr, coefs1);

  const res = Array.from(Array(N1_X), () => new Array(N1_Y));
  for (let i = 0; i < N1_X; i++) {
    for (let j = 0; j < N1_Y; j++) {
      let scalerId;
      if (!dir) {
        scalerId = i;
      } else {
        scalerId = j;
      }
      let target = coefs1[i][j];
      if (target === undefined) {
        target = Fr.one;
      }
      res[i][j] = Fr.mul(target, vect[scalerId]);
    }
  }
  return res;
}

/**
 *
 * @param {*} Fr
 * @param {*} coefs
 * @param {*} scaler scaler in Fr
 * @returns
 */
async function scalePoly(Fr, coefs, scaler) {
  if(Fr.eq(scaler, Fr.zero)) return [[Fr.zero]];
  if(Fr.eq(scaler, Fr.one)) return coefs;
  const nSlotX = coefs.length;
  const nSlotY = coefs[0].length;

  const res = Array.from(Array(nSlotX), () => new Array(nSlotY));
  for (let i = 0; i < nSlotX; i++) {
    for (let j = 0; j < nSlotY; j++) {
      let target = coefs[i][j];
      if (target === undefined) {
        target = Fr.one;
      }
      res[i][j] = Fr.mul(target, scaler);
    }
  }
  return res;
}

async function addPoly(Fr, coefs1, coefs2) {
  const N1_X = coefs1.length;
  const N1_Y = coefs1[0].length;
  const N2_X = coefs2.length;
  const N2_Y = coefs2[0].length;

  const N3_X = Math.max(N1_X, N2_X);
  const N3_Y = Math.max(N1_Y, N2_Y);

  const res = Array.from(Array(N3_X), () => new Array(N3_Y));

  for (let i = 0; i < N3_X; i++) {
    for (let j = 0; j < N3_Y; j++) {
      if (coefs1[i] == undefined){
        if (coefs2[i][j] == undefined){
          res[i][j] = Fr.zero;
        } else {
          res[i][j] = coefs2[i][j];
        }
      } else if (coefs2[i] == undefined){
        if (coefs1[i][j] == undefined){
          res[i][j] = Fr.zero;
        } else {
          res[i][j] = coefs1[i][j];
        }
      } else {
        if (coefs1[i][j] !== undefined && coefs2[i][j] !== undefined){
          res[i][j] = Fr.add(coefs1[i][j], coefs2[i][j]);
        } else if(coefs1[i][j] == undefined){
          res[i][j] = coefs2[i][j];
        } else if(coefs2[i][j] == undefined){
          res[i][j] = coefs1[i][j];
        }
      }
    }
  }
  return res;
}

async function subPoly(Fr, coefs1, coefs2) {
  const N1_X = coefs1.length;
  const N1_Y = coefs1[0].length;
  const N2_X = coefs2.length;
  const N2_Y = coefs2[0].length;

  const N3_X = Math.max(N1_X, N2_X);
  const N3_Y = Math.max(N1_Y, N2_Y);

  const res = new Array(N3_X);
  for (let i = 0; i < N3_X; i++) {
    const temprow = new Array(N3_Y);
    for (let j = 0; j < N3_Y; j++) {
      let _arg1 = Fr.zero;
      if (coefs1[i] !== undefined) {
        if (coefs1[i][j] !== undefined) {
          _arg1 = coefs1[i][j];
        }
      }
      let _arg2 = Fr.zero;
      if (coefs2[i] !== undefined) {
        if (coefs2[i][j] !== undefined) {
          _arg2 = coefs2[i][j];
        }
      }
      temprow[j] = Fr.sub(_arg1, _arg2);
    }
    res[i] = temprow;
  }
  return res;
}

function _transToObject(Fr, coefs) {
  if ( (typeof coefs[0][0] == 'bigint') || (coefs[0][0] === undefined) ) {
    return coefs;
  } else if (typeof coefs[0][0] != 'object') {
    throw new Error('transFromObject: unexpected input type');
  }

  const res = Array.from(Array(coefs.length), () => new Array(coefs[0].length));
  for (let i = 0; i < coefs.length; i++) {
    for (let j = 0; j < coefs[0].length; j++) {
      res[i][j] = Fr.toObject(coefs[i][j]);
    }
  }
  return res;
}

function _autoTransFromObject(Fr, coefs) {
  if ( (typeof coefs[0][0] == 'object') || (coefs[0][0] === undefined) ) {
    return coefs;
  } else if (typeof coefs[0][0] != 'bigint') {
    throw new Error('autoTransFromObject: unexpected input type');
  }

  const res = Array.from(Array(coefs.length), () => new Array(coefs[0].length));
  for (let i = 0; i < coefs.length; i++) {
    for (let j = 0; j < coefs[0].length; j++) {
      res[i][j] = Fr.fromObject(coefs[i][j]);
    }
  }
  return res;
}

function _transpose(A){
  return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
  /*
  const res = Array.from(
    Array(A.length),
    () => new Array(A[0].length),
  );
  for (let i = 0; i < res.length; i++) {
    for (let j = 0; j < res[0].length; j++) {
      res[]
    }
  }
  */
}

async function QapDiv(Fr, QAPcoefs, objectFlag) {
  // Assume divisors are t(X) = X^(n-1) - 1, t(Y) = Y^(s_{max}-1) - 1
  // p(X,Y) = t(Y)*HY(X,Y) + r(X)
  // r(X) = t(X)*HX(X)
  let P = reduceDimPoly(Fr, _autoTransFromObject(Fr, QAPcoefs));
  const PXDeg = P.length - 1;
  const PYDeg = P[0].length - 1;
  const nX = (PXDeg + 2)/2;
  const nY = (PYDeg + 2)/2;
  if (Math.round(nX) != nX || Math.round(nY) != nY){
    throw new Error(`Error in QapDivOnY: X degree is not equal to 2n-2`)
  }
  if (P.length != 2*nX-1 || P[0].length != 2*nY-1) {
    throw new Error(`Error in QapDivOnY: QAP polynomial degree mismatch`)
  }

  P = _transpose(P);
  let P1, P2, P3;
  P3 = P.slice(0, nY-1);
  P2 = [P[nY-1]];
  P1 = P.slice(nY, 2*nY-1);

  const ZeroVector = Array.from(
    Array(1),
    () => new Array(P1[0].length),
  );
  for (let j = 0; j < P1[0].length; j++) {
    ZeroVector[0][j] = Fr.zero;
  }
  let SL = P3;
  SL.push(...P2);
  let SR = P1;
  SR.push(...ZeroVector);
  const S = await addPoly(Fr, SL, SR);

  const R = _transpose(S);
  let R1, R2, R3;
  R3 = R.slice(0, nX-1);
  R2 = [R[nX-1]];
  R1 = R.slice(nX, 2*nX-1);

  for (let j = 0; j < R1[0].length; j++) {
    if (await Fr.eq(R2[0][j], Fr.zero) == false){
      throw new Error(`Error in QapDivOnY: P(X,Y) is not divisible (1)`)
    }
    for (let i = 0; i < R1.length; i++) {
      if ((await Fr.eq(R1[i][j], await Fr.neg(R3[i][j])) == false)){
        throw new Error(`Error in QapDivOnY: P(X,Y) is not divisible (2)`)
      }
    }
  }

  const HY = _transpose(P1);
  const HX = R1;

  if (!((objectFlag === undefined) || (objectFlag == false))) {
    HX = _transToObject(Fr, HX);
    HY = _transToObject(Fr, HY);
  }

  //return {HX, HY};
  
  const HY_buff = new ffjavascript.BigBuffer((2*nX-1)*(nY-1) * Fr.n8);
  const buff_temp = new Uint8Array(Fr.n8);
  for (let i = 0; i < 2*nX-1; i++){
    for (let j = 0; j < nY-1; j++){
      await Fr.toRprLE(buff_temp, 0, HY[i][j]);
      HY_buff.set(buff_temp, (j + (nY-1)*i) * Fr.n8);
    }
  }
  const HX_buff = new ffjavascript.BigBuffer((nX-1)*nY * Fr.n8);
  for (let i = 0; i < nX-1; i++){
    for (let j = 0; j < nY; j++){
      await Fr.toRprLE(buff_temp, 0, HX[i][j]);
      HX_buff.set(buff_temp, (j + nY*i) * Fr.n8);
    }
  }

  return {HX_buff, HY_buff};
}

/**
 *
 * @param {*} Fr
 * @param {*} coefs
 * @param {*} dir
 * @return output order is the highest order in dictionary order
 */
function _findOrder(Fr, coefs, dir) {
  const N_X = coefs.length;
  const N_Y = coefs[0].length;
  const NumEl=N_X*N_Y;
  let xId;
  let yId;
  let coef;
  let modular;
  if ( (dir === undefined) || (dir == 0) ) {
    modular = N_Y;
  } else if ( dir == 1 ) {
    modular = N_X;
  } else {
    throw new Error('findOrder: unexpected direction');
  }
  for (let i=NumEl-1; i>=0; i--) {
    if ( (dir === undefined) || (dir == 0) ) {
      xId = Math.floor(i/modular);
      yId = i % modular;
    } else {
      yId = Math.floor(i/modular);
      xId = i % modular;
    }
    coef = coefs[xId][yId];
    if (!Fr.eq(coef, Fr.zero)) {
      break;
    }
  }
  return {xId, yId, coef};
}
/**
 *
 * @param {*} Fr
 * @param {*} coefs
 * @return highest orders of respective variables
 */
function _orderPoly(Fr, coefs) {
  coefs = _autoTransFromObject(Fr, coefs);
  const {xId: xOrder} = _findOrder(Fr, coefs, 0);
  const {yId: yOrder} = _findOrder(Fr, coefs, 1);
  return {xOrder, yOrder};
}

function reduceDimPoly(Fr, coefs) {
  const {
    xOrder: xOrder,
    yOrder: yOrder,
  } = _orderPoly(Fr, coefs);
  const oldNX = coefs.length;
  const oldNY = coefs[0].length;
  const N_X = xOrder+1;
  const N_Y = yOrder+1;
  if (N_X != oldNX || N_Y != oldNY) {
    const res = Array.from(
        Array(N_X),
        () => new Array(N_Y),
    );
    for (let i = 0; i < N_X; i++) {
      res[i] = coefs[i].slice(0, N_Y);
    }
    return res;
  } else {
    return coefs;
  }
}

async function readQAP(qapDirPath, k, m, n, n8r) {
  const {
    fd: fdQAP,
    sections: sectionsQAP,
  } = await binFileUtils__namespace.readBinFile(
      `${qapDirPath}/subcircuit${k}.qap`,
      'qapp',
      1,
      1<<22,
      1<<24,
  );

  const uX = new Array(m);
  const vX = new Array(m);
  const wX = new Array(m);

  await binFileUtils__namespace.startReadUniqueSection(fdQAP, sectionsQAP, 2);
  for (let i = 0; i < m; i++) {
    const degree = await fdQAP.readULE32();
    const data = Array.from(
        Array(degree),
        () => new Array(1),
    );
    for (let j = 0; j<degree; j++) {
      data[j][0] = await fdQAP.read(n8r);
    }
    uX[i] = data;
  }
  for (let i = 0; i < m; i++) {
    const degree = await fdQAP.readULE32();
    const data = Array.from(
        Array(degree),
        () => new Array(1),
    );
    for (let j = 0; j < degree; j++) {
      data[j][0] = await fdQAP.read(n8r);
    }
    vX[i] = data;
  }

  for (let i = 0; i < m; i++) {
    const degree = await fdQAP.readULE32();
    const data = Array.from(
        Array(degree),
        () => new Array(1),
    );
    for (let j = 0; j < degree; j++) {
      data[j][0] = await fdQAP.read(n8r);
    }
    wX[i] = data;
  }

  await binFileUtils__namespace.endReadSection(fdQAP);
  await fdQAP.close();

  return {uX, vX, wX};
}

/**
 *
 * @param {*} Fr
 * @param {*} _array1 m-by-1 matrix in Fr
 * @param {*} _array2 1-by-n matrix in Fr
 * @returns
 */
async function tensorProduct(Fr, _array1, _array2) {
  if (_array1.length == 1 && _array1[0].length == 1){
    if (Fr.eq(_array1[0][0], Fr.zero)){
      return [[Fr.zero]];
    }
  }
  if (_array2.length == 1 && _array2[0].length == 1){
    if (Fr.eq(_array2[0][0], Fr.zero)){
      return [[Fr.zero]];
    }
  } 
  const product = Array.from(Array(_array1.length), () => new Array(_array2.length));
  
  for (let i = 0; i < _array1.length; i++) {
    for (let j = 0; j<_array2[0].length; j++) {
      // console.log(product[i][j], _array2[0][j], _array1[i][0])
      product[i][j] = Fr.mul(_array2[0][j], _array1[i][0]);
      // console.log(product[i][j], _array2[0][j], _array1[i][0])
      // console.log('')
    }
  }
  return product;
}

/**
 *
 * @param {number} x  value
 * @return {number}  the smallest power of 2 that is greater than x
 */
function minPowerOfTwo(x) {
  return Math.pow(2, Math.ceil(Math.log(x)/Math.log(2)));
}

/**
 * @param {Fr}     Fr     Fr of a curve
 * @param {Array}  matrix 2D Array of nested 1D arrays
 * @param {Number} targetRowLength outer array length of the return matrix
 * @param {Number} targetColLength inner array length of the return matrix
 */
function paddingMatrix(Fr, matrix, targetRowLength, targetColLength) {
  if (targetRowLength < matrix.length &&
    targetColLength < matrix[0].length) return;

  // padding inner arrays
  const extraColLength = targetColLength - matrix[0].length;
  for (let i = 0; i < matrix.length; i++) {
    const extraCol = new Array(extraColLength).fill(Fr.e(0));
    matrix[i] = matrix[i].concat(extraCol);
  }

  // padding outer arrays
  const extraRowLength = targetRowLength - matrix.length;
  for (let i = 0; i < extraRowLength; i++) {
    const extraRow = new Array(matrix[0].length).fill(Fr.e(0));
    matrix.push(extraRow);
  }
}

function paddingArray(Fr, array, targetLength) {
  if (targetLength < array.length) return;

  // padding inner arrays
  const length = targetLength - array.length;
  for (let i = 0; i < length; i++) {
    array.push(Fr.e(0));
  }
}

/**
 * 
 * @param {Array} array a nested 2D array
 * @returns {Array} a transposed nested 2D array
 */
function transpose(array) {
  return array.reduce(
    (result, row) => row.map((_, i) => [...(result[i] || []), row[i]]),
    []
  )
}

const DIMENSION = {
  'Matrix': 0,
  'RowVector': 1,
  'ColVector': -1
};

/**
 * 
 * @param {Array} array A nested 2D array
 * @returns {Number} A DIMENSION enum value
 */
function checkDim (array) {
  const row = array.length;
  const col = array[0].length;

  // if (row > 1 && col > 1) return DIMENSION.Matrix;

  if (row === 1) return DIMENSION.RowVector;
  if (col === 1) return DIMENSION.ColVector;

  return DIMENSION.Matrix;
}

/**
 * 
 * @param {Fr} Fr A curve's Fr
 * @param {Array} coefs1 A nested 2D array
 * @param {Array} coefs2 A nested 2D array
 * @returns {Array} A  nested 2D array of multiplied polynomial coeffients 
 */
async function fftMulPoly(Fr, coefs1, coefs2) {
  // check the shape of coefs
  const shape1 = checkDim(coefs1);
  const shape2 = checkDim(coefs2);

  // call fft2d if they both are 2d arrays
  if (shape1 === DIMENSION.Matrix && shape2 === DIMENSION.Matrix) {
    return await _fft2dMulPoly(Fr, coefs1, coefs2);
  }
  // call fft1d multiple times looping through column element 
  // if one of them is 1d array
  let coefsA = coefs1;
  let coefsB = coefs2;

  if (shape1 !== shape2) {
    if (shape2 === DIMENSION.Matrix) {
      [coefsA, coefsB] = [coefs2, coefs1];
    }  
    // transpose array if it has column-wise array
    const isColumnVector = shape2 === DIMENSION.ColVector;
    if (isColumnVector) {
      coefsA = transpose(coefsA);
      coefsB = transpose(coefsB);
    }
    coefsA = reduceDimPoly(Fr, coefsA);
  
    // call fft1d looping through the 2d coef array
    const result = [];
  
    for (let i = 0; i < coefsA.length; i++) {
      result.push(await _fft1dMulPoly(Fr, coefsA[i], coefsB[0]));
    }
    if (isColumnVector) return transpose(result);
    return result;
  }
  // call fft1d once if both are 1d arrays of the same shape
  
  // transpose array if it has column-wise array
  const isColumnVector = shape1 === DIMENSION.ColVector;
  if (isColumnVector) {
    coefsA = transpose(coefsA);
    coefsB = transpose(coefsB);
  }
  if (isColumnVector) return transpose(await _fft1dMulPoly(Fr, coefsA[0], coefsB[0]));
  return await _fft1dMulPoly(Fr, coefsA[0], coefsB[0]);
}

/**
 *
 * @param {Fr} Fr   Finite field element of a curve
 * @param {Array} coefs1  2D nested array of coefficients
 * @param {Array} coefs2  2D nested array of coefficients
 * @return {Array}       2D nested array of coefficients of multiplication
 */
async function _fft2dMulPoly(Fr, coefs1, coefs2) {
  // copy array
  let coefsA = coefs1.slice(0);
  let coefsB = coefs2.slice(0);

  // array reduce dimension
  coefsA = reduceDimPoly(Fr, coefsA);
  coefsB = reduceDimPoly(Fr, coefsB);

  // find the smallest power of 2
  // that is greater than the multiplication of coefsA and coefsB
  const xDegree = coefsA.length + coefsB.length - 1;
  const yDegree = coefsA[0].length + coefsB[0].length - 1;

  const minPowerOfTwoForX = minPowerOfTwo(xDegree);
  const minPowerOfTwoForY = minPowerOfTwo(yDegree);

  // padding coefsA and coefsB
  paddingMatrix(Fr, coefsA, minPowerOfTwoForX, minPowerOfTwoForY);
  paddingMatrix(Fr, coefsB, minPowerOfTwoForX, minPowerOfTwoForY);

  // get fft of coefsA
  // perform fft with respect to x
  const fftOfXA = [];
  for (let i = 0; i < coefsA.length; i++) {
    fftOfXA.push(await Fr.fft(coefsA[i]));
  }

  const fftOfXYA = [];
  // perform fft with respect to y
  for (let i = 0; i < fftOfXA[0].length; i++) {
    const temp = [];
    for (let j = 0; j < fftOfXA.length; j++) {
      temp.push(fftOfXA[j][i]);
    }
    fftOfXYA.push(await Fr.fft(temp));
  }

  // get fft of coefsB
  // perform fft with respect to x
  const fftOfXB = [];
  for (let i = 0; i < coefsB.length; i++) {
    fftOfXB.push(await Fr.fft(coefsB[i]));
  }

  const fftOfXYB = [];
  // perform fft with respect to y
  for (let i = 0; i < fftOfXB[0].length; i++) {
    const temp = [];
    for (let j = 0; j < fftOfXB.length; j++) {
      temp.push(fftOfXB[j][i]);
    }
    fftOfXYB.push(await Fr.fft(temp));
  }

  // multiply each points from coefs1 and coefs2
  if (fftOfXYA.length !== fftOfXYB.length) {
    return Error('FFTs are not compatible to multiply.');
  }
  for (let i = 0; i < fftOfXYA.length; i++) {
    for (let j = 0; j < fftOfXYA[0].length; j++) {
      fftOfXYA[i][j] = Fr.mul(fftOfXYA[i][j], fftOfXYB[i][j]);
    }
  }

  // perform inverse fft with respect to x
  const ifftX = [];
  for (let i = 0; i < fftOfXYA.length; i++) {
    ifftX.push(await Fr.ifft(fftOfXYA[i]));
  }

  // perform inverse fft with respect to y
  const coefsC = [];
  for (let i = 0; i < ifftX[0].length; i++) {
    const temp = [];
    for (let j = 0; j < ifftX.length; j++) {
      temp.push(ifftX[j][i]);
    }
    coefsC.push(await Fr.ifft(temp));
  }

  return coefsC;
}

/**
 * 
 * @param {Fr} Fr A curve element, Fr
 * @param {Array} coefs1 A 1D array of coefficients of x
 * @param {Array} coefs2 A 1D array of coefficients of x
 * @returns {Array} A 1D array of coefficients of x
 */
async function _fft1dMulPoly(Fr, coefs1, coefs2) {
  // copy array
  let coefsA = coefs1.slice(0);
  let coefsB = coefs2.slice(0);

  // reduce dimension of the vector; the array have been reduced outside of the function
  while(Fr.eq(coefsB[coefsB.length - 1], Fr.e(0))) coefsB.pop();

  // find the smallest power of 2
  // that is greater than the multiplication of coefsA and coefsB
  const xDegree = coefsA.length + coefsB.length - 1;
  const minPowerOfTwoForX = minPowerOfTwo(xDegree);

  // padding coefsA and coefsB
  paddingArray(Fr, coefsA, minPowerOfTwoForX);
  paddingArray(Fr, coefsB, minPowerOfTwoForX);

  // get fft of coefsA
  const fftOfXA = await Fr.fft(coefsA);

  // get fft of coefsB
  const fftOfXB = await Fr.fft(coefsB);

  // multiply each points from coefs1 and coefs2
  if (fftOfXA.length !== fftOfXB.length) {
    return Error('FFTs are not compatible to multiply.');
  }
  for (let i = 0; i < fftOfXA.length; i++) {
    fftOfXA[i] = Fr.mul(fftOfXA[i], fftOfXB[i]);
  }

  // perform inverse fft with respect to x
  return await Fr.ifft(fftOfXA);
}

async function setup(
  parameterFile, 
  universalReferenceStringFileName, 
  qapDirPath, 
  logger
) {
  const startTime = start();
  let partTime;
  let EncTimeAccum1 = 0;
  let EncTimeAccum2 = 0;
  let EncTimeStart;
  let qapTimeStart;
  let qapTimeAccum = 0;

  const TESTFLAG = process.env.TEST_MODE;
  const assert = chai__default["default"].assert;
  if (logger) logger.debug(`TEST_MODE = ${TESTFLAG}`);

  fs.mkdir(
    path__default["default"].join(
        'resource/universal_rs'
    ), (err) => {},
  );
  const {
    fd: fdParam,
    sections: sectionsParam,
  } = await binFileUtils.readBinFile(
      parameterFile,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const param = await readRSParams(fdParam, sectionsParam);
  const sD = param.sD;

  const fdRS = await binFileUtils.createBinFile(
    `resource/universal_rs/${universalReferenceStringFileName}.urs`,
      'zkey',
      1,
      4 + sD,
      1<<22,
      1<<24,
  );
  await binFileUtils.copySection(fdParam, sectionsParam, fdRS, 1);
  await binFileUtils.copySection(fdParam, sectionsParam, fdRS, 2);

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
    rng[i] = await getRandomRng(i + 1);
  }
  const tau = createTauKey(Fr, rng);

  // Write the sigmaG section
  partTime = start();
  if (logger) logger.debug(`Generating sigmaG...`);
  await binFileUtils.startWriteSection(fdRS, 3);

  EncTimeStart = start();
  const vk1AlphaU = await G1.timesFr( buffG1, tau.alpha_u );
  const vk1AlphaV = await G1.timesFr( buffG1, tau.alpha_v );
  const vk1GammaA = await G1.timesFr( buffG1, tau.gamma_a );
  EncTimeAccum1 += end(EncTimeStart);

  await writeG1(fdRS, curve, vk1AlphaU);
  await writeG1(fdRS, curve, vk1AlphaV);
  await writeG1(fdRS, curve, vk1GammaA);
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
      Array(2*n-1),
      () => new Array(sMax),
  ); // n by sMax 2d array

  for (let i = 0; i < 2*n-1; i++) {
    for (let j = 0; j < sMax; j++) {
      xyPows[i][j] = await Fr.mul(await Fr.exp(x, i), await Fr.exp(y, j));
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < sMax; j++) {
      EncTimeStart = start();
      vk1XyPows[i][j] = await G1.timesFr(buffG1, xyPows[i][j]);
      EncTimeAccum1 += end(EncTimeStart);
      await writeG1(fdRS, curve, vk1XyPows[i][j]);
      // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(sMax-1)], [x^1*y^0], ...
    }
  }

  const gammaAInv=Fr.inv(tau.gamma_a);
  let xyPowsT1g;
  const vk1XyPowsT1g = Array.from(Array(n-1), () => new Array(sMax));
  const t1X=Fr.sub(await Fr.exp(x, n), Fr.one);
  const t1XG=Fr.mul(t1X, gammaAInv);
  for (let i = 0; i < n-1; i++) {
    for (let j=0; j<sMax; j++) {
      xyPowsT1g= await Fr.mul(xyPows[i][j], t1XG);
      EncTimeStart = start();
      vk1XyPowsT1g[i][j]= await G1.timesFr( buffG1, xyPowsT1g );
      EncTimeAccum1 += end(EncTimeStart);
      await writeG1( fdRS, curve, vk1XyPowsT1g[i][j] );
      // [x^0*y^0*t*g], [x^0*y^1*t*g], ...,
      // [x^0*y^(sMax-1)*t*g], [x^1*y^0*t*g], ...
    }
  }

  let xyPowsT2g;
  const vk1XyPowsT2g = Array.from(Array(2*n-1), () => new Array(sMax-1));
  const t2Y=Fr.sub(await Fr.exp(y, sMax), Fr.one);
  const t2YG=Fr.mul(t2Y, gammaAInv);
  for (let i = 0; i < 2*n-1; i++) {
    for (let j=0; j<sMax-1; j++) {
      xyPowsT2g= await Fr.mul(xyPows[i][j], t2YG);
      EncTimeStart = start();
      vk1XyPowsT2g[i][j]= await G1.timesFr( buffG1, xyPowsT2g );
      EncTimeAccum1 += end(EncTimeStart);
      await writeG1( fdRS, curve, vk1XyPowsT2g[i][j] );
      // [x^0*y^0*t*g], [x^0*y^1*t*g], ...,
      // [x^0*y^(sMax-1)*t*g], [x^1*y^0*t*g], ...
    }
  }

  await binFileUtils.endWriteSection(fdRS);
  if (logger) logger.debug(`Generating sigmaG...Done`);
  // End of the sigmaG section


  // Write the sigmaH section

  if (logger) logger.debug(`Generating sigmaH...`);
  await binFileUtils.startWriteSection(fdRS, 4);

  EncTimeStart = start();
  const vk2AlphaU = await G2.timesFr( buffG2, tau.alpha_u );
  const vk2GammaZ = await G2.timesFr( buffG2, tau.gamma_z );
  const vk2GammaA = await G2.timesFr( buffG2, tau.gamma_a );
  EncTimeAccum1 += end(EncTimeStart);
  await writeG2(fdRS, curve, vk2AlphaU);
  await writeG2(fdRS, curve, vk2GammaZ);
  await writeG2(fdRS, curve, vk2GammaA);

  let vk2XyPows;
  for (let i = 0; i < n; i++) {
    for (let j=0; j<sMax; j++) {
      EncTimeStart = start();
      vk2XyPows= await G2.timesFr( buffG2, xyPows[i][j] );
      EncTimeAccum1 += end(EncTimeStart);
      await writeG2(fdRS, curve, vk2XyPows );
      // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(sMax-1)], [x^1*y^0], ...
    }
  }
  await binFileUtils.endWriteSection(fdRS);
  if (logger) logger.debug(`Generating sigmaH...Done`);
  const sigmaTime = end(partTime);
  // End of the sigmaH section


  // Write the thetaG[k] sections for k in [0, 1, ..., sD]
  partTime = start();
  for (let k=0; k<sD; k++) {
    if (logger) logger.debug(`Generating thetaG...${k+1}/${sD}`);
    if (logger) logger.debug(`  Loading ${3*m[k]} sub-QAP polynomials...`);
    qapTimeStart = start();
    const {
      uX: uX,
      vX: vX,
      wX: wX,
    } = await readQAP(qapDirPath, k, m[k], n, n8r);
    qapTimeAccum += end(qapTimeStart);

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
      _ux[i] = await evalPoly(Fr, uX[i], x, 0);
      _vx[i] = await evalPoly(Fr, vX[i], x, 0);
      _wx[i] = await evalPoly(Fr, wX[i], x, 0);
      EncTimeStart = start();
      vk1UX[i] = await G1.timesFr(buffG1, _ux[i]);
      vk1VX[i] = await G1.timesFr(buffG1, _vx[i]);
      vk2VX[i] = await G2.timesFr(buffG2, _vx[i]);
      EncTimeAccum2 += end(EncTimeStart);
      combined = Fr.add(
          Fr.add(
              Fr.mul(tau.alpha_u, _ux[i]),
              Fr.mul(tau.alpha_v, _vx[i]),
          ),
          _wx[i],
      );
      if (i>=NConstWires && i<NConstWires+mPublic[k]) {
        zx=Fr.mul(combined, Fr.inv(tau.gamma_z));
        EncTimeStart = start();
        vk1ZX.push(await G1.timesFr(buffG1, zx));
        EncTimeAccum2 += end(EncTimeStart);
      } else {
        ax=Fr.mul(combined, Fr.inv(tau.gamma_a));
        EncTimeStart = start();
        vk1AX.push(await G1.timesFr(buffG1, ax));
        EncTimeAccum2 += end(EncTimeStart);
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

    await binFileUtils.startWriteSection(fdRS, 5+k);
    let multiplier;
    let vk1Uxy2d;
    let vk1Vxy2d;
    let vk2Vxy2d;
    let vk1Zxy2d;
    let vk1Axy2d;
    if (logger) logger.debug(`  Encrypting and file writing ${4*m[k]} QAP keys...`);
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = start();
      vk1Uxy2d= await G1.timesFr(vk1UX[i], multiplier);
      EncTimeAccum2 += end(EncTimeStart);
      await writeG1(fdRS, curve, vk1Uxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = start();
        vk1Uxy2d= await G1.timesFr(vk1UX[i], multiplier);
        EncTimeAccum2 += end(EncTimeStart);
        await writeG1(fdRS, curve, vk1Uxy2d);
      }
    }
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = start();
      vk1Vxy2d= await G1.timesFr(vk1VX[i], multiplier);
      EncTimeAccum2 += end(EncTimeStart);
      await writeG1(fdRS, curve, vk1Vxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = start();
        vk1Vxy2d= await G1.timesFr(vk1VX[i], multiplier);
        EncTimeAccum2 += end(EncTimeStart);
        await writeG1(fdRS, curve, vk1Vxy2d);
      }
    }
    for (let i=0; i < m[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = start();
      vk2Vxy2d= await G2.timesFr(vk2VX[i], multiplier);
      EncTimeAccum2 += end(EncTimeStart);
      await writeG2(fdRS, curve, vk2Vxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = start();
        vk2Vxy2d= await G2.timesFr(vk2VX[i], multiplier);
        EncTimeAccum2 += end(EncTimeStart);
        await writeG2(fdRS, curve, vk2Vxy2d);
      }
    }
    for (let i=0; i < mPublic[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = start();
      vk1Zxy2d= await G1.timesFr(vk1ZX[i], multiplier);
      EncTimeAccum2 += end(EncTimeStart);
      await writeG1(fdRS, curve, vk1Zxy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = start();
        vk1Zxy2d= await G1.timesFr(vk1ZX[i], multiplier);
        EncTimeAccum2 += end(EncTimeStart);
        await writeG1(fdRS, curve, vk1Zxy2d);
      }
    }
    for (let i=0; i < mPrivate[k]; i++) {
      multiplier=Fr.inv(Fr.e(sMax));
      EncTimeStart = start();
      vk1Axy2d= await G1.timesFr(vk1AX[i], multiplier);
      EncTimeAccum2 += end(EncTimeStart);
      await writeG1(fdRS, curve, vk1Axy2d);
      for (let j=1; j < sMax; j++) {
        multiplier=Fr.mul(multiplier, y);
        EncTimeStart = start();
        vk1Axy2d= await G1.timesFr(vk1AX[i], multiplier);
        EncTimeAccum2 += end(EncTimeStart);
        await writeG1(fdRS, curve, vk1Axy2d);
      }
    }
    await binFileUtils.endWriteSection(fdRS);
  }
  const thetaTime = end(partTime);

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

  const totalTime = end(startTime);
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

async function derive(
  referenceStringFile, 
  circuitReferenceString, 
  circuitDirectory, 
  qapName, 
  logger
) {
  const startTime = start();
  let partTime;
  let EncTimeStart;
  let EncTimeAccum = 0;
  let PolTimeStart;
  let PolTimeAccum = 0;
  let QAPWriteTimeStart;
  let QAPWriteTimeAccum = 0;

  const dirPath = circuitDirectory;

  const URS = 0;
  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils__namespace.readBinFile(
      referenceStringFile,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const urs = {};
  urs.param = await readRSParams(fdRS, sectionsRS);

  if (logger) logger.debug(`Loading urs...`);
  partTime = start();
  urs.content = await readRS(fdRS, sectionsRS, urs.param, URS);
  const ursLoadTime = end(partTime);
  if (logger) logger.debug(`Loading urs...Done`);

  const fdIdV = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_V.bin`,
      1<<25,
      1<<23,
  );
  const fdIdP = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_P.bin`,
      1<<25,
      1<<23,
  );
  const fdOpL = await fastFile__namespace.readExisting(
      `${dirPath}/OpList.bin`,
      1<<25,
      1<<23,
  );

  const IdSetV = await readIndSet(fdIdV);
  const IdSetP = await readIndSet(fdIdP);
  const OpList = await readOpList(fdOpL);
  // IdSet#.set, IdSet#.PreImgs

  await fdIdV.close();
  await fdIdP.close();
  await fdOpL.close();

  const fdcRS = await binFileUtils.createBinFile(
      `${dirPath}/${circuitReferenceString}.crs`,
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

  if (logger) logger.debug('Deriving crs...');
  let crsTime = start();
  if (logger) logger.debug(`  Deriving crs: [z_i(x,y)]_G for i upto ${mPublic}...`);
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

  if (logger) logger.debug(`  Deriving crs: [a_i(x,y)]_G for i upto ${mPrivate}...`);
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
          if (logger) logger.debug(`i: ${i}, PreImgIdx: ${PreImgIdx}`);
          throw new Error('invalid access to vk1_axy_kij');
        }
        vk1Term = urs.content.thetaG.vk1Axy[sKPrime][arrayIdx][j];
        vk1Term = await mulFrInG1(vk1Term, OmegaFactors[(kPrime*j)%sMax]);
        vk1Axy[i] = await G1.add(vk1Axy[i], vk1Term);
      }
    }
  }

  if (logger) logger.debug(`  Deriving crs: [u_i(x,y)]_G for i upto ${m}...`);
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

  if (logger) logger.debug(`  Deriving crs: [v_i(x,y)]_G for i upto ${m}...`);
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

  if (logger) logger.debug(`  Deriving crs: [v_i(x,y)]_H for i upto ${m}...`);
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

  await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 1);
  await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 2);
  await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 3);
  await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 4);

  await fdRS.close();

  if (logger) logger.debug(`  Writing crs file...`);
  partTime = start();
  await binFileUtils.startWriteSection(fdcRS, 5);
  await fdcRS.writeULE32(m);
  await fdcRS.writeULE32(mPublic);
  await fdcRS.writeULE32(mPrivate);
  for (let i=0; i<m; i++) {
    await writeG1(fdcRS, curve, vk1Uxy[i]);
  }
  for (let i=0; i<m; i++) {
    await writeG1(fdcRS, curve, vk1Vxy[i]);
  }
  for (let i=0; i<mPublic; i++) {
    await writeG1(fdcRS, curve, vk1Zxy[i]);
  }
  // vk1Zxy[i] is for the IdSetV.set[i]-th wire of circuit
  for (let i=0; i<mPrivate; i++) {
    await writeG1(fdcRS, curve, vk1Axy[i]);
  }
  // vk1Axy[i] is for the IdSetP.set[i]-th wire of circuit
  for (let i=0; i<m; i++) {
    await writeG2(fdcRS, curve, vk2Vxy[i]);
  }
  await binFileUtils.endWriteSection(fdcRS);
  const crsWriteTime = end(partTime);

  await fdcRS.close();

  crsTime = end(crsTime);
  if (logger) logger.debug(`Deriving crs...Done`);

  if (logger) logger.debug(`Deriving QAP...`);
  let qapTime = start();
  if (logger) logger.debug(`  Loading sub-QAPs...`);
  partTime = start();
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
      } = await readQAP(qapName, k, mK, n, n8r);
      uXK[k] = _uX;
      vXK[k] = _vX;
      wXK[k] = _wX;
    }
  }
  if (logger) logger.debug(`  Loading ${uXK.length} sub-QAPs...Done`);
  const subQapLoadTime = end(partTime);

  const fdQAP = await binFileUtils.createBinFile(
      `${dirPath}/circuitQAP.qap`,
      'qapp',
      1,
      4,
      1<<22,
      1<<24,
  );

  await binFileUtils.startWriteSection(fdQAP, 1);
  await fdQAP.writeULE32(1); // Groth
  await binFileUtils.endWriteSection(fdQAP);

  if (logger) logger.debug(`  Generating f_k(Y) of degree ${sMax-1} for k upto ${sF}...`);
  const fYK = new Array(sF);
  const fY = Array.from(Array(1), () => new Array(sMax));
  const FrSMaxInv = Fr.inv(Fr.e(sMax));
  for (let k=0; k<sF; k++) {
    const invOmegaYK = new Array(sMax);
    invOmegaYK[0] = Fr.one;
    for (let i=1; i<sMax; i++) {
      invOmegaYK[i] = Fr.mul(invOmegaYK[i-1], await Fr.exp(Fr.inv(omegaY), k));
    }
    PolTimeStart = start();
    const LagY = await filterPoly(Fr, fY, invOmegaYK, 1);
    fYK[k] = await scalePoly(Fr, LagY, FrSMaxInv);
    PolTimeAccum += end(PolTimeStart);
  }
  if (logger) logger.debug(`  Deriving u_i(X,Y), v_i(X,Y), w_i(X,Y) for i upto ${m}...`);
  
  await binFileUtils.startWriteSection(fdQAP, 2); // section2: u_i(X,Y)
  for (let i=0; i<m; i++) {    
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
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];

      PolTimeStart = start();
      const uTerm = await tensorProduct(
          Fr,
          uXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      uXY = await addPoly(Fr, uXY, uTerm);
      PolTimeAccum += end(PolTimeStart);      
    }
    
    uXY = reduceDimPoly(Fr, uXY);
    if ( (n != uXY.length && 1 != uXY.length) || (sMax != uXY[0].length && 1 != uXY[0].length) ) {
      if (logger) logger.debug(`xlen = ${uXY.length}, ylen = ${uXY[0].length}`);
      throw new Error(`uXY size and degree do not match`);
    }
    
    QAPWriteTimeStart = start();

    //const uXY_flat = uXY.flat();
    //await fdQAP.write(uXY_flat);

    if ( uXY.length == 1 && uXY[0].length == 1 ) {
      await fdQAP.writeULE32(0);
    } else {
      await fdQAP.writeULE32(1);
    }

    for (let xi=0; xi<uXY.length; xi++) {
      for (let yi=0; yi<uXY[0].length; yi++) {
        await fdQAP.write(uXY[xi][yi]);
      }
    }

    QAPWriteTimeAccum += end(QAPWriteTimeStart);
  }
  await binFileUtils.endWriteSection(fdQAP);

  await binFileUtils.startWriteSection(fdQAP, 3); // section3: v_i(X,Y)
  for (let i=0; i<m; i++) {    
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
    let vXY = [[Fr.zero]];
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];

      PolTimeStart = start();
      const vTerm = await tensorProduct(
          Fr,
          vXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      vXY = await addPoly(Fr, vXY, vTerm);
      PolTimeAccum += end(PolTimeStart);      
    }

    vXY = reduceDimPoly(Fr, vXY);
    if ( (n != vXY.length && 1 != vXY.length) || (sMax != vXY[0].length && 1 != vXY[0].length) ) {
      if (logger) logger.debug(`xlen = ${vXY.length}, ylen = ${vXY[0].length}`);
      throw new Error(`vXY size and degree do not match`);
    }
    
    QAPWriteTimeStart = start();

    if ( 1 == vXY.length && 1 == vXY[0].length ) {
      await fdQAP.writeULE32(0);
    } else {
      await fdQAP.writeULE32(1);
    }

    for (let xi=0; xi<vXY.length; xi++) {
      for (let yi=0; yi<vXY[0].length; yi++) {
        await fdQAP.write(vXY[xi][yi]);
      }
    }
    QAPWriteTimeAccum += end(QAPWriteTimeStart);
  }
  await binFileUtils.endWriteSection(fdQAP);

  await binFileUtils.startWriteSection(fdQAP, 4); // section4: w_i(X,Y)
  for (let i=0; i<m; i++) {    
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
    let wXY = [[Fr.zero]];
    for (let PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++) {
      const kPrime = PreImgSet[PreImgIdx][0];
      const iPrime = PreImgSet[PreImgIdx][1];
      const sKPrime = OpList[kPrime];

      PolTimeStart = start();
      const wTerm = await tensorProduct(
          Fr,
          wXK[sKPrime][iPrime],
          fYK[kPrime],
      );
      wXY = await addPoly(Fr, wXY, wTerm);
      PolTimeAccum += end(PolTimeStart);      
    }

    wXY = reduceDimPoly(Fr, wXY);
    if ( (n != wXY.length && 1 != wXY.length) || (sMax != wXY[0].length && 1 != wXY[0].length) ) {
      if (logger) logger.debug(`xlen = ${wXY.length}, ylen = ${wXY[0].length}`);
      throw new Error(`wXY size and degree do not match`);
    } 
  
    QAPWriteTimeStart = start();

    if ( 1 == wXY.length && 1 == wXY[0].length ) {
      await fdQAP.writeULE32(0);
    } else {
      await fdQAP.writeULE32(1);
    }

    for (let xi=0; xi<wXY.length; xi++) {
      for (let yi=0; yi<wXY[0].length; yi++) {
        await fdQAP.write(wXY[xi][yi]);
      }
    }
    QAPWriteTimeAccum += end(QAPWriteTimeStart);
  }
  await binFileUtils.endWriteSection(fdQAP);

  await fdQAP.close();
  qapTime = end(qapTime);

  if (logger) logger.debug('Deriving QAP...Done');
  if (logger) logger.debug('\n');

  const totalTime = end(startTime);
  if (logger) {
    logger.debug('----- Derive Time Analyzer -----');
    logger.debug(`### Total ellapsed time: ${totalTime} [ms]`);
    logger.debug(` ## Time for deriving crs for ${m} wires (${4*m} keys): ${crsTime} [ms] (${((crsTime)/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # URS loading time: ${ursLoadTime} [ms] (${(ursLoadTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Encryption time: ${EncTimeAccum} [ms] (${(EncTimeAccum/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # File writing time: ${crsWriteTime} [ms] (${(crsWriteTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(` ## Time for deriving ${3*m} QAP polynomials of degree (${n},${sMax}): ${qapTime} [ms] (${(qapTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Sub-QAPs loading time: ${subQapLoadTime} [ms] (${(subQapLoadTime/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # Polynomial multiplication time: ${PolTimeAccum} [ms] (${(PolTimeAccum/totalTime*100).toFixed(3)} %)`);
    logger.debug(`  # File writing time: ${QAPWriteTimeAccum} [ms] (${(QAPWriteTimeAccum/totalTime*100).toFixed(3)} %)`);
  }
  process.exit(0);


  async function mulFrInG1(point, fieldval) {
    EncTimeStart = start();
    const out = await G1.timesFr(point, fieldval);
    EncTimeAccum += end(EncTimeStart);
    return out;
  }
  async function mulFrInG2(point, fieldval) {
    EncTimeStart = start();
    const out = await G2.timesFr(point, fieldval);
    EncTimeAccum += end(EncTimeStart);
    return out;
  }
//   async function polyUtils_mulPoly(Fr, coef1, coef2) {
//     PolTimeStart = timer.start();
//     const out = await polyUtils.mulPoly(Fr, coef1, coef2);
//     PolTimeAccum += timer.end(PolTimeStart);
//     return out;
//   }
}

async function readHeader(fd, sections) {
  await binFileUtils__namespace.startReadUniqueSection(fd, sections, 1);
  const n8 = await fd.readULE32();
  const q = await binFileUtils__namespace.readBigInt(fd, n8);
  const nWitness = await fd.readULE32();
  await binFileUtils__namespace.endReadSection(fd);

  return {n8, q, nWitness};
}

async function read(fileName) {
  const {fd, sections} = await binFileUtils__namespace.readBinFile(fileName, 'wtns', 2);

  const {n8, nWitness} = await readHeader(fd, sections);

  await binFileUtils__namespace.startReadUniqueSection(fd, sections, 2);
  //const res_buff = new BigBuffer(nWitness*n8);
  //await fd.readToBuffer(res_buff,0,nWitness*n8);
  
  const res = new Array(nWitness);
  for (let i=0; i<nWitness; i++) { 
    const buff_temp = new Uint8Array(n8);
    await fd.readToBuffer(buff_temp,0,n8);
    res[i] = buff_temp;
  }
  
  /*
  let res=[];
  for (let i=0; i<nWitness; i++) { 
    const v = await binFileUtils.readBigInt(fd, n8);
    res.push(v);
  }
  await binFileUtils.endReadSection(fd);

  await fd.close();
  */

  return res;
}

var witness_calculator = async function builder(code, options) {

    options = options || {};

    let wasmModule;
    try {
	wasmModule = await WebAssembly.compile(code);
    }  catch (err) {
	console.log(err);
	console.log("\nTry to run circom --c in order to generate c++ code instead\n");
	throw new Error(err);
    }

    let wc;

    let errStr = "";
    let msgStr = "";
    
    const instance = await WebAssembly.instantiate(wasmModule, {
        runtime: {
            exceptionHandler : function(code) {
		let err;
        if (code == 1) {
            err = "Signal not found.\n";
        } else if (code == 2) {
            err = "Too many signals set.\n";
        } else if (code == 3) {
            err = "Signal already set.\n";
        } else if (code == 4) {
            err = "Assert Failed.\n";
        } else if (code == 5) {
            err = "Not enough memory.\n";
		} else if (code == 6) {
                    err = "Input signal array access exceeds the size.\n";
		} else {
            err = "Unknown error.\n";
        }
            throw new Error(err + errStr);
        },
	    printErrorMessage : function() {
		errStr += getMessage() + "\n";
                // console.error(getMessage());
	    },
	    writeBufferMessage : function() {
			const msg = getMessage();
			// Any calls to `log()` will always end with a `\n`, so that's when we print and reset
			if (msg === "\n") {
				console.log(msgStr);
				msgStr = "";
			} else {
				// If we've buffered other content, put a space in between the items
				if (msgStr !== "") {
					msgStr += " ";
				}
				// Then append the message to the message we are creating
				msgStr += msg;
			}
	    },
	    showSharedRWMemory : function() {
		printSharedRWMemory ();
            }

        }
    });

    const sanityCheck =
        options;
//        options &&
//        (
//            options.sanityCheck ||
//            options.logGetSignal ||
//            options.logSetSignal ||
//            options.logStartComponent ||
//            options.logFinishComponent
//        );

    
    wc = new WitnessCalculator(instance, sanityCheck);
    return wc;

    function getMessage() {
        var message = "";
	var c = instance.exports.getMessageChar();
        while ( c != 0 ) {
	    message += String.fromCharCode(c);
	    c = instance.exports.getMessageChar();
	}
        return message;
    }
	
    function printSharedRWMemory () {
	const shared_rw_memory_size = instance.exports.getFieldNumLen32();
	const arr = new Uint32Array(shared_rw_memory_size);
	for (let j=0; j<shared_rw_memory_size; j++) {
	    arr[shared_rw_memory_size-1-j] = instance.exports.readSharedRWMemory(j);
	}

	// If we've buffered other content, put a space in between the items
	if (msgStr !== "") {
		msgStr += " ";
	}
	// Then append the value to the message we are creating
	msgStr += (fromArray32(arr).toString());
	}

};

class WitnessCalculator {
    constructor(instance, sanityCheck) {
        this.instance = instance;

	this.version = this.instance.exports.getVersion();
        this.n32 = this.instance.exports.getFieldNumLen32();

        this.instance.exports.getRawPrime();
        const arr = new Uint32Array(this.n32);
        for (let i=0; i<this.n32; i++) {
            arr[this.n32-1-i] = this.instance.exports.readSharedRWMemory(i);
        }
        this.prime = fromArray32(arr);

        this.witnessSize = this.instance.exports.getWitnessSize();

        this.sanityCheck = sanityCheck;
    }
    
    circom_version() {
	return this.instance.exports.getVersion();
    }

    async _doCalculateWitness(input, sanityCheck) {
	//input is assumed to be a map from signals to arrays of bigints
        this.instance.exports.init((this.sanityCheck || sanityCheck) ? 1 : 0);
        const keys = Object.keys(input);
	var input_counter = 0;
        keys.forEach( (k) => {
            const h = fnvHash(k);
            const hMSB = parseInt(h.slice(0,8), 16);
            const hLSB = parseInt(h.slice(8,16), 16);
            const fArr = flatArray(input[k]);
	    let signalSize = this.instance.exports.getInputSignalSize(hMSB, hLSB);
	    if (signalSize < 0){
		throw new Error(`Signal ${k} not found\n`);
	    }
	    if (fArr.length < signalSize) {
		throw new Error(`Not enough values for input signal ${k}\n`);
	    }
	    if (fArr.length > signalSize) {
		throw new Error(`Too many values for input signal ${k}\n`);
	    }
            for (let i=0; i<fArr.length; i++) {
                const arrFr = toArray32(BigInt(fArr[i])%this.prime,this.n32);
                for (let j=0; j<this.n32; j++) {
		    this.instance.exports.writeSharedRWMemory(j,arrFr[this.n32-1-j]);
		}
		try {
                    this.instance.exports.setInputSignal(hMSB, hLSB,i);
		    input_counter++;
		} catch (err) {
		    // console.log(`After adding signal ${i} of ${k}`)
                    throw new Error(err);
		}
            }

        });
	if (input_counter < this.instance.exports.getInputSize()) {
	    throw new Error(`Not all inputs have been set. Only ${input_counter} out of ${this.instance.exports.getInputSize()}`);
	}
    }

    async calculateWitness(input, sanityCheck) {

        const w = [];

        await this._doCalculateWitness(input, sanityCheck);

        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
	    const arr = new Uint32Array(this.n32);
            for (let j=0; j<this.n32; j++) {
            arr[this.n32-1-j] = this.instance.exports.readSharedRWMemory(j);
            }
            w.push(fromArray32(arr));
        }

        return w;
    }
    

    async calculateBinWitness(input, sanityCheck) {

        const buff32 = new Uint32Array(this.witnessSize*this.n32);
	const buff = new  Uint8Array( buff32.buffer);
        await this._doCalculateWitness(input, sanityCheck);

        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
	    const pos = i*this.n32;
            for (let j=0; j<this.n32; j++) {
		buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
            }
        }

	return buff;
    }
    

    async calculateWTNSBin(input, sanityCheck) {

        const buff32 = new Uint32Array(this.witnessSize*this.n32+this.n32+11);
	const buff = new  Uint8Array( buff32.buffer);
        await this._doCalculateWitness(input, sanityCheck);
  
	//"wtns"
	buff[0] = "w".charCodeAt(0);
	buff[1] = "t".charCodeAt(0);
	buff[2] = "n".charCodeAt(0);
	buff[3] = "s".charCodeAt(0);

	//version 2
	buff32[1] = 2;

	//number of sections: 2
	buff32[2] = 2;

	//id section 1
	buff32[3] = 1;

	const n8 = this.n32*4;
	//id section 1 length in 64bytes
	const idSection1length = 8 + n8;
	const idSection1lengthHex = idSection1length.toString(16);
        buff32[4] = parseInt(idSection1lengthHex.slice(0,8), 16);
        buff32[5] = parseInt(idSection1lengthHex.slice(8,16), 16);

	//this.n32
	buff32[6] = n8;

	//prime number
	this.instance.exports.getRawPrime();

	var pos = 7;
        for (let j=0; j<this.n32; j++) {
	    buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
        }
	pos += this.n32;

	// witness size
	buff32[pos] = this.witnessSize;
	pos++;

	//id section 2
	buff32[pos] = 2;
	pos++;

	// section 2 length
	const idSection2length = n8*this.witnessSize;
	const idSection2lengthHex = idSection2length.toString(16);
        buff32[pos] = parseInt(idSection2lengthHex.slice(0,8), 16);
        buff32[pos+1] = parseInt(idSection2lengthHex.slice(8,16), 16);

	pos += 2;
        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
            for (let j=0; j<this.n32; j++) {
		buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
            }
	    pos += this.n32;
        }

	return buff;
    }

}


function toArray32(rem,size) {
    const res = []; //new Uint32Array(size); //has no unshift
    const radix = BigInt(0x100000000);
    while (rem) {
        res.unshift( Number(rem % radix));
        rem = rem / radix;
    }
    if (size) {
	var i = size - res.length;
	while (i>0) {
	    res.unshift(0);
	    i--;
	}
    }
    return res;
}

function fromArray32(arr) { //returns a BigInt
    var res = BigInt(0);
    const radix = BigInt(0x100000000);
    for (let i = 0; i<arr.length; i++) {
        res = res*radix + BigInt(arr[i]);
    }
    return res;
}

function flatArray(a) {
    var res = [];
    fillArray(res, a);
    return res;

    function fillArray(res, a) {
        if (Array.isArray(a)) {
            for (let i=0; i<a.length; i++) {
                fillArray(res, a[i]);
            }
        } else {
            res.push(a);
        }
    }
}

function fnvHash(str) {
    const uint64_max = BigInt(2) ** BigInt(64);
    let hash = BigInt("0xCBF29CE484222325");
    for (var i = 0; i < str.length; i++) {
	hash ^= BigInt(str[i].charCodeAt());
	hash *= BigInt(0x100000001B3);
	hash %= uint64_max;
    }
    let shash = hash.toString(16);
    let n = 16 - shash.length;
    shash = '0'.repeat(n).concat(shash);
    return shash;
}

async function generateWitness(circuitDirectory, instanceId){

  const dirPath = circuitDirectory;
	const fdOpL = await fastFile__namespace.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
  const opList = await readOpList(fdOpL);
	await fdOpL.close();

	fs.mkdir(path__default["default"].join(dirPath, `witness${instanceId}`), (err) => {});

	for (const index in opList) {
		const buffer = fs.readFileSync(`${appRootPath__default["default"].path}/resource/subcircuits/wasm/subcircuit${opList[index]}.wasm`);
		const input = JSON.parse(fs.readFileSync(`${dirPath}/instance${instanceId}/Input_opcode${index}.json`, "utf8"));
		const witnessCalculator = await witness_calculator(buffer);
		const buff = await witnessCalculator.calculateWTNSBin(input, 0);
		fs.writeFile(`${dirPath}/witness${instanceId}/witness${index}.wtns`, buff, function(err) {
			if (err) throw err
		});
	}
}

async function groth16Prove(
  qapName,   
  circuitReferenceString,
  proofName,
  circuitName,
  instanceId,
  logger
) {
  let timers = {};
  timers.total = start();
  const dirPath = circuitName;
  const TESTFLAG = process.env.TEST_MODE;
  const CRS = 1;

  if (logger) logger.debug(`TESTMODE = ${TESTFLAG}`);

  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils__namespace.readBinFile(
      circuitReferenceString,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const fdIdV = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_V.bin`,
      1<<25,
      1<<23,
  );
  const fdIdP = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_P.bin`,
      1<<25,
      1<<23,
  );
  const fdOpL = await fastFile__namespace.readExisting(
      `${dirPath}/OpList.bin`,
      1<<25,
      1<<23,
  );
  const fdWrL = await fastFile__namespace.readExisting(
      `${dirPath}/WireList.bin`,
      1<<25,
      1<<23,
  );

  const urs = {};
  const crs = {};
  urs.param = await readRSParams(fdRS, sectionsRS);
  const rs = await readRS(
      fdRS,
      sectionsRS,
      urs.param,
      CRS,
  );
  const IdSetV = await readIndSet(fdIdV);
  const IdSetP = await readIndSet(fdIdP);
  const OpList = await readOpList(fdOpL);
  const WireList = await readWireList(fdWrL);
  await fdRS.close();
  await fdIdV.close();
  await fdIdP.close();
  await fdOpL.close();
  await fdWrL.close();

  const fdPrf = await binFileUtils__namespace.createBinFile(
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
  curve.G1.oneAffine;
  curve.G2.oneAffine;
  const n = urs.param.n;
  const n8r = urs.param.n8r;
  const sMax = urs.param.sMax;
  const sD = urs.param.sD;
  const sF = OpList.length;
  // const s_F = OpList.length;
  await Fr.e(urs.param.omegaX);
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
  timers.qapSolve = start();
  if (logger) logger.debug(`  Generating circuit witness...`);
  await generateWitness(circuitName, instanceId);
  const wtns = [];
  for (let k=0; k<OpList.length; k++ ) {
    const wtnsK = await read(
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
      } = await binFileUtils__namespace.readBinFile(
          `resource/subcircuits/r1cs/subcircuit${k}.r1cs`,
          'r1cs',
          1,
          1<<22,
          1<<24,
      );
      sR1cs.push(await binFileUtils__namespace.readSection(fdR1cs, sectionsR1cs, 2));
      await fdR1cs.close();
    }
    for (let k=0; k<OpList.length; k++) {
      const kPrime = OpList[k];
      const processResultsK = await processConstraints(
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
  const cWtns_buff = new ffjavascript.BigBuffer(WireList.length * Fr.n8);
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
  const cWtns_private_buff = new ffjavascript.BigBuffer(mPrivate * Fr.n8);
  for (let i=0; i<mPrivate; i++) {
    const ii = IdSetP.set[i];
    const kPrime = WireList[ii][0];
    const idx = WireList[ii][1];
    const cWtns_ii = wtns[kPrime][idx]; // Uint8Array buffer
    cWtns_private_buff.set(cWtns_ii, Fr.n8*i);
  }

  /*
  const tX = Array.from(Array(n+1), () => new Array(1));
  const tY = Array.from(Array(1), () => new Array(sMax+1));
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
  */

  // / compute p(X,Y)
  if (logger) logger.debug(`  Loading sub-QAPs...`);
  timers.subQAPLoad = start();
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
      } = await readQAP(qapName, k, mK, n, n8r);
      uXK[k] = _uX;
      vXK[k] = _vX;
      wXK[k] = _wX;
    }
  }
  if (logger) logger.debug(`  Loading ${uXK.length} sub-QAPs...Done`);
  timers.subQAPLoad= end(timers.subQAPLoad);
  
  if (logger) logger.debug(`  Preparing f_k(Y) of degree ${sMax-1} for k upto ${sF}...`);
  timers.LagY = start();
  const fYK = new Array(sF);
  //const fY = Array.from(Array(1), () => new Array(sMax));
  const FrSMaxInv = Fr.inv(Fr.e(sMax));
  const FrOmegaInv = Fr.inv(omegaY);
  for (let k=0; k<sF; k++) {
    const invOmegaYK = new Array(sMax);
    //invOmegaYK[0] = Fr.one;
    invOmegaYK[0] = FrSMaxInv;
    for (let i=1; i<sMax; i++) {
      //invOmegaYK[i] = Fr.mul(invOmegaYK[i-1], await Fr.exp(Fr.inv(omegaY), k));
      invOmegaYK[i] = Fr.mul(invOmegaYK[i-1], await Fr.exp(FrOmegaInv, k));
    }
    //const LagY = await polyUtils.filterPoly(Fr, fY, invOmegaYK, 1); //????????????
    //fYK[k] = await polyUtils.scalePoly(Fr, LagY, FrSMaxInv);
    fYK[k] = [invOmegaYK];
  }
  timers.LagY = end(timers.LagY);
  
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
      timertemp = start();
      const scaled_uXK = await scalePoly(Fr, uXK[sKPrime][iPrime], cWtns_i);
      const scaled_vXK = await scalePoly(Fr, vXK[sKPrime][iPrime], cWtns_i);
      const scaled_wXK = await scalePoly(Fr, wXK[sKPrime][iPrime], cWtns_i);
      timers.polScalingAccum += end(timertemp);
      timertemp = start();
      
      const uTerm = await tensorProduct(Fr, scaled_uXK, fYK[kPrime]);
      const vTerm = await tensorProduct(Fr, scaled_vXK, fYK[kPrime]);
      const wTerm = await tensorProduct(Fr, scaled_wXK, fYK[kPrime]);
      timers.polTensorAccum += end(timertemp);
      timertemp = start();
      p1XY = await addPoly(Fr, p1XY, uTerm);
      p2XY = await addPoly(Fr, p2XY, vTerm);
      p3XY = await addPoly(Fr, p3XY, wTerm);
      timers.polAddAccum += end(timertemp);
    }
  }
  timers.polMul = start();
  const temp = await fftMulPoly(Fr, p1XY, p2XY);
  timers.polMul = end(timers.polMul);
  timertemp = start();
  const pXY = await subPoly(Fr, temp, p3XY);
  timers.polAddAccum += end(timertemp);

  // compute H
  if (logger) logger.debug(`  Finding h1(X,Y) and h2(X,Y)...`);
  timers.polDiv = start();
  // h1XY = HX(X,Y), h2XY = HY(X,Y)
  const {HX_buff: h1XY, HY_buff: h2XY} = await QapDiv(Fr, pXY);
  timers.polDiv = end(timers.polDiv);
  timers.qapSolve = end(timers.qapSolve);
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
    } = _orderPoly(Fr, h1XY);
    const {
      xOrder: h2XOrder,
      yOrder: h2YOrder,
    } = _orderPoly(Fr, h2XY);
    if (logger) logger.debug(`h1_x_order: ${h1XOrder}, h1_y_order: ${h1YOrder}`);
    if (logger) logger.debug(`h2_x_order: ${h2XOrder}, h2_y_order: ${h2YOrder}`);
    if (logger) logger.debug(`n: ${n}, sMax: ${sMax}`);
  }

  // Generate r and s
  const rawr = await getRandomRng(1);
  const raws = await getRandomRng(2);
  const r = Fr.fromRng(rawr);
  const s = Fr.fromRng(raws);

  if (logger) logger.debug(`Generating Proofs...`);
  timers.proving = start();
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
  vk1CP[2] = await G1.multiExpAffine(urs.sigmaG.vk1XyPowsT2g, h2XY, false);
  vk1CP[3] = await G1.timesFr(vk1A, s);
  vk1CP[4] = await G1.timesFr(vk1B, r);
  vk1CP[5] = await G1.timesFr( urs.sigmaG.vk1GammaA, Fr.neg(Fr.mul(r, s)) );
  let vk1C = vk1CP[0];
  for (let i=1; i<6; i++) {
    vk1C = await G1.add(vk1C, vk1CP[i]);
  }
  timers.proving = end(timers.proving);
  if (logger) logger.debug(`Generating Proofs...Done`);

  // Write Header
  // /////////
  await binFileUtils__namespace.startWriteSection(fdPrf, 1);
  await fdPrf.writeULE32(1); // Groth
  await binFileUtils__namespace.endWriteSection(fdPrf);
  // End of the Header

  await binFileUtils__namespace.startWriteSection(fdPrf, 2);
  await writeG1(fdPrf, curve, vk1A);
  await writeG2(fdPrf, curve, vk2B);
  await writeG1(fdPrf, curve, vk1C);

  await binFileUtils__namespace.endWriteSection(fdPrf);

  await fdPrf.close();

  timers.total = end(timers.total);
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

async function groth16Verify(
    proofFile,
    circuitReferenceStringFile,
    circuitDirectory,
    instanceId,
    logger
) {
  const startTime = start();
  const ID_KECCAK = 5;

  const dirPath = circuitDirectory;
  const CRS = 1;

  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils__namespace.readBinFile(
      circuitReferenceStringFile,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const fdIdV = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_V.bin`,
      1<<25,
      1<<23,
  );
  const fdIdP = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_P.bin`,
      1<<25,
      1<<23,
  );
  const fdOpL = await fastFile__namespace.readExisting(
      `${dirPath}/OpList.bin`,
      1<<25,
      1<<23,
  );
  const fdWrL = await fastFile__namespace.readExisting(
      `${dirPath}/WireList.bin`,
      1<<25,
      1<<23,
  );
  const {
    fd: fdPrf,
    sections: sectionsPrf,
  } = await binFileUtils__namespace.readBinFile(
      proofFile,
      'prof',
      2,
      1<<22,
      1<<24,
  );

  const urs = {};
  const crs = {};
  urs.param = await readRSParams(fdRS, sectionsRS);
  const rs = await readRS(fdRS, sectionsRS, urs.param, CRS);
  const IdSetV = await readIndSet(fdIdV);
  const IdSetP = await readIndSet(fdIdP);
  const OpList = await readOpList(fdOpL);
  const WireList = await readWireList(fdWrL);
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
  curve.G1.oneAffine;
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
        fs.readFileSync(
            `${dirPath}/instance${instanceId}/Input_opcode${index}.json`,
            'utf8',
        ),
    );
    const outputs = JSON.parse(
        fs.readFileSync(
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
  const cInstance = new ffjavascript.BigBuffer(IdSetV.set.length * Fr.n8);
  const buff_temp = new Uint8Array(Fr.n8);
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
    const value = Fr.e(subInstance[kPrime][iPrime]);
    await Fr.toRprLE(buff_temp, 0, value, Fr.n8);
    cInstance.set(buff_temp, Fr.n8 * i);  
  }

  if (cInstance.byteLength != mPublic * Fr.n8) {
    throw new Error(
        'Error in arranging circuit instance: wrong instance size.',
    );
  }


  // / read proof
  await binFileUtils__namespace.startReadUniqueSection(fdPrf, sectionsPrf, 2);
  const vk1A = await readG1(fdPrf, curve);
  const vk2B = await readG2(fdPrf, curve);
  const vk1C = await readG1(fdPrf, curve);
  await binFileUtils__namespace.endReadSection(fdPrf);
  await fdPrf.close();

  // / Compute term D
  let EncTime = start();
  let vk1D;
  vk1D = await G1.multiExpAffine(crs.vk1Zxy1d, cInstance, false);
  EncTime = end(EncTime);

  // / Verify
  let PairingTime = start();
  const res = await curve.pairingEq(urs.sigmaG.vk1AlphaV, urs.sigmaH.vk2AlphaU,
      vk1D, urs.sigmaH.vk2GammaZ,
      vk1C, urs.sigmaH.vk2GammaA,
      vk1A, await G2.neg(vk2B));
  PairingTime = end(PairingTime);
  if (logger) logger.debug(`Circuit verification result = ${res}`);

  let HashTime = start();
  const {keccak256} = hash__default["default"];
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
  HashTime = end(HashTime);
  if (keccakList.length>0) {
    if (logger) logger.debug(`Keccak verification result = ${res2}`);
  }

  const totalTime = end(startTime);
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

async function buildQAP(curveName, sD, minSMax, logger) {
  const startTime = start();
  let partTime;

  // read debug mode from enviroment variable
  const TESTFLAG = process.env.TEST_MODE;
  const assert = chai__default["default"].assert;
  const r1cs = [];
  const sR1cs = [];

  fs.mkdir(
      path__default["default"].join(
          `resource/subcircuits`, `QAP_${sD}_${minSMax}`,
      ), (err) => {},
  );
  const dirPath = `resource/subcircuits/QAP_${sD}_${minSMax}`;

  partTime = start();
  for (let i=0; i<sD; i++) {
    if (logger) logger.debug(`Loading R1CSs...${i+1}/${sD}`);
    const r1csIdx = String(i);
    const {
      fd: fdR1cs,
      sections: sectionsR1cs,
    } = await binFileUtils.readBinFile(
        'resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs',
        'r1cs',
        2,
        1<<22,
        1<<24,
    );
    r1cs.push(
        await r1csfile.readR1csHeader(fdR1cs, sectionsR1cs, false),
    );
    sR1cs.push(
        await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2),
    );
    await fdR1cs.close();
  }
  if (logger) logger.debug(`Loading R1CSs...Done`);
  const r1csTime = end(partTime);

  const fdRS = await binFileUtils.createBinFile(
      `resource/subcircuits/param_${sD}_${minSMax}.dat`,
      'zkey',
      1,
      2,
      1<<22,
      1<<24,
  );

  const curve = await getCurveFromName(curveName);
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
  await binFileUtils.startWriteSection(fdRS, 1);
  await fdRS.writeULE32(1); // Groth
  await binFileUtils.endWriteSection(fdRS);
  // End of the Header

  // Write parameters section
  // /////////
  await binFileUtils.startWriteSection(fdRS, 2);
  const primeQ = curve.q;
  const n8q = (Math.floor( (ffjavascript.Scalar.bitLength(primeQ) - 1) / 64) +1)*8;

  // Group parameters
  const primeR = curve.r;
  const n8r = (Math.floor( (ffjavascript.Scalar.bitLength(primeR) - 1) / 64) +1)*8;

  await fdRS.writeULE32(n8q); // byte length of primeQ
  await binFileUtils.writeBigInt(fdRS, primeQ, n8q);
  await fdRS.writeULE32(n8r); // byte length of primeR
  await binFileUtils.writeBigInt(fdRS, primeR, n8r);

  // Instruction set constants
  await fdRS.writeULE32(sD);
  const m = []; // the numbers of wires
  const mPublic = []; // the numbers of public wires
  const nConstraints = [];
  for (let i=0; i<sD; i++) {
    m.push(r1cs[i].nVars);
    nConstraints.push(r1cs[i].nConstraints);
    mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs + r1cs[i].nPrvInputs);
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

  const omegaX = await Fr.exp(Fr.w[Fr.s], ffjavascript.Scalar.exp(2, Fr.s-expon));

  const expos = Math.ceil(Math.log2(minSMax));
  const sMax = 2**expos;
  const omegaY = await Fr.exp(Fr.w[Fr.s], ffjavascript.Scalar.exp(2, Fr.s-expos));

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
  await binFileUtils.writeBigInt(fdRS, Fr.toObject(omegaX), n8r);
  await binFileUtils.writeBigInt(fdRS, Fr.toObject(omegaY), n8r);

  // FIXME: Test code 2 //
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running Test 2`);
    assert(Fr.eq(omegaX, Fr.e(Fr.toObject(omegaX))));
    if (logger) logger.debug(`Test 2 finished`);
  }
  // End of test code 2 //

  await binFileUtils.endWriteSection(fdRS);
  // / End of parameters section

  await fdRS.close();

  const rs = {};
  rs.curve = curve;
  rs.n = n;
  rs.sMax = sMax;
  rs.omegaX = omegaX;
  rs.omegaY = omegaY;

  partTime = start();

  if (logger) logger.debug(
      `Generating Lagrange bases for X with ${n} evaluation points...`,
  );
  const lagrangeBasis = await buildCommonPolys(rs);
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
    } = await buildR1csPolys(
        curve,
        lagrangeBasis,
        r1cs[k],
        sR1cs[k],
    );

    if (logger) logger.debug(`File writing the polynomials...`);
    const FSTime = start();
    const fdQAP = await binFileUtils.createBinFile(
        `${dirPath}/subcircuit${k}.qap`,
        'qapp',
        1,
        2,
        1<<22,
        1<<24,
    );

    await binFileUtils.startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fdQAP);

    await binFileUtils.startWriteSection(fdQAP, 2);
    for (let i=0; i<m[k]; i++) {
      const degree = uX[i].length;
      await fdQAP.writeULE32(degree);
      for (let xi=0; xi<degree; xi++) {
        if (typeof uX[i][xi][0] != 'bigint') {
          await fdQAP.write(uX[i][xi][0]);
        } else {
          await binFileUtils.writeBigInt(fdQAP, uX[i][xi][0], n8r);
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
          await binFileUtils.writeBigInt(fdQAP, vX[i][xi][0], n8r);
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
          await binFileUtils.writeBigInt(fdQAP, wX[i][xi][0], n8r);
        }
      }
    }
    await binFileUtils.endWriteSection(fdQAP);
    await fdQAP.close();
    FSTimeAccum += end(FSTime);
  }
  const qapTime = end(partTime);
  const totalTime = end(startTime);

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

async function buildSingleQAP(paramName, id, logger) {
  const TESTFLAG = process.env.TEST_MODE;
  const assert = chai__default["default"].assert;
  const QAPName = `QAP${paramName.slice(5)}`;
  fs.mkdir(
      path__default["default"].join(
          `resource/subcircuits`,
          QAPName,
      ),
      (err) => {},
  );
  const dirPath = `resource/subcircuits/` + QAPName;

  const {
    fd: fdParam,
    sections: sectionsParam,
  } = await binFileUtils.readBinFile(
      `resource/subcircuits/${paramName}.dat`,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const param = await readRSParams(fdParam, sectionsParam);
  await fdParam.close();

  const r1csIdx = String(id);
  const {
    fd: fdR1cs,
    sections: sectionsR1cs,
  } = await binFileUtils.readBinFile(
      'resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs',
      'r1cs',
      2,
      1<<22,
      1<<24,
  );
  const sR1cs = await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2);
  await fdR1cs.close();

  // if (logger) logger.debug('checkpoint0');

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
  // if (logger) logger.debug(`checkpoint4`);

  // Group parameters
  const primeR = curve.r;
  const n8r = (Math.floor( (ffjavascript.Scalar.bitLength(primeR) - 1) / 64) +1)*8;

  const mK = r1cs.m;

  // QAP constants
  const n = param.n;

  const omegaX = param.omegaX;

  const sMax = param.sMax;
  const omegaY = param.sMax;

  // FIXME: Test code 1 // --> DONE
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running Test 1`);
    assert(Fr.eq(await Fr.exp(Fr.e(n), primeR), Fr.e(n)));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaX), n), Fr.one));
    assert(Fr.eq(await Fr.exp(Fr.e(omegaY), sMax), Fr.one));
    if (logger) logger.debug(`Test 1 finished`);
  }
  // End of test code 1 //


  // if (logger) logger.debug(`checkpoint5`);

  // FIXME:  Test code 2 //
  if (TESTFLAG === 'true') {
    if (logger) logger.debug(`Running Test 2`);
    assert(Fr.eq(omegaX, Fr.e(Fr.toObject(omegaX))));
    if (logger) logger.debug(`Test 2 finished`);
  }
  // End of test code 2 //

  // / End of parameters section

  const rs={};
  rs.curve = curve;
  rs.n = n;
  rs.sMax = sMax;
  rs.omegaX = omegaX;
  rs.omegaY = omegaY;
  const lagrangeBasis = await buildCommonPolys(rs);

  if (logger) logger.debug(`k: ${id}`);
  const {
    uX: uX,
    vX: vX,
    wX: wX,
  } = await buildR1csPolys(
      curve,
      lagrangeBasis,
      r1cs,
      sR1cs);
  const fdQAP = await binFileUtils.createBinFile(
      `${dirPath}/subcircuit${id}.qap`,
      'qapp',
      1,
      2,
      1<<22,
      1<<24,
  );

  await binFileUtils.startWriteSection(fdQAP, 1);
  await fdQAP.writeULE32(1); // Groth
  await binFileUtils.endWriteSection(fdQAP);

  await binFileUtils.startWriteSection(fdQAP, 2);
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof uX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of uX at k: ${id}, i: ${i}`);
      }
      await binFileUtils.writeBigInt(fdQAP, uX[i][xi][0], n8r);
    }
  }
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof vX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of vX at k: ${id}, i: ${i}`);
      }
      await binFileUtils.writeBigInt(fdQAP, vX[i][xi][0], n8r);
    }
  }
  for (let i=0; i<mK; i++) {
    for (let xi=0; xi<n; xi++) {
      if (typeof wX[i][xi][0] != 'bigint') {
        throw new Error(`Error in coefficient type of wX at k: ${id}, i: ${i}`);
      }
      await binFileUtils.writeBigInt(fdQAP, wX[i][xi][0], n8r);
    }
  }
  await binFileUtils.endWriteSection(fdQAP);
  await fdQAP.close();
}

async function tests(logger) {
  const circuitReferenceString = `resource/circuits/test_transfer/test_transfer.crs`;
  const circuitName = `resource/circuits/test_transfer`;
  const instanceId = 1;

  const dirPath = circuitName;
  const TESTFLAG = process.env.TEST_MODE;
  const CRS = 1;

  if (logger) logger.debug(`TESTMODE = ${TESTFLAG}`);

  const {
    fd: fdRS,
    sections: sectionsRS,
  } = await binFileUtils__namespace.readBinFile(
      circuitReferenceString,
      'zkey',
      2,
      1<<25,
      1<<23,
  );
  const fdIdV = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_V.bin`,
      1<<25,
      1<<23,
  );
  const fdIdP = await fastFile__namespace.readExisting(
      `${dirPath}/Set_I_P.bin`,
      1<<25,
      1<<23,
  );
  const fdOpL = await fastFile__namespace.readExisting(
      `${dirPath}/OpList.bin`,
      1<<25,
      1<<23,
  );
  const fdWrL = await fastFile__namespace.readExisting(
      `${dirPath}/WireList.bin`,
      1<<25,
      1<<23,
  );

  const urs = {};
  const crs = {};
  urs.param = await readRSParams(fdRS, sectionsRS);
  const rs = await readRS(
      fdRS,
      sectionsRS,
      urs.param,
      CRS,
  );
  await readIndSet(fdIdV);
  await readIndSet(fdIdP);
  const OpList = await readOpList(fdOpL);
  const WireList = await readWireList(fdWrL);
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
  urs.param.n8r;
  const sMax = urs.param.sMax;
  urs.param.sD;
  // const s_F = OpList.length;
  await Fr.e(urs.param.omegaX);
  await Fr.e(urs.param.omegaY);

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
    const wtnsK = await read(
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
  const cWtns_buff = new ffjavascript.BigBuffer(32*m);
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
      
  const vk1keys_buff = new ffjavascript.BigBuffer(G1.F.n8*2*m);
  const vk2keys_buff = new ffjavascript.BigBuffer(G2.F.n8*2*m);

  const buff1 = new Uint8Array(G1.F.n8*2);
  const buff2 = new Uint8Array(G2.F.n8*2);
  for (let i=0; i<m; i++) {    
    await G1.toRprLEM(buff1, 0, crs.vk1Uxy1d[i]);
    await G2.toRprLEM(buff2, 0, crs.vk2Vxy1d[i]);
    vk1keys_buff.set(buff1, G1.F.n8*2*i);
    vk2keys_buff.set(buff2, G2.F.n8*2*i);
  }

  //const nPoints = Math.floor(vk1keys_buff.byteLength / sGIn);


  let provingTime1 = start();
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
  provingTime1 = end(provingTime1);

  let provingTime2 = start();
  const vk1AP2_buffed = await curve.G1.multiExpAffine(vk1keys_buff, cWtns_buff, false);
  const vk2BP2_buffed = await curve.G2.multiExpAffine(vk2keys_buff, cWtns_buff, false);
  provingTime2 = end(provingTime2);

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
    const out = await G1.timesFr(point, fieldval);
    return out;
  }
  async function mulFrInG2(point, fieldval) {
    const out = await G2.timesFr(point, fieldval);
    return out;
  }
}

var zkey = /*#__PURE__*/Object.freeze({
  __proto__: null,
  setup: setup,
  derive: derive,
  groth16Prove: groth16Prove,
  groth16Verify: groth16Verify,
  buildQAP: buildQAP,
  buildSingleQAP: buildSingleQAP,
  tests: tests
});

exports.zKey = zkey;
