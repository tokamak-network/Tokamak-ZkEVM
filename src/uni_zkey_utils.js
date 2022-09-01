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

import { Scalar, F1Field} from "ffjavascript";
import * as binFileUtils from "@iden3/binfileutils";

import { getCurveFromQ as getCurve } from "./curves.js";
import { log2 } from "./misc.js";
import * as fastFile from "fastfile"

/* 
export async function writeHeader(fd, zkey) {

    // Write the header
    ///////////
    await binFileUtils.startWriteSection(fd, 1);
    await fd.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fd);

    // Write the Groth header section
    ///////////

    const curve = await getCurve(zkey.q);

    await binFileUtils.startWriteSection(fd, 2);
    const primeQ = curve.q;
    const n8q = (Math.floor( (Scalar.bitLength(primeQ) - 1) / 64) +1)*8;

    const primeR = curve.r;
    const n8r = (Math.floor( (Scalar.bitLength(primeR) - 1) / 64) +1)*8;

    await fd.writeULE32(n8q);
    await binFileUtils.writeBigInt(fd, primeQ, n8q);
    await fd.writeULE32(n8r);
    await binFileUtils.writeBigInt(fd, primeR, n8r);
    await fd.writeULE32(zkey.nVars);                         // Total number of bars
    await fd.writeULE32(zkey.nPublic);                       // Total number of public vars (not including ONE)
    await fd.writeULE32(zkey.domainSize);                  // domainSize
    await writeG1(fd, curve, zkey.vk_alpha_1);
    await writeG1(fd, curve, zkey.vk_beta_1);
    await writeG2(fd, curve, zkey.vk_beta_2);
    await writeG2(fd, curve, zkey.vk_gamma_2);
    await writeG1(fd, curve, zkey.vk_delta_1);
    await writeG2(fd, curve, zkey.vk_delta_2);

    await binFileUtils.endWriteSection(fd);


}

export async function writeZKey(fileName, zkey) {

    let curve = getCurve(zkey.q);

    const fd = await binFileUtils.createBinFile(fileName,"zkey", 1, 9);

    await writeHeader(fd, zkey);
    const n8r = (Math.floor( (Scalar.bitLength(zkey.r) - 1) / 64) +1)*8;
    const Rr = Scalar.mod(Scalar.shl(1, n8r*8), zkey.r);
    const R2r = Scalar.mod(Scalar.mul(Rr,Rr), zkey.r);

    // Write Pols (A and B (C can be ommited))
    ///////////

    zkey.ccoefs = zkey.ccoefs.filter(c => c.matrix<2);
    zkey.ccoefs.sort( (a,b) => a.constraint - b.constraint );
    await binFileUtils.startWriteSection(fd, 4);
    await fd.writeULE32(zkey.ccoefs.length);
    for (let i=0; i<zkey.ccoefs.length; i++) {
        const coef = zkey.ccoefs[i];
        await fd.writeULE32(coef.matrix);
        await fd.writeULE32(coef.constraint);
        await fd.writeULE32(coef.signal);
        await writeFr2(coef.value);
    }
    await binFileUtils.endWriteSection(fd);


    // Write IC Section
    ///////////
    await binFileUtils.startWriteSection(fd, 3);
    for (let i=0; i<= zkey.nPublic; i++) {
        await writeG1(fd, curve, zkey.IC[i] );
    }
    await binFileUtils.endWriteSection(fd);


    // Write A
    ///////////
    await binFileUtils.startWriteSection(fd, 5);
    for (let i=0; i<zkey.nVars; i++) {
        await writeG1(fd, curve, zkey.A[i]);
    }
    await binFileUtils.endWriteSection(fd);

    // Write B1
    ///////////
    await binFileUtils.startWriteSection(fd, 6);
    for (let i=0; i<zkey.nVars; i++) {
        await writeG1(fd, curve, zkey.B1[i]);
    }
    await binFileUtils.endWriteSection(fd);

    // Write B2
    ///////////
    await binFileUtils.startWriteSection(fd, 7);
    for (let i=0; i<zkey.nVars; i++) {
        await writeG2(fd, curve, zkey.B2[i]);
    }
    await binFileUtils.endWriteSection(fd);

    // Write C
    ///////////
    await binFileUtils.startWriteSection(fd, 8);
    for (let i=zkey.nPublic+1; i<zkey.nVars; i++) {
        await writeG1(fd, curve, zkey.C[i]);
    }
    await binFileUtils.endWriteSection(fd);


    // Write H points
    ///////////
    await binFileUtils.startWriteSection(fd, 9);
    for (let i=0; i<zkey.domainSize; i++) {
        await writeG1(fd, curve, zkey.hExps[i]);
    }
    await binFileUtils.endWriteSection(fd);

    await fd.close();

    async function writeFr2(n) {
        // Convert to montgomery
        n = Scalar.mod( Scalar.mul(n, R2r), zkey.r);

        await binFileUtils.writeBigInt(fd, n, n8r);
    }

}
 */
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

