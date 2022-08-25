import {processConstraints} from "./uni_zkey_utils.js";

export async function buildR1csPolys(rs, sR1cs){
    const curve = rs.curve;
    const Fr = curve.Fr;
    const n = rs.n;
    const s_max = rs.s_max;
    const omega_x = await Fr.e(rs.omega_x);
    const omega_y = await Fr.e(rs.omega_y);
    const ParamR1cs = rs.r1cs;
    const s_D = rs.s_D;

    let Lagrange_basis = new Array(n);
    for(var i=0; i<n; i++){
        let terms = Array.from(Array(n), () => new Array(1));
        let multiplier = await Fr.exp(Fr.inv(omega_x),i);
        terms[0][0]=Fr.one;
        for(var j=1; j<n; j++){
            terms[j][0]=await Fr.mul(terms[j-1][0], multiplier);
        }
        Lagrange_basis[i]=await scalePoly(Fr, terms, Fr.inv(Fr.e(n)));
    }

    let uX_ki = new Array(s_D);
    let vX_ki = new Array(s_D);
    let wX_ki = new Array(s_D);

    for(var k=0; k<s_D; k++){
        let m_k = ParamR1cs[k].nVars;
        if (ParamR1cs[k].nVars === undefined){
            m_k = ParamR1cs[k].m;
        }
        let n_k = ParamR1cs[k].nConstraints;
        
        const constraints_k = await processConstraints(curve, n_k, sR1cs[k]);
        let U = constraints_k.U
        let Uid = constraints_k.Uid
        let V = constraints_k.V
        let Vid = constraints_k.Vid
        let W = constraints_k.W
        let Wid = constraints_k.Wid

        let uX = new Array(m_k);
        let vX = new Array(m_k);
        let wX = new Array(m_k);

        for(var i=0; i<m_k; i++){
            uX[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
            vX[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
            wX[i] = await scalePoly(Fr, Lagrange_basis[0], Fr.zero);
        }
        for(var i=0; i<ParamR1cs[k].nConstraints; i++){
            let U_ids = Uid[i];
            let U_coefs = U[i];
            let V_ids = Vid[i];
            let V_coefs = V[i];
            let W_ids = Wid[i];
            let W_coefs = W[i];
            let Lagrange_poly;
            for(var j=0; j<U_ids.length; j++){
                let U_idx=U_ids[j]
                if(U_idx>=0){
                    Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], U_coefs[j]);
                    uX[U_idx] = await addPoly(Fr, uX[U_idx], Lagrange_poly);
                }
            }
            for(var j=0; j<V_ids.length; j++){
                let V_idx=V_ids[j]
                if(V_idx>=0){
                    Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], V_coefs[j]);
                    vX[V_idx] = await addPoly(Fr, vX[V_idx], Lagrange_poly);
                }
            }
            for(var j=0; j<W_ids.length; j++){
                let W_idx=W_ids[j]
                if(W_idx>=0){
                    Lagrange_poly = await scalePoly(Fr, Lagrange_basis[i], W_coefs[j]);
                    wX[W_idx] = await addPoly(Fr, wX[W_idx], Lagrange_poly);
                }
            }
        }
        uX_ki[k] = uX;
        vX_ki[k] = vX;
        wX_ki[k] = wX;
    }

    //let fY = Array.from(Array(1), () => new Array(s_max));
    //const Fr_s_max_inv = Fr.inv(Fr.e(s_max));
    //fY = await scalePoly(Fr, fY, Fr_s_max_inv);

    let tX = Array.from(Array(n+1), () => new Array(1));
    let tY = Array.from(Array(1), () => new Array(s_max+1));
    tX = await scalePoly(Fr, tX, Fr.zero);
    tY = await scalePoly(Fr, tY, Fr.zero);
    tX[0][0] = Fr.negone;
    tX[n][0] = Fr.one;
    tY[0][0] = Fr.negone;
    tY[0][s_max] = Fr.one;
    const tXY = await mulPoly(Fr, tX, tY);
    // t(X,Y) = (X^n-1) * (X^s_max-1) = PI(X-omega_x^i) for i=0,...,n * PI(Y-omega_y^j) for j =0,...,s_max
    // P(X,Y) = (SUM c_i*u_i(X,Y))*(SUM c_i*v_i(X,Y)) - (SUM c_i*w_i(X,Y)) = 0 at X=omega_x^i, Y=omega_y^j
    // <=> P(X,Y) has zeros at least the points omega_x^i and omega_y^j
    // <=> there exists h(X,Y) such that p(X,Y) = t(X,Y) * h(X,Y)
    // <=> finding h(X,Y) is the goal of Prove algorithm
    return {uX_ki, vX_ki, wX_ki, tXY, tX, tY}
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
    return res
}

export async function addPoly(Fr, coefs1, coefs2, SUBFLAG){
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);

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
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);
    const N3_X = N1_X+N2_X-1;
    const N3_Y = N1_Y+N2_Y-1;

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
    let res = Array.from(Array(coefs.length), () => new Array(coefs[0].length))
    for (var i=0; i<coefs.length; i++){
        for (var j=0; j<coefs[0].length; j++){
            res[i][j] = Fr.toObject(coefs[i][j]);
        }
    }
    return res
}

export async function divPoly(Fr, coefs1, coefs2, object_flag){
    const denom = coefs2;
    const {xId: de_order_X, yId: de_order_Y, coef: de_high_coef} = _findOrder(Fr, denom);
    //console.log(`i: ${de_order_X}, j: ${de_order_Y}`)
    
    let numer = coefs1;
    let res = [[Fr.zero]];

    let prev_order_X;
    let prev_order_Y;
  
    while (1){
        let {xId: nu_order_X, yId: nu_order_Y, coef: nu_high_coef} = _findOrder(Fr, numer);
        //console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`)
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
        const rem = await addPoly(Fr, numer, energy, true);

        return {quo, rem}
    }
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
    const {xId: x_order} = _findOrder(Fr, coefs, 0);
    const {yId: y_order} = _findOrder(Fr, coefs, 1);
    return {x_order, y_order}
}