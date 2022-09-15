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
import * as timer from "./timer.js"


export default async function uni_buildQAP(curveName, s_D, min_s_max) {
    const startTime = timer.start();
    let partTime;

    const TESTFLAG = false;
    const r1cs = new Array();
    const sR1cs = new Array();
    
    mkdir(path.join(`resource/subcircuits`, `QAP_${s_D}_${min_s_max}`), (err) => {});
    const dirPath = `resource/subcircuits/QAP_${s_D}_${min_s_max}`

    partTime = timer.start();
    for(var i=0; i<s_D; i++){
        console.log(`Loading R1CSs...${i+1}/${s_D}`)
        let r1csIdx = String(i);
        const {fd: fdR1cs, sections: sectionsR1cs} = await readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 2, 1<<22, 1<<24);
        r1cs.push(await readR1csHeader(fdR1cs, sectionsR1cs, false));
        sR1cs.push(await readSection(fdR1cs, sectionsR1cs, 2));
        await fdR1cs.close();
    }
    console.log(`Loading R1CSs...Done`)
    const r1csTime = timer.end(partTime);
    
    const fdRS = await createBinFile(`resource/subcircuits/param_${s_D}_${min_s_max}.dat`, "zkey", 1, 2, 1<<22, 1<<24);
    
    const curve = await curves.getCurveFromName(curveName);
    const Fr = curve.Fr;
    
    if (r1cs[0].prime != curve.r) {
        console.log("r1cs_prime: ", r1cs[0].prime);
        console.log("curve_r: ", curve.r);
        throw new Error("r1cs curve does not match powers of tau ceremony curve")
        //return -1
    }

    // Write Header
    ///////////
    await startWriteSection(fdRS, 1);
    await fdRS.writeULE32(1); // Groth
    await endWriteSection(fdRS);
    // End of the Header

    // Write parameters section
    ///////////
    await startWriteSection(fdRS, 2);
    const primeQ = curve.q;
    const n8q = (Math.floor( (Scalar.bitLength(primeQ) - 1) / 64) +1)*8;

    // Group parameters
    const primeR = curve.r;
    const n8r = (Math.floor( (Scalar.bitLength(primeR) - 1) / 64) +1)*8;

    await fdRS.writeULE32(n8q);                   // byte length of primeQ
    await writeBigInt(fdRS, primeQ, n8q);
    await fdRS.writeULE32(n8r);                   // byte length of primeR
    await writeBigInt(fdRS, primeR, n8r);

    // Instruction set constants
    await fdRS.writeULE32(s_D)
    const m = new Array()          // the numbers of wires
    const mPublic = new Array()    // the numbers of public wires (not including constant wire at zero index)
    const mPrivate = new Array()
    const nConstraints = new Array()
    for(var i=0; i<s_D; i++){
        m.push(r1cs[i].nVars);
        nConstraints.push(r1cs[i].nConstraints)
        mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs + r1cs[i].nPrvInputs) 
        mPrivate.push(m[i] - mPublic[i])
        await fdRS.writeULE32(m[i])
        await fdRS.writeULE32(mPublic[i])
        await fdRS.writeULE32(nConstraints[i])
    }

    // QAP constants
    const sum_mPublic = mPublic.reduce((accu,curr) => accu + curr)
    const sum_mPrivate = mPrivate.reduce((accu,curr) => accu + curr)
    const NEqs = Math.max(sum_mPublic, sum_mPrivate)
    //let n = Math.max(Math.ceil(NEqs/3), Math.max(...nConstraints));
    let n = Math.max(...nConstraints);
    
    const expon = Math.ceil(Math.log2(n));
    n = 2**expon;

    const omega_x = await Fr.exp(Fr.w[Fr.s], Scalar.exp(2, Fr.s-expon));
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
    
    let expos = Math.ceil(Math.log2(min_s_max));
    const s_max = 2**expos;
    const omega_y = await Fr.exp(Fr.w[Fr.s], Scalar.exp(2, Fr.s-expos));
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

    await fdRS.writeULE32(n);                       // the maximum number of gates in each subcircuit: n>=NEqs/3 and n|(r-1)
    await fdRS.writeULE32(s_max);                  // the maximum number of subcircuits in a p-code: s_max>min_s_max and s_max|(r-1)
    await writeBigInt(fdRS, Fr.toObject(omega_x), n8r);                    // Generator for evaluation points on X
    await writeBigInt(fdRS, Fr.toObject(omega_y), n8r);             // Generator for evaluation points on Y

    // Test code 2 //
    if(TESTFLAG){
        console.log(`Running Test 2`)
        assert(Fr.eq(omega_x, Fr.e(Fr.toObject(omega_x))))
        console.log(`Test 2 finished`)
    }
    // End of test code 2 //

    await endWriteSection(fdRS);
    /// End of parameters section

    await fdRS.close();

    const rs={};
    rs.curve = curve;
    rs.n = n;
    rs.s_max = s_max;
    rs.omega_x = omega_x;
    rs.omega_y = omega_y;
    
    partTime = timer.start();
    
    console.log(`Generating Lagrange bases for X with ${n} evaluation points...`)
    const Lagrange_basis = await polyUtils.buildCommonPolys(rs, true);
    console.log(`Generating Lagrange bases for X with ${n} evaluation points...Done`)
    
    let FSTimeAccum = 0;
    for (var k=0; k<s_D; k++){
        console.log(`Interpolating ${3*m[k]} QAP polynomials...${k+1}/${s_D}`)
        let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await polyUtils.buildR1csPolys(curve, Lagrange_basis, r1cs[k], sR1cs[k], true)
        
        console.log(`File writing the polynomials...`)
        let FSTime = timer.start();
        let fdQAP = await createBinFile(`${dirPath}/subcircuit${k}.qap`, "qapp", 1, 2, 1<<22, 1<<24);
        
        await startWriteSection(fdQAP, 1);
        await fdQAP.writeULE32(1); // Groth
        await endWriteSection(fdQAP);

        await startWriteSection(fdQAP, 2);
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof uX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of uX_i at k: ${k}, i: ${i}`);
                }
                await writeBigInt(fdQAP, uX_i[i][xi][0], n8r);
            }
        }
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof vX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of vX_i at k: ${k}, i: ${i}`);
                }
                await writeBigInt(fdQAP, vX_i[i][xi][0], n8r);
            }
        }
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof wX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of wX_i at k: ${k}, i: ${i}`);
                }
                await writeBigInt(fdQAP, wX_i[i][xi][0], n8r);
            }
        }
        await endWriteSection(fdQAP)
        await fdQAP.close();
        FSTimeAccum += timer.end(FSTime);
    }
    const qapTime = timer.end(partTime);
    const totalTime = timer.end(startTime);
    console.log(`-----Time Analyzer-----`)
    console.log(`###Total ellapsed time: ${totalTime} [ms]`)
    console.log(` ##R1CS loading time: ${r1csTime} [ms] (${r1csTime/totalTime*100} %)`)
    console.log(` ##Total QAP time for ${m.reduce((accu,curr) => accu + curr)} wires: ${qapTime} [ms] (${qapTime/totalTime*100} %)`)
    console.log(`  #QAP interpolation time: ${qapTime-FSTimeAccum} [ms] (${(qapTime-FSTimeAccum)/totalTime*100} %)`)
    console.log(`  #QAP file writing time: ${FSTimeAccum} [ms] (${FSTimeAccum/totalTime*100} %)`)
    console.log(` ##Average QAP time per wire with ${n} interpolation points: ${qapTime/m.reduce((accu,curr) => accu + curr)} [ms]`)

}