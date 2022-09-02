#! /usr/bin/env node

'use strict';

var path = require('path');
var fs = require('fs');
var url = require('url');
var ffjavascript = require('ffjavascript');
var Blake2b = require('blake2b-wasm');
var readline = require('readline');
var crypto = require('crypto');
var binFileUtils = require('@iden3/binfileutils');
var fastFile = require('fastfile');
var chai = require('chai');
var r1csfile = require('r1csfile');
require('constants');
var hash = require('js-sha3');
var Logger = require('logplease');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var url__default = /*#__PURE__*/_interopDefaultLegacy(url);
var Blake2b__default = /*#__PURE__*/_interopDefaultLegacy(Blake2b);
var readline__default = /*#__PURE__*/_interopDefaultLegacy(readline);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var binFileUtils__namespace = /*#__PURE__*/_interopNamespace(binFileUtils);
var fastFile__namespace = /*#__PURE__*/_interopNamespace(fastFile);
var chai__default = /*#__PURE__*/_interopDefaultLegacy(chai);
var hash__default = /*#__PURE__*/_interopDefaultLegacy(hash);
var Logger__default = /*#__PURE__*/_interopDefaultLegacy(Logger);

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

const __dirname$1 = path__default["default"].dirname(url__default["default"].fileURLToPath((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('cli.cjs', document.baseURI).href))));

let pkgS;
try {
    pkgS = fs__default["default"].readFileSync(path__default["default"].join(__dirname$1, "package.json"));
} catch (err) {
    pkgS = fs__default["default"].readFileSync(path__default["default"].join(__dirname$1, "..","package.json"));
}

const pkg = JSON.parse(pkgS);
const version = pkg.version;
let selectedCommand = null;

async function clProcessor(commands) {
    const cl = [];
    const argv = {};
    for (let i=2; i<process.argv.length; i++) {
        if (process.argv[i][0] == "-") {
            let S = process.argv[i];
            while (S[0] == "-") S = S.slice(1);
            const arr = S.split("=");
            if (arr.length > 1) {
                argv[arr[0]] = arr.slice(1).join("=");
            } else {
                argv[arr[0]] = true;
            }
        } else {
            cl.push(process.argv[i]);
        }
    }
    for (let i=0; i<commands.length; i++) {
        const cmd = commands[i];
        const m = calculateMatch(commands[i], cl);
        let res;
        if (m) {
            if ((argv.h) || (argv.help)) {
                helpCmd(cmd);
                return;
            }
            if (areParamsValid(cmd.cmd, m)) {
                if (cmd.options) {
                    const options = getOptions(cmd.options);
                    res = await cmd.action(m, options);
                } else {
                    res = await cmd.action(m, {});
                }
            } else {
                if (m.length>0) console.log("Invalid number of parameters");
                helpCmd(cmd);
                return 99;
            }
            return res;
        }
    }
    if (cl.length>0) console.log("Invalid command");
    helpAll();
    return 99;

    function calculateMatch(cmd, cl) {
        const alias = [];
        const m = parseLine(cmd.cmd);
        alias.push(m);
        if (cmd.alias) {
            if (Array.isArray(cmd.alias)) {
                for (let i=0; i<cmd.alias.length; i++) {
                    const a = parseLine(cmd.alias[i]);
                    alias.push({
                        cmd: a.cmd,
                        params: m.params
                    });
                }
            } else {
                const a = parseLine(cmd.alias);
                alias.push({
                    cmd: a.cmd,
                    params: m.params
                });
            }
        }
        for (let i=0; i<cl.length; i++) {
            for (let j=0; j<alias.length; j++) {
                const w = alias[j].cmd.shift();
                if (cl[i].toUpperCase() == w.toUpperCase()) {
                    if (alias[j].cmd.length == 0) {
                        return buildRemaining(alias[j].params, cl.slice(i+1));
                    }
                } else {
                    alias.splice(j, 1);
                    j--;
                }
            }
        }
        return null;


        function buildRemaining(defParams, cl) {
            const res = [];
            let p=0;
            for (let i=0; i<defParams.length; i++) {
                if (defParams[i][0]=="-") {
                    res.push(getOption(defParams[i]).val);
                } else {
                    if (p<cl.length) {
                        res.push(cl[p++]);
                    } else {
                        res.push(null);
                    }
                }
            }
            while (p<cl.length) {
                res.push(cl[p++]);
            }
            return res;
        }
    }

    function parseLine(l) {
        const words = l.match(/(\S+)/g);
        for (let i=0; i<words.length; i++) {
            if  (   (words[i][0] == "<")
                 || (words[i][0] == "[")
                 || (words[i][0] == "-"))
            {
                return {
                    cmd: words.slice(0,i),
                    params: words.slice(i)
                };
            }
        }
        return {
            cmd: words,
            params: []
        };
    }


    function getOption(o) {
        const arr1 = o.slice(1).split(":");
        const arr2 = arr1[0].split("|");
        for (let i = 0; i<arr2.length; i++) {
            if (argv[arr2[i]]) return {
                key: arr2[0],
                val: argv[arr2[i]]
            };
        }
        return {
            key: arr2[0],
            val: (arr1.length >1) ? arr1[1] : null
        };
    }


    function areParamsValid(cmd, params) {
        while ((params.length)&&(!params[params.length-1])) params.pop();
        const pl = parseLine(cmd);
        if (params.length > pl.params.length) return false;
        let minParams = pl.params.length;
        while ((minParams>0)&&(pl.params[minParams-1][0] == "[")) minParams --;
        if (params.length < minParams) return false;

        for (let i=0; (i< pl.params.length)&&(pl.params[i][0]=="<"); i++) {
            if (typeof params[i] == "undefined") return false;
        }
        return true;
    }

    function getOptions(options) {
        const res = {};
        const opts = options.match(/(\S+)/g);
        for (let i=0; i<opts.length; i++) {
            const o = getOption(opts[i]);
            res[o.key] = o.val;
        }
        return res;
    }

    function printVersion() {
        console.log("snarkjs@"+version);
    }

    function epilog() {
        console.log(`        Copyright (C) 2018  0kims association
        This program comes with ABSOLUTELY NO WARRANTY;
        This is free software, and you are welcome to redistribute it
        under certain conditions; see the COPYING file in the official
        repo directory at  https://github.com/iden3/snarkjs `);
    }

    function helpAll() {
        printVersion();
        epilog();
        console.log("");
        console.log("Usage:");
        console.log("        snarkjs <full command> ...  <options>");
        console.log("   or   snarkjs <shorcut> ...  <options>");
        console.log("");
        console.log("Type snarkjs <command> --help to get more information for that command");
        console.log("");
        console.log("Full Command                  Description");
        console.log("============                  =================");
        for (let i=0; i<commands.length; i++) {
            const cmd = commands[i];
            let S = "";
            const pl = parseLine(cmd.cmd);
            S += pl.cmd.join(" ");
            while (S.length<30) S = S+" ";
            S += cmd.description;
            console.log(S);
            S = "     Usage:  snarkjs ";
            if (cmd.alias) {
                if (Array.isArray(cmd.alias)) {
                    S += cmd.alias[0];
                } else {
                    S += cmd.alias;
                }
            } else {
                S += pl.cmd.join(" ");
            }
            S += " " + pl.params.join(" ");
            console.log(S);
        }
    }

    function helpCmd(cmd) {
        if (typeof cmd == "undefined") cmd = selectedCommand;
        if (typeof cmd == "undefined") return helpAll();
        printVersion();
        epilog();
        console.log("");
        if (cmd.longDescription) {
            console.log(cmd.longDescription);
        } else {
            console.log(cmd.description);
        }
        console.log("Usage: ");
        console.log("        snarkjs "+ cmd.cmd);
        const pl = parseLine(cmd.cmd);
        let S = "   or   snarkjs ";
        if (cmd.alias) {
            if (Array.isArray(cmd.alias)) {
                S += cmd.alias[0];
            } else {
                S += cmd.alias;
            }
        } else {
            S += pl.cmd.join(" ");
        }
        S += " " + pl.params.join(" ");
        console.log(S);



        console.log("");
    }
}

ffjavascript.Scalar.e("73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001", 16);
ffjavascript.Scalar.e("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const bls12381q = ffjavascript.Scalar.e("1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab", 16);
const bn128q = ffjavascript.Scalar.e("21888242871839275222246405745257275088696311157297823662689037894645226208583");

async function getCurveFromQ(q) {
    let curve;
    if (ffjavascript.Scalar.eq(q, bn128q)) {
        curve = await ffjavascript.buildBn128();
    } else if (ffjavascript.Scalar.eq(q, bls12381q)) {
        curve = await ffjavascript.buildBls12381();
    } else {
        throw new Error(`Curve not supported: ${ffjavascript.Scalar.toString(q)}`);
    }
    return curve;
}

async function getCurveFromName(name) {
    let curve;
    const normName = normalizeName(name);
    if (["BN128", "BN254", "ALTBN128"].indexOf(normName) >= 0) {
        curve = await ffjavascript.buildBn128();
    } else if (["BLS12381"].indexOf(normName) >= 0) {
        curve = await ffjavascript.buildBls12381();
    } else {
        throw new Error(`Curve not supported: ${name}`);
    }
    return curve;

    function normalizeName(n) {
        return n.toUpperCase().match(/[A-Za-z0-9]+/g).join("");
    }

}

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


function askEntropy() {
    if (process.browser) {
        return window.prompt("Enter a random text. (Entropy): ", "");
    } else {
        const rl = readline__default["default"].createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question("Enter a random text. (Entropy): ", (input) => resolve(input) );
        });
    }
}

async function getRandomRng(entropy) {
    // Generate a random Rng
    while (!entropy) {
        entropy = await askEntropy();
    }
    const hasher = Blake2b__default["default"](64);
    hasher.update(crypto__default["default"].randomBytes(64));
    const enc = new TextEncoder(); // always utf-8
    hasher.update(enc.encode(entropy));
    const hash = Buffer.from(hasher.digest());

    const seed = [];
    for (let i=0;i<8;i++) {
        seed[i] = hash.readUInt32BE(i*4);
    }
    const rng = new ffjavascript.ChaCha(seed);
    return rng;
}

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

async function writeG1(fd, curve, p) {
    const buff = new Uint8Array(curve.G1.F.n8*2);
    curve.G1.toRprLEM(buff, 0, p);
    await fd.write(buff);
}

async function writeG2(fd, curve, p) {
    const buff = new Uint8Array(curve.G2.F.n8*2);
    curve.G2.toRprLEM(buff, 0, p);
    await fd.write(buff);
}

async function readG1(fd, curve, toObject) {
    const buff = await fd.read(curve.G1.F.n8*2);
    const res = curve.G1.fromRprLEM(buff, 0);
    return toObject ? curve.G1.toObject(res) : res;
}