/* 
export async function readHeader(fd, sections, toObject) {
    // Read Header
    /////////////////////
    await binFileUtils.startReadUniqueSection(fd, sections, 1);
    const protocolId = await fd.readULE32();
    await binFileUtils.endReadSection(fd);

    if (protocolId == 1) {
        return await readHeaderGroth16(fd, sections, toObject);
    } else if (protocolId == 2) {
        return await readHeaderPlonk(fd, sections, toObject);
    } else {
        throw new Error("Protocol not supported: ");
    }        
}

async function readHeaderGroth16(fd, sections, toObject) {
    const zkey = {};

    zkey.protocol = "groth16";

    // Read Groth Header
    /////////////////////
    await binFileUtils.startReadUniqueSection(fd, sections, 2);
    const n8q = await fd.readULE32();
    zkey.n8q = n8q;
    zkey.q = await binFileUtils.readBigInt(fd, n8q);

    const n8r = await fd.readULE32();
    zkey.n8r = n8r;
    zkey.r = await binFileUtils.readBigInt(fd, n8r);
    zkey.curve = await getCurve(zkey.q);
    zkey.nVars = await fd.readULE32();
    zkey.nPublic = await fd.readULE32();
    zkey.domainSize = await fd.readULE32();
    zkey.power = log2(zkey.domainSize);
    zkey.vk_alpha_1 = await readG1(fd, zkey.curve, toObject);
    zkey.vk_beta_1 = await readG1(fd, zkey.curve, toObject);
    zkey.vk_beta_2 = await readG2(fd, zkey.curve, toObject);
    zkey.vk_gamma_2 = await readG2(fd, zkey.curve, toObject);
    zkey.vk_delta_1 = await readG1(fd, zkey.curve, toObject);
    zkey.vk_delta_2 = await readG2(fd, zkey.curve, toObject);
    await binFileUtils.endReadSection(fd);

    return zkey;

}
 */

