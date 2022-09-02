import {processConstraints} from "./uni_zkey_utils.js";
import * as binFileUtils from "@iden3/binfileutils";

export async function buildR1csPolys(curve, Lagrange_basis, r1cs_k, sR1cs_k, flagMemorySave){
    const Fr = curve.Fr;
    const ParamR1cs = r1cs_k;
    let flag_memory = true;
    if ( (flagMemorySave === undefined) || (flagMemorySave == false) ){
        flag_memory = false;
    }

    let U;
    let Uid;
    let V;
    let Vid;
    let W;
    let Wid;

    let constraints_k;

    let U_ids;
    let U_coefs;
    let V_ids;
    let V_coefs;
    let W_ids;
    let W_coefs;
    let Lagrange_poly;

    let m_k = ParamR1cs.nVars;
    if (ParamR1cs.nVars === undefined){
        m_k = ParamR1cs.m;
    }
    let n_k = ParamR1cs.nConstraints;

    let uX_i = new Array(m_k);
    let vX_i = new Array(m_k);
    let wX_i = new Array(m_k);
    console.log(`checkpoint 0-0`)
    
    constraints_k = await processConstraints(curve, n_k, sR1cs_k);
    U = constraints_k.U
    Uid = constraints_k.Uid
    V = constraints_k.V
    Vid = constraints_k.Vid
    W = constraints_k.W
    Wid = constraints_k.Wid

    console.log(`checkpoint 0-1`)

    for(var i=0; i<m_k; i++){
        uX_i[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
        vX_i[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
        wX_i[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
        if (flag_memory){
            uX_i[i] = _transToObject(Fr, uX_i[i]);
            vX_i[i] = _transToObject(Fr, vX_i[i]);
            wX_i[i] = _transToObject(Fr, wX_i[i]);
        }
    }
    let item_i;
    for(var i=0; i<ParamR1cs.nConstraints; i++){
        U_ids = Uid[i];
        U_coefs = U[i];
        V_ids = Vid[i];
        V_coefs = V[i];
        W_ids = Wid[i];
        W_coefs = W[i];
        for(var j=0; j<U_ids.length; j++){
            let U_idx=U_ids[j]
            if(U_idx>=0){
                Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], U_coefs[j]);
                item_i = await addPoly(Fr, uX_i[U_idx], Lagrange_poly);
                if (flag_memory){
                    item_i = _transToObject(Fr, item_i);
                }
                uX_i[U_idx] = item_i;
            }
        }
        for(var j=0; j<V_ids.length; j++){
            let V_idx=V_ids[j]
            if(V_idx>=0){
                Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], V_coefs[j]);
                item_i = await addPoly(Fr, vX_i[V_idx], Lagrange_poly);
                if (flag_memory){
                    item_i = _transToObject(Fr, item_i);
                }
                vX_i[V_idx] = item_i;
            }
        }
        for(var j=0; j<W_ids.length; j++){
            let W_idx=W_ids[j]
            if(W_idx>=0){
                Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], W_coefs[j]);
                item_i = await addPoly(Fr, wX_i[W_idx], Lagrange_poly);
                if (flag_memory){
                    item_i = _transToObject(Fr, item_i);
                }
                wX_i[W_idx] = item_i;
            }
        }
    }

    console.log(`checkpoint 0-2`)

    return {uX_i, vX_i, wX_i}
    // uX_ki[k][i] = polynomial of the i-th wire in the k-th subcircuit.
}

export async function buildCommonPolys(rs, flagMemorySave){
    const curve = rs.curve;
    const Fr = curve.Fr;
    const n = rs.n;
    const s_max = rs.s_max;
    const omega_x = await Fr.e(rs.omega_x);
    let flag_memory = true;
    if ( (flagMemorySave === undefined) || (flagMemorySave == false) ){
        flag_memory = false;
    }

    console.log(`checkpoint 0-0`)
    let Lagrange_basis = new Array(n);
    let item_i;
    for(var i=0; i<n; i++){
        let terms = Array.from(Array(n), () => new Array(1));
        let multiplier = await Fr.exp(Fr.inv(omega_x),i);
        terms[0][0]=Fr.one;
        for(var j=1; j<n; j++){
            terms[j][0]=await Fr.mul(terms[j-1][0], multiplier);
        }
        item_i = await scalePoly(Fr, terms, Fr.inv(Fr.e(n)));
        if (flag_memory){
            item_i = _transToObject(Fr, item_i);
        }
        Lagrange_basis[i] = item_i;
    }
    console.log(`checkpoint 0-1`)

   
    return Lagrange_basis
    // uX_ki[k][i] = polynomial of the i-th wire in the k-th subcircuit.
}

