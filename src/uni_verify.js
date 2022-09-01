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
import * as zkeyUtils from "./uni_zkey_utils.js";
import * as wtnsUtils from "./wtns_utils.js";
import generateWitness from "./generate_witness.js"
import * as fastFile from "fastfile";
import { getCurveFromQ as getCurve } from "./curves.js";
import { log2 } from "./misc.js";
import { Scalar, utils, BigBuffer } from "ffjavascript";
const {stringifyBigInts} = utils;
import * as misc from './misc.js'
import { readFileSync} from 'fs'
import hash from 'js-sha3'
import * as timer from "./timer.js"

export default async function groth16Verify(proofName, cRSName, circuitName) {
    const startTime = timer.start();
    
    const TESTFLAG = false;
    const ID_KECCAK = 5;
    
    const dirPath = `resource/circuits/${circuitName}`
    const CRS = 1;

    const {fd: fdRS, sections: sectionsRS} = await binFileUtils.readBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 2, 1<<25, 1<<23);
    const fdIdV = await fastFile.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
    const fdWrL = await fastFile.readExisting(`${dirPath}/WireList.bin`, 1<<25, 1<<23);
    const {fd: fdPrf, sections: sectionsPrf} = await binFileUtils.readBinFile(`${dirPath}/${proofName}.proof`, "prof", 2, 1<<22, 1<<24);
    
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
    const omega_x = await Fr.e(urs.param.omega_x)
    const omega_y = await Fr.e(urs.param.omega_y)
    
    const mPublic = crs.param.mPublic;
    const mPrivate = crs.param.mPrivate;
    const m = mPublic + mPrivate;
    const NConstWires = 1;
    const NOutputWires = 1;



    if(!((mPublic == IdSetV.set.length) && (mPrivate == IdSetP.set.length)))
    {
        throw new Error(`Error in crs file: invalid crs parameters. mPublic: ${mPublic}, IdSetV: ${IdSetV.set.length}, mPrivate: ${mPrivate}, IdSetP: ${IdSetP.set.length},`)
    }

    /// list keccak instances
    const keccakList = [];
    for (var k=0; k<OpList.length; k++){
        let kPrime = OpList[k];
        if (kPrime == ID_KECCAK){
            keccakList.push(k);
        }
    }

    /// generate instance for each subcircuit
    const hex_keccakInstance = [];
    let subInstance = new Array(OpList.length);
    await OpList.forEach((kPrime, index) => {
		const inputs = JSON.parse(readFileSync(`${dirPath}/instance/Input_opcode${index}.json`, "utf8"))
        const outputs = JSON.parse(readFileSync(`${dirPath}/instance/Output_opcode${index}.json`, "utf8"))
        const instance_k_hex = [];
        for(var i=0; i<NConstWires; i++){
            instance_k_hex.push('0x01');
        }
        if (keccakList.indexOf(kPrime)>-1){
            instance_k_hex.push('0x01');
        } else {
            instance_k_hex.push(...outputs.out);
        }
        instance_k_hex.push(...inputs.in);
        if(instance_k_hex.length != ParamR1cs[kPrime].mPublic+NConstWires){
            throw new Error(`Error in loading subinstances: wrong instance size`)
        }
        if (keccakList.indexOf(kPrime)>-1){
            let keccakItems = [];
            keccakItems.push('0x01');
            keccakItems.push(...outputs.out);
            keccakItems.push(...inputs.in);
            hex_keccakInstance.push(keccakItems);
        }
        let instance_k = new Array(ParamR1cs[kPrime].mPublic+NConstWires);
        for(var i=0; i<instance_k.length; i++){
            instance_k[i] = BigInt(instance_k_hex[i]);
        }
        subInstance[index] = instance_k;
    })

    /// arrange circuit instance accroding to Set_I_V.bin (= IdSetV), which ideally consists of only subcircuit outputs
    let cInstance = new Array(IdSetV.set.length);
    for(var i=0; i<IdSetV.set.length; i++){
        const kPrime = WireList[IdSetV.set[i]][0];
        const iPrime = WireList[IdSetV.set[i]][1];
        if(iPrime<NConstWires || iPrime>=NConstWires+ParamR1cs[kPrime].mPublic){
            throw new Error(`Error in arranging circuit instance: containing a private wire`);
        }
        // if(iPrime<NConstWires || iPrime>=NConstWires+NOutputWires){
        //     throw new Error(`Error in arranging circuit instance: containing an input wire`);
        // }
        cInstance[i] = subInstance[kPrime][iPrime];
    }
    if (cInstance.length != mPublic){
        throw new Error('Error in arranging circuit instance: wrong instance size');
    }
   
    
    /// read proof
    await binFileUtils.startReadUniqueSection(fdPrf, sectionsPrf, 2);
    const vk1_A = await zkeyUtils.readG1(fdPrf, curve);
    const vk2_B = await zkeyUtils.readG2(fdPrf, curve);
    const vk1_C = await zkeyUtils.readG1(fdPrf, curve);
    await binFileUtils.endReadSection(fdPrf);
    await fdPrf.close();

    /// Compute term D
    let vk1_D
    vk1_D = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<mPublic; i++){
        let term = await G1.timesFr(crs.vk1_zxy_i[i], Fr.e(cInstance[i]));
        vk1_D = await G1.add(vk1_D, term);
    }
    
    /// Verify
    const res = await curve.pairingEq(urs.sigma_G.vk1_alpha_v, urs.sigma_H.vk2_alpha_u,
        vk1_D, urs.sigma_H.vk2_gamma_z,
        vk1_C, urs.sigma_H.vk2_gamma_a,
        vk1_A,  await G2.neg(vk2_B));
    console.log(`Circuit verification result = ${res}`);

    const { keccak256 } = hash
    let res2 = true;
    for (var i=0; i<keccakList.length; i++){
        // keccak has two inputs and one output
        const hex_expected = hex_keccakInstance[i][1].slice(2);
        let hex_inputs=[];
        hex_inputs[0] = hex_keccakInstance[i][2].slice(2);
        hex_inputs[1] = hex_keccakInstance[i][3].slice(2);
        const con_hex_in = hex_inputs[0] + hex_inputs[1]
        const string_input = hexToString(con_hex_in);
        
        const hex_hashout = keccak256(string_input);
        res2 = res2 && (hex_expected == hex_hashout);
    }
    if (keccakList.length>0){
        console.log(`Keccak verification result = ${res2}`);
    }

    timer.end(startTime);

    function hexToString(hex) {
        if (!hex.match(/^[0-9a-fA-F]+$/)) {
          throw new Error('is not a hex string.');
        }
        if (hex.length % 2 !== 0) {
          hex = '0' + hex;
        }
        var bytes = [];
        for (var n = 0; n < hex.length; n += 2) {
          var code = parseInt(hex.substr(n, 2), 16)
          bytes.push(code);
        }
        return bytes;
      }
}