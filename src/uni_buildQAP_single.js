import * as curves from "./curves.js"
import * as misc from './misc.js'
import * as zkeyUtils from "./uni_zkey_utils.js";
import * as polyUtils from "./uni_poly_utils.js"
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
    endReadSection
} from "@iden3/binfileutils";
import { Scalar, F1Field, getCurveFromR} from "ffjavascript";
import fs from "fs"
import * as fastFile from "fastfile"
import { O_TRUNC, O_CREAT, O_RDWR, O_RDONLY} from "constants";
import {  mkdir } from 'fs'
import path from "path"



export default async function uni_buildQAP_single(paramName, id) {
    const TESTFLAG = false;
    
    const QAPName_suffix = paramName.slice(5);
    const QAPName = `QAP${QAPName_suffix}`;
    mkdir(path.join(`resource/subcircuits`, QAPName), (err) => {});
    const dirPath = `resource/subcircuits/` + QAPName;

    const {fd: fdParam, sections: sectionsParam} = await readBinFile(`resource/subcircuits/${paramName}.dat`, "zkey", 2, 1<<25, 1<<23);
    const param = await zkeyUtils.readRSParams(fdParam, sectionsParam);
    await fdParam.close();

    let r1csIdx = String(id);
    const {fd: fdR1cs, sections: sectionsR1cs} = await readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 2, 1<<22, 1<<24);
    const sR1cs_k = await readSection(fdR1cs, sectionsR1cs, 2);
    await fdR1cs.close();
        
    console.log('checkpoint0')
 
    const curve = param.curve;
    const Fr = curve.Fr;
    const r1cs_k = param.r1cs[id];
    if (r1cs_k === undefined){
        throw new Error(`Parameters in ${paramName}.dat do not support Subcircuit${id}.`)
    }

    // Write parameters section
    ///////////
    console.log(`checkpoint4`)

    // Group parameters
    const primeR = curve.r;
    const n8r = (Math.floor( (Scalar.bitLength(primeR) - 1) / 64) +1)*8;
    
    const m_k = r1cs_k.m;

    // QAP constants
    const n = param.n;
    
    const omega_x = param.omega_x;
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
    
    const s_max = param.s_max;
    const omega_y = param.s_max;
    //console.log(Fr.toObject(omega_y))
    //console.log(Fr.toObject(await Fr.exp(omega_y, s_max)))
    
    // Test code 1 // --> DONE
    if(TESTFLAG){
        console.log(`Running Test 1`)
        assert(Fr.eq(await Fr.exp(Fr.e(n), primeR), Fr.e(n)))
        assert(Fr.eq(await Fr.exp(Fr.e(omega_x), n), Fr.one))
        assert(Fr.eq(await Fr.exp(Fr.e(omega_y), s_max), Fr.one))
        console.log(`Test 1 finished`)
    }
    // End of test code 1 //

    
    console.log(`checkpoint5`)

    // Test code 2 //
    if(TESTFLAG){
        console.log(`Running Test 2`)
        assert(Fr.eq(omega_x, Fr.e(Fr.toObject(omega_x))))
        console.log(`Test 2 finished`)
    }
    // End of test code 2 //

    /// End of parameters section

    const rs={};
    rs.curve = curve;
    rs.n = n;
    rs.s_max = s_max;
    rs.omega_x = omega_x;
    rs.omega_y = omega_y;
    const Lagrange_basis = await polyUtils.buildCommonPolys(rs, true);

    console.log(`k: ${id}`)
    let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await polyUtils.buildR1csPolys(curve, Lagrange_basis, r1cs_k, sR1cs_k, true)
    let fdQAP = await createBinFile(`${dirPath}/subcircuit${id}.qap`, "qapp", 1, 2, 1<<22, 1<<24);
    
    await startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await endWriteSection(fdQAP);

    await startWriteSection(fdQAP, 2);
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof uX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of uX_i at k: ${id}, i: ${i}`);
            }
            await writeBigInt(fdQAP, uX_i[i][xi][0], n8r);
        }
    }
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof vX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of vX_i at k: ${id}, i: ${i}`);
            }
            await writeBigInt(fdQAP, vX_i[i][xi][0], n8r);
        }
    }
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof wX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of wX_i at k: ${id}, i: ${i}`);
            }
            await writeBigInt(fdQAP, wX_i[i][xi][0], n8r);
        }
    }
    await endWriteSection(fdQAP)
    await fdQAP.close();



}