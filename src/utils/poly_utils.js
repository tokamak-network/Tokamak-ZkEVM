import { processConstraints } from './zkey_utils.js';
import * as binFileUtils from '@iden3/binfileutils';

/**
 *
 * @param {*} curve
 * @param {*} lagrangeBasis
 * @param {*} r1cs
 * @param {*} sR1cs
 * @returns
 */
export async function buildR1csPolys(curve, lagrangeBasis, r1cs, sR1cs) {
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

export async function buildCommonPolys(rs) {
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

export async function evalPoly(Fr, coefs, x, y) {
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
export async function filterPoly(Fr, coefs1, vect, dir) {
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
export async function scalePoly(Fr, coefs, scaler) {
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

export async function addPoly(Fr, coefs1, coefs2) {
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
      temprow[j] = Fr.add(_arg1, _arg2);
    }
    res[i] = temprow;
  }
  return res;
}

export async function subPoly(Fr, coefs1, coefs2) {
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

export function mulPoly(Fr, coefs1, coefs2) {
  const N1_X = coefs1.length;
  const N1_Y = coefs1[0].length;
  const N2_X = coefs2.length;
  const N2_Y = coefs2[0].length;

  const N3_X = N1_X + N2_X - 1;
  const N3_Y = N1_Y + N2_Y - 1;

  // coefs1 = _autoTransFromObject(Fr, coefs1)
  // coefs2 = _autoTransFromObject(Fr, coefs2)

  const res = new Array(N3_X);
  for (let i = 0; i < N3_X; i++) {
    const xmin = Math.max(0, i - (N2_X - 1));
    const xmax = Math.min(i, N1_X - 1);
    const temprow = new Array(N3_Y);
    for (let j = 0; j < N3_Y; j++) {
      let sum = Fr.zero;
      const ymin = Math.max(0, j - (N2_Y - 1));
      const ymax = Math.min(j, N1_Y - 1);
      for (let k = xmin; k <= xmax; k++) {
        for (let l = ymin; l <= ymax; l++) {
          const term = Fr.mul(coefs1[k][l], coefs2[i-k][j-l]);
          sum = Fr.add(sum, term);
          temprow[j] = sum;
        }
      }
    }
    res[i] = temprow;
  }
  return res;
}

export function _transToObject(Fr, coefs) {
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

export function _autoTransFromObject(Fr, coefs) {
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

export async function divPoly(Fr, coefs1, coefs2, objectFlag) {
  coefs1 = _autoTransFromObject(Fr, coefs1);
  coefs2 = _autoTransFromObject(Fr, coefs2);
  const denom = coefs2;
  const {
    xId: deOrderX,
    yId: deOrderY,
    coef: deHighCoef,
  } = _findOrder(Fr, denom);
  let numer = coefs1;
  let res = [[Fr.zero]];

  let prevOrderX;
  let prevOrderY;

  while (1) {
    const {
      xId: nuOrderX,
      yId: nuOrderY,
      coef: nuHighCoef,
    } = _findOrder(Fr, numer);
    // console.log(`i: ${nuOrderX}, j: ${nuOrderY}`);
    if ((prevOrderX <= nuOrderX) && prevOrderY <= nuOrderY) {
      throw new Error(`infinite loop`);
    }
    if (
      (!((nuOrderX >= deOrderX) && (nuOrderY >= deOrderY))) ||
        Fr.eq(nuHighCoef, Fr.zero)
    ) break;

    const diffOrderX = nuOrderX - deOrderX;
    const diffOrderY = nuOrderY - deOrderY;
    const scaler = Fr.mul(nuHighCoef, await Fr.inv(deHighCoef));
    const {
      quo: quoterm,
      rem: rem,
    } = await _divOne(numer, denom, diffOrderX, diffOrderY, scaler);

    res = await addPoly(Fr, res, quoterm);
    numer = rem;

    prevOrderX = nuOrderX;
    prevOrderY = nuOrderY;
  }
  let finalrem = numer;

  if (!((objectFlag === undefined) || (objectFlag == false))) {
    res = _transToObject(Fr, res);
    finalrem = _transToObject(Fr, finalrem);
  }
  return {res, finalrem};

  async function _divOne(numer, denom, diffOrderX, diffOrderY, scaler) {
    const quo = Array.from(
        Array(diffOrderX + 1),
        () => new Array(diffOrderY + 1),
    );
    for (let i = 0; i < diffOrderX + 1; i++) {
      for (let j = 0; j < diffOrderY + 1; j++) {
        quo[i][j] = Fr.zero;
      }
    }
    quo[diffOrderX][diffOrderY] = scaler;
    const energy = mulPoly(Fr, quo, denom);
    const rem = reduceDimPoly(Fr, await subPoly(Fr, numer, energy));

    return {quo, rem};
  }
}

export async function divPolyByX(Fr, coefs1, coefs2, objectFlag) {
  coefs1 = _autoTransFromObject(Fr, coefs1);
  coefs2 = _autoTransFromObject(Fr, coefs2);
  const dictOrder = 0;
  const denom = coefs2;
  const {
    xId: deOrderX,
    yId: deOrderY,
    coef: deHighCoef,
  } = _findOrder(Fr, denom, dictOrder);

  let numer = coefs1;
  let res = [[Fr.zero]];

  let prevOrderX;
  let prevOrderY;

  while (1) {
    const {
      xId: nuOrderX,
      yId: nuOrderY,
      coef: nuHighCoef,
    } = _findOrder(Fr, numer, dictOrder);
    if ((prevOrderX <= nuOrderX) && prevOrderY <= nuOrderY) {
      throw new Error(`infinite loop`);
    }
    if (
      (!((nuOrderX>=deOrderX) && (nuOrderY>=deOrderY))) ||
      Fr.eq(nuHighCoef, Fr.zero)
    ) break;

    const diffOrderX = nuOrderX - deOrderX;
    const quoXY = Array.from(
        Array(diffOrderX + 1),
        () => new Array(nuOrderY+1),
    );
    for (let i = 0; i < nuOrderY + 1; i++) {
      for (let j = 0; j < diffOrderX; j++) {
        quoXY[j][i]=Fr.zero;
      }
      quoXY[diffOrderX][i] = Fr.mul(
          numer[nuOrderX][i],
          await Fr.inv(deHighCoef),
      );
    }

    const energy = mulPoly(Fr, quoXY, denom);
    const rem = reduceDimPoly(Fr, await subPoly(Fr, numer, energy));

    res = await addPoly(Fr, res, quoXY);
    numer = rem;

    prevOrderX = nuOrderX;
    prevOrderY = nuOrderY;
  }
  let finalrem = numer;

  if (!((objectFlag === undefined) || (objectFlag == false))) {
    res = _transToObject(Fr, res);
    finalrem = _transToObject(Fr, finalrem);
  }
  return {res, finalrem};
}

export async function divPolyByY(Fr, coefs1, coefs2, objectFlag) {
  coefs1 = _autoTransFromObject(Fr, coefs1);
  coefs2 = _autoTransFromObject(Fr, coefs2);
  const dictOrder = 1;
  const denom = coefs2;
  const {
    xId: deOrderX,
    yId: deOrderY,
    coef: deHighCoef,
  } = _findOrder(Fr, denom, dictOrder);

  let numer = coefs1;
  let res = [[Fr.zero]];

  let prevOrderX;
  let prevOrderY;

  while (1) {
    const {
      xId: nuOrderX,
      yId: nuOrderY,
      coef: nuHighCoef,
    } = _findOrder(Fr, numer, dictOrder);
    if ((prevOrderX <= nuOrderX) && prevOrderY <= nuOrderY) {
      throw new Error(`infinite loop`);
    }

    if (
      (!((nuOrderX>=deOrderX) && (nuOrderY>=deOrderY))) ||
      Fr.eq(nuHighCoef, Fr.zero)
    ) break;

    const diffOrderY = nuOrderY - deOrderY;
    const quoXY = Array.from(
        Array(nuOrderX + 1),
        () => new Array(diffOrderY + 1),
    );
    for (let i = 0; i < nuOrderX + 1; i++) {
      for (let j = 0; j < diffOrderY; j++) {
        quoXY[i][j] = Fr.zero;
      }
      quoXY[i][diffOrderY] = Fr.mul(
          numer[i][nuOrderY],
          await Fr.inv(deHighCoef),
      );
    }

    const energy = mulPoly(Fr, quoXY, denom);
    const rem = reduceDimPoly(Fr, await subPoly(Fr, numer, energy));

    res = await addPoly(Fr, res, quoXY);
    numer = rem;

    prevOrderX = nuOrderX;
    prevOrderY = nuOrderY;
  }
  let finalrem = numer;

  if (!((objectFlag === undefined) || (objectFlag == false))) {
    res = _transToObject(Fr, res);
    finalrem = _transToObject(Fr, finalrem);
  }
  return {res, finalrem};
}

/**
 * 
 * @param {*} Fr 
 * @param {*} coefs 
 * @param {*} dir 
 * @returns output order is the highest order in dictionary order
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
 * @returns highest orders of respective variables
 */
export function _orderPoly(Fr, coefs) {
  coefs = _autoTransFromObject(Fr, coefs);
  const {xId: xOrder} = _findOrder(Fr, coefs, 0);
  const {yId: yOrder} = _findOrder(Fr, coefs, 1);
  return {xOrder, yOrder};
}

export function reduceDimPoly(Fr, coefs) {
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

export async function readQAP(QAPName, k, m, n, n8r) {
  const {
    fd: fdQAP,
    sections: sectionsQAP,
  } = await binFileUtils.readBinFile(
      `resource/subcircuits/${QAPName}/subcircuit${k}.qap`,
      'qapp',
      1,
      1<<22,
      1<<24,
  );

  const uX = new Array(m);
  const vX = new Array(m);
  const wX = new Array(m);

  await binFileUtils.startReadUniqueSection(fdQAP, sectionsQAP, 2);
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

  await binFileUtils.endReadSection(fdQAP);
  await fdQAP.close();

  return {uX, vX, wX};
}

export async function readCircuitQAP(
    Fr,
    fdQAP,
    sectionsQAP,
    i,
    n,
    sMax,
    n8r,
) {
  await binFileUtils.startReadUniqueSection(fdQAP, sectionsQAP, 2+i);

  let degreeX;
  let degreeY;

  degreeX = await fdQAP.readULE32();
  degreeY = await fdQAP.readULE32();
  const uXY = Array.from(
      Array(degreeX),
      () => new Array(degreeY),
  );
  for (let i = 0; i < degreeX; i++) {
    for (let j = 0; j < degreeY; j++) {
      uXY[i][j] = await fdQAP.read(n8r);
    }
  }

  degreeX = await fdQAP.readULE32();
  degreeY = await fdQAP.readULE32();
  const vXY = Array.from(
      Array(degreeX),
      () => new Array(degreeY),
  );
  for (let i = 0; i < degreeX; i++) {
    for (let j = 0; j < degreeY; j++) {
      vXY[i][j] = await fdQAP.read(n8r);
    }
  }

  degreeX = await fdQAP.readULE32();
  degreeY = await fdQAP.readULE32();
  const wXY = Array.from(
      Array(degreeX),
      () => new Array(degreeY),
  );
  for (let i = 0; i < degreeX; i++) {
    for (let j = 0; j < degreeY; j++) {
      wXY[i][j] = await fdQAP.read(n8r);
    }
  }

  await binFileUtils.endReadSection(fdQAP);

  return {uXY, vXY, wXY};
}

/**
 * 
 * @param {*} Fr 
 * @param {*} _array1 m-by-1 matrix in Fr
 * @param {*} _array2 1-by-n matrix in Fr
 * @returns 
 */
export async function tensorProduct(Fr, _array1, _array2) {

  const product = new Array(_array1.length);
  for (let i = 0; i < _array1.length; i++) {
    const temprow = new Array(_array2[0].length);
    for (let j = 0; j<_array2[0].length; j++) {
      temprow[j] = Fr.mul(_array2[0][j], _array1[i][0]);
    }
    product[i] = temprow;
  }
  return product;
}

export async function fftMulPolys(Fr, coefs1, coefs2) {
  
  // TODO: copy array
  // TODO: padding coefs1 and coefs2
  /**
   * FIXME: 자동으로 차원 패딩해야 함.
   * 최고차항 계산해서 총 몇개의 좌표가 필요한지로 패딩해야 함.
   * 곱했을 때 하나의 변수의 최고차수를 포함하는 2의 제곱수로 패딩하면 됨.
  */

  // get fft of coefs1
  // perform fft repective of x
  const fftOfX1 = []
  for (let i = 0; i < coefs1.length; i++) {
    fftOfX1.push(await Fr.fft(coefs1[i]))
  }
  
  const fftOfXY1 = []
  // perform fft repective of y
  for (let i = 0; i < fftOfX1[0].length; i++) {
    const temp = []
    for (let j = 0; j < fftOfX1.length; j++) {
      temp.push(fftOfX1[j][i])
    }
    fftOfXY1.push(await Fr.fft(temp))
  }

  // get fft of coefs2
  // perform fft repective of x
  const fftOfX2 = []
  for (let i = 0; i < coefs2.length; i++) {
    fftOfX2.push(await Fr.fft(coefs2[i]))
  }
  
  const fftOfXY2 = []
  // perform fft repective of y
  for (let i = 0; i < fftOfX2[0].length; i++) {
    const temp = []
    for (let j = 0; j < fftOfX2.length; j++) {
      temp.push(fftOfX2[j][i])
    }
    fftOfXY2.push(await Fr.fft(temp))
  }


  // multiply polynomial
  if (fftOfXY1.length !== fftOfXY2.length) {
    return Error('FFTs are not compatible to multiply.')
  }
  for (let i = 0; i < fftOfXY1.length; i++) {
    for (let j = 0; j < fftOfXY1[0].length; j++) {
      fftOfXY1[i][j] = Fr.mul(fftOfXY1[i][j], fftOfXY2[i][j])
    }
  }

  // perform inverse fft respective of y
  const ifftXY = []
  for (let i = 0; i < fftOfXY1.length; i++) {
    ifftXY.push(await Fr.ifft(fftOfXY1[i]))
  }

  // perform inverse fft repective of x
  const ifftX = []
  for (let i = 0; i < ifftXY[0].length; i++) {
    const temp = []
    for (let j = 0; j < ifftXY.length; j++) {
      temp.push(ifftXY[j][i])
    }
    ifftX.push(await Fr.ifft(temp))
  }

  return ifftX
}