async function readG2(fd, curve, toObject) {
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

async function processConstraints(curve, n_k, sR1cs_k) { 
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

async function readOpList(fd){
    const ListSize = await fd.readULE32();
    let OpList = new Array(ListSize);

    for(var k=0; k<ListSize; k++){
        OpList[k] = await fd.readULE32();
    }

    return OpList
}

async function readWireList(fd) {
    const listSize = await fd.readULE32();
    let result = new Array(listSize);
    for(var i=0; i<listSize; i++){
        result[i] = [await fd.readULE32(), await fd.readULE32()];
    }

    return result

    // PreImages[i] = row^(-1)[m_i] = {(k1, i1), (k2, i2), (k3, i3), ...},
    // where the index i denotes the i-th wire of a derived (chained) circuit,
    // and m_i = (k', i') denotes the i'-th (output) wire in the k'-th subcircuit,
    // which is a linear combination of the i1-th, i2-th, i3-th, and ... (input) wires respectively from the k1-th, k2-th, k3-th, and ... subcircuits.
}

async function readIndSet(fd) {
    const setSize = await fd.readULE32();
    const IndSet = {};
    IndSet.set=[];
    for(var i=0; i<setSize; i++){
        IndSet.set.push(await fd.readULE32());
    }
    let PreImages = new Array(setSize);
    let PreImgSize;
    for(var i=0; i<setSize; i++){
        PreImgSize = await fd.readULE32();
        PreImages[i] = new Array(PreImgSize);
        for(var j=0; j<PreImgSize; j++){
            PreImages[i][j] = [await fd.readULE32(), await fd.readULE32()];
        }
    }
    IndSet.PreImgs=PreImages;

    return IndSet

    // PreImages[i] = row^(-1)[m_i] = {(k1, i1), (k2, i2), (k3, i3), ...},
    // where the index i denotes the i-th wire of a derived (chained) circuit,
    // and m_i = (k', i') denotes the i'-th (output) wire in the k'-th subcircuit,
    // which is a linear combination of the i1-th, i2-th, i3-th, and ... (input) wires respectively from the k1-th, k2-th, k3-th, and ... subcircuits.
}

async function readRSParams(fd, sections) {
    // read only urs params from urs or crs file
    // crs params are read by readRS()
    const rs = {};

    rs.protocol = "groth16";

    // Read parameters
    /////////////////////
    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 2);
    // Group parameters
    const n8q = await fd.readULE32();
    rs.n8q = n8q;
    rs.q = await binFileUtils__namespace.readBigInt(fd, n8q);

    const n8r = await fd.readULE32();
    rs.n8r = n8r;
    rs.r = await binFileUtils__namespace.readBigInt(fd, n8r);
    rs.curve = await getCurveFromQ(rs.q);
    
    // Instruction set constants
    const s_D = await fd.readULE32();
    rs.s_D = s_D;
    rs.r1cs = new Array(s_D);
    for(var i=0; i<s_D; i++){
        rs.r1cs[i] = {};
        rs.r1cs[i].m = await fd.readULE32();
        rs.r1cs[i].mPublic = await fd.readULE32();
        rs.r1cs[i].mPrivate = rs.r1cs[i].m - rs.r1cs[i].mPublic;
        rs.r1cs[i].nConstraints = await fd.readULE32();
    }

    // QAP constants
    rs.n = await fd.readULE32();
    rs.s_max = await fd.readULE32();
    rs.omega_x = rs.curve.Fr.e(await binFileUtils__namespace.readBigInt(fd, n8r));
    rs.omega_y = rs.curve.Fr.e(await binFileUtils__namespace.readBigInt(fd, n8r));

    await binFileUtils__namespace.endReadSection(fd);

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

async function readRS(fd, sections, rsParam, rsType, toObject) {
    //rsType?crs:urs
    const curve = rsParam.curve;
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
    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 3);
    rsContent.sigma_G = {};
    rsContent.sigma_G.vk1_alpha_u = await readG1(fd, curve, toObject);
    rsContent.sigma_G.vk1_alpha_v = await readG1(fd, curve, toObject);
    rsContent.sigma_G.vk1_gamma_a = await readG1(fd, curve, toObject);
    
    let vk1_xy_pows = Array.from(Array(n), () => new Array(s_max));
    for(var i = 0; i < n; i++) {
        for(var j = 0; j < s_max; j++){
            vk1_xy_pows[i][j] = await readG1(fd, curve, toObject);
            // vk1_xy_pows[i][j] = G1*(x^i * y^j)
        }
    }
    rsContent.sigma_G.vk1_xy_pows = vk1_xy_pows;

    let vk1_xy_pows_t1g = Array.from(Array(n-1), () => new Array(2*s_max-1));
    for(var i = 0; i < n-1; i++) {
        for(var j=0; j<2*s_max-1; j++){
            vk1_xy_pows_t1g[i][j] = await readG1(fd, curve, toObject);
            // vk1_xy_pows_tg[i][j] = G1*(x^i * y^j)*t(x)*inv(gamma_a)
        }
    }
    rsContent.sigma_G.vk1_xy_pows_t1g = vk1_xy_pows_t1g;

    let vk1_xy_pows_t2g = Array.from(Array(n), () => new Array(s_max-1));
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max-1; j++){
            vk1_xy_pows_t2g[i][j] = await readG1(fd, curve, toObject);
            // vk1_xy_pows_tg[i][j] = G1*(x^i * y^j)*t(x)*inv(gamma_a)
        }
    }
    rsContent.sigma_G.vk1_xy_pows_t2g = vk1_xy_pows_t2g;

    await binFileUtils__namespace.endReadSection(fd);
    // End of reading sigma_G

    // Read sigma_H section
    ///////////
    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 4);
    rsContent.sigma_H = {};
    rsContent.sigma_H.vk2_alpha_u = await readG2(fd, curve, toObject);
    rsContent.sigma_H.vk2_gamma_z = await readG2(fd, curve, toObject);
    rsContent.sigma_H.vk2_gamma_a = await readG2(fd, curve, toObject);

    let vk2_xy_pows = Array.from(Array(n), () => new Array(s_max));
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max; j++){
            vk2_xy_pows[i][j] = await readG2(fd, curve, toObject);
            // vk2_xy_pows[i][j] = G2*(x^i * y^j)
        }
    }
    rsContent.sigma_H.vk2_xy_pows = vk2_xy_pows;
    await binFileUtils__namespace.endReadSection(fd);
    // End of reading sigma_H

    if (!rsType) //urs
    {
        // Read theta_G[k] sections for k in [0, 1, ..., s_D]
        ///////////
        rsContent.theta_G = {};
        let vk1_uxy_kij = new Array(s_D);
        let vk1_vxy_kij = new Array(s_D);
        let vk2_vxy_kij = new Array(s_D);
        let vk1_zxy_kij = new Array(s_D);
        let vk1_axy_kij = new Array(s_D);
        for(var k=0; k<s_D; k++){
            const m_k = rsParam.r1cs[k].m;
            const mPublic_k = rsParam.r1cs[k].mPublic;
            const mPrivate_k = rsParam.r1cs[k].mPrivate;
            let vk1_uxy_ij = Array.from(Array(m_k), () => new Array(s_max));
            let vk1_vxy_ij = Array.from(Array(m_k), () => new Array(s_max));
            let vk2_vxy_ij = Array.from(Array(m_k), () => new Array(s_max));
            let vk1_zxy_ij = Array.from(Array(mPublic_k), () => new Array(s_max));
            let vk1_axy_ij = Array.from(Array(mPrivate_k), () => new Array(s_max));
            await binFileUtils__namespace.startReadUniqueSection(fd, sections, 5+k);
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_uxy_ij[i][j] = await readG1(fd, curve, toObject);
                }
            }
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_vxy_ij[i][j] = await readG1(fd, curve, toObject);
                }
            }
            for(var i=0; i < m_k; i++){
                for(var j=0; j < s_max; j++){
                    vk2_vxy_ij[i][j] = await readG2(fd, curve, toObject);
                }
            }
            for(var i=0; i < mPublic_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_zxy_ij[i][j] = await readG1(fd, curve, toObject);
                }
            }
            for(var i=0; i < mPrivate_k; i++){
                for(var j=0; j < s_max; j++){
                    vk1_axy_ij[i][j] = await readG1(fd, curve, toObject);
                }
            }
            await binFileUtils__namespace.endReadSection(fd);
            vk1_uxy_kij[k] = vk1_uxy_ij;
            vk1_vxy_kij[k] = vk1_vxy_ij;
            vk2_vxy_kij[k] = vk2_vxy_ij;
            vk1_zxy_kij[k] = vk1_zxy_ij;
            vk1_axy_kij[k] = vk1_axy_ij;
        }
        rsContent.theta_G.vk1_uxy_kij = vk1_uxy_kij;
        rsContent.theta_G.vk1_vxy_kij = vk1_vxy_kij;
        rsContent.theta_G.vk2_vxy_kij = vk2_vxy_kij;
        rsContent.theta_G.vk1_zxy_kij = vk1_zxy_kij;
        rsContent.theta_G.vk1_axy_kij = vk1_axy_kij;
    
    } else if(rsType==1){ //crs
        rsContent.crs ={};
        await binFileUtils__namespace.startReadUniqueSection(fd, sections, 5);
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
        await binFileUtils__namespace.endReadSection(fd);
        
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

function start() {
  return new Date();
}

function end(startTime) {
  const endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  //timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  console.log(`Elapsed time: ${seconds} [ms]`);
}

function check(startTime) {
  const endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  //timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  console.log(`Elapsed time: ${seconds} [ms]`);
  return endTime;
}

chai__default["default"].assert;



async function uni_Setup(paramName, RSName, entropy) {
    const startTime = start();
    
    const TESTFLAG = false;
    console.log(`TESTMODE = ${TESTFLAG}`);
    
    const {fd: fdParam, sections: sectionsParam} = await binFileUtils.readBinFile(`resource/subcircuits/${paramName}.dat`, "zkey", 2, 1<<25, 1<<23);
    const param = await readRSParams(fdParam, sectionsParam);
    const s_D = param.s_D;
    
    const fdRS = await binFileUtils.createBinFile('resource/universal_rs/'+RSName+".urs", "zkey", 1, 4+s_D, 1<<22, 1<<24);
    await binFileUtils.copySection(fdParam, sectionsParam, fdRS, 1);
    await binFileUtils.copySection(fdParam, sectionsParam, fdRS, 2);
    
    await fdParam.close();

    const r1cs = new Array();
    const sR1cs = new Array();
    for(var i=0; i<s_D; i++){
        let r1csIdx = String(i);
        const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+".r1cs", "r1cs", 1, 1<<22, 1<<24);
        r1cs.push(await r1csfile.readR1csHeader(fdR1cs, sectionsR1cs, false));
        sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
        await fdR1cs.close();
    }

    const curve = param.curve;
    // const sG1 = curve.G1.F.n8*2              // unused
    // const sG2 = curve.G2.F.n8*2              // unused
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const Fr = curve.Fr;
    const G1 = curve.G1;
    const G2 = curve.G2;
    const NConstWires = 1;

    const n = param.n;
    const s_max = param.s_max;
    const omega_x = param.omega_x;
    param.omega_y;

    const m = new Array();          // the numbers of wires
    const mPublic = new Array();    // the numbers of public wires (not including constant wire at zero index)
    const mPrivate = new Array();
    const nConstraints = new Array();
    for(var i=0; i<s_D; i++){
        m.push(r1cs[i].nVars);
        nConstraints.push(r1cs[i].nConstraints);
        mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs + r1cs[i].nPrvInputs); 
        mPrivate.push(m[i] - mPublic[i]);
    }
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
       
    // Generate tau
    var num_keys = 6; // the number of keys in tau
    let rng = new Array(num_keys);
    for(var i = 0; i < num_keys; i++) {
        rng[i] = await getRandomRng(entropy + i);
    }    
    const tau = createTauKey(Fr, rng);
    console.log(`checkpoint2`);

    
    // Write the sigma_G section
    ///////////
    await binFileUtils.startWriteSection(fdRS, 3);
    let vk1_alpha_u;
    vk1_alpha_u = await G1.timesFr( buffG1, tau.alpha_u );
    let vk1_alpha_v;
    vk1_alpha_v = await G1.timesFr( buffG1, tau.alpha_v );
    let vk1_gamma_a;
    vk1_gamma_a = await G1.timesFr( buffG1, tau.gamma_a );

    await writeG1(fdRS, curve, vk1_alpha_u);
    await writeG1(fdRS, curve, vk1_alpha_v);
    await writeG1(fdRS, curve, vk1_gamma_a);
    let x=tau.x;
    let y=tau.y;

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
            vk1_xy_pows[i][j] = await G1.timesFr(buffG1, xy_pows[i][j]);
            await writeG1(fdRS, curve, vk1_xy_pows[i][j]);
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
            vk1_xy_pows_t1g[i][j]= await G1.timesFr( buffG1, xy_pows_t1g );
            await writeG1( fdRS, curve, vk1_xy_pows_t1g[i][j] );
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
            vk1_xy_pows_t2g[i][j]= await G1.timesFr( buffG1, xy_pows_t2g );
            await writeG1( fdRS, curve, vk1_xy_pows_t2g[i][j] );
            // [x^0*y^0*t*g], [x^0*y^1*t*g], ..., [x^0*y^(s_max-1)*t*g], [x^1*y^0*t*g], ...
        }
    }
    
    await binFileUtils.endWriteSection(fdRS);
    // End of the sigma_G section
    ///////////

     // Write the sigma_H section
    ///////////
    await binFileUtils.startWriteSection(fdRS, 4);
    let vk2_alpha_u;
    vk2_alpha_u = await G2.timesFr( buffG2, tau.alpha_u );
    let vk2_gamma_z;
    vk2_gamma_z = await G2.timesFr( buffG2, tau.gamma_z );
    let vk2_gamma_a;
    vk2_gamma_a = await G2.timesFr( buffG2, tau.gamma_a );
    await writeG2(fdRS, curve, vk2_alpha_u);
    await writeG2(fdRS, curve, vk2_gamma_z);
    await writeG2(fdRS, curve, vk2_gamma_a);

    let vk2_xy_pows;
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max; j++){
            vk2_xy_pows= await G2.timesFr( buffG2, xy_pows[i][j] );
            await writeG2(fdRS, curve, vk2_xy_pows );
            // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(s_max-1)], [x^1*y^0], ...
        }
    }
    await binFileUtils.endWriteSection(fdRS);
    // End of the test code 3//

    // Write the theta_G[i] sections for i in [0, 1, ..., s_D] (alpha*u(X)+beta*v(X)+w(X))/gamma
    ///////////
    let Lagrange_basis = new Array(n);
    let term;
    let acc;
    let multiplier;
    for(var i=0; i<n; i++){
        term=Fr.one;
        acc=Fr.one;
        multiplier=Fr.mul(await Fr.exp(Fr.inv(omega_x),i),x);
        for(var j=1; j<n; j++){
            term=Fr.mul(term,multiplier);
            acc=Fr.add(acc,term);
        }
        Lagrange_basis[i]=Fr.mul(Fr.inv(Fr.e(n)),acc);
    }
    // let temp = new Array(n)
    // for(var i=0; i<n; i++){
    //     temp[i] = Fr.toObject(Lagrange_basis[i])
    // }
    // console.log('Lags ', temp)
    console.log(`checkpoint6`);

    for(var k = 0; k < s_D; k++){
        console.log(`k: ${k}`);
        let processResults_k;
        processResults_k = await processConstraints(curve, nConstraints[k], sR1cs[k]); // to fill U, V, W
        let U = processResults_k.U;
        let Uid = processResults_k.Uid;
        let V = processResults_k.V;
        let Vid = processResults_k.Vid;
        let W = processResults_k.W;
        let Wid = processResults_k.Wid;
        console.log(`checkpoint7`);
    
        let ux = new Array(m[k]);
        let vx = new Array(m[k]);
        let wx = new Array(m[k]);
        for(var i=0; i<m[k]; i++){
            ux[i]=Fr.e(0);
            vx[i]=Fr.e(0);
            wx[i]=Fr.e(0);
        }
   
        let U_ids;
        let U_coefs;
        let V_ids;
        let V_coefs;
        let W_ids;
        let W_coefs;
        let Lagrange_term;
        let U_idx;
        let V_idx;
        let W_idx;
    
        for(var i=0; i<r1cs[k].nConstraints; i++){
            U_ids=Uid[i];
            U_coefs=U[i];
            V_ids=Vid[i];
            V_coefs=V[i];
            W_ids=Wid[i];
            W_coefs=W[i];
            for(var j=0; j<U_ids.length; j++){
                U_idx=U_ids[j];
                if(U_idx>=0){
                    Lagrange_term=Fr.mul(U_coefs[j],Lagrange_basis[i]);
                    ux[U_idx]=Fr.add(ux[U_idx],Lagrange_term);
                }
            }
            for(var j=0; j<V_ids.length; j++){
                V_idx=V_ids[j];
                if(V_idx>=0){
                    Lagrange_term=Fr.mul(V_coefs[j],Lagrange_basis[i]);
                    vx[V_idx]=Fr.add(vx[V_idx],Lagrange_term);
                }
            }
            for(var j=0; j<W_ids.length; j++){
                W_idx=W_ids[j];
                if(W_idx>=0){
                    Lagrange_term=Fr.mul(W_coefs[j],Lagrange_basis[i]);
                    wx[W_idx]=Fr.add(wx[W_idx],Lagrange_term);
                }
            }
        }
        console.log(`checkpoint8`);
    
        let vk1_ux = new Array(m[k]);
        let vk1_vx = new Array(m[k]);
        let vk2_vx = new Array(m[k]);
        let vk1_zx = [];
        let vk1_ax = [];
        let combined_i;
        let zx_i;
        let ax_i;
        
        for(var i=0; i<m[k]; i++){
            vk1_ux[i] = await G1.timesFr(buffG1, ux[i]);
            vk1_vx[i] = await G1.timesFr(buffG1, vx[i]);
            vk2_vx[i] = await G2.timesFr(buffG2, vx[i]);
            combined_i = Fr.add(Fr.add(Fr.mul(tau.alpha_u, ux[i]), Fr.mul(tau.alpha_v, vx[i])), wx[i]);
            if(i>=NConstWires && i<NConstWires+mPublic[k]){
                zx_i=Fr.mul(combined_i, Fr.inv(tau.gamma_z));
                vk1_zx.push(await G1.timesFr(buffG1, zx_i));
            }
            else {
                ax_i=Fr.mul(combined_i, Fr.inv(tau.gamma_a));
                vk1_ax.push(await G1.timesFr(buffG1, ax_i));
            }
        }

        //console.log('temp test')
        //console.log('ux: ', ux)
        //console.log('vx: ', vx)
        //console.log('wx: ', wx)
        //console.log('temp test pass')
        // Test code 4//
        // To test [z^(k)_i(x)]_G and [a^(k)_i(x)]_G in sigma_G
        var i; 
        // End of the test code 4//

        await binFileUtils.startWriteSection(fdRS, 5+k);
        console.log(`checkpoint9`);
        let multiplier;
        let vk1_uxy_ij;
        let vk1_vxy_ij;
        let vk2_vxy_ij;
        let vk1_zxy_ij;
        let vk1_axy_ij;
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max));
            vk1_uxy_ij= await G1.timesFr(vk1_ux[i], multiplier);
            await writeG1(fdRS, curve, vk1_uxy_ij);
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y);
                vk1_uxy_ij= await G1.timesFr(vk1_ux[i], multiplier);
                await writeG1(fdRS, curve, vk1_uxy_ij);
            }
        }
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max));
            vk1_vxy_ij= await G1.timesFr(vk1_vx[i], multiplier);
            await writeG1(fdRS, curve, vk1_vxy_ij);
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y);
                vk1_vxy_ij= await G1.timesFr(vk1_vx[i], multiplier);
                await writeG1(fdRS, curve, vk1_vxy_ij);
            }
        }
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max));
            vk2_vxy_ij= await G2.timesFr(vk2_vx[i], multiplier);
            await writeG2(fdRS, curve, vk2_vxy_ij);
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y);
                vk2_vxy_ij= await G2.timesFr(vk2_vx[i], multiplier);
                await writeG2(fdRS, curve, vk2_vxy_ij);
            }
        }
        console.log(`checkpoint10`);
        for(var i=0; i < mPublic[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max));
            vk1_zxy_ij= await G1.timesFr(vk1_zx[i], multiplier);
            await writeG1(fdRS, curve, vk1_zxy_ij);
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y);
                vk1_zxy_ij= await G1.timesFr(vk1_zx[i], multiplier);
                await writeG1(fdRS, curve, vk1_zxy_ij);
            }
        }
        for(var i=0; i < mPrivate[k]; i++){
            multiplier=Fr.inv(Fr.e(s_max));
            vk1_axy_ij= await G1.timesFr(vk1_ax[i], multiplier);
            await writeG1(fdRS, curve, vk1_axy_ij);
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y);
                vk1_axy_ij= await G1.timesFr(vk1_ax[i], multiplier);
                await writeG1(fdRS, curve, vk1_axy_ij);
            }
        }
        await binFileUtils.endWriteSection(fdRS);
        console.log(`checkpoint11`);
    }
    // End of the test code 5//
    

    await fdRS.close();
    console.log(`checkpoint12`);

    end(startTime);

    // End of the theta_G section
    ///////////
