import * as curves from "./curves.js"
import * as misc from './misc.js'
import * as zkeyUtils from "./uni_zkey_utils.js";
import BigArray from "./bigarray.js";
import chai from "chai";
const assert = chai.assert
import {readR1csHeader} from "r1csfile";
import {
    readBinFile,
    readSection,
    createBinFile,
    writeBigInt,
    readBigInt,
    startWriteSection,
    endWriteSection,
    startReadUniqueSection,
    endReadSection,
    copySection
} from "@iden3/binfileutils";
import { Scalar, F1Field, getCurveFromR} from "ffjavascript";
import fs from "fs"
import * as fastFile from "fastfile"
import { O_TRUNC, O_CREAT, O_RDWR, O_RDONLY} from "constants";
import * as timer from "./timer.js"
import * as polyUtils from "./uni_poly_utils.js";



export default async function uni_Setup(paramName, RSName, QAPName, entropy) {
    const startTime = timer.start();
    let partTime;
    let EncTimeAccum1 = 0;
    let EncTimeAccum2 = 0;
    let EncTimeStart;
    let qapTimeStart;
    let qapTimeAccum = 0;
    
    const TESTFLAG = false;
    console.log(`TESTMODE = ${TESTFLAG}`)
    
    const {fd: fdParam, sections: sectionsParam} = await readBinFile(`resource/subcircuits/${paramName}.dat`, "zkey", 2, 1<<25, 1<<23);
    const param = await zkeyUtils.readRSParams(fdParam, sectionsParam);
    const s_D = param.s_D;
    
    const fdRS = await createBinFile('resource/universal_rs/'+RSName+".urs", "zkey", 1, 4+s_D, 1<<22, 1<<24);
    await copySection(fdParam, sectionsParam, fdRS, 1);
    await copySection(fdParam, sectionsParam, fdRS, 2);
    
    await fdParam.close();

    const curve = param.curve;
    // const sG1 = curve.G1.F.n8*2              // unused
    // const sG2 = curve.G2.F.n8*2              // unused
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const Fr = curve.Fr;
    const G1 = curve.G1;
    const G2 = curve.G2;
    const n8r = param.n8r;
    const NConstWires = 1;

    const n = param.n;
    const s_max = param.s_max;

    const r1cs = param.r1cs;

    const m = new Array()          // the numbers of wires
    const mPublic = new Array()    // the numbers of public wires (not including constant wire at zero index)
    const mPrivate = new Array()
    const nConstraints = new Array()
    for(var i=0; i<s_D; i++){
        m.push(r1cs[i].m);
        nConstraints.push(r1cs[i].nConstraints);
        mPublic.push(r1cs[i].mPublic);
        mPrivate.push(r1cs[i].mPrivate);
    }
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
       
    // Generate tau
    var num_keys = 6 // the number of keys in tau
    let rng = new Array(num_keys)
    for(var i = 0; i < num_keys; i++) {
        rng[i] = await misc.getRandomRng(entropy + i)
    }    
    const tau = createTauKey(Fr, rng)
    
    // Write the sigma_G section
    ///////////
    partTime = timer.start();
    console.log(`Generating sigma_G...`);
    await startWriteSection(fdRS, 3);
    let vk1_alpha_u;
    let vk1_alpha_v;
    let vk1_gamma_a;

    EncTimeStart = timer.start();
    vk1_alpha_u = await G1.timesFr( buffG1, tau.alpha_u );
    vk1_alpha_v = await G1.timesFr( buffG1, tau.alpha_v );
    vk1_gamma_a = await G1.timesFr( buffG1, tau.gamma_a );
    EncTimeAccum1 += timer.end(EncTimeStart);

    await zkeyUtils.writeG1(fdRS, curve, vk1_alpha_u);
    await zkeyUtils.writeG1(fdRS, curve, vk1_alpha_v);
    await zkeyUtils.writeG1(fdRS, curve, vk1_gamma_a);
    let x=tau.x;
    let y=tau.y;
    if (TESTFLAG){
        x = Fr.e(13);
        y = Fr.e(23);
    }

    // if(TESTFLAG){  // UNUSED, since pairingEQ doesnt work for the points of infinity
    //     x=Fr.exp(omega_x, Fr.toObject(tau.x));
    //     y=Fr.exp(omega_y, Fr.toObject(tau.y));
    // }
    
    let vk1_xy_pows = Array.from(Array(n), () => new Array(s_max));
    let xy_pows = Array.from(Array(n), () => new Array(2*s_max-1)); // n by s_max 2d array

    for(var i = 0; i < n; i++) {
        for(var j = 0; j < 2*s_max-1; j++){
            xy_pows[i][j] = await Fr.mul(await Fr.exp(x,i), await Fr.exp(y,j));
        }
    }

    for(var i = 0; i < n; i++) {
        for(var j = 0; j < s_max; j++){
            EncTimeStart = timer.start();
            vk1_xy_pows[i][j] = await G1.timesFr(buffG1, xy_pows[i][j]);
            EncTimeAccum1 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1(fdRS, curve, vk1_xy_pows[i][j]);
            // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(s_max-1)], [x^1*y^0], ...
        }
    }

    const gamma_a_inv=Fr.inv(tau.gamma_a);
    let xy_pows_t1g;
    let vk1_xy_pows_t1g = Array.from(Array(n-1), () => new Array(2*s_max-1));
    const t1_x=Fr.sub(await Fr.exp(x,n),Fr.one);
    const t1_x_g=Fr.mul(t1_x, gamma_a_inv);
    for(var i = 0; i < n-1; i++) {
        for(var j=0; j<2*s_max-1; j++){
            xy_pows_t1g= await Fr.mul(xy_pows[i][j], t1_x_g);
            EncTimeStart = timer.start();
            vk1_xy_pows_t1g[i][j]= await G1.timesFr( buffG1, xy_pows_t1g );
            EncTimeAccum1 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1( fdRS, curve, vk1_xy_pows_t1g[i][j] );
            // [x^0*y^0*t*g], [x^0*y^1*t*g], ..., [x^0*y^(s_max-1)*t*g], [x^1*y^0*t*g], ...
        }
    }

    let xy_pows_t2g;
    let vk1_xy_pows_t2g = Array.from(Array(n), () => new Array(s_max-1));
    const t2_y=Fr.sub(await Fr.exp(y,s_max),Fr.one);
    const t2_y_g=Fr.mul(t2_y, gamma_a_inv);
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max-1; j++){
            xy_pows_t2g= await Fr.mul(xy_pows[i][j], t2_y_g);
            EncTimeStart = timer.start();
            vk1_xy_pows_t2g[i][j]= await G1.timesFr( buffG1, xy_pows_t2g );
            EncTimeAccum1 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1( fdRS, curve, vk1_xy_pows_t2g[i][j] );
            // [x^0*y^0*t*g], [x^0*y^1*t*g], ..., [x^0*y^(s_max-1)*t*g], [x^1*y^0*t*g], ...
        }
    }
    
    await endWriteSection(fdRS);
    console.log(`Generating sigma_G...Done`);
    // End of the sigma_G section
    ///////////

     // Write the sigma_H section
    ///////////
    console.log(`Generating sigma_H...`);
    await startWriteSection(fdRS, 4);
    let vk2_alpha_u;
    let vk2_gamma_z;
    let vk2_gamma_a;
    EncTimeStart = timer.start();
    vk2_alpha_u = await G2.timesFr( buffG2, tau.alpha_u );
    vk2_gamma_z = await G2.timesFr( buffG2, tau.gamma_z );
    vk2_gamma_a = await G2.timesFr( buffG2, tau.gamma_a );
    EncTimeAccum1 += timer.end(EncTimeStart);
    await zkeyUtils.writeG2(fdRS, curve, vk2_alpha_u);
    await zkeyUtils.writeG2(fdRS, curve, vk2_gamma_z);
    await zkeyUtils.writeG2(fdRS, curve, vk2_gamma_a);

    let vk2_xy_pows
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max; j++){
            EncTimeStart = timer.start();
            vk2_xy_pows= await G2.timesFr( buffG2, xy_pows[i][j] );
            EncTimeAccum1 += timer.end(EncTimeStart);
            await zkeyUtils.writeG2(fdRS, curve, vk2_xy_pows );
            // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(s_max-1)], [x^1*y^0], ...
        }
    }
    await endWriteSection(fdRS);
    console.log(`Generating sigma_H...Done`);
    const sigmaTime = timer.end(partTime);
    // End of the sigma_H section
    ///////////

    ///////////
    // Write the theta_G[k] sections for k in [0, 1, ..., s_D]
    partTime = timer.start();
    for (var k=0; k<s_D; k++){
        console.log(`Generating theta_G...${k+1}/${s_D}`)
        console.log(`  Loading ${3*m[k]} sub-QAP polynomials...`)
        qapTimeStart = timer.start();
        const {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await polyUtils.readQAP(QAPName, k, m[k], n, n8r);
        qapTimeAccum += timer.end(qapTimeStart);
        
        let ux = new Array(m[k]);
        let vx = new Array(m[k]);
        let wx = new Array(m[k]);
        let vk1_ux = new Array(m[k])
        let vk1_vx = new Array(m[k])
        let vk2_vx = new Array(m[k])
        let vk1_zx = []
        let vk1_ax = []
        let combined_i
        let zx_i
        let ax_i
        console.log(`  Evaluating and combining the sub-QAP polynomials...`)
        for (var i=0; i<m[k]; i++){
            ux[i] = await polyUtils.evalPoly(Fr, uX_i[i], x, 0);
            vx[i] = await polyUtils.evalPoly(Fr, vX_i[i], x, 0);
            wx[i] = await polyUtils.evalPoly(Fr, wX_i[i], x, 0);
            EncTimeStart = timer.start();
            vk1_ux[i] = await G1.timesFr(buffG1, ux[i])
            vk1_vx[i] = await G1.timesFr(buffG1, vx[i])
            vk2_vx[i] = await G2.timesFr(buffG2, vx[i])
            EncTimeAccum2 += timer.end(EncTimeStart);
            combined_i = Fr.add(Fr.add(Fr.mul(tau.alpha_u, ux[i]), Fr.mul(tau.alpha_v, vx[i])), wx[i]);
            if(i>=NConstWires && i<NConstWires+mPublic[k]){
                zx_i=Fr.mul(combined_i, Fr.inv(tau.gamma_z));
                EncTimeStart = timer.start();
                vk1_zx.push(await G1.timesFr(buffG1, zx_i))
                EncTimeAccum2 += timer.end(EncTimeStart);
            }
            else{
                ax_i=Fr.mul(combined_i, Fr.inv(tau.gamma_a));
                EncTimeStart = timer.start();
                vk1_ax.push(await G1.timesFr(buffG1, ax_i))
                EncTimeAccum2 += timer.end(EncTimeStart);
            }
        }
      
        // Test code 4//
        // To test [z^(k)_i(x)]_G and [a^(k)_i(x)]_G in sigma_G
        if(TESTFLAG){
            console.log(`Running Test 4`)
            let vk2_alpha_v = await G2.timesFr(buffG2, tau.alpha_v)
            let vk1_wx_i
            let res=0;
            for(var i=0; i<m[k]; i++){ // 모든 i 대신 랜덤한 몇 개의 i만 해봐도 good
                vk1_wx_i = await G1.timesFr(buffG1, wx[i])
                if(i>=NConstWires && i<NConstWires+mPublic[k]){
                    res = await curve.pairingEq(vk1_zx[i-NConstWires],  await G2.neg(vk2_gamma_z), 
                    vk1_ux[i], vk2_alpha_u,
                    vk1_vx[i], vk2_alpha_v,
                    vk1_wx_i, buffG2);
                }
                else{
                    res = await curve.pairingEq(vk1_ax[Math.max(0,i-mPublic[k])],  await G2.neg(vk2_gamma_a),
                    vk1_ux[i], vk2_alpha_u,
                    vk1_vx[i], vk2_alpha_v,
                    vk1_wx_i, buffG2)
/*                     if (k==6 && i==0){
                        console.log('k: ', k)
                        console.log('i: ', i)
                        console.log('i-mPublic: ', i-mPublic[k])
                        console.log('vk1_ax: ', vk1_ax)
                    } */
                    
                }
                if(res == false){
                    console.log('k: ', k)
                    console.log('i: ', i)
                }
                assert(res)
            }   
            console.log(`Test 4 finished`)
        }
        // End of the test code 4//

        await startWriteSection(fdRS, 5+k);
        let multiplier
        let vk1_uxy_ij
        let vk1_vxy_ij
        let vk2_vxy_ij
        let vk1_zxy_ij
        let vk1_axy_ij
        console.log(`  Encrypting and file writing ${4*m[k]} QAP keys...`)
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max))
            EncTimeStart = timer.start();
            vk1_uxy_ij= await G1.timesFr(vk1_ux[i], multiplier)
            EncTimeAccum2 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1(fdRS, curve, vk1_uxy_ij)
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                EncTimeStart = timer.start();
                vk1_uxy_ij= await G1.timesFr(vk1_ux[i], multiplier)
                EncTimeAccum2 += timer.end(EncTimeStart);
                await zkeyUtils.writeG1(fdRS, curve, vk1_uxy_ij)
            }
        }
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max))
            EncTimeStart = timer.start();
            vk1_vxy_ij= await G1.timesFr(vk1_vx[i], multiplier)
            EncTimeAccum2 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1(fdRS, curve, vk1_vxy_ij)
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                EncTimeStart = timer.start();
                vk1_vxy_ij= await G1.timesFr(vk1_vx[i], multiplier)
                EncTimeAccum2 += timer.end(EncTimeStart);
                await zkeyUtils.writeG1(fdRS, curve, vk1_vxy_ij)
            }
        }
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max))
            EncTimeStart = timer.start();
            vk2_vxy_ij= await G2.timesFr(vk2_vx[i], multiplier)
            EncTimeAccum2 += timer.end(EncTimeStart);
            await zkeyUtils.writeG2(fdRS, curve, vk2_vxy_ij)
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                EncTimeStart = timer.start();
                vk2_vxy_ij= await G2.timesFr(vk2_vx[i], multiplier)
                EncTimeAccum2 += timer.end(EncTimeStart);
                await zkeyUtils.writeG2(fdRS, curve, vk2_vxy_ij)
            }
        }
        for(var i=0; i < mPublic[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max))
            EncTimeStart = timer.start();
            vk1_zxy_ij= await G1.timesFr(vk1_zx[i], multiplier)
            EncTimeAccum2 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1(fdRS, curve, vk1_zxy_ij)
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                EncTimeStart = timer.start();
                vk1_zxy_ij= await G1.timesFr(vk1_zx[i], multiplier)
                EncTimeAccum2 += timer.end(EncTimeStart);
                await zkeyUtils.writeG1(fdRS, curve, vk1_zxy_ij)
            }
        }
        for(var i=0; i < mPrivate[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max))
            EncTimeStart = timer.start();
            vk1_axy_ij= await G1.timesFr(vk1_ax[i], multiplier)
            EncTimeAccum2 += timer.end(EncTimeStart);
            await zkeyUtils.writeG1(fdRS, curve, vk1_axy_ij)
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                EncTimeStart = timer.start();
                vk1_axy_ij= await G1.timesFr(vk1_ax[i], multiplier)
                EncTimeAccum2 += timer.end(EncTimeStart);
                await zkeyUtils.writeG1(fdRS, curve, vk1_axy_ij)
            }
        }
        await endWriteSection(fdRS)
    }
    const thetaTime = timer.end(partTime);
        // Test code 5//
    
    if(TESTFLAG) // k==6 --> MOD subcircuit, c2 mod c3 = c1 <==> c4*c3+c1 = c2 <==> c4*c3 = -c1+c2
    {
        console.log('Running Test 5')
        let res = [];
        res.push(await curve.pairingEq(vk1_xy_pows_t1g[1][1], vk2_gamma_a,
            await G1.timesFr(buffG1, Fr.mul(x,y)), await G2.neg(await G2.timesFr(buffG2, t1_x))
            )
        );
        console.log(res)
        
        if (!res[0]){
            throw new Error('Test 5 failed')
        }
        console.log(`Test 5 finished`)
    }
    // End of the test code 5//

    // End of the theta_G section
    ///////////
    await fdRS.close()

    const totalTime = timer.end(startTime);
    console.log(`-----Time Analyzer-----`)
    console.log(`###Total ellapsed time: ${totalTime} [ms]`)
    console.log(` ##Time for generating two sigmas with n=${n}, s_max=${s_max}: ${sigmaTime} [ms] (${(sigmaTime)/totalTime*100} %)`)
    console.log(`  #Encryption time: ${EncTimeAccum1} [ms] (${EncTimeAccum1/totalTime*100} %)`)
    console.log(`  #File writing time: ${sigmaTime - EncTimeAccum1} [ms] (${(sigmaTime - EncTimeAccum1)/totalTime*100} %)`)
    console.log(` ##Time for generating theta_G for ${s_D} sub-QAPs with totally ${m.reduce((accu,curr) => accu + curr)} wires and s_max=${s_max} opcode slots: ${thetaTime} [ms] (${(thetaTime)/totalTime*100} %)`)
    console.log(`  #Sub-QAPs loading time: ${qapTimeAccum} [ms] (${qapTimeAccum/totalTime*100} %)`)
    console.log(`  #Encryption time: ${EncTimeAccum2} [ms] (${(EncTimeAccum2)/totalTime*100} %)`)
    console.log(`  #file writing time: ${thetaTime - qapTimeAccum - EncTimeAccum2} [ms] (${(thetaTime - qapTimeAccum - EncTimeAccum2)/totalTime*100} %)`)
 

    function createTauKey(Field, rng) {
        if (rng.length != 6){
            console.log(`checkpoint3`)
            throw new Error('It should have six elements.')
        } 
        const key = {
            x: Field.fromRng(rng[0]),
            y: Field.fromRng(rng[1]),
            alpha_u: Field.fromRng(rng[2]),
            alpha_v: Field.fromRng(rng[3]),
            gamma_a: Field.fromRng(rng[4]),
            gamma_z: Field.fromRng(rng[5])
        }
        return key
    }

}
