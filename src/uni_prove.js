/*
    Copyright 2018 0KIMS association.

    This file is part of snarkJS.

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

import * as binFileUtils from "@iden3/binfileutils";
import * as polyUtils from "./uni_poly_utils.js"
import * as zkeyUtils from "./uni_zkey_utils.js";
import * as wtnsUtils from "./wtns_utils.js";
import generateWitness from "./generate_witness.js"
import * as fastFile from "fastfile";
import { getCurveFromQ as getCurve } from "./curves.js";
import { log2 } from "./misc.js";
import { Scalar, utils, BigBuffer } from "ffjavascript";
const {stringifyBigInts} = utils;
import * as misc from './misc.js'

export default async function groth16Prove(cRSName, proofName, circuitName, entropy) {
    const dirPath = `resource/circuits/${circuitName}`
    const TESTFLAG = true;
    const CRS = 1;

    const {fd: fdRS, sections: sectionsRS} = await binFileUtils.readBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 2, 1<<25, 1<<23);
    const fdIdV = await fastFile.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
    const fdWrL = await fastFile.readExisting(`${dirPath}/WireList.bin`, 1<<25, 1<<23);
    
    const urs = {}
    const crs = {}
    urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS);
    const rs = await zkeyUtils.readRS(fdRS, sectionsRS, urs.param, CRS);
    const IdSetV = await zkeyUtils.readIndSet(fdIdV);
    const IdSetP = await zkeyUtils.readIndSet(fdIdP);
    const OpList = await zkeyUtils.readOpList(fdOpL);
    const WireList = await zkeyUtils.readWireList(fdWrL);
    await fdRS.close();
    await fdIdV.close();
    await fdIdP.close();
    await fdOpL.close();
    await fdWrL.close();

    const fdPrf = await binFileUtils.createBinFile(`${dirPath}/${proofName}.proof`, "prof", 1, 2, 1<<22, 1<<24);

    urs.sigma_G = rs.sigma_G;
    urs.sigma_H = rs.sigma_H;
    crs.param = rs.crs.param;
    crs.vk1_uxy_i = rs.crs.vk1_uxy_i;
    crs.vk1_vxy_i = rs.crs.vk1_vxy_i;
    crs.vk1_zxy_i = rs.crs.vk1_zxy_i;
    crs.vk1_axy_i = rs.crs.vk1_axy_i;
    crs.vk2_vxy_i = rs.crs.vk2_vxy_i;

    const ParamR1cs = urs.param.r1cs
    const curve = urs.param.curve
    const G1 = urs.param.curve.G1
    const G2 = urs.param.curve.G2
    const Fr = urs.param.curve.Fr
    const n8 = curve.Fr.n8;
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const n = urs.param.n
    const s_max = urs.param.s_max
    const s_D = urs.param.s_D
    const s_F = OpList.length;
    const omega_x = await Fr.e(urs.param.omega_x)
    const omega_y = await Fr.e(urs.param.omega_y)
    
    const mPublic = crs.param.mPublic;
    const mPrivate = crs.param.mPrivate;
    const m = mPublic + mPrivate;
     

    if(!((mPublic == IdSetV.set.length) && (mPrivate == IdSetP.set.length)))
    {
        throw new Error(`Error in crs file: invalid crs parameters. mPublic: ${mPublic}, IdSetV: ${IdSetV.set.length}, mPrivate: ${mPrivate}, IdSetP: ${IdSetP.set.length},`)
    }

    /// load subcircuit polynomials
    const sR1cs = new Array(); 
    for(var i=0; i<s_D; i++){
        let r1csIdx = String(i);
        const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 1, 1<<22, 1<<24);
        sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
        await fdR1cs.close();
    }
    const {uX_ki: uX_ki, vX_ki: vX_ki, wX_ki: wX_ki, tXY: tXY, tX: tX, tY: tY} = await polyUtils.buildR1csPolys(urs.param, sR1cs);
    

    let fY_k = new Array(s_F);
    const fY = Array.from(Array(1), () => new Array(s_max));
    const Fr_s_max_inv = Fr.inv(Fr.e(s_max));
    for (var k=0; k<s_F; k++){
        let inv_omega_y_k = new Array(s_max);
        inv_omega_y_k[0] = Fr.one;
        for (i=1; i<s_max; i++){
            inv_omega_y_k[i] = Fr.mul(inv_omega_y_k[i-1], await Fr.exp(Fr.inv(omega_y), k));
        }
        let LagY = await polyUtils.filterPoly(Fr, fY, inv_omega_y_k, 1);
        fY_k[k] = await polyUtils.scalePoly(Fr, LagY, Fr_s_max_inv);
    }
    /// TEST CODE 1
    if (TESTFLAG){
        console.log('Running Test 1')
        const EVAL_k = 2;
        const eval_point = await Fr.exp(omega_y, EVAL_k);
        for (var k=0; k<s_F; k++){
            let flag = await polyUtils.evalPoly(Fr, fY_k[k], Fr.one, eval_point);
            if ( !( (k == EVAL_k && Fr.eq(flag, Fr.one)) || (k != EVAL_k && Fr.eq(flag, Fr.zero)) ) ){
                throw new Error('Error in fY_k');
            }
        }
        console.log(`Test 1 finished`)
    }
    /// End of TEST CODE 1    
    
    
    /// derive circuit polynomials
    const QAP = {};
    let uXY_i = new Array(m);
    let vXY_i = new Array(m);
    let wXY_i = new Array(m);
    let InitPoly = Array.from(Array(n), () => new Array(s_max));
    InitPoly = await polyUtils.scalePoly(Fr, InitPoly, Fr.zero);
    for (var i = 0; i<m; i++){
        uXY_i[i] = InitPoly;
        vXY_i[i] = InitPoly;
        wXY_i[i] = InitPoly;
    }
    for(var i=0; i<m; i++){
        let arrayIdx;
        let PreImgSet;
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i)
            PreImgSet = IdSetV.PreImgs[arrayIdx]
        } else {
            arrayIdx = IdSetP.set.indexOf(i)
            PreImgSet = IdSetP.PreImgs[arrayIdx]
        }
        let PreImgSize = PreImgSet.length;
        for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
            let kPrime = PreImgSet[PreImgIdx][0];
            let iPrime = PreImgSet[PreImgIdx][1];
            let s_kPrime = OpList[kPrime];

            let u_term = await polyUtils.mulPoly(Fr, uX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            uXY_i[i] = await polyUtils.addPoly(Fr, uXY_i[i], u_term);

            let v_term = await polyUtils.mulPoly(Fr, vX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            vXY_i[i] = await polyUtils.addPoly(Fr, vXY_i[i], v_term);

            let w_term = await polyUtils.mulPoly(Fr, wX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            wXY_i[i] = await polyUtils.addPoly(Fr, wXY_i[i], w_term);
        }
    }


    // generate witness for each subcircuit
    await generateWitness(circuitName);
    const wtns = [];
    for(var k=0; k<OpList.length; k++ ){
        const wtns_k = await wtnsUtils.read(`${dirPath}/witness/witness${k}.wtns`);
        const kPrime = OpList[k];
        const m_k = ParamR1cs[kPrime].m;
        if (wtns_k.length != m_k) {
            throw new Error(`Invalid witness length. Circuit: ${m_k}, witness: ${wtns.length}`);
        }
        wtns.push(wtns_k);
    }

    /// TEST CODE 2
    if (TESTFLAG == true)
    {   
        console.log(`Running test 2`)
        const sR1cs = new Array();
        for(var k=0; k<s_D; k++){
            const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile(`resource/subcircuits/r1cs/subcircuit${k}.r1cs`, "r1cs", 1, 1<<22, 1<<24);
            sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
            await fdR1cs.close();
        }
        for(var k=0; k<OpList.length; k++){
            const kPrime = OpList[k];
            let processResults_k
            processResults_k = await zkeyUtils.processConstraints(curve, ParamR1cs[kPrime].nConstraints, sR1cs[kPrime]); // to fill U, V, W
            let U = processResults_k.U
            let Uid = processResults_k.Uid
            let V = processResults_k.V
            let Vid = processResults_k.Vid
            let W = processResults_k.W
            let Wid = processResults_k.Wid
            const wtns_k = wtns[k];

            let U_ids
            let U_coefs
            let V_ids
            let V_coefs
            let W_ids
            let W_coefs

            for(var i=0; i<ParamR1cs[kPrime].nConstraints; i++){
                U_ids=Uid[i];
                U_coefs=U[i];
                V_ids=Vid[i];
                V_coefs=V[i];
                W_ids=Wid[i];
                W_coefs=W[i];

                let constraintU = Fr.e(0);
                for(var j=0; j<U_ids.length; j++){
                    let term = Fr.mul(U_coefs[j], Fr.e(wtns_k[U_ids[j]]));
                    constraintU = Fr.add(constraintU, term);
                }
                let constraintV = Fr.e(0);
                for(var j=0; j<V_ids.length; j++){
                    let term = Fr.mul(V_coefs[j], Fr.e(wtns_k[V_ids[j]]));
                    constraintV = Fr.add(constraintV, term);
                }
                let constraintW = Fr.mul(constraintU, constraintV);
                for(var j=0; j<W_ids.length; j++){
                    let term = Fr.mul(W_coefs[j], Fr.e(wtns_k[W_ids[j]]));
                    constraintW = Fr.sub(constraintW, term);
                }
                if(!Fr.eq(constraintW, Fr.e(0))){
                    console.log(`U_ids: ${U_ids}`)
                    console.log(`U_coefs: ${U_coefs}`)
                    console.log(`V_ids: ${V_ids}`)
                    console.log(`V_coefs: ${V_coefs}`)
                    console.log(`W_ids: ${W_ids}`)
                    console.log(`W_coefs: ${W_coefs}`)
                    console.log(`wtns_k: ${wtns_k}`)
                    throw new Error(`assertion not passed at k: ${k}, i: ${i}, constraint: ${Fr.toObject(constraintW)}`)
                }
            }
        }
        console.log(`Test 2 finished`)
    }
    /// END of TEST CODE 2

    /// arrange circuit witness
    let cWtns = new Array(WireList.length);
    for(var i=0; i<WireList.length; i++){
        const kPrime = WireList[i][0];
        const idx = WireList[i][1];
        cWtns[i] = Fr.e(wtns[kPrime][idx]);
    }
    /// compute p(X,Y)
    let p1XY = Array.from(Array(n), () => new Array(s_max));
    p1XY = await polyUtils.scalePoly(Fr, p1XY, Fr.zero);
    let p2XY = p1XY;
    let p3XY = p1XY;

    for (var i=0; i<m; i++){
        let term1 = await polyUtils.scalePoly(Fr, uXY_i[i], cWtns[i]);
        let term2 = await polyUtils.scalePoly(Fr, vXY_i[i], cWtns[i]);
        let term3 = await polyUtils.scalePoly(Fr, wXY_i[i], cWtns[i]);
        p1XY = await polyUtils.addPoly(Fr, p1XY, term1);
        p2XY = await polyUtils.addPoly(Fr, p2XY, term2);
        p3XY = await polyUtils.addPoly(Fr, p3XY, term3);
    }

    const temp = await polyUtils.mulPoly(Fr, p1XY, p2XY);
    const pXY = await polyUtils.addPoly(Fr, temp, p3XY, true);


    /// TEST CODE 3
    if (TESTFLAG){
        console.log('Running Test 3')
        for (var i=0; i<n; i++){
            for (var j=0; j<s_max; j++){
                const eval_point_X = await Fr.exp(omega_x, i);
                const eval_point_Y = await Fr.exp(omega_y, j);
                const flag = await polyUtils.evalPoly(Fr, pXY, eval_point_X, eval_point_Y);
                if( !Fr.eq(flag, Fr.zero) ){
                    throw new Error('Error in pXY');
                }
            }
        }
        console.log(`Test 3 finished`)
    }
    /// End of TEST CODE 3   
    
    /// compute H
    const {res: h1XY, finalrem: rem1} =  await polyUtils.divPoly(Fr, pXY, tX);
    const {res: h2XY, finalrem: rem2} =  await polyUtils.divPoly(Fr, rem1, tY);

    console.log(`rem2: ${polyUtils._transToObject(Fr, rem2)}`)
    const {x_order: h1_x_order, y_order: h1_y_order} = polyUtils._orderPoly(Fr, h1XY);
    const {x_order: h2_x_order, y_order: h2_y_order} = polyUtils._orderPoly(Fr, h2XY);
    console.log(`h1_x_order: ${h1_x_order}, h1_y_order: ${h1_y_order}`);
    console.log(`h2_x_order: ${h2_x_order}, h2_y_order: ${h2_y_order}`);
    console.log(`n: ${n}, s_max: ${s_max}`);



    // Generate r and s
    const rawr = await misc.getRandomRng(entropy);
    const raws = await misc.getRandomRng(entropy+1);
    const r = Fr.fromRng(rawr);
    const s = Fr.fromRng(raws);
    
    // Compute proof A
    const vk1_A_p1 = urs.sigma_G.vk1_alpha_v;
    const vk1_A_p3 = await G1.timesFr(urs.sigma_G.vk1_gamma_a, r);
    let vk1_A_p2 = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<m; i++){
        let term = await G1.timesFr(crs.vk1_uxy_i[i], cWtns[i]);
        vk1_A_p2 = await G1.add(vk1_A_p2, term);
    }
    const vk1_A = await G1.add(await G1.add(vk1_A_p1, vk1_A_p2), vk1_A_p3);
    
    // Compute proof B_G
    const vk1_B_p1 = urs.sigma_G.vk1_alpha_u;
    const vk1_B_p3 = await G1.timesFr(urs.sigma_G.vk1_gamma_a, s);
    let vk1_B_p2 = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<m; i++){
        let term = await G1.timesFr(crs.vk1_vxy_i[i], cWtns[i]);
        vk1_B_p2 = await G1.add(vk1_B_p2, term);
    }
    const vk1_B = await G1.add(await G1.add(vk1_B_p1, vk1_B_p2), vk1_B_p3);
    
    // Compute proof B_H
    const vk2_B_p1 = urs.sigma_H.vk2_alpha_u;
    const vk2_B_p3 = await G2.timesFr(urs.sigma_H.vk2_gamma_a, s);
    let vk2_B_p2 = await G2.timesFr(buffG2, Fr.e(0));
    for(var i=0; i<m; i++){
        let term = await G2.timesFr(crs.vk2_vxy_i[i], cWtns[i]);
        vk2_B_p2 = await G2.add(vk2_B_p2, term);
    }
    const vk2_B = await G2.add(await G2.add(vk2_B_p1, vk2_B_p2), vk2_B_p3);

    // Compute proof C_G
    let vk1_C_p = new Array(5)
    vk1_C_p[0] = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<mPrivate; i++){
        let term = await G1.timesFr(crs.vk1_axy_i[i], cWtns[IdSetP.set[i]]);
        vk1_C_p[0] = await G1.add(vk1_C_p[0], term);
    }
    vk1_C_p[1] = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<n-1; i++){
        for(var j=0; j<s_max-1; j++){
            let term = G1.timesFr(urs.sigma_G.vk1_xy_pows_tg[i][j], hXY[i][j]);
            vk1_C_p[1] = G1.add(vk1_C_p[1], term);
        }
    }
    vk1_C_p[2] = await G1.timesFr(vk1_A, s);
    vk1_C_p[3] = await G1.timesFr(vk1_B, r);
    vk1_C_p[4] = await G1.timesFr(urs.sigma_G.vk1_gamma_a, Fr.mul(r,s));
    let vk1_C = vk1_C_p[0];
    for(var i=1; i<5; i++){
        vk1_C = await G1.add(vk1_C, vk1_C_p[i]);
    }

    // Write Header
    ///////////
    await binFileUtils.startWriteSection(fdPrf, 1);
    await fdPrf.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fdPrf);
    // End of the Header

    await binFileUtils.startWriteSection(fdPrf, 2);
    await zkeyUtils.writeG1(fdPrf, curve, vk1_A);
    await zkeyUtils.writeG2(fdPrf, curve, vk2_B);
    await zkeyUtils.writeG1(fdPrf, curve, vk1_C);

    await binFileUtils.endWriteSection(fdPrf);

    await fdPrf.close();
}