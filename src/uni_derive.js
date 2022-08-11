import * as curves from "./curves.js"
import * as misc from 'misc.js'
import * as zkeyUtils from "./uni_zkey_utils.js";
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

export function createTauKey(Field, rng) {
    if (rng.length != 6) throw new Error('It should have six elements.')
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

export default async function uni_Derive(wireMapName, RSName, cRSName) {
    const {fd: fdRS, sections: sectionsRS} = await binFileUtils.readBinFile(RSName+'.urs', "zkey", 2, 1<<25, 1<<23);
    const urs = {}
    urs.param = await zkeyUtils.readRSParams(fdRS, sectionsRS)
    urs.content = await readRS(fdRS, sectionsRS, urs.param)
    await fdRS.close()

    const ParamR1cs = urs.param.r1cs
    const curve = urs.param.curve
    const s_max = urs.param.s_max
    const omega_y = BigInt(urs.param.omega_y)







    
}