function _polyCheck(coefs){
    //Assert if coefs is a matrix of Fr elements
    let NVars = 0;
    let currObject = coefs;
    while(Array.isArray(currObject)){
        NVars += 1;
        currObject = currObject[0];
    }
    if (NVars != 2){
        throw new Error(`A polynomial is not bivariate (coefs is ${NVars}-dimensional)`);
    }
    const N_X = coefs.length;
    const N_Y = coefs[0].length;
    for(var i=1; i<N_X; i++){
        if (N_Y != coefs[i].length){
            throw new Error(`Invalid format of coefficient matrix for a polynomial`);
        }
    }
    return {N_X, N_Y}
}

export async function evalPoly(Fr, coefs, x, y){
    const {N_X: N_X, N_Y: N_Y} = _polyCheck(coefs);

    coefs = _autoTransFromObject(Fr, coefs)
    let sum = Fr.zero;
    for (var i=0; i<N_X; i++){
        for (var j=0; j<N_Y; j++){
            let xy_pows = Fr.mul(await Fr.exp(x, i), await Fr.exp(y,j));
            let term = Fr.mul(xy_pows, coefs[i][j]);
            sum = Fr.add(sum, term);
        }
    }
    return sum
}

export async function filterPoly(Fr, coefs1, vect, dir){
    // Elemetwise multiplication of the coefficients of a polynomial along with a directed variable with a filtering vector
    // dir? Y:X
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    if ( !((!dir) && (N1_X == vect.length) || (dir) && (N1_Y == vect.length)) ){
        throw new Error('filterPoly: the lengths of two coefficients are not equal')
    }

    coefs1 = _autoTransFromObject(Fr, coefs1)

    let res = Array.from(Array(N1_X), () => new Array(N1_Y));
    for(var i=0; i<N1_X; i++){
        for(var j=0; j<N1_Y; j++){
            let scalerId;
            if (!dir){
                scalerId = i;
            } else{
                scalerId = j;
            }
            let target = coefs1[i][j];
            if (target === undefined)
            {
                target = Fr.one;
            }
            res[i][j] = Fr.mul(target, vect[scalerId]); 
        }
    }
    return res
}

export async function scalePoly(Fr, coefs, scaler){
    // Assume scaler is in Fr
    const {N_X: NSlots_X, N_Y: NSlots_Y} = _polyCheck(coefs);
    coefs = _autoTransFromObject(Fr, coefs)

    let res = Array.from(Array(NSlots_X), () => new Array(NSlots_Y));
    for(var i=0; i<NSlots_X; i++){
        for(var j=0; j<NSlots_Y; j++){
            let target = coefs[i][j];
            if (target === undefined)
            {
                target = Fr.one;
            }
            res[i][j] = Fr.mul(target, scaler); 
        }
    }
    return res;
}

export async function mulUniPolys(Fr, coefs1, vector){
    // coefs1 is the coefficients(2-dim) of a X-variate polynomial, vector is the coefficients(1-dim) of a Y-variate polynomial
    const {N_X: N_X, N_Y: N_Y} = _polyCheck(coefs1);
    if ( N_Y != 1 ){
        throw new Error(`mulUniPolys: coefs1 is not a X-variate polynomial`);
    }
    if ( !( Array.isArray(vector) && !Array.isArray(vector[0]) ) ){
        throw new Error(`mulUniPolys: vector is a not 1-dim array`);
    }
    coefs1 = _autoTransFromObject(Fr, coefs1);
    const N2_X = N_X;
    const N2_Y = vector.length;
    let res = Array.from(Array(N2_X), () => new Array(N2_Y));
    for (var i=0; i<N2_X; i++){
        let X_coef = coefs1[i][0];
        for (var j=0; j<N2_Y; j++){
            let Y_coef = vector[j];
            res[i][j] = Fr.mul(X_coef, Y_coef);
        }
    }
    return res;
}
export async function mulUniPolys2(Fr, coefsX, coefsY){
    // coefsX is the coefficients(1-dim) of a X-variate polynomial, coefsY is the coefficients(1-dim) of a Y-variate polynomial
    const N_Y = coefsY.length;
    
    const res = [];
    for (var j=0; j<N_Y; j++){
        let scaler = coefsY[j];
        const temp = coefsX.map(x => Fr.mul(Fr.e(x), Fr.e(scaler)));
        res.push(temp);
    }
    return res;
}