/* 
    // TEST CODE 6
    if (TESTFLAG == true){
        console.log(`Running Test 1`)
        
        const sR1cs = new Array(); 
        for(var i=0; i<s_D; i++){
            let r1csIdx = String(i);
            const {fd: fdR1cs, sections: sectionsR1cs} = await readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 1, 1<<22, 1<<24);
            sR1cs.push(await readSection(fdR1cs, sectionsR1cs, 2));
            await fdR1cs.close();
        }

        const {uX_ki: uX_ki, vX_ki: vX_ki, wX_ki: wX_ki, tXY: tXY} = await polyUtils.buildR1csPolys(urs.param, sR1cs);
        let fY = Array.from(Array(1), () => new Array(s_max));
        const Fr_s_max_inv = Fr.inv(Fr.e(s_max));
        fY = await polyUtils.scalePoly(Fr, fY, Fr_s_max_inv);

        
        let XY_pows = Array.from(Array(n-1), () => new Array(s_max-1));
        XY_pows = await polyUtils.scalePoly(Fr, XY_pows, Fr.one);
        const XY_pows_tXY = await polyUtils.mulPoly(Fr, tXY, XY_pows);

        const test_xy_pows_t = await polyUtils.evalPoly(Fr, XY_pows_tXY, x, y);


        



        



        console.log(U_ids[0])
        const test_ux = await polyUtils.evalPoly(Fr, uX_ki[k][U_ids[0]], x, Fr.one);
        console.log(`test: ${Fr.toObject(test_ux)}`)
        console.log(`target: ${Fr.toObject(ux[U_ids[0]])}`)
        if (!Fr.eq(test_ux, ux[U_ids[0]])){
            throw new Error(`Polynomial evaluation failed`)
        }
        
        console.log(`Test 1 finished`)
    }
    // END OF TEST CODE 6
 */
    


    function createTauKey(Field, rng) {
        if (rng.length != 6){
            console.log(`checkpoint3`);
            throw new Error('It should have six elements.')
        } 
        const key = {
            x: Field.fromRng(rng[0]),
            y: Field.fromRng(rng[1]),
            alpha_u: Field.fromRng(rng[2]),
            alpha_v: Field.fromRng(rng[3]),
            gamma_a: Field.fromRng(rng[4]),
            gamma_z: Field.fromRng(rng[5])
        };
        return key
    }

}

async function buildR1csPolys(curve, Lagrange_basis, r1cs_k, sR1cs_k, flagMemorySave){
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
    console.log(`checkpoint 0-0`);
    
    constraints_k = await processConstraints(curve, n_k, sR1cs_k);
    U = constraints_k.U;
    Uid = constraints_k.Uid;
    V = constraints_k.V;
    Vid = constraints_k.Vid;
    W = constraints_k.W;
    Wid = constraints_k.Wid;

    console.log(`checkpoint 0-1`);

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
            let U_idx=U_ids[j];
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
            let V_idx=V_ids[j];
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
            let W_idx=W_ids[j];
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

    console.log(`checkpoint 0-2`);

    return {uX_i, vX_i, wX_i}
    // uX_ki[k][i] = polynomial of the i-th wire in the k-th subcircuit.
}