export async function processConstraints(curve, n_k, sR1cs_k) { 
    // parameters: curve, the number of k-th subcircuit's constraints, k-th subcircuit's r1cs
    let r1csPos = 0;
    let results={};
    //const n_k = r1cs[k].nConstraints;
    let U = new Array(n_k);
    let Uid = new Array(n_k);
    let V = new Array(n_k);
    let Vid = new Array(n_k);
    let W = new Array(n_k);
    let Wid = new Array(n_k);

    function r1cs_readULE32toUInt() {
        const buff = sR1cs_k.slice(r1csPos, r1csPos+4);
        r1csPos += 4;
        const buffV = new DataView(buff.buffer);
        return buffV.getUint32(0, true)
    }
    function r1cs_readULE256toFr() {
        const buff = sR1cs_k.slice(r1csPos, r1csPos+32);
        r1csPos += 32;
        const buffV = curve.Fr.fromRprLE(buff);
        return buffV
    }
    for (var c=0; c<n_k; c++) {
        //if ((logger)&&(c%10000 == 0)) logger.debug(`processing constraints: ${c}/${r1cs.nConstraints}`);
        const nA = r1cs_readULE32toUInt();
        let coefsA = new Array(nA);
        let idsA = new Array(nA);
        for (let i=0; i<nA; i++) {
            idsA[i] = r1cs_readULE32toUInt();
            coefsA[i] = r1cs_readULE256toFr();
        }
        //if (typeof A[s] === "undefined") A[s] = [];
        U[c] = coefsA;
        Uid[c] = idsA;

        const nB = r1cs_readULE32toUInt();
        let coefsB = new Array(nB);
        let idsB = new Array(nB);
        for (let i=0; i<nB; i++) {
            idsB[i] = r1cs_readULE32toUInt();
            coefsB[i] = r1cs_readULE256toFr();
        }
        V[c] = coefsB;
        Vid[c] = idsB;

        const nC = r1cs_readULE32toUInt();
        let coefsC = new Array(nC);
        let idsC = new Array(nC);
        for (let i=0; i<nC; i++) {
            idsC[i] = r1cs_readULE32toUInt();
            coefsC[i] = r1cs_readULE256toFr();
        }
        W[c] = coefsC;
        Wid[c] = idsC;
    }
    results.U = U;
    results.Uid = Uid;
    results.V = V;
    results.Vid = Vid;
    results.W = W;
    results.Wid = Wid;
    return results
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

    const {fd, sections} = await binFileUtils.readBinFile(fileName, "wtns", 2);

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

export async function readOpList(fd){
    const ListSize = await fd.readULE32()
    let OpList = new Array(ListSize)

    for(var k=0; k<ListSize; k++){
        OpList[k] = await fd.readULE32()
    }

    return OpList
}

export async function readWireList(fd) {
    const listSize = await fd.readULE32()
    let result = new Array(listSize);
    for(var i=0; i<listSize; i++){
        result[i] = [await fd.readULE32(), await fd.readULE32()]
    }

    return result

    // PreImages[i] = row^(-1)[m_i] = {(k1, i1), (k2, i2), (k3, i3), ...},
    // where the index i denotes the i-th wire of a derived (chained) circuit,
    // and m_i = (k', i') denotes the i'-th (output) wire in the k'-th subcircuit,
    // which is a linear combination of the i1-th, i2-th, i3-th, and ... (input) wires respectively from the k1-th, k2-th, k3-th, and ... subcircuits.
}

export async function readIndSet(fd) {
    const setSize = await fd.readULE32()
    const IndSet = {}
    IndSet.set=[]
    for(var i=0; i<setSize; i++){
        IndSet.set.push(await fd.readULE32())
    }
    let PreImages = new Array(setSize)
    let PreImgSize
    for(var i=0; i<setSize; i++){
        PreImgSize = await fd.readULE32()
        PreImages[i] = new Array(PreImgSize)
        for(var j=0; j<PreImgSize; j++){
            PreImages[i][j] = [await fd.readULE32(), await fd.readULE32()]
        }
    }
    IndSet.PreImgs=PreImages

    return IndSet

    // PreImages[i] = row^(-1)[m_i] = {(k1, i1), (k2, i2), (k3, i3), ...},
    // where the index i denotes the i-th wire of a derived (chained) circuit,
    // and m_i = (k', i') denotes the i'-th (output) wire in the k'-th subcircuit,
    // which is a linear combination of the i1-th, i2-th, i3-th, and ... (input) wires respectively from the k1-th, k2-th, k3-th, and ... subcircuits.
}

export async function readRSParams(fd, sections) {
    // read only urs params from urs or crs file
    // crs params are read by readRS()
    const rs = {};

    rs.protocol = "groth16";

    // Read parameters
    /////////////////////
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
    const s_D = await fd.readULE32();
    rs.s_D = s_D
    rs.r1cs = new Array(s_D)
    for(var i=0; i<s_D; i++){
        rs.r1cs[i] = {}
        rs.r1cs[i].m = await fd.readULE32()
        rs.r1cs[i].mPublic = await fd.readULE32()
        rs.r1cs[i].mPrivate = rs.r1cs[i].m - rs.r1cs[i].mPublic
        rs.r1cs[i].nConstraints = await fd.readULE32()
    }

    // QAP constants
    rs.n = await fd.readULE32()
    rs.s_max = await fd.readULE32()
    rs.omega_x = rs.curve.Fr.e(await binFileUtils.readBigInt(fd, n8r));
    rs.omega_y = rs.curve.Fr.e(await binFileUtils.readBigInt(fd, n8r));

    await binFileUtils.endReadSection(fd);

    return rs;

}

/* 
async function readHeaderPlonk(fd, sections, toObject) {
    const zkey = {};

    zkey.protocol = "plonk";

    // Read Plonk Header
    /////////////////////
    await binFileUtils.startReadUniqueSection(fd, sections, 2);
    const n8q = await fd.readULE32();
    zkey.n8q = n8q;
    zkey.q = await binFileUtils.readBigInt(fd, n8q);

    const n8r = await fd.readULE32();
    zkey.n8r = n8r;
    zkey.r = await binFileUtils.readBigInt(fd, n8r);
    zkey.curve = await getCurve(zkey.q);
    zkey.nVars = await fd.readULE32();
    zkey.nPublic = await fd.readULE32();
    zkey.domainSize = await fd.readULE32();
    zkey.power = log2(zkey.domainSize);
    zkey.nAdditions = await fd.readULE32();
    zkey.nConstrains = await fd.readULE32();
    zkey.k1 = await fd.read(n8r);
    zkey.k2 = await fd.read(n8r);

    zkey.Qm = await readG1(fd, zkey.curve, toObject);
    zkey.Ql = await readG1(fd, zkey.curve, toObject);
    zkey.Qr = await readG1(fd, zkey.curve, toObject);
    zkey.Qo = await readG1(fd, zkey.curve, toObject);
    zkey.Qc = await readG1(fd, zkey.curve, toObject);
    zkey.S1 = await readG1(fd, zkey.curve, toObject);
    zkey.S2 = await readG1(fd, zkey.curve, toObject);
    zkey.S3 = await readG1(fd, zkey.curve, toObject);
    zkey.X_2 = await readG2(fd, zkey.curve, toObject);

    await binFileUtils.endReadSection(fd);

    return zkey;
}
 */

export async function readRS(fd, sections, rsParam, rsType, toObject) {
    //rsType?crs:urs
    const curve = rsParam.curve
    // const Fr = curve.Fr
    // const Rr = Scalar.mod(Scalar.shl(1, rsParam.n8r*8), rsParam.r)
    // const Rri = Fr.inv(Rr);
    // const Rri2 = Fr.mul(Rri, Rri);
    const n = rsParam.n;
    const s_max = rsParam.s_max;
    const s_D = rsParam.s_D;
    const rsContent = {};

    // Read sigma_G section
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 3);
    rsContent.sigma_G = {};
    rsContent.sigma_G.vk1_alpha_u = await readG1(fd, curve, toObject)
    rsContent.sigma_G.vk1_alpha_v = await readG1(fd, curve, toObject)
    rsContent.sigma_G.vk1_gamma_a = await readG1(fd, curve, toObject)
    
    let vk1_xy_pows = Array.from(Array(n), () => new Array(s_max))
    for(var i = 0; i < n; i++) {
        for(var j = 0; j < s_max; j++){
            vk1_xy_pows[i][j] = await readG1(fd, curve, toObject)
            // vk1_xy_pows[i][j] = G1*(x^i * y^j)
        }
    }
    rsContent.sigma_G.vk1_xy_pows = vk1_xy_pows

    let vk1_xy_pows_t1g = Array.from(Array(n-1), () => new Array(2*s_max-1))
    for(var i = 0; i < n-1; i++) {
        for(var j=0; j<2*s_max-1; j++){
            vk1_xy_pows_t1g[i][j] = await readG1(fd, curve, toObject)
            // vk1_xy_pows_tg[i][j] = G1*(x^i * y^j)*t(x)*inv(gamma_a)
        }
    }
    rsContent.sigma_G.vk1_xy_pows_t1g = vk1_xy_pows_t1g;

    let vk1_xy_pows_t2g = Array.from(Array(n), () => new Array(s_max-1));
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max-1; j++){
            vk1_xy_pows_t2g[i][j] = await readG1(fd, curve, toObject)
            // vk1_xy_pows_tg[i][j] = G1*(x^i * y^j)*t(x)*inv(gamma_a)
        }
    }
    rsContent.sigma_G.vk1_xy_pows_t2g = vk1_xy_pows_t2g;

    await binFileUtils.endReadSection(fd);
    // End of reading sigma_G

    // Read sigma_H section
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 4);
    rsContent.sigma_H = {}
    rsContent.sigma_H.vk2_alpha_u = await readG2(fd, curve, toObject)
    rsContent.sigma_H.vk2_gamma_z = await readG2(fd, curve, toObject)
    rsContent.sigma_H.vk2_gamma_a = await readG2(fd, curve, toObject)

    let vk2_xy_pows = Array.from(Array(n), () => new Array(s_max))
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max; j++){
            vk2_xy_pows[i][j] = await readG2(fd, curve, toObject)
            // vk2_xy_pows[i][j] = G2*(x^i * y^j)
        }
    }
    rsContent.sigma_H.vk2_xy_pows = vk2_xy_pows
    await binFileUtils.endReadSection(fd);
    // End of reading sigma_H

    if (!rsType) //urs
    {
        // Read theta_G[k] sections for k in [0, 1, ..., s_D]
        ///////////
        rsContent.theta_G = {};
        let vk1_uxy_kij = new Array(s_D)
        let vk1_vxy_kij = new Array(s_D)
        let vk2_vxy_kij = new Array(s_D)
        let vk1_zxy_kij = new Array(s_D)
        let vk1_axy_kij = new Array(s_D)
        for(var k=0; k<s_D; k++){
            const m_k = rsParam.r1cs[k].m
            const mPublic_k = rsParam.r1cs[k].mPublic
            const mPrivate_k = rsParam.r1cs[k].mPrivate
            let vk1_uxy_ij = Array.from(Array(m_k), () => new Array(s_max))
            let vk1_vxy_ij = Array.from(Array(m_k), () => new Array(s_max))
            let vk2_vxy_ij = Array.from(Array(m_k), () => new Array(s_max))
            let vk1_zxy_ij = Array.from(Array(mPublic_k), () => new Array(s_max))
            let vk1_axy_ij = Array.from(Array(mPrivate_k), () => new Array(s_max))
            await binFileUtils.startReadUniqueSection(fd, sections, 5+k);
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_uxy_ij[i][j] = await readG1(fd, curve, toObject)
                }
            }
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_vxy_ij[i][j] = await readG1(fd, curve, toObject)
                }
            }
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk2_vxy_ij[i][j] = await readG2(fd, curve, toObject)
                }
            }
            for(var i=0; i < mPublic_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_zxy_ij[i][j] = await readG1(fd, curve, toObject)
                }
            }
            for(var i=0; i < mPrivate_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_axy_ij[i][j] = await readG1(fd, curve, toObject)
                }
            }
            await binFileUtils.endReadSection(fd);
            vk1_uxy_kij[k] = vk1_uxy_ij
            vk1_vxy_kij[k] = vk1_vxy_ij
            vk2_vxy_kij[k] = vk2_vxy_ij
            vk1_zxy_kij[k] = vk1_zxy_ij
            vk1_axy_kij[k] = vk1_axy_ij
        }
        rsContent.theta_G.vk1_uxy_kij = vk1_uxy_kij
        rsContent.theta_G.vk1_vxy_kij = vk1_vxy_kij
        rsContent.theta_G.vk2_vxy_kij = vk2_vxy_kij
        rsContent.theta_G.vk1_zxy_kij = vk1_zxy_kij
        rsContent.theta_G.vk1_axy_kij = vk1_axy_kij
    
    } else if(rsType==1){ //crs
        rsContent.crs ={};
        await binFileUtils.startReadUniqueSection(fd, sections, 5);
        rsContent.crs.param={};
        const m = await fd.readULE32();
        rsContent.crs.param.m = m;
        const mPublic = await fd.readULE32();
        rsContent.crs.param.mPublic = mPublic;
        const mPrivate = await fd.readULE32();
        rsContent.crs.param.mPrivate = mPrivate;
        
        let vk1_uxy_i = new Array(m);
        let vk1_vxy_i = new Array(m);
        let vk1_zxy_i = new Array(mPublic);
        let vk1_axy_i = new Array(mPrivate);
        let vk2_vxy_i = new Array(m);

        for(var i=0; i<m; i++){
            vk1_uxy_i[i] = await readG1(fd, curve, toObject);
        }
        for(var i=0; i<m; i++){
            vk1_vxy_i[i] = await readG1(fd, curve, toObject);
        }
        for(var i=0; i<mPublic; i++){
            vk1_zxy_i[i] = await readG1(fd, curve, toObject);
        }
        // vk1_zxy[i] represents the IdSetV.set(i)-th wire of circuit
        for(var i=0; i<mPrivate; i++){
            vk1_axy_i[i] = await readG1(fd, curve, toObject);
        }
        // vk1_axy[i] represents the IdSetP.set(i)-th wire of circuit
        for(var i=0; i<m; i++){
            vk2_vxy_i[i] = await readG2(fd, curve, toObject);
        }
        await binFileUtils.endReadSection(fd);
        
        rsContent.crs.vk1_uxy_i = vk1_uxy_i;
        rsContent.crs.vk1_vxy_i = vk1_vxy_i;
        rsContent.crs.vk1_zxy_i = vk1_zxy_i;
        rsContent.crs.vk1_axy_i = vk1_axy_i;
        rsContent.crs.vk2_vxy_i = vk2_vxy_i;
    }

    return rsContent

    // async function readFr2(/* toObject */) {
    //     const n = await binFileUtils.readBigInt(fd, zkey.n8r);
    //     return Fr.mul(n, Rri2);
    // }
}