export async function addPoly(Fr, coefs1, coefs2, SUBFLAG){
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);

    coefs1 = _autoTransFromObject(Fr, coefs1)
    coefs2 = _autoTransFromObject(Fr, coefs2)

    if (SUBFLAG !== undefined){
        if (SUBFLAG == 1){
            coefs2 = await scalePoly(Fr, coefs2, Fr.negone);
        } else if (SUBFLAG !=0){
            throw new Error(`Unexpected Subflag in addPoly`);
        }
    }
    const N3_X = Math.max(N1_X, N2_X);
    const N3_Y = Math.max(N1_Y, N2_Y);

    let res = Array.from(Array(N3_X), () => new Array(N3_Y));
    for (var i=0; i<N3_X; i++){
        for (var j=0; j<N3_Y; j++){
            res[i][j] = Fr.zero;
        }
    }

    for (var i=0; i<N1_X; i++){
        for (var j=0; j<N1_Y; j++){
            res[i][j] = Fr.add(res[i][j], coefs1[i][j]);
        }
    }

    for (var i=0; i<N2_X; i++){
        for (var j=0; j<N2_Y; j++){
            res[i][j] = Fr.add(res[i][j], coefs2[i][j]);
        }
    }
    return res
}

export async function mulPoly(Fr, coefs1, coefs2, object_flag){
    
    coefs1 = reduceDimPoly(Fr, coefs1);
    coefs2 = reduceDimPoly(Fr, coefs2);

    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);
    const N3_X = N1_X+N2_X-1;
    const N3_Y = N1_Y+N2_Y-1;

    coefs1 = _autoTransFromObject(Fr, coefs1)
    coefs2 = _autoTransFromObject(Fr, coefs2)

    let res = Array.from(Array(N3_X), () => new Array(N3_Y));
    for (var i=0; i<N3_X; i++){
        for (var j=0; j<N3_Y; j++){
            let sum = Fr.zero;
            for (var ii=0; ii<=Math.min(i,N1_X-1); ii++){
                for (var jj=0; jj<=Math.min(j,N1_Y-1); jj++){
                    if (((i-ii)>=0 && i-ii<N2_X) && ((j-jj)>=0 && j-jj<N2_Y)){
                        let term = Fr.mul(coefs1[ii][jj], coefs2[i-ii][j-jj]);
                        sum = Fr.add(sum, term);
                    }
                }
            }
            if ((object_flag === undefined) || (object_flag == false)){
                res[i][j] = sum;
            } else{
                res[i][j] = Fr.toObject(sum);
            }
        }
    }
    return res
}

export function _transToObject(Fr, coefs){
    if ( (typeof coefs[0][0] == "bigint") || (coefs[0][0] === undefined) ){
        return coefs
    } else if(typeof coefs[0][0] != "object"){
        throw new Error('transFromObject: unexpected input type')
    }
    
    let res = Array.from(Array(coefs.length), () => new Array(coefs[0].length))
    for (var i=0; i<coefs.length; i++){
        for (var j=0; j<coefs[0].length; j++){
            res[i][j] = Fr.toObject(coefs[i][j]);
        }
    }
    return res
}

export function _autoTransFromObject(Fr, coefs){
    if ( (typeof coefs[0][0] == "object") || (coefs[0][0] === undefined) ){
        return coefs
    } else if(typeof coefs[0][0] != "bigint"){
        throw new Error('autoTransFromObject: unexpected input type')
    }
    
    let res = Array.from(Array(coefs.length), () => new Array(coefs[0].length))
    for (var i=0; i<coefs.length; i++){
        for (var j=0; j<coefs[0].length; j++){
            res[i][j] = Fr.fromObject(coefs[i][j]);
        }
    }
    return res
}