async function buildCommonPolys(rs, flagMemorySave){
    const curve = rs.curve;
    const Fr = curve.Fr;
    const n = rs.n;
    rs.s_max;
    const omega_x = await Fr.e(rs.omega_x);
    let flag_memory = true;
    if ( (flagMemorySave === undefined) || (flagMemorySave == false) ){
        flag_memory = false;
    }

    console.log(`checkpoint 0-0`);
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
    console.log(`checkpoint 0-1`);

   
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

async function filterPoly(Fr, coefs1, vect, dir){
    // Elemetwise multiplication of the coefficients of a polynomial along with a directed variable with a filtering vector
    // dir? Y:X
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    if ( !((!dir) && (N1_X == vect.length) || (dir) && (N1_Y == vect.length)) ){
        throw new Error('filterPoly: the lengths of two coefficients are not equal')
    }

    coefs1 = _autoTransFromObject(Fr, coefs1);

    let res = Array.from(Array(N1_X), () => new Array(N1_Y));
    for(var i=0; i<N1_X; i++){
        for(var j=0; j<N1_Y; j++){
            let scalerId;
            if (!dir){
                scalerId = i;
            } else {
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

async function scalePoly(Fr, coefs, scaler){
    // Assume scaler is in Fr
    const {N_X: NSlots_X, N_Y: NSlots_Y} = _polyCheck(coefs);
    coefs = _autoTransFromObject(Fr, coefs);

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

async function addPoly(Fr, coefs1, coefs2, SUBFLAG){
    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);

    coefs1 = _autoTransFromObject(Fr, coefs1);
    coefs2 = _autoTransFromObject(Fr, coefs2);

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

async function mulPoly(Fr, coefs1, coefs2, object_flag){
    
    coefs1 = reduceDimPoly(Fr, coefs1);
    coefs2 = reduceDimPoly(Fr, coefs2);

    const {N_X: N1_X, N_Y: N1_Y} = _polyCheck(coefs1);
    const {N_X: N2_X, N_Y: N2_Y} = _polyCheck(coefs2);
    const N3_X = N1_X+N2_X-1;
    const N3_Y = N1_Y+N2_Y-1;

    coefs1 = _autoTransFromObject(Fr, coefs1);
    coefs2 = _autoTransFromObject(Fr, coefs2);

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
            } else {
                res[i][j] = Fr.toObject(sum);
            }
        }
    }
    return res
}

function _transToObject(Fr, coefs){
    if ( (typeof coefs[0][0] == "bigint") || (coefs[0][0] === undefined) ){
        return coefs
    } else if(typeof coefs[0][0] != "object"){
        throw new Error('transFromObject: unexpected input type')
    }
    
    let res = Array.from(Array(coefs.length), () => new Array(coefs[0].length));
    for (var i=0; i<coefs.length; i++){
        for (var j=0; j<coefs[0].length; j++){
            res[i][j] = Fr.toObject(coefs[i][j]);
        }
    }
    return res
}

function _autoTransFromObject(Fr, coefs){
    if ( (typeof coefs[0][0] == "object") || (coefs[0][0] === undefined) ){
        return coefs
    } else if(typeof coefs[0][0] != "bigint"){
        throw new Error('autoTransFromObject: unexpected input type')
    }
    
    let res = Array.from(Array(coefs.length), () => new Array(coefs[0].length));
    for (var i=0; i<coefs.length; i++){
        for (var j=0; j<coefs[0].length; j++){
            res[i][j] = Fr.fromObject(coefs[i][j]);
        }
    }
    return res
}

async function divPolyByX(Fr, coefs1, coefs2, object_flag){
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
        console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`);
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
        prev_order_Y = nu_order_Y;
    }
    let finalrem = numer;

    if (!((object_flag === undefined) || (object_flag == false))){
        res = _transToObject(Fr, res);
        finalrem = _transToObject(Fr, finalrem);
    }
    return {res, finalrem}
}

async function divPolyByY(Fr, coefs1, coefs2, object_flag){
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
        console.log(`i: ${nu_order_X}, j: ${nu_order_Y}`);
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
        prev_order_Y = nu_order_Y;
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

function _orderPoly(Fr, coefs){
    /// highest orders of respective variables
    coefs = _autoTransFromObject(Fr, coefs);
    const {xId: x_order} = _findOrder(Fr, coefs, 0);
    const {yId: y_order} = _findOrder(Fr, coefs, 1);
    return {x_order, y_order}
}

function reduceDimPoly(Fr, coefs){
    const {x_order: x_order, y_order: y_order} = _orderPoly(Fr,coefs);
    const N_X = x_order+1;
    const N_Y = y_order+1;
    let res = Array.from(Array(N_X), () => new Array(N_Y));
    for (var i=0; i<N_X; i++){
        res[i] = coefs[i].slice(0, N_Y);
    }

    return res
}

async function readQAP(QAPName, k, m_k, n, n8r){
    
    const {fd: fdQAP, sections: sectionsQAP}  = await binFileUtils__namespace.readBinFile(`resource/subcircuits/${QAPName}/subcircuit${k}.qap`, "qapp", 1, 1<<22, 1<<24);
        
    let uX_i = new Array(m_k);
    let vX_i = new Array(m_k);
    let wX_i = new Array(m_k);
    await binFileUtils__namespace.startReadUniqueSection(fdQAP,sectionsQAP, 2);
    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils__namespace.readBigInt(fdQAP, n8r);
        }
        uX_i[i] = data;
    }
    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils__namespace.readBigInt(fdQAP, n8r);
        }
        vX_i[i] = data;
    }

    for (var i=0; i<m_k; i++){
        let data = Array.from(Array(n), () => new Array(1));
        for (var xi=0; xi<n; xi++){
            data[xi][0] = await binFileUtils__namespace.readBigInt(fdQAP, n8r);
        }
        wX_i[i] = data;
    }

    await binFileUtils__namespace.endReadSection(fdQAP);
    await fdQAP.close();

    return {uX_i, vX_i, wX_i}
}

async function readCircuitQAP_i(Fr, fdQAP, sectionsQAP, i, n, s_max, n8r){
    
    
    await binFileUtils__namespace.startReadUniqueSection(fdQAP,sectionsQAP, 2+i);

    let uXY_i = Array.from(Array(n), () => new Array(s_max));
    let vXY_i = Array.from(Array(n), () => new Array(s_max));
    let wXY_i = Array.from(Array(n), () => new Array(s_max));

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            uXY_i[xi][yi] = Fr.e(await binFileUtils__namespace.readBigInt(fdQAP, n8r));
        }
    }

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            vXY_i[xi][yi] = Fr.e(await binFileUtils__namespace.readBigInt(fdQAP, n8r));
        }
    }

    for (var xi=0; xi<n; xi++){
        for (var yi=0; yi<s_max; yi++){
            wXY_i[xi][yi] = Fr.e(await binFileUtils__namespace.readBigInt(fdQAP, n8r));
        }
    }

    await binFileUtils__namespace.endReadSection(fdQAP);

    return {uXY_i, vXY_i, wXY_i}
}

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

async function readHeader(fd, sections) {

    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 1);
    const n8 = await fd.readULE32();
    const q = await binFileUtils__namespace.readBigInt(fd, n8);
    const nWitness = await fd.readULE32();
    await binFileUtils__namespace.endReadSection(fd);

    return {n8, q, nWitness};

}

async function read(fileName) {

    const {fd, sections} = await binFileUtils__namespace.readBinFile(fileName, "wtns", 2);

    const {n8, nWitness} = await readHeader(fd, sections);

    await binFileUtils__namespace.startReadUniqueSection(fd, sections, 2);
    const res = [];
    for (let i=0; i<nWitness; i++) {
        const v = await binFileUtils__namespace.readBigInt(fd, n8);
        res.push(v);
    }
    await binFileUtils__namespace.endReadSection(fd);

    await fd.close();

    return res;
}

async function uniDerive$1(RSName, cRSName, circuitName, QAPName) {
    const startTime = start();
    let interTime;
    const dirPath = `resource/circuits/${circuitName}`;
    
    const URS=0;
    const {fd: fdRS, sections: sectionsRS} = await binFileUtils__namespace.readBinFile('resource/universal_rs/'+RSName+'.urs', "zkey", 2, 1<<25, 1<<23);
    const urs = {};
    urs.param = await readRSParams(fdRS, sectionsRS);
    urs.content = await readRS(fdRS, sectionsRS, urs.param, URS);

    const fdIdV = await fastFile__namespace.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile__namespace.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile__namespace.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);

    const IdSetV = await readIndSet(fdIdV);
    const IdSetP = await readIndSet(fdIdP);
    const OpList = await readOpList(fdOpL);
    // IdSet#.set, IdSet#.PreImgs
    
    await fdIdV.close();
    await fdIdP.close();
    await fdOpL.close();

    const fdcRS = await binFileUtils.createBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 1, 5, 1<<22, 1<<24);

    const ParamR1cs = urs.param.r1cs;
    const curve = urs.param.curve;
    const G1 = urs.param.curve.G1;
    const G2 = urs.param.curve.G2;
    const Fr = urs.param.curve.Fr;
    const n8r = urs.param.n8r;
    const n = urs.param.n;
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const s_max = urs.param.s_max;
    const s_D = urs.param.s_D;
    const s_F = OpList.length;
    const omega_y = await Fr.e(urs.param.omega_y);

    console.log('smax: ', s_max);

    const mPublic = IdSetV.set.length; // length of input instance + the total number of subcircuit outputs
    const mPrivate = IdSetP.set.length; 
    const m = mPublic + mPrivate;
    const NZeroWires = 1;

    let PreImgSet;
    let PreImgSize;
    let mPublic_k;
    let vk1_term;
    let vk2_term;
    let arrayIdx;
    let kPrime;
    let s_kPrime;
    let iPrime;

        
    console.log('checkpoint0');
    let OmegaFactors = new Array(s_max);
    OmegaFactors[0] = Fr.one;
    const omega_y_inv = Fr.inv(omega_y);
    for (var j=1; j<s_max; j++){
        OmegaFactors[j] = Fr.mul(OmegaFactors[j-1], omega_y_inv);
    }
    
    if (Math.max(OpList) >= s_D){
        throw new Error('An opcode in the target EVM bytecode has no subcircuit');
    }

    let vk1_zxy = new Array(mPublic);
    for(var i=0; i<mPublic; i++){
        PreImgSet = IdSetV.PreImgs[i];
        PreImgSize = IdSetV.PreImgs[i].length;
        vk1_zxy[i] = await G1.timesFr(buffG1, Fr.zero);
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0];
                s_kPrime = OpList[kPrime];
                iPrime = PreImgSet[PreImgIdx][1];
                mPublic_k = ParamR1cs[s_kPrime].mPublic;
                
                if(!(iPrime >= NZeroWires && iPrime < NZeroWires+mPublic_k)){
                    throw new Error('invalid access to vk1_zxy_kij')
                }
                arrayIdx = iPrime-NZeroWires;
                vk1_term = urs.content.theta_G.vk1_zxy_kij[s_kPrime][arrayIdx][j];
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1.timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1.timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_zxy[i] = await G1.add(vk1_zxy[i], vk1_term);
            }
        }
    }

    console.log('checkpoint1');

    let vk1_axy = new Array(mPrivate);
    for(var i=0; i<mPrivate; i++){
        PreImgSet = IdSetP.PreImgs[i];
        PreImgSize = IdSetP.PreImgs[i].length;
        vk1_axy[i] = await G1.timesFr(buffG1, Fr.zero);
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0];
                s_kPrime = OpList[kPrime];
                iPrime = PreImgSet[PreImgIdx][1];
                mPublic_k = ParamR1cs[s_kPrime].mPublic;
 
                if(iPrime < NZeroWires){
                    arrayIdx = iPrime;
                } else if(iPrime >= NZeroWires+mPublic_k){
                    arrayIdx = iPrime-mPublic_k;
                } else {
                    console.log(`i: ${i}, PreImgIdx: ${PreImgIdx}`);
                    throw new Error('invalid access to vk1_axy_kij')
                }

                vk1_term = urs.content.theta_G.vk1_axy_kij[s_kPrime][arrayIdx][j];
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1.timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1.timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_axy[i] = await G1.add(vk1_axy[i], vk1_term);
            }
        }
    }

    console.log('checkpoint2');

    let vk1_uxy = new Array(m);
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i);
            PreImgSet = IdSetV.PreImgs[arrayIdx];
        } else {
            arrayIdx = IdSetP.set.indexOf(i);
            PreImgSet = IdSetP.PreImgs[arrayIdx];
        }
        PreImgSize = PreImgSet.length;
        vk1_uxy[i] = await G1.timesFr(buffG1, Fr.zero);
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0];
                s_kPrime = OpList[kPrime];
                iPrime = PreImgSet[PreImgIdx][1];
                vk1_term = urs.content.theta_G.vk1_uxy_kij[s_kPrime][iPrime][j];
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1.timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1.timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_uxy[i] = await G1.add(vk1_uxy[i], vk1_term);
            }
        }
    }

    console.log('checkpoint3');

    let vk1_vxy = new Array(m);
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i);
            PreImgSet = IdSetV.PreImgs[arrayIdx];
        } else {
            arrayIdx = IdSetP.set.indexOf(i);
            PreImgSet = IdSetP.PreImgs[arrayIdx];
        }
        PreImgSize = PreImgSet.length;
        vk1_vxy[i] = await G1.timesFr(buffG1, Fr.zero);
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0];
                s_kPrime = OpList[kPrime];
                iPrime = PreImgSet[PreImgIdx][1];

                vk1_term = urs.content.theta_G.vk1_vxy_kij[s_kPrime][iPrime][j];
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk1_term = await G1.timesFr(vk1_term, OmegaFactor)
                vk1_term = await G1.timesFr(vk1_term, OmegaFactors[(kPrime*j)%s_max]);
                vk1_vxy[i] = await G1.add(vk1_vxy[i], vk1_term);
            }
        }
    }

    console.log('checkpoint4');

    let vk2_vxy = new Array(m);
    for(var i=0; i<m; i++){
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i);
            PreImgSet = IdSetV.PreImgs[arrayIdx];
        } else {
            arrayIdx = IdSetP.set.indexOf(i);
            PreImgSet = IdSetP.PreImgs[arrayIdx];
        }
        PreImgSize = PreImgSet.length;
        vk2_vxy[i] = await G2.timesFr(buffG2, Fr.zero);
        for(var j=0; j<s_max; j++){
            for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
                kPrime = PreImgSet[PreImgIdx][0];
                s_kPrime = OpList[kPrime];
                iPrime = PreImgSet[PreImgIdx][1];

                vk2_term = urs.content.theta_G.vk2_vxy_kij[s_kPrime][iPrime][j];
                //OmegaFactor = Fr.inv(await Fr.exp(omega_y, kPrime*j))
                //vk2_term = await G2.timesFr(vk2_term, OmegaFactor)
                vk2_term = await G2.timesFr(vk2_term, OmegaFactors[(kPrime*j)%s_max]);
                vk2_vxy[i] = await G2.add(vk2_vxy[i], vk2_term);
            }
        }
    }

    console.log('checkpoint5');

    await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 1);
    await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 2);
    await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 3);
    await binFileUtils__namespace.copySection(fdRS, sectionsRS, fdcRS, 4);

    await fdRS.close();
    
    await binFileUtils.startWriteSection(fdcRS, 5);
    await fdcRS.writeULE32(m);
    await fdcRS.writeULE32(mPublic);
    await fdcRS.writeULE32(mPrivate);
    for(var i=0; i<m; i++){
        await writeG1(fdcRS, curve, vk1_uxy[i]);
    }
    for(var i=0; i<m; i++){
        await writeG1(fdcRS, curve, vk1_vxy[i]);
    }
    for(var i=0; i<mPublic; i++){
        await writeG1(fdcRS, curve, vk1_zxy[i]);
    }
    // vk1_zxy[i] is for the IdSetV.set[i]-th wire of circuit
    for(var i=0; i<mPrivate; i++){
        await writeG1(fdcRS, curve, vk1_axy[i]);
    }
    // vk1_axy[i] is for the IdSetP.set[i]-th wire of circuit
    for(var i=0; i<m; i++){
        await writeG2(fdcRS, curve, vk2_vxy[i]);
    }
    await binFileUtils.endWriteSection(fdcRS);

    await fdcRS.close();


    let uX_ki = new Array(s_D);
    let vX_ki = new Array(s_D);
    let wX_ki = new Array(s_D);
    interTime = start();
    for (var i=0; i<s_F; i++){
        let k = OpList[i];
        if ( (uX_ki[k] === undefined) ){
            let m_k = ParamR1cs[k].m;

            let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await readQAP(QAPName, k, m_k, n, n8r);
            uX_ki[k] = uX_i;
            vX_ki[k] = vX_i;
            wX_ki[k] = wX_i;
        }
    }
    console.log(`Reading QAP is completed`);
    end(interTime);

    const fdQAP = await binFileUtils.createBinFile(`${dirPath}/circuitQAP.qap`, "qapp", 1, 1+m, 1<<22, 1<<24);

    await binFileUtils.startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fdQAP);

    interTime = start();
    let fY_k = new Array(s_F);
    const fY = Array.from(Array(1), () => new Array(s_max));
    const Fr_s_max_inv = Fr.inv(Fr.e(s_max));
    for (var k=0; k<s_F; k++){
        let inv_omega_y_k = new Array(s_max);
        inv_omega_y_k[0] = Fr.one;
        for (i=1; i<s_max; i++){
            inv_omega_y_k[i] = Fr.mul(inv_omega_y_k[i-1], await Fr.exp(Fr.inv(omega_y), k));
        }
        let LagY = await filterPoly(Fr, fY, inv_omega_y_k, 1);
        fY_k[k] = await scalePoly(Fr, LagY, Fr_s_max_inv);
    }
    console.log(`Generating fY_k is completed`);
    end(interTime);

    let InitPoly = Array.from(Array(n), () => new Array(s_max));
    InitPoly = await scalePoly(Fr, InitPoly, Fr.zero);
    console.log(`m: ${m}`);
    for(var i=0; i<m; i++){
        await binFileUtils.startWriteSection(fdQAP, 2+i);
        let arrayIdx;
        let PreImgSet;
        if(IdSetV.set.indexOf(i) > -1){
            arrayIdx = IdSetV.set.indexOf(i);
            PreImgSet = IdSetV.PreImgs[arrayIdx];
        } else {
            arrayIdx = IdSetP.set.indexOf(i);
            PreImgSet = IdSetP.PreImgs[arrayIdx];
        }
        let PreImgSize = PreImgSet.length;
        let uXY_i = InitPoly;
        let vXY_i = InitPoly;
        let wXY_i = InitPoly;
        interTime = start();
        for(var PreImgIdx=0; PreImgIdx<PreImgSize; PreImgIdx++){
            let kPrime = PreImgSet[PreImgIdx][0];
            let iPrime = PreImgSet[PreImgIdx][1];
            let s_kPrime = OpList[kPrime];

            let u_term = await mulPoly(Fr, uX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            uXY_i = await addPoly(Fr, uXY_i, u_term);

            let v_term = await mulPoly(Fr, vX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            vXY_i = await addPoly(Fr, vXY_i, v_term);

            let w_term = await mulPoly(Fr, wX_ki[s_kPrime][iPrime], fY_k[kPrime]);
            wXY_i = await addPoly(Fr, wXY_i, w_term);
        }
        
        interTime = check(interTime);
        for (var xi=0; xi<n; xi++){            for (var yi=0; yi<s_max; yi++){
                await binFileUtils.writeBigInt(fdQAP, Fr.toObject(uXY_i[xi][yi]), n8r);
            }
        }
        end(interTime);

        for (var xi=0; xi<n; xi++){
            for (var yi=0; yi<s_max; yi++){
                await binFileUtils.writeBigInt(fdQAP, Fr.toObject(vXY_i[xi][yi]), n8r);
            }
        }

        for (var xi=0; xi<n; xi++){
            for (var yi=0; yi<s_max; yi++){
                await binFileUtils.writeBigInt(fdQAP, Fr.toObject(wXY_i[xi][yi]), n8r);
            }
        }
        await binFileUtils.endWriteSection(fdQAP);
        console.log(`checkpoint derive-${i} of ${m}`);
    }
    await fdQAP.close();

    end(startTime);
}

async function builder(code, options) {

    options = options || {};

    let wasmModule;
    try {
	wasmModule = await WebAssembly.compile(code);
    }  catch (err) {
	console.log(err);
	console.log("\nTry to run circom --c in order to generate c++ code instead\n");
	throw new Error(err);
    }

    let wc;

    
    const instance = await WebAssembly.instantiate(wasmModule, {
        runtime: {
            exceptionHandler : function(code) {
                let errStr;
                if (code == 1) {
                    errStr= "Signal not found. ";
                } else if (code == 2) {
                    errStr= "Too many signals set. ";
                } else if (code == 3) {
                    errStr= "Signal already set. ";
		} else if (code == 4) {
                    errStr= "Assert Failed. ";
		} else if (code == 5) {
                    errStr= "Not enough memory. ";
		} else if (code == 6) {
                    errStr= "Input signal array access exceeds the size";
		} else {
		    errStr= "Unknown error\n";
                }
		// get error message from wasm
		errStr += getMessage();
                throw new Error(errStr);
            },
	    showSharedRWMemory: function() {
		printSharedRWMemory ();
            }

        }
    });

    const sanityCheck =
        options;
//        options &&
//        (
//            options.sanityCheck ||
//            options.logGetSignal ||
//            options.logSetSignal ||
//            options.logStartComponent ||
//            options.logFinishComponent
//        );

    
    wc = new WitnessCalculator(instance, sanityCheck);
    return wc;

    function getMessage() {
        var message = "";
	var c = instance.exports.getMessageChar();
        while ( c != 0 ) {
	    message += String.fromCharCode(c);
	    c = instance.exports.getMessageChar();
	}
        return message;
    }
	
    function printSharedRWMemory () {
	const shared_rw_memory_size = instance.exports.getFieldNumLen32();
	const arr = new Uint32Array(shared_rw_memory_size);
	for (let j=0; j<shared_rw_memory_size; j++) {
	    arr[shared_rw_memory_size-1-j] = instance.exports.readSharedRWMemory(j);
	}
	console.log(fromArray32(arr));
    }

}
class WitnessCalculator {
    constructor(instance, sanityCheck) {
        this.instance = instance;

	    this.version = this.instance.exports.getVersion();
        this.n32 = this.instance.exports.getFieldNumLen32();

        this.instance.exports.getRawPrime();
        const arr = new Array(this.n32);
        for (let i=0; i<this.n32; i++) {
            arr[this.n32-1-i] = this.instance.exports.readSharedRWMemory(i);
        }
        this.prime = fromArray32(arr);

        this.witnessSize = this.instance.exports.getWitnessSize();

        this.sanityCheck = sanityCheck;
    }
    
    circom_version() {
	return this.instance.exports.getVersion();
    }

    async _doCalculateWitness(input, sanityCheck) {
	//input is assumed to be a map from signals to arrays of bigints
        this.instance.exports.init((this.sanityCheck || sanityCheck) ? 1 : 0);
        const keys = Object.keys(input);
	var input_counter = 0;
        keys.forEach( (k) => {
            const h = fnvHash(k);
            const hMSB = parseInt(h.slice(0,8), 16);
            const hLSB = parseInt(h.slice(8,16), 16);
            const fArr = flatArray(input[k]);
	    let signalSize = this.instance.exports.getInputSignalSize(hMSB, hLSB);
	    if (signalSize < 0){
		throw new Error(`Signal ${k} not found\n`);
	    }
	    if (fArr.length < signalSize) {
		throw new Error(`Not enough values for input signal ${k}\n`);
	    }
	    if (fArr.length > signalSize) {
		throw new Error(`Too many values for input signal ${k}\n`);
	    }
            for (let i=0; i<fArr.length; i++) {
		const arrFr = toArray32(fArr[i],this.n32);
		for (let j=0; j<this.n32; j++) {
		    this.instance.exports.writeSharedRWMemory(j,arrFr[this.n32-1-j]);
		}
		try {
                    this.instance.exports.setInputSignal(hMSB, hLSB,i);
		    input_counter++;
		} catch (err) {
		    // console.log(`After adding signal ${i} of ${k}`)
                    throw new Error(err);
		}
            }

        });
	if (input_counter < this.instance.exports.getInputSize()) {
	    throw new Error(`Not all inputs have been set. Only ${input_counter} out of ${this.instance.exports.getInputSize()}`);
	}
    }

    async calculateWitness(input, sanityCheck) {

        const w = [];

        await this._doCalculateWitness(input, sanityCheck);

        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
	    const arr = new Uint32Array(this.n32);
            for (let j=0; j<this.n32; j++) {
            arr[this.n32-1-j] = this.instance.exports.readSharedRWMemory(j);
            }
            w.push(fromArray32(arr));
        }

        return w;
    }
    

    async calculateBinWitness(input, sanityCheck) {

        const buff32 = new Uint32Array(this.witnessSize*this.n32);
	const buff = new  Uint8Array( buff32.buffer);
        await this._doCalculateWitness(input, sanityCheck);

        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
	    const pos = i*this.n32;
            for (let j=0; j<this.n32; j++) {
		buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
            }
        }

	return buff;
    }
    

    async calculateWTNSBin(input, sanityCheck) {

        const buff32 = new Uint32Array(this.witnessSize*this.n32+this.n32+11);
	const buff = new  Uint8Array( buff32.buffer);
        await this._doCalculateWitness(input, sanityCheck);
  
	//"wtns"
	buff[0] = "w".charCodeAt(0);
	buff[1] = "t".charCodeAt(0);
	buff[2] = "n".charCodeAt(0);
	buff[3] = "s".charCodeAt(0);

	//version 2
	buff32[1] = 2;

	//number of sections: 2
	buff32[2] = 2;

	//id section 1
	buff32[3] = 1;

	const n8 = this.n32*4;
	//id section 1 length in 64bytes
	const idSection1length = 8 + n8;
	const idSection1lengthHex = idSection1length.toString(16);
        buff32[4] = parseInt(idSection1lengthHex.slice(0,8), 16);
        buff32[5] = parseInt(idSection1lengthHex.slice(8,16), 16);

	//this.n32
	buff32[6] = n8;

	//prime number
	this.instance.exports.getRawPrime();

	var pos = 7;
        for (let j=0; j<this.n32; j++) {
	    buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
        }
	pos += this.n32;

	// witness size
	buff32[pos] = this.witnessSize;
	pos++;

	//id section 2
	buff32[pos] = 2;
	pos++;

	// section 2 length
	const idSection2length = n8*this.witnessSize;
	const idSection2lengthHex = idSection2length.toString(16);
        buff32[pos] = parseInt(idSection2lengthHex.slice(0,8), 16);
        buff32[pos+1] = parseInt(idSection2lengthHex.slice(8,16), 16);

	pos += 2;
        for (let i=0; i<this.witnessSize; i++) {
            this.instance.exports.getWitness(i);
            for (let j=0; j<this.n32; j++) {
		buff32[pos+j] = this.instance.exports.readSharedRWMemory(j);
            }
	    pos += this.n32;
        }

	return buff;
    }

}


function toArray32(s,size) {
    const res = []; //new Uint32Array(size); //has no unshift
    let rem = BigInt(s);
    const radix = BigInt(0x100000000);
    while (rem) {
        res.unshift( Number(rem % radix));
        rem = rem / radix;
    }
    if (size) {
	var i = size - res.length;
	while (i>0) {
	    res.unshift(0);
	    i--;
	}
    }
    return res;
}

function fromArray32(arr) { //returns a BigInt
    var res = BigInt(0);
    const radix = BigInt(0x100000000);
    for (let i = 0; i<arr.length; i++) {
        res = res*radix + BigInt(arr[i]);
    }
    return res;
}

function flatArray(a) {
    var res = [];
    fillArray(res, a);
    return res;

    function fillArray(res, a) {
        if (Array.isArray(a)) {
            for (let i=0; i<a.length; i++) {
                fillArray(res, a[i]);
            }
        } else {
            res.push(a);
        }
    }
}

function fnvHash(str) {
    const uint64_max = BigInt(2) ** BigInt(64);
    let hash = BigInt("0xCBF29CE484222325");
    for (var i = 0; i < str.length; i++) {
	hash ^= BigInt(str[i].charCodeAt());
	hash *= BigInt(0x100000001B3);
	hash %= uint64_max;
    }
    let shash = hash.toString(16);
    let n = 16 - shash.length;
    shash = '0'.repeat(n).concat(shash);
    return shash;
}

// Example: generateWitness('test_transfer')
/**
 * 
 * @param {resource/circuits/서킷명} circuitName 
 */
async function generateWitness(circuitName, instanceId){
	// @TODO: __dirPath 를 사용해서 사용자가 어떤 dir에서 명령어를 실행해도 실행되도록 수정해야 함.
  const dirPath = `resource/circuits/${circuitName}`;
	const fdOpL = await fastFile__namespace.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
  const opList = await readOpList(fdOpL);
	await fdOpL.close();

	fs.mkdir(path__default["default"].join(dirPath, `witness${instanceId}`), (err) => {});

	for (const index in opList) {
		const buffer = fs.readFileSync(`resource/subcircuits/wasm/subcircuit${opList[index]}.wasm`);
		const input = JSON.parse(fs.readFileSync(`${dirPath}/instance${instanceId}/Input_opcode${index}.json`, "utf8"));
		const witnessCalculator = await builder(buffer);
		const buff = await witnessCalculator.calculateWTNSBin(input, 0);
		fs.writeFile(`${dirPath}/witness${instanceId}/witness${index}.wtns`, buff, function(err) {
			if (err) throw err
		});
	}
}

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

async function groth16Prove$1(cRSName, proofName, QAPName, circuitName, entropy, instanceId) {
    const startTime = start();
    let interTime;

    const dirPath = `resource/circuits/${circuitName}`;
    const TESTFLAG = false;
    const CRS = 1;

    console.log(`TESTMODE = ${TESTFLAG}`);

    const {fd: fdRS, sections: sectionsRS} = await binFileUtils__namespace.readBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 2, 1<<25, 1<<23);
    const fdIdV = await fastFile__namespace.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile__namespace.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile__namespace.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
    const fdWrL = await fastFile__namespace.readExisting(`${dirPath}/WireList.bin`, 1<<25, 1<<23);
    
    const urs = {};
    const crs = {};
    urs.param = await readRSParams(fdRS, sectionsRS);
    const rs = await readRS(fdRS, sectionsRS, urs.param, CRS);
    const IdSetV = await readIndSet(fdIdV);
    const IdSetP = await readIndSet(fdIdP);
    const OpList = await readOpList(fdOpL);
    const WireList = await readWireList(fdWrL);
    await fdRS.close();
    await fdIdV.close();
    await fdIdP.close();
    await fdOpL.close();
    await fdWrL.close();

    const fdPrf = await binFileUtils__namespace.createBinFile(`${dirPath}/${proofName}.proof`, "prof", 1, 2, 1<<22, 1<<24);

    urs.sigma_G = rs.sigma_G;
    urs.sigma_H = rs.sigma_H;
    crs.param = rs.crs.param;
    crs.vk1_uxy_i = rs.crs.vk1_uxy_i;
    crs.vk1_vxy_i = rs.crs.vk1_vxy_i;
    crs.vk1_zxy_i = rs.crs.vk1_zxy_i;
    crs.vk1_axy_i = rs.crs.vk1_axy_i;
    crs.vk2_vxy_i = rs.crs.vk2_vxy_i;

    const ParamR1cs = urs.param.r1cs;
    const curve = urs.param.curve;
    const G1 = urs.param.curve.G1;
    const G2 = urs.param.curve.G2;
    const Fr = urs.param.curve.Fr;
    curve.Fr.n8;
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const n = urs.param.n;
    const n8r = urs.param.n8r;
    const s_max = urs.param.s_max;
    urs.param.s_D;
    OpList.length;
    await Fr.e(urs.param.omega_x);
    await Fr.e(urs.param.omega_y);
    
    const mPublic = crs.param.mPublic;
    const mPrivate = crs.param.mPrivate;
    const m = mPublic + mPrivate;

    console.log(`n = ${n}`);
    console.log(`s_max = ${s_max}`);
     

    if(!((mPublic == IdSetV.set.length) && (mPrivate == IdSetP.set.length)))
    {
        throw new Error(`Error in crs file: invalid crs parameters. mPublic: ${mPublic}, IdSetV: ${IdSetV.set.length}, mPrivate: ${mPrivate}, IdSetP: ${IdSetP.set.length},`)
    }
    console.log(`checkpoint 1`);

    /// load subcircuit polynomials
    // const sR1cs = new Array(); 
    // for(var i=0; i<s_D; i++){
    //     let r1csIdx = String(i);
    //     const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 1, 1<<22, 1<<24);
    //     sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
    //     await fdR1cs.close();
    // }
    // console.log(`checkpoint 0`)
    
    // const {uX_ki: uX_ki, vX_ki: vX_ki, wX_ki: wX_ki, tX: tX, tY: tY} = await polyUtils.buildR1csPolys(urs.param, sR1cs, true);
    // console.log(`checkpoint 1`)  

    
    // generate witness for each subcircuit
    await generateWitness(circuitName, instanceId);
    const wtns = [];
    for(var k=0; k<OpList.length; k++ ){
        const wtns_k = await read(`${dirPath}/witness${instanceId}/witness${k}.wtns`);
        const kPrime = OpList[k];
        const m_k = ParamR1cs[kPrime].m;
        if (wtns_k.length != m_k) {
            throw new Error(`Invalid witness length. Circuit: ${m_k}, witness: ${wtns.length}`);
        }
        wtns.push(wtns_k);
    }

    /// TEST CODE 2
    var k, i, j; 
    /// END of TEST CODE 2

    /// arrange circuit witness
    let cWtns = new Array(WireList.length);
    for(var i=0; i<WireList.length; i++){
        const kPrime = WireList[i][0];
        const idx = WireList[i][1];
        cWtns[i] = Fr.e(wtns[kPrime][idx]);
        if (cWtns[i] === undefined){
            throw new Error(`Undefined cWtns value at i=${i}`)
        }
    }
    console.log(`checkpoint 2`);
  
    let tX = Array.from(Array(n+1), () => new Array(1));
    let tY = Array.from(Array(1), () => new Array(s_max+1));
    tX = await scalePoly(Fr, tX, Fr.zero);
    tY = await scalePoly(Fr, tY, Fr.zero);
    tX[0][0] = Fr.negone;
    tX[n][0] = Fr.one;
    tY[0][0] = Fr.negone;
    tY[0][s_max] = Fr.one;
    // t(X,Y) = (X^n-1) * (X^s_max-1) = PI(X-omega_x^i) for i=0,...,n * PI(Y-omega_y^j) for j =0,...,s_max
    // P(X,Y) = (SUM c_i*u_i(X,Y))*(SUM c_i*v_i(X,Y)) - (SUM c_i*w_i(X,Y)) = 0 at X=omega_x^i, Y=omega_y^j
    // <=> P(X,Y) has zeros at least the points omega_x^i and omega_y^j
    // <=> there exists h(X,Y) such that p(X,Y) = t(X,Y) * h(X,Y)
    // <=> finding h(X,Y) is the goal of Prove algorithm


    /// TEST CODE 1
    // if (TESTFLAG){
    //     console.log('Running Test 1')
    //     const EVAL_k = 2;
    //     const eval_point = await Fr.exp(omega_y, EVAL_k);
    //     for (var k=0; k<s_F; k++){
    //         let flag = await polyUtils.evalPoly(Fr, fY_k[k], Fr.one, eval_point);
    //         if ( !( (k == EVAL_k && Fr.eq(flag, Fr.one)) || (k != EVAL_k && Fr.eq(flag, Fr.zero)) ) ){
    //             throw new Error('Error in fY_k');
    //         }
    //     }
    //     console.log(`Test 1 finished`)
    // }
    /// End of TEST CODE 1  
    console.log(`checkpoint 3`); 
    
    /// compute p(X,Y)
    const {fd: fdQAP, sections: sectionsQAP}  = await binFileUtils__namespace.readBinFile(`resource/circuits/${circuitName}/circuitQAP.qap`, "qapp", 1, 1<<22, 1<<24);
    let InitPoly = Array.from(Array(n), () => new Array(s_max));
    InitPoly = await scalePoly(Fr, InitPoly, Fr.zero);
    let p1XY = InitPoly;
    let p2XY = InitPoly;
    let p3XY = InitPoly;
    for(var i=0; i<m; i++){
        let interTime = start();
        const {uXY_i, vXY_i, wXY_i} = await readCircuitQAP_i(Fr, fdQAP, sectionsQAP, i, n, s_max, n8r);
        interTime = check(interTime);
        let term1 = await scalePoly(Fr, uXY_i, cWtns[i]);
        interTime = check(interTime);
        p1XY = await addPoly(Fr, p1XY, term1);
        end(interTime);
        let term2 = await scalePoly(Fr, vXY_i, cWtns[i]);
        p2XY = await addPoly(Fr, p2XY, term2);
        let term3 = await scalePoly(Fr, wXY_i, cWtns[i]);
        p3XY = await addPoly(Fr, p3XY, term3);
        console.log(`checkpoint 3-${i} of ${m}`);
    }
    await fdQAP.close();

    const temp = await mulPoly(Fr, p1XY, p2XY);
    const pXY = await addPoly(Fr, temp, p3XY, true);
    console.log(`checkpoint 4`);
    
    /// compute H
    interTime = start();
    const {res: h1XY, finalrem: rem1} =  await divPolyByX(Fr, pXY, tX);
    interTime = check(interTime);
    console.log(`checkpoint 4-1`);
    const {res: h2XY, finalrem: rem2} =  await divPolyByY(Fr, rem1, tY);
    end(interTime);

    console.log(`checkpoint 5`);

        /// TEST CODE 3
        var i, j;        
        /// End of TEST CODE 3   

    // Generate r and s
    const rawr = await getRandomRng(entropy);
    const raws = await getRandomRng(entropy+1);
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
    let vk1_C_p = new Array(6);
    vk1_C_p[0] = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<mPrivate; i++){
        let term = await G1.timesFr(crs.vk1_axy_i[i], cWtns[IdSetP.set[i]]);
        vk1_C_p[0] = await G1.add(vk1_C_p[0], term);
    }
    vk1_C_p[1] = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<n-1; i++){
        for(var j=0; j<2*s_max-1; j++){
            let term = G1.timesFr(urs.sigma_G.vk1_xy_pows_t1g[i][j], h1XY[i][j]);
            vk1_C_p[1] = G1.add(vk1_C_p[1], term);
        }
    }
    vk1_C_p[2] = await G1.timesFr(buffG1, Fr.e(0));
    for(var i=0; i<n; i++){
        for(var j=0; j<s_max-1; j++){
            let term = G1.timesFr(urs.sigma_G.vk1_xy_pows_t2g[i][j], h2XY[i][j]);
            vk1_C_p[2] = G1.add(vk1_C_p[2], term);
        }
    }
    vk1_C_p[3] = await G1.timesFr(vk1_A, s);
    vk1_C_p[4] = await G1.timesFr(vk1_B, r);
    vk1_C_p[5] = await G1.timesFr(urs.sigma_G.vk1_gamma_a, Fr.neg(Fr.mul(r,s)));
    let vk1_C = vk1_C_p[0];
    for(var i=1; i<6; i++){
        vk1_C = await G1.add(vk1_C, vk1_C_p[i]);
    }

    console.log(`checkpoint 6`);

    /// TEST CODE 4
    var i; 
    /// End of TEST CODE 4

    /// TEST CODE 5
    var i; 
    /// END of TEST CODE 5

    // Write Header
    ///////////
    await binFileUtils__namespace.startWriteSection(fdPrf, 1);
    await fdPrf.writeULE32(1); // Groth
    await binFileUtils__namespace.endWriteSection(fdPrf);
    // End of the Header

    await binFileUtils__namespace.startWriteSection(fdPrf, 2);
    await writeG1(fdPrf, curve, vk1_A);
    await writeG2(fdPrf, curve, vk2_B);
    await writeG1(fdPrf, curve, vk1_C);

    await binFileUtils__namespace.endWriteSection(fdPrf);

    await fdPrf.close();

    end(startTime);
}

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

async function groth16Verify$1(proofName, cRSName, circuitName, instanceId) {
    const startTime = start();
    const ID_KECCAK = 5;
    
    const dirPath = `resource/circuits/${circuitName}`;
    const CRS = 1;

    const {fd: fdRS, sections: sectionsRS} = await binFileUtils__namespace.readBinFile(`${dirPath}/${cRSName}.crs`, "zkey", 2, 1<<25, 1<<23);
    const fdIdV = await fastFile__namespace.readExisting(`${dirPath}/Set_I_V.bin`, 1<<25, 1<<23);
    const fdIdP = await fastFile__namespace.readExisting(`${dirPath}/Set_I_P.bin`, 1<<25, 1<<23);
    const fdOpL = await fastFile__namespace.readExisting(`${dirPath}/OpList.bin`, 1<<25, 1<<23);
    const fdWrL = await fastFile__namespace.readExisting(`${dirPath}/WireList.bin`, 1<<25, 1<<23);
    const {fd: fdPrf, sections: sectionsPrf} = await binFileUtils__namespace.readBinFile(`${dirPath}/${proofName}.proof`, "prof", 2, 1<<22, 1<<24);
    
    const urs = {};
    const crs = {};
    urs.param = await readRSParams(fdRS, sectionsRS);
    const rs = await readRS(fdRS, sectionsRS, urs.param, CRS);
    const IdSetV = await readIndSet(fdIdV);
    const IdSetP = await readIndSet(fdIdP);
    const OpList = await readOpList(fdOpL);
    const WireList = await readWireList(fdWrL);
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

    const ParamR1cs = urs.param.r1cs;
    const curve = urs.param.curve;
    const G1 = urs.param.curve.G1;
    const G2 = urs.param.curve.G2;
    const Fr = urs.param.curve.Fr;
    curve.Fr.n8;
    const buffG1 = curve.G1.oneAffine;
    curve.G2.oneAffine;
    urs.param.n;
    urs.param.s_max;
    urs.param.s_D;
    await Fr.e(urs.param.omega_x);
    await Fr.e(urs.param.omega_y);
    
    const mPublic = crs.param.mPublic;
    const mPrivate = crs.param.mPrivate;
    const NConstWires = 1;



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
		const inputs = JSON.parse(fs.readFileSync(`${dirPath}/instance${instanceId}/Input_opcode${index}.json`, "utf8"));
        const outputs = JSON.parse(fs.readFileSync(`${dirPath}/instance${instanceId}/Output_opcode${index}.json`, "utf8"));
        const instance_k_hex = [];
        for(var i=0; i<NConstWires; i++){
            instance_k_hex.push('0x01');
        }
        if (keccakList.indexOf(index)>-1){
            instance_k_hex.push('0x01');
        } else {
            instance_k_hex.push(...outputs.out);
        }
        instance_k_hex.push(...inputs.in);
        if(instance_k_hex.length != ParamR1cs[kPrime].mPublic+NConstWires){
            throw new Error(`Error in loading subinstances: wrong instance size`)
        }
        if (keccakList.indexOf(index)>-1){
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
    });

    /// arrange circuit instance accroding to Set_I_V.bin (= IdSetV), which ideally consists of only subcircuit outputs
    let cInstance = new Array(IdSetV.set.length);
    for(var i=0; i<IdSetV.set.length; i++){
        const kPrime = WireList[IdSetV.set[i]][0];
        const iPrime = WireList[IdSetV.set[i]][1];
        if(iPrime<NConstWires || iPrime>=NConstWires+ParamR1cs[OpList[kPrime]].mPublic){
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

    console.log(cInstance);
   
    
    /// read proof
    await binFileUtils__namespace.startReadUniqueSection(fdPrf, sectionsPrf, 2);
    const vk1_A = await readG1(fdPrf, curve);
    const vk2_B = await readG2(fdPrf, curve);
    const vk1_C = await readG1(fdPrf, curve);
    await binFileUtils__namespace.endReadSection(fdPrf);
    await fdPrf.close();

    /// Compute term D
    let vk1_D;
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

    const { keccak256 } = hash__default["default"];
    let res2 = true;
    for (var i=0; i<keccakList.length; i++){
        // keccak has two inputs and one output
        const hex_expected = hex_keccakInstance[i][1].slice(2);
        let hex_inputs=[];
        hex_inputs[0] = hex_keccakInstance[i][2].slice(2);
        hex_inputs[1] = hex_keccakInstance[i][3].slice(2);
        const con_hex_in = hex_inputs[0] + hex_inputs[1];
        const string_input = hexToString(con_hex_in);
        
        const hex_hashout = keccak256(string_input);
        res2 = res2 && (hex_expected == hex_hashout);
    }
    if (keccakList.length>0){
        console.log(`Keccak verification result = ${res2}`);
    }

    end(startTime);

    function hexToString(hex) {
        if (!hex.match(/^[0-9a-fA-F]+$/)) {
          throw new Error('is not a hex string.');
        }
        if (hex.length % 2 !== 0) {
          hex = '0' + hex;
        }
        var bytes = [];
        for (var n = 0; n < hex.length; n += 2) {
          var code = parseInt(hex.substr(n, 2), 16);
          bytes.push(code);
        }
        return bytes;
      }
}

chai__default["default"].assert;


async function uni_buildQAP(curveName, s_D, min_s_max) {
    const startTime = start();
    const r1cs = new Array();
    const sR1cs = new Array();
    
    fs.mkdir(path__default["default"].join(`resource/subcircuits`, `QAP_${s_D}_${min_s_max}`), (err) => {});
    const dirPath = `resource/subcircuits/QAP_${s_D}_${min_s_max}`;

    for(var i=0; i<s_D; i++){
        let r1csIdx = String(i);
        const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 2, 1<<22, 1<<24);
        r1cs.push(await r1csfile.readR1csHeader(fdR1cs, sectionsR1cs, false));
        sR1cs.push(await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2));
        await fdR1cs.close();
    }
    const fdRS = await binFileUtils.createBinFile(`resource/subcircuits/param_${s_D}_${min_s_max}.dat`, "zkey", 1, 2, 1<<22, 1<<24);
        
    console.log('checkpoint0');
 
    const curve = await getCurveFromName(curveName);
    const Fr = curve.Fr;
    
    if (r1cs[0].prime != curve.r) {
        console.log('checkpoint1');
        console.log("r1cs_prime: ", r1cs[0].prime);
        console.log("curve_r: ", curve.r);
        throw new Error("r1cs curve does not match powers of tau ceremony curve")
        //return -1
    }

    // Write Header
    ///////////
    await binFileUtils.startWriteSection(fdRS, 1);
    await fdRS.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fdRS);
    // End of the Header
    console.log(`checkpoint3`);

    // Write parameters section
    ///////////
    await binFileUtils.startWriteSection(fdRS, 2);
    const primeQ = curve.q;
    const n8q = (Math.floor( (ffjavascript.Scalar.bitLength(primeQ) - 1) / 64) +1)*8;
    console.log(`checkpoint4`);

    // Group parameters
    const primeR = curve.r;
    const n8r = (Math.floor( (ffjavascript.Scalar.bitLength(primeR) - 1) / 64) +1)*8;

    await fdRS.writeULE32(n8q);                   // byte length of primeQ
    await binFileUtils.writeBigInt(fdRS, primeQ, n8q);
    await fdRS.writeULE32(n8r);                   // byte length of primeR
    await binFileUtils.writeBigInt(fdRS, primeR, n8r);

    // Instruction set constants
    await fdRS.writeULE32(s_D);
    const m = new Array();          // the numbers of wires
    const mPublic = new Array();    // the numbers of public wires (not including constant wire at zero index)
    const mPrivate = new Array();
    const nConstraints = new Array();
    for(var i=0; i<s_D; i++){
        m.push(r1cs[i].nVars);
        nConstraints.push(r1cs[i].nConstraints);
        mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs + r1cs[i].nPrvInputs); 
        mPrivate.push(m[i] - mPublic[i]);
        await fdRS.writeULE32(m[i]);
        await fdRS.writeULE32(mPublic[i]);
        await fdRS.writeULE32(nConstraints[i]);
    }

    // QAP constants
    mPublic.reduce((accu,curr) => accu + curr);
    mPrivate.reduce((accu,curr) => accu + curr);
    //let n = Math.max(Math.ceil(NEqs/3), Math.max(...nConstraints));
    let n = Math.max(...nConstraints);
    console.log(`n_min: ${n}`);
    
    const expon = Math.ceil(Math.log2(n));
    n = 2**expon;

    const omega_x = await Fr.exp(Fr.w[Fr.s], ffjavascript.Scalar.exp(2, Fr.s-expon));
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
    
    let expos = Math.ceil(Math.log2(min_s_max));
    const s_max = 2**expos;
    console.log(`n: ${n}, s_max: ${s_max}`);
    const omega_y = await Fr.exp(Fr.w[Fr.s], ffjavascript.Scalar.exp(2, Fr.s-expos));
    // End of test code 1 //

    await fdRS.writeULE32(n);                       // the maximum number of gates in each subcircuit: n>=NEqs/3 and n|(r-1)
    await fdRS.writeULE32(s_max);                  // the maximum number of subcircuits in a p-code: s_max>min_s_max and s_max|(r-1)
    await binFileUtils.writeBigInt(fdRS, Fr.toObject(omega_x), n8r);                    // Generator for evaluation points on X
    await binFileUtils.writeBigInt(fdRS, Fr.toObject(omega_y), n8r);             // Generator for evaluation points on Y
    console.log(`checkpoint5`);
    // End of test code 2 //

    await binFileUtils.endWriteSection(fdRS);
    /// End of parameters section

    await fdRS.close();

    const rs={};
    rs.curve = curve;
    rs.n = n;
    rs.s_max = s_max;
    rs.omega_x = omega_x;
    rs.omega_y = omega_y;
    const Lagrange_basis = await buildCommonPolys(rs, true);

    for (var k=0; k<s_D; k++){
        console.log(`k: ${k}`);
        let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await buildR1csPolys(curve, Lagrange_basis, r1cs[k], sR1cs[k], true);
        let fdQAP = await binFileUtils.createBinFile(`${dirPath}/subcircuit${k}.qap`, "qapp", 1, 2, 1<<22, 1<<24);
        
        await binFileUtils.startWriteSection(fdQAP, 1);
        await fdQAP.writeULE32(1); // Groth
        await binFileUtils.endWriteSection(fdQAP);

        await binFileUtils.startWriteSection(fdQAP, 2);
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof uX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of uX_i at k: ${k}, i: ${i}`);
                }
                await binFileUtils.writeBigInt(fdQAP, uX_i[i][xi][0], n8r);
            }
        }
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof vX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of vX_i at k: ${k}, i: ${i}`);
                }
                await binFileUtils.writeBigInt(fdQAP, vX_i[i][xi][0], n8r);
            }
        }
        for (var i=0; i<m[k]; i++){
            for (var xi=0; xi<n; xi++){
                if (typeof wX_i[i][xi][0] != "bigint"){
                    throw new Error(`Error in coefficient type of wX_i at k: ${k}, i: ${i}`);
                }
                await binFileUtils.writeBigInt(fdQAP, wX_i[i][xi][0], n8r);
            }
        }
        await binFileUtils.endWriteSection(fdQAP);
        await fdQAP.close();
    }

    end(startTime);


}

chai__default["default"].assert;



async function uni_buildQAP_single(paramName, id) {
    
    const QAPName_suffix = paramName.slice(5);
    const QAPName = `QAP${QAPName_suffix}`;
    fs.mkdir(path__default["default"].join(`resource/subcircuits`, QAPName), (err) => {});
    const dirPath = `resource/subcircuits/` + QAPName;

    const {fd: fdParam, sections: sectionsParam} = await binFileUtils.readBinFile(`resource/subcircuits/${paramName}.dat`, "zkey", 2, 1<<25, 1<<23);
    const param = await readRSParams(fdParam, sectionsParam);
    await fdParam.close();

    let r1csIdx = String(id);
    const {fd: fdR1cs, sections: sectionsR1cs} = await binFileUtils.readBinFile('resource/subcircuits/r1cs/subcircuit'+r1csIdx+'.r1cs', "r1cs", 2, 1<<22, 1<<24);
    const sR1cs_k = await binFileUtils.readSection(fdR1cs, sectionsR1cs, 2);
    await fdR1cs.close();
        
    console.log('checkpoint0');
 
    const curve = param.curve;
    curve.Fr;
    const r1cs_k = param.r1cs[id];
    if (r1cs_k === undefined){
        throw new Error(`Parameters in ${paramName}.dat do not support Subcircuit${id}.`)
    }

    // Write parameters section
    ///////////
    console.log(`checkpoint4`);

    // Group parameters
    const primeR = curve.r;
    const n8r = (Math.floor( (ffjavascript.Scalar.bitLength(primeR) - 1) / 64) +1)*8;
    
    const m_k = r1cs_k.m;

    // QAP constants
    const n = param.n;
    
    const omega_x = param.omega_x;
    //console.log(Fr.toObject(omega_x))
    //console.log(Fr.toObject(await Fr.exp(omega_x, n)))
    
    const s_max = param.s_max;
    const omega_y = param.s_max;
    // End of test code 1 //

    
    console.log(`checkpoint5`);
    // End of test code 2 //

    /// End of parameters section

    const rs={};
    rs.curve = curve;
    rs.n = n;
    rs.s_max = s_max;
    rs.omega_x = omega_x;
    rs.omega_y = omega_y;
    const Lagrange_basis = await buildCommonPolys(rs, true);

    console.log(`k: ${id}`);
    let {uX_i: uX_i, vX_i: vX_i, wX_i: wX_i} = await buildR1csPolys(curve, Lagrange_basis, r1cs_k, sR1cs_k, true);
    let fdQAP = await binFileUtils.createBinFile(`${dirPath}/subcircuit${id}.qap`, "qapp", 1, 2, 1<<22, 1<<24);
    
    await binFileUtils.startWriteSection(fdQAP, 1);
    await fdQAP.writeULE32(1); // Groth
    await binFileUtils.endWriteSection(fdQAP);

    await binFileUtils.startWriteSection(fdQAP, 2);
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof uX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of uX_i at k: ${id}, i: ${i}`);
            }
            await binFileUtils.writeBigInt(fdQAP, uX_i[i][xi][0], n8r);
        }
    }
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof vX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of vX_i at k: ${id}, i: ${i}`);
            }
            await binFileUtils.writeBigInt(fdQAP, vX_i[i][xi][0], n8r);
        }
    }
    for (var i=0; i<m_k; i++){
        for (var xi=0; xi<n; xi++){
            if (typeof wX_i[i][xi][0] != "bigint"){
                throw new Error(`Error in coefficient type of wX_i at k: ${id}, i: ${i}`);
            }
            await binFileUtils.writeBigInt(fdQAP, wX_i[i][xi][0], n8r);
        }
    }
    await binFileUtils.endWriteSection(fdQAP);
    await fdQAP.close();



}

/* eslint-disable no-console */
const logger = Logger__default["default"].create("snarkJS", {showTimestamp:false});
Logger__default["default"].setLogLevel("INFO");

const commands = [
    {
        cmd: "setup [paramName] [RSName] [entropy]",
        description: "setup phase",
        alias: ["st"],
        action: uniSetup
    },
    {
        cmd: "derive [RSName] [cRSName] [circuitName] [QAPName]",
        description: "derive phase",
        alias: ["dr"],
        action: uniDerive
    },
    {
        cmd: "prove [cRSName] [proofName] [QAPName] [circuitName] [entropy] [instanceId]",
        description: "prove phase",
        alias: ["dr"],
        action: groth16Prove
    },
    {
        cmd: "verify [proofName] [cRSName] [circuitName] [instanceId]",
        description: "verify phase",
        alias: ["dr"],
        action: groth16Verify
    },
    {
        cmd: "QAP_all [curveName] [s_D] [min_s_max]",
        description: "prephase",
        alias: ["dr"],
        action: uniBuildQAP
    },
    {
        cmd: "QAP_single [paramName] [id]",
        description: "prephase",
        alias: ["dr"],
        action: uniBuildQAP_single
    }
];

clProcessor(commands).then( (res) => {
    process.exit(res);
}, (err) => {
    logger.error(err);
    process.exit(1);
});


// setup [curveName], [s_D], [min_s_max], [r1csName], [RSName], [entropy]
async function uniSetup(params) {
    const paramName = params[0];
    const RSName = params[1];
    const entropy = params[2];

    // console.log(curveName, s_D, min_x_max, r1csName, RSName, entropy)
    return uni_Setup(paramName, RSName, entropy);
}
// derive [RSName] [cRSName] [circuitName] [QAPName]
async function uniDerive(params) {
    const RSName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];
    const QAPName = params[3];

    // console.log(RSName, cRSName, IndSetVName, IndSetPName, OpListName)
    return uniDerive$1(RSName, cRSName, circuitName, QAPName);
}

async function groth16Prove(params){
    const cRSName = params[0];
    const proofName = params[1];
    const QAPName = params[2];
    const circuitName = params[3];
    const entropy = params[4];
    let instanceId;
    if (params[5] === undefined){
        instanceId = '';
    } else {
        instanceId = params[5];
    }

    return groth16Prove$1(cRSName, proofName, QAPName, circuitName, entropy, instanceId)
}

async function groth16Verify(params){
    const proofName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];
    let instanceId;
    if (params[3] === undefined){
        instanceId = '';
    } else {
        instanceId = params[3];
    }


    return groth16Verify$1(proofName, cRSName, circuitName, instanceId)
}

async function uniBuildQAP(params){
    const curveName = params[0];
    const s_D = params[1];
    const min_s_max = params[2];

    return uni_buildQAP(curveName, s_D, min_s_max)
}

// QAP_single [paramName] [id]
async function uniBuildQAP_single(params){
    const paramName = params[0];
    const id = params[1];

    return uni_buildQAP_single(paramName, id)
}
