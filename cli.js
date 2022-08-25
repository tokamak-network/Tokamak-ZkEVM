/* eslint-disable no-console */

import clProcessor from "./src/clprocessor.js";
import * as zkey from "./src/uni_zkey.js";
import Logger from "logplease";
const logger = Logger.create("snarkJS", {showTimestamp:false});
Logger.setLogLevel("INFO");

const commands = [
    {
        cmd: "setup [curveName] [s_D] [min_s_max] [r1csName] [RSName] [entropy]",
        description: "setup phase",
        alias: ["st"],
        action: uniSetup
    },
    {
        cmd: "derive [RSName] [cRSName] [circuitName]",
        description: "derive phase",
        alias: ["dr"],
        action: uniDerive
    },
    {
        cmd: "prove [cRSName] [proofName] [circuitName] [entropy]",
        description: "prove phase",
        alias: ["dr"],
        action: groth16Prove
    },
    {
        cmd: "verify [proofName] [cRSName] [circuitName]",
        description: "verify phase",
        alias: ["dr"],
        action: groth16Verify
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
    const curveName = params[0];
    const s_D = params[1];
    const min_x_max = params[2];
    const r1csName = params[3];
    const RSName = params[4];
    const entropy = params[5];

    // console.log(curveName, s_D, min_x_max, r1csName, RSName, entropy)
    return zkey.uniSetup(curveName, s_D, min_x_max, r1csName, RSName, entropy);
}
// derive [RSName] [cRSName] [circuitName]
async function uniDerive(params) {
    const RSName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];

    // console.log(RSName, cRSName, IndSetVName, IndSetPName, OpListName)
    return zkey.uniDerive(RSName, cRSName, circuitName);
}

async function groth16Prove(params){
    const cRSName = params[0];
    const proofName = params[1];
    const circuitName = params[2];
    const entropy = params[3];

    return zkey.groth16Prove(cRSName, proofName, circuitName, entropy)
}

async function groth16Verify(params){
    const proofName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];

    return zkey.groth16Verify(proofName, cRSName, circuitName)
}