export async function divPoly(Fr, coefs1, coefs2, object_flag){
    coefs1 = _autoTransFromObject(Fr, coefs1);
    coefs2 = _autoTransFromObject(Fr, coefs2);
    const denom = coefs2;
    const {xId: de_order_X, yId: de_order_Y, coef: de_high_coef} = _findOrder(Fr, denom);
    //console.log(`i: ${de_order_X}, j: ${de_order_Y}`)
    
    let numer = coefs1;
    let res = [[Fr.zero]];

    let prev_order_X;
    let prev_order_Y;
  
    while (1){
        let {xId: nu_order_X, yId: nu_order_Y, coef: nu_high_coef} = _findOrder(Fr, numer);
        console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`)
        if ((prev_order_X <= nu_order_X) && prev_order_Y <= nu_order_Y){
            throw new Error(`infinite loop`)
        }
        if ( (!((nu_order_X>=de_order_X) && (nu_order_Y>=de_order_Y))) || Fr.eq(nu_high_coef, Fr.zero) ){
            break;
        }
        let diff_order_X = nu_order_X - de_order_X;
        let diff_order_Y = nu_order_Y - de_order_Y;
        let scaler = Fr.mul(nu_high_coef, await Fr.inv(de_high_coef));
        let {quo: quoterm, rem: rem} = await _divOne(numer, denom, diff_order_X, diff_order_Y, scaler);

        res = await addPoly(Fr, res, quoterm);
        numer = rem;

        prev_order_X = nu_order_X;
        prev_order_Y = nu_order_Y
    }
    let finalrem = numer;

    if (!((object_flag === undefined) || (object_flag == false))){
        res = _transToObject(Fr, res);
        finalrem = _transToObject(Fr, finalrem);
    }
    return {res, finalrem}

    async function _divOne(numer, denom, diff_order_X, diff_order_Y, scaler){
        let quo = Array.from(Array(diff_order_X+1), () => new Array(diff_order_Y+1));
        for (var i=0; i<diff_order_X+1; i++){
            for (var j=0; j<diff_order_Y+1; j++){
                quo[i][j] = Fr.zero;
            }
        }
        quo[diff_order_X][diff_order_Y] = scaler;
        const energy = await mulPoly(Fr, quo, denom);
        //console.log(`x_o_dif: ${diff_order_X}, y_o_dif: ${diff_order_Y}`)
        //console.log(_transToObject(Fr, numer))
        const rem = reduceDimPoly(Fr, await addPoly(Fr, numer, energy, true));

        return {quo, rem}
    }
}

export async function divPolyByX(Fr, coefs1, coefs2, object_flag){
    coefs1 = _autoTransFromObject(Fr, coefs1);
    coefs2 = _autoTransFromObject(Fr, coefs2);
    const dictOrder = 0;
    const denom = coefs2;
    const {xId: de_order_X, yId: de_order_Y, coef: de_high_coef} = _findOrder(Fr, denom, dictOrder);
    //console.log(`i: ${de_order_X}, j: ${de_order_Y}`)
    
    let numer = coefs1;
    let res = [[Fr.zero]];

    let prev_order_X;
    let prev_order_Y;
  
    while (1){
        let {xId: nu_order_X, yId: nu_order_Y, coef: nu_high_coef} = _findOrder(Fr, numer, dictOrder);
        console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`)
        if ((prev_order_X <= nu_order_X) && prev_order_Y <= nu_order_Y){
            throw new Error(`infinite loop`)
        }
        if ( (!((nu_order_X>=de_order_X) && (nu_order_Y>=de_order_Y))) || Fr.eq(nu_high_coef, Fr.zero) ){
            break;
        }
        let diff_order_X = nu_order_X - de_order_X;
        let quoXY = Array.from(Array(diff_order_X+1), () => new Array(nu_order_Y+1));
        for (var j=0; j<nu_order_Y+1; j++){
            for (var i=0; i<diff_order_X; i++){
                quoXY[i][j]=Fr.zero;
            }
            quoXY[diff_order_X][j] = Fr.mul(numer[nu_order_X][j], await Fr.inv(de_high_coef));
        }

        const energy = await mulPoly(Fr, quoXY, denom);
        const rem = reduceDimPoly(Fr, await addPoly(Fr, numer, energy, true));            

        res = await addPoly(Fr, res, quoXY);
        numer = rem;

        prev_order_X = nu_order_X;
        prev_order_Y = nu_order_Y
    }
    let finalrem = numer;

    if (!((object_flag === undefined) || (object_flag == false))){
        res = _transToObject(Fr, res);
        finalrem = _transToObject(Fr, finalrem);
    }
    return {res, finalrem}
}

