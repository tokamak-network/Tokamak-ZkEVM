/* eslint-disable no-console */

import clProcessor from "./src/clprocessor.js";
import * as zkey from "./src/zkey.js";
import Logger from "logplease";
const logger = Logger.create("UniGro16js", {showTimestamp:false});
Logger.setLogLevel("INFO");

const commands = [
    {
        cmd: "setup [paramName] [RSName] [QAPName] [entropy]",
        description: "setup phase",
        alias: ["st"],
        action: setup
    },
    {
        cmd: "derive [RSName] [cRSName] [circuitName] [QAPName]",
        description: "derive phase",
        alias: ["dr"],
        action: derive
    },
    {
        cmd: "prove [cRSName] [proofName] [circuitName] [instanceId] [entropy]",
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
        action: buildQAP
    },
    {
        cmd: "QAP_single [paramName] [id]",
        description: "prephase",
        alias: ["dr"],
        action: buildSingleQAP
    }
];

clProcessor(commands).then( (res) => {
    process.exit(res);
}, (err) => {
    logger.error(err);
    process.exit(1);
});


// setup [curveName], [s_D], [min_s_max], [r1csName], [RSName], [entropy]
async function setup(params) {
    const paramName = params[0];
    const RSName = params[1];
    const QAPName = params[2];
    const entropy = params[3];
    return zkey.setup(paramName, RSName, QAPName, entropy);
}
// derive [RSName] [cRSName] [circuitName] [QAPName]
async function derive(params) {
    const RSName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];
    const QAPName = params[3];
    return zkey.derive(RSName, cRSName, circuitName, QAPName);
}

async function groth16Prove(params){
    const cRSName = params[0];
    const proofName = params[1];
    const circuitName = params[2];
    const instanceId = params[3];
    const entropy = params[4];

    return zkey.groth16Prove(cRSName, proofName, circuitName, instanceId, entropy)
}

async function groth16Verify(params){
    const proofName = params[0];
    const cRSName = params[1];
    const circuitName = params[2];
    let instanceId;
    if (params[3] === undefined){
        instanceId = '';
    } else{
        instanceId = params[3];
    }


    return zkey.groth16Verify(proofName, cRSName, circuitName, instanceId)
}

async function buildQAP(params){
    const curveName = params[0];
    const s_D = params[1];
    const min_s_max = params[2];

    return zkey.buildQAP(curveName, s_D, min_s_max)
}

// QAP_single [paramName] [id]
async function buildSingleQAP(params){
    const paramName = params[0];
    const id = params[1];

    return zkey.buildSingleQAP(paramName, id)
}

