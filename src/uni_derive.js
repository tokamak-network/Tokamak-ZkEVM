import * as curves from "./curves.js"
import * as misc from './misc.js'
import * as zkeyUtils from "./uni_zkey_utils.js";
import * as polyUtils from "./uni_poly_utils.js";
import * as binFileUtils from "@iden3/binfileutils";
import * as wtnsUtils from "./wtns_utils.js";
import {
    readBinFile,
    createBinFile,
    readSection,
    writeBigInt,
    startWriteSection,
    endWriteSection,
} from "@iden3/binfileutils";
import * as fastFile from "fastfile";
import { assert } from "chai";
import * as timer from "./timer.js"


export default async function uniDerive(RSName, cRSName, circuitName, QAPName) {
    const startTime = timer.start();
    let partTime;
    let EncTimeStart;
    let EncTimeAccum = 0;

    const TESTFLAG = false;
    const dirPath = `resource/circuits/${circuitName}`
    
    const URS=0;
    const {fd: fdRS, sections: sectionsRS} = await binFileUtils.readBinFile('resource/universal_rs/'+RSName+'.urs', "zkey", 2, 1<<25, 1<<23);
    const urs = {}
    urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS)
    
    console.log(`Loading urs...`)
    partTime = timer.start();
    urs.content = await zkeyUtils.readRS(fdRS, sectionsRS, urs.param, URS)
    const ursLoadTime = timer.end(partTime);
    console.log(`Loading urs...Done`)

    const fdIdV = await fastFile.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);

    const IdSetV = await zkeyUtils.readIndSet(fdIdV)
    const IdSetP = await zkeyUtils.readIndSet(fdIdP)
    const OpList = await zkeyUtils.readOpList(fdOpL)
    // IdSet#.set, IdSet#.PreImgs
    
    await fdIdV.close()
    await fdIdP.close()
    await fdOpL.close()

    const fdcRS = await createBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 1, 5, 1<<22, 1<<24)

    const ParamR1cs = urs.param.r1cs
    const curve = urs.param.curve
    const G1 = urs.param.curve.G1
    const G2 = urs.param.curve.G2
    const Fr = urs.param.curve.Fr
    const n8r = urs.param.n8r;
    const n = urs.param.n;
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const s_max = urs.param.s_max
    const s_D = urs.param.s_D
    const s_F = OpList.length;
    const omega_y = await Fr.e(urs.param.omega_y)

    const mPublic = IdSetV.set.length // length of input instance + the total number of subcircuit outputs
    const mPrivate = IdSetP.set.length 
    const m = mPublic + mPrivate
    const NZeroWires = 1

    let PreImgSet
    let PreImgSize
    let mPublic_k
    let vk1_term
    let vk2_term
    let arrayIdx
    let kPrime
    let s_kPrime
    let iPrime

    let OmegaFactors = new Array(s_max);
    OmegaFactors[0] = Fr.one;
    const omega_y_inv = Fr.inv(omega_y);
    for (var j=1; j<s_max; j++){
        OmegaFactors[j] = Fr.mul(OmegaFactors[j-1], omega_y_inv);
    }
    
    if (Math.max(OpList) >= s_D){
        throw new Error('An opcode in the target EVM bytecode has no subcircuit');
    }

    
    let vk1_zxy = new Array(mPublic)
    for(var i=0; i<mPublic; i++){
        PreImgSet = IdSetV.PreImgs[i]
        PreImgSize = IdSetV.PreImgs[i].length
        vk1_zxy[i] = await G1_timesFr(buffG1, Fr.zero)
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0]
                s_kPrime = OpList[kPrime]
                iPrime = PreImgSet[PreImgIdx][1]
                mPublic_k = ParamR1cs[s_kPrime].mPublic
                
                if(!(iPrime >= NZeroWires && iPrime < NZeroWires+mPublic_k)){
                    throw new Error('invalid access to vk1_zxy_kij')
                }
                arrayIdx = iPrime-NZeroWires
                vk1_term = urs.content.theta_G.vk1_zxy_kij[s_kPrime][arrayIdx][j]
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1_timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1_timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_zxy[i] = await G1.add(vk1_zxy[i], vk1_term)
            }
        }
    }

    let vk1_axy = new Array(mPrivate)
    for(var i=0; i<mPrivate; i++){
        PreImgSet = IdSetP.PreImgs[i]
        PreImgSize = IdSetP.PreImgs[i].length
        vk1_axy[i] = await G1_timesFr(buffG1, Fr.zero)
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0]
                s_kPrime = OpList[kPrime]
                iPrime = PreImgSet[PreImgIdx][1]
                mPublic_k = ParamR1cs[s_kPrime].mPublic
 
                if(iPrime < NZeroWires){
                    arrayIdx = iPrime
                } else if(iPrime >= NZeroWires+mPublic_k){
                    arrayIdx = iPrime-mPublic_k
                } else{
                    console.log(`i: ${i}, PreImgIdx: ${PreImgIdx}`)
                    throw new Error('invalid access to vk1_axy_kij')
                }

                vk1_term = urs.content.theta_G.vk1_axy_kij[s_kPrime][arrayIdx][j]
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1_timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1_timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_axy[i] = await G1.add(vk1_axy[i], vk1_term)
            }
        }
    }

    let vk1_uxy = new Array(m)
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i)
            PreImgSet = IdSetV.PreImgs[arrayIdx]
        } else {
            arrayIdx = IdSetP.set.indexOf(i)
            PreImgSet = IdSetP.PreImgs[arrayIdx]
        }
        PreImgSize = PreImgSet.length
        vk1_uxy[i] = await G1_timesFr(buffG1, Fr.zero)
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0]
                s_kPrime = OpList[kPrime]
                iPrime = PreImgSet[PreImgIdx][1]
                vk1_term = urs.content.theta_G.vk1_uxy_kij[s_kPrime][iPrime][j]
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1_timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1_timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_uxy[i] = await G1.add(vk1_uxy[i], vk1_term)
            }
        }
    }

    let vk1_vxy = new Array(m)
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i)
            PreImgSet = IdSetV.PreImgs[arrayIdx]
        } else {
            arrayIdx = IdSetP.set.indexOf(i)
            PreImgSet = IdSetP.PreImgs[arrayIdx]
        }
        PreImgSize = PreImgSet.length
        vk1_vxy[i] = await G1_timesFr(buffG1, Fr.zero)
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0]
                s_kPrime = OpList[kPrime]
                iPrime = PreImgSet[PreImgIdx][1]

                vk1_term = urs.content.theta_G.vk1_vxy_kij[s_kPrime][iPrime][j]
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1_timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1_timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_vxy[i] = await G1.add(vk1_vxy[i], vk1_term)
            }
        }
    }

    let vk2_vxy = new Array(m)
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i)
            PreImgSet = IdSetV.PreImgs[arrayIdx]
        } else {
            arrayIdx = IdSetP.set.indexOf(i)
            PreImgSet = IdSetP.PreImgs[arrayIdx]
        }
        PreImgSize = PreImgSet.length
        vk2_vxy[i] = await G2_timesFr(buffG2, Fr.zero)
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0]
                s_kPrime = OpList[kPrime]
                iPrime = PreImgSet[PreImgIdx][1]

                vk2_term = urs.content.theta_G.vk2_vxy_kij[s_kPrime][iPrime][j]
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk2_term = await G2_timesFr(vk2_term, OmegaFactor)
                vk2_term = await G2_timesFr(vk2_term, OmegaFactors[(kPrime*j)%s_max]);
                vk2_vxy[i] = await G2.add(vk2_vxy[i], vk2_term)
            }
        }
    }

    await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 1)
    await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 2)
    await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 3)
    await binFileUtils.copySection(fdRS, sectionsRS, fdcRS, 4)

    await fdRS.close()
    
    await startWriteSection(fdcRS, 5)
    await fdcRS.writeULE32(m);
    await fdcRS.writeULE32(mPublic);
    await fdcRS.writeULE32(mPrivate);
    for(var i=0; i<m; i++){
        await zkeyUtils.writeG1(fdcRS, curve, vk1_uxy[i])
    }
    for(var i=0; i<m; i++){
        await zkeyUtils.writeG1(fdcRS, curve, vk1_vxy[i])
    }
    for(var i=0; i<mPublic; i++){
        await zkeyUtils.writeG1(fdcRS, curve, vk1_zxy[i])
    }
    // vk1_zxy[i] is for the IdSetV.set[i]-th wire of circuit
    for(var i=0; i<mPrivate; i++){
        await zkeyUtils.writeG1(fdcRS, curve, vk1_axy[i])
    }
    // vk1_axy[i] is for the IdSetP.set[i]-th wire of circuit
    for(var i=0; i<m; i++){
        await zkeyUtils.writeG2(fdcRS, curve, vk2_vxy[i])
    }
    await endWriteSection(fdcRS)

    await fdcRS.close()

    console.log(`Loading sub-QAPs...`)
    partTime = timer.start();
    let uX_ki = new Array(s_D);
    let vX_ki = new Array(s_D);
    let wX_ki = new Array(s_D);
    for (var i=0; i<s_F; i++){
        let k = OpList[i];
        if ( (uX_ki[k] === undefined) ){
            let m_k = ParamR1cs[k].m;
            let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await polyUtils.readQAP(QAPName, k, m_k, n, n8r);
            uX_ki[k] = uX_i;
            vX_ki[k] = vX_i;
            wX_ki[k] = wX_i;
        }
    }
    console.log(`Loading ${uX_ki.length} sub-QAPs...Done`)
    const qapLoadTime = timer.end(partTime);

    const fdQAP = await createBinFile(`${dirPath}/circuitQAP.qap`, "qapp", 1, 1+m, 1<<22, 1<<24);

    await startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await endWriteSection(fdQAP);

    partTime = timer.start();
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
    console.log(`Generating fY_k is completed`)
    timer.end(partTime);

    let InitPoly = Array.from(Array(n), () => new Array(s_max));
    InitPoly = await polyUtils.scalePoly(Fr, InitPoly, Fr.zero);
    console.log(`m: ${m}`)
    for(var i=0; i<m; i++){
        await startWriteSection(fdQAP, 2+i);
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
        let uXY_i = InitPoly;
        let vXY_i = InitPoly;
        let wXY_i = InitPoly;
        partTime = timer.start();
        for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
            let kPrime = PreImgSet[PreImgIdx][0];
            let iPrime = PreImgSet[PreImgIdx][1];
            let s_kPrime = OpList[kPrime];

            let u_term = await polyUtils.mulPoly(Fr, uX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            uXY_i = await polyUtils.addPoly(Fr, uXY_i, u_term);

            let v_term = await polyUtils.mulPoly(Fr, vX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            vXY_i = await polyUtils.addPoly(Fr, vXY_i, v_term);

            let w_term = await polyUtils.mulPoly(Fr, wX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            wXY_i = await polyUtils.addPoly(Fr, wXY_i, w_term);
        }
        
        partTime = timer.check(partTime);
        for (var xi=0; xi<n; xi++){8
            for (var yi=0; yi<s_max; yi++){
                await writeBigInt(fdQAP, Fr.toObject(uXY_i[xi][yi]), n8r);
            }
        }
        timer.end(partTime);

        for (var xi=0; xi<n; xi++){
            for (var yi=0; yi<s_max; yi++){
                await writeBigInt(fdQAP, Fr.toObject(vXY_i[xi][yi]), n8r);
            }
        }

        for (var xi=0; xi<n; xi++){
            for (var yi=0; yi<s_max; yi++){
                await writeBigInt(fdQAP, Fr.toObject(wXY_i[xi][yi]), n8r);
            }
        }
        await endWriteSection(fdQAP);
        console.log(`checkpoint derive-${i} of ${m}`)
    }
    await fdQAP.close();

    const totalTime = timer.end(startTime);
    ursLoadTime
    qapLoadTime
    EncTimeAccum

    async function G1_timesFr(point, fieldval){
        EncTimeStart = timer.start();
        const out = await G1.timesFr(point, fieldval);
        EncTimeAccum += timer.end(EncTimeStart);
        return out;
    }
    async function G2_timesFr(point, fieldval){
        EncTimeStart = timer.start();
        const out = await G2.timesFr(point, fieldval);
        EncTimeAccum += timer.end(EncTimeStart);
        return out;
    }
}
