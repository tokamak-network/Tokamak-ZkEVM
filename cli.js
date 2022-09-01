/* eslint-disable no-console */

import clProcessor from "./src/clprocessor.js";
import * as zkey from "./src/uni_zkey.js";
import Logger from "logplease";
const logger = Logger.create("snarkJS", {showTimestamp:false});
Logger.setLogLevel("INFO");

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
        cmd: "prove [cRSName] [proofName] [QAPName] [circuitName] [entropy]",
        description: "prove phase",
        alias: ["dr"],
        action: groth16Prove
    },
    {
        cmd: "verify [proofName] [cRSName] [circuitName]",
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
    return zkey.uniSetup(paramName, RSName, entropy);
}
// derive [RSName] [cRSName] [circuitName] [QAPName]
async function uniDerive(params) {
    const RSName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];
    const QAPName = params[3];

    // console.log(RSName, cRSName, IndSetVName, IndSetPName, OpListName)
    return zkey.uniDerive(RSName, cRSName, circuitName, QAPName);
}

async function groth16Prove(params){
    const cRSName = params[0];
    const proofName = params[1];
    const QAPName = params[2];
    const circuitName = params[3];
    const entropy = params[4];

    return zkey.groth16Prove(cRSName, proofName, QAPName, circuitName, entropy)
}

async function groth16Verify(params){
    const proofName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];

    return zkey.groth16Verify(proofName, cRSName, circuitName)
}

async function uniBuildQAP(params){
    const curveName = params[0];
    const s_D = params[1];
    const min_s_max = params[2];

    return zkey.uniBuildQAP(curveName, s_D, min_s_max)
}

// QAP_single [paramName] [id]
async function uniBuildQAP_single(params){
    const paramName = params[0];
    const id = params[1];

    return zkey.uniBuildQAP_single(paramName, id)
}