export async function divPolyByY(Fr, coefs1, coefs2, object_flag){
    coefs1 = _autoTransFromObject(Fr, coefs1);
    coefs2 = _autoTransFromObject(Fr, coefs2);
    const dictOrder = 1;
    const denom = coefs2;
    const {xId: de_order_X, yId: de_order_Y, coef: de_high_coef} = _findOrder(Fr, denom, dictOrder);
    //console.log(`i: ${de_order_X}, j: ${de_order_Y}`)
    
    let numer = coefs1;
    let res = [[Fr.zero]];

    let prev_order_X;
    let prev_order_Y;
  
    while (1){
        let {xId: nu_order_X, yId: nu_order_Y, coef: nu_high_coef} = _findOrder(Fr, numer, dictOrder);
        console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`)
        if ((prev_order_X <= nu_order_X) && prev_order_Y <= nu_order_Y){
            throw new Error(`infinite loop`)
        }
        if ( (!((nu_order_X>=de_order_X) && (nu_order_Y>=de_order_Y))) || Fr.eq(nu_high_coef, Fr.zero) ){
            break;
        }
        let diff_order_Y = nu_order_Y - de_order_Y;
        let quoXY = Array.from(Array(nu_order_X+1), () => new Array(diff_order_Y+1));
        for (var i=0; i<nu_order_X+1; i++){
            for (var j=0; j<diff_order_Y; j++){
                quoXY[i][j]=Fr.zero;
            }
            quoXY[i][diff_order_Y] = Fr.mul(numer[i][nu_order_Y], await Fr.inv(de_high_coef));
        }

        const energy = await mulPoly(Fr, quoXY, denom);
        const rem = reduceDimPoly(Fr, await addPoly(Fr, numer, energy, true));            

        res = await addPoly(Fr, res, quoXY);
        numer = rem;

        prev_order_X = nu_order_X;
        prev_order_Y = nu_order_Y
    }
    let finalrem = numer;

    if (!((object_flag === undefined) || (object_flag == false))){
        res = _transToObject(Fr, res);
        finalrem = _transToObject(Fr, finalrem);
    }
    return {res, finalrem}
}

function _findOrder(Fr, coefs, dir){
    /// output order is the highest order in dictionary order
    const {N_X: N_X, N_Y: N_Y} = _polyCheck(coefs);
    const NumEl=N_X*N_Y;
    let xId;
    let yId;
    let coef;
    let modular;
    if( (dir === undefined) || (dir == 0) ){
        modular = N_Y;
    } else if( dir == 1 ){
        modular = N_X;
    } else {
        throw new Error('findOrder: unexpected direction')
    }
    for (var i=NumEl-1; i>=0; i--){
        if( (dir === undefined) || (dir == 0) ){
            xId = Math.floor(i/modular);
            yId = i % modular;
        } else {
            yId = Math.floor(i/modular);
            xId = i % modular;
        }
        coef = coefs[xId][yId];
        if (!Fr.eq(coef, Fr.zero)){
            break;
        }
    }
    return {xId, yId, coef}
}

export function _orderPoly(Fr, coefs){
    /// highest orders of respective variables
    coefs = _autoTransFromObject(Fr, coefs);
    const {xId: x_order} = _findOrder(Fr, coefs, 0);
    const {yId: y_order} = _findOrder(Fr, coefs, 1);
    return {x_order, y_order}
}

export function reduceDimPoly(Fr, coefs){
    const {x_order: x_order, y_order: y_order} = _orderPoly(Fr,coefs);
    const N_X = x_order+1;
    const N_Y = y_order+1;
    let res = Array.from(Array(N_X), () => new Array(N_Y));
    for (var i=0; i<N_X; i++){
        res[i] = coefs[i].slice(0, N_Y);
    }

    return res
}

export async function readQAP(QAPName, k, m_k, n, n8r){
    
    const {fd: fdQAP, sections: sectionsQAP}  = await binFileUtils.readBinFile(`resource/subcircuits/${QAPName}/subcircuit${k}.qap`, "qapp", 1, 1<<22, 1<<24);
        
    let uX_i = new Array(m_k);
    let vX_i = new Array(m_k);
    let wX_i = new Array(m_k);
    await binFileUtils.startReadUniqueSection(fdQAP,sectionsQAP, 2);
    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils.readBigInt(fdQAP, n8r);
        }
        uX_i[i] = data;
    }
    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils.readBigInt(fdQAP, n8r);
        }
        vX_i[i] = data;
    }

    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils.readBigInt(fdQAP, n8r);
        }
        wX_i[i] = data;
    }

    await binFileUtils.endReadSection(fdQAP)
    await fdQAP.close();

    return {uX_i, vX_i, wX_i}
}

export async function readCircuitQAP_i(Fr, fdQAP, sectionsQAP, i, n, s_max, n8r){
    
    
    await binFileUtils.startReadUniqueSection(fdQAP,sectionsQAP, 2+i);

    let uXY_i = Array.from(Array(n), () => new Array(s_max));
    let vXY_i = Array.from(Array(n), () => new Array(s_max));
    let wXY_i = Array.from(Array(n), () => new Array(s_max));

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            uXY_i[xi][yi] = Fr.e(await binFileUtils.readBigInt(fdQAP, n8r));
        }
    }

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            vXY_i[xi][yi] = Fr.e(await binFileUtils.readBigInt(fdQAP, n8r));
        }
    }

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            wXY_i[xi][yi] = Fr.e(await binFileUtils.readBigInt(fdQAP, n8r));
        }
    }

    await binFileUtils.endReadSection(fdQAP)

    return {uXY_i, vXY_i, wXY_i}
}