export async function readZKey(fileName, toObject) {
    const {fd, sections} = await binFileUtils.readBinFile(fileName, "zkey", 1);

    const zkey = await readHeader(fd, sections, toObject);

    const Fr = new F1Field(zkey.r);
    const Rr = Scalar.mod(Scalar.shl(1, zkey.n8r*8), zkey.r);
    const Rri = Fr.inv(Rr);
    const Rri2 = Fr.mul(Rri, Rri);

    let curve = await getCurve(zkey.q);

    // Read IC Section
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 3);
    zkey.IC = [];
    for (let i=0; i<= zkey.nPublic; i++) {
        const P = await readG1(fd, curve, toObject);
        zkey.IC.push(P);
    }
    await binFileUtils.endReadSection(fd);


    // Read Coefs
    ///////////
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
            value: v
        });
    }
    await binFileUtils.endReadSection(fd);

    // Read A points
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 5);
    zkey.A = [];
    for (let i=0; i<zkey.nVars; i++) {
        const A = await readG1(fd, curve, toObject);
        zkey.A[i] = A;
    }
    await binFileUtils.endReadSection(fd);


    // Read B1
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 6);
    zkey.B1 = [];
    for (let i=0; i<zkey.nVars; i++) {
        const B1 = await readG1(fd, curve, toObject);

        zkey.B1[i] = B1;
    }
    await binFileUtils.endReadSection(fd);


    // Read B2 points
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 7);
    zkey.B2 = [];
    for (let i=0; i<zkey.nVars; i++) {
        const B2 = await readG2(fd, curve, toObject);
        zkey.B2[i] = B2;
    }
    await binFileUtils.endReadSection(fd);


    // Read C points
    ///////////
    await binFileUtils.startReadUniqueSection(fd, sections, 8);
    zkey.C = [];
    for (let i=zkey.nPublic+1; i<zkey.nVars; i++) {
        const C = await readG1(fd, curve, toObject);

        zkey.C[i] = C;
    }
    await binFileUtils.endReadSection(fd);


    // Read H points
    ///////////
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

/* 
async function readContribution(fd, curve, toObject) {
    const c = {delta:{}};
    c.deltaAfter = await readG1(fd, curve, toObject);
    c.delta.g1_s = await readG1(fd, curve, toObject);
    c.delta.g1_sx = await readG1(fd, curve, toObject);
    c.delta.g2_spx = await readG2(fd, curve, toObject);
    c.transcript = await fd.read(64);
    c.type = await fd.readULE32();

    const paramLength = await fd.readULE32();
    const curPos = fd.pos;
    let lastType =0;
    while (fd.pos-curPos < paramLength) {
        const buffType = await fd.read(1);
        if (buffType[0]<= lastType) throw new Error("Parameters in the contribution must be sorted");
        lastType = buffType[0];
        if (buffType[0]==1) {     // Name
            const buffLen = await fd.read(1);
            const buffStr = await fd.read(buffLen[0]);
            c.name = new TextDecoder().decode(buffStr);
        } else if (buffType[0]==2) {
            const buffExp = await fd.read(1);
            c.numIterationsExp = buffExp[0];
        } else if (buffType[0]==3) {
            const buffLen = await fd.read(1);
            c.beaconHash = await fd.read(buffLen[0]);
        } else {
            throw new Error("Parameter not recognized");
        }
    }
    if (fd.pos != curPos + paramLength) {
        throw new Error("Parametes do not match");
    }

    return c;
}


export async function readMPCParams(fd, curve, sections) {
    await binFileUtils.startReadUniqueSection(fd, sections, 10);
    const res = { contributions: []};
    res.csHash = await fd.read(64);
    const n = await fd.readULE32();
    for (let i=0; i<n; i++) {
        const c = await readContribution(fd, curve);
        res.contributions.push(c);
    }
    await binFileUtils.endReadSection(fd);

    return res;
}

async function writeContribution(fd, curve, c) {
    await writeG1(fd, curve, c.deltaAfter);
    await writeG1(fd, curve, c.delta.g1_s);
    await writeG1(fd, curve, c.delta.g1_sx);
    await writeG2(fd, curve, c.delta.g2_spx);
    await fd.write(c.transcript);
    await fd.writeULE32(c.type || 0);

    const params = [];
    if (c.name) {
        params.push(1);      // Param Name
        const nameData = new TextEncoder("utf-8").encode(c.name.substring(0,64));
        params.push(nameData.byteLength);
        for (let i=0; i<nameData.byteLength; i++) params.push(nameData[i]);
    }
    if (c.type == 1) {
        params.push(2);      // Param numIterationsExp
        params.push(c.numIterationsExp);

        params.push(3);      // Beacon Hash
        params.push(c.beaconHash.byteLength);
        for (let i=0; i<c.beaconHash.byteLength; i++) params.push(c.beaconHash[i]);
    }
    if (params.length>0) {
        const paramsBuff = new Uint8Array(params);
        await fd.writeULE32(paramsBuff.byteLength);
        await fd.write(paramsBuff);
    } else {
        await fd.writeULE32(0);
    }

}

export async function writeMPCParams(fd, curve, mpcParams) {
    await binFileUtils.startWriteSection(fd, 10);
    await fd.write(mpcParams.csHash);
    await fd.writeULE32(mpcParams.contributions.length);
    for (let i=0; i<mpcParams.contributions.length; i++) {
        await writeContribution(fd, curve,mpcParams.contributions[i]);
    }
    await binFileUtils.endWriteSection(fd);
}

export function hashG1(hasher, curve, p) {
    const buff = new Uint8Array(curve.G1.F.n8*2);
    curve.G1.toRprUncompressed(buff, 0, p);
    hasher.update(buff);
}

export function hashG2(hasher,curve, p) {
    const buff = new Uint8Array(curve.G2.F.n8*2);
    curve.G2.toRprUncompressed(buff, 0, p);
    hasher.update(buff);
}

export function hashPubKey(hasher, curve, c) {
    hashG1(hasher, curve, c.deltaAfter);
    hashG1(hasher, curve, c.delta.g1_s);
    hashG1(hasher, curve, c.delta.g1_sx);
    hashG2(hasher, curve, c.delta.g2_spx);
    hasher.update(c.transcript);
}
 */
