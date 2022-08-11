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

/*
Header(1)
    n8
    prime
    power1 // ceil(log2(n))
    power2 // ceil(log2(s_max))
tau1G1(2)
    {(2 ** power1)*2-1} [
        G1, tau1*G1, tau1^2 * G1, ....
    ]
tau1G2(3)
    {2 ** power1}[
        G2, tau1*G2, tau1^2 * G2, ...
    ]
alphaTau1G1(4)
    {2 ** power1}[
        alpha*G1, alpha*tau1*G1, alpha*tau1^2*G1,....
    ]
betaTau1G1(5)
    {2 ** power1} []
        beta*G1, beta*tau1*G1, beta*tau1^2*G1, ....
    ]
betaG2(6)
    {1}[
        beta*G2
    ]
contributions(7)
    NContributions
    {NContributions}[
        tau*G1
        tau*G2
        alpha*G1
        beta*G1
        beta*G2
        pubKey
            tau_g1s
            tau_g1sx
            tau_g2spx
            alpha_g1s
            alpha_g1sx
            alpha_g1spx
            beta_g1s
            beta_g1sx
            beta_g1spx
        partialHash (216 bytes) See https://github.com/mafintosh/blake2b-wasm/blob/23bee06945806309977af802bc374727542617c7/blake2b.wat#L9
        hashNewChallenge
    ]
tau2G1(8)
    {(2 ** power2)*2-1} [
        G1, tau2*G1, tau2^2 * G1, ....
    ]
tau2G2(9)
    {2 ** power2}[
        G2, tau2*G2, tau2^2 * G2, ...
    ]
alphaTau2G1(10)
    {2 ** power2}[
        alpha*G1, alpha*tau2*G1, alpha*tau2^2*G1,....
    ]
betaTau2G1(11)
    {2 ** power2} []
        beta*G1, beta*tau2*G1, beta*tau2^2*G1, ....
    ]
 */

import * as ptauUtils from "./powersoftau_utils.js";
import * as binFileUtils from "@iden3/binfileutils";
import Blake2b from "blake2b-wasm";
import * as misc from "./misc.js";

export default async function newAccumulator(curve, power1, power2, fileName, logger) {

    await Blake2b.ready();

    const fd = await binFileUtils.createBinFile(fileName, "ptau", 1, 11);

    await ptauUtils.writePTauHeader(fd, curve, power1, 0, power2); //수정필요

    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;

    // write tau1G1
    ///////////
    await binFileUtils.startWriteSection(fd, 2);
    const nTau1G1 = (2 ** power1) * 2 -1;
    for (let i=0; i< nTau1G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("tau1G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // write tau1G2
    ///////////
    await binFileUtils.startWriteSection(fd, 3);
    const nTau1G2 = (2 ** power1);
    for (let i=0; i< nTau1G2; i++) {
        await fd.write(buffG2);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("tau1G2: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // Write alphaTau1G1
    ///////////
    await binFileUtils.startWriteSection(fd, 4);
    const nAlfaTau1G1 = (2 ** power1);
    for (let i=0; i< nAlfaTau1G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("alphaTau1G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // Write betaTau1G1
    ///////////
    await binFileUtils.startWriteSection(fd, 5);
    const nBetaTau1G1 = (2 ** power1);
    for (let i=0; i< nBetaTau1G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("betaTau1G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // Write betaG2
    ///////////
    await binFileUtils.startWriteSection(fd, 6);
    await fd.write(buffG2);
    await binFileUtils.endWriteSection(fd);

    // Contributions
    ///////////
    await binFileUtils.startWriteSection(fd, 7);
    await fd.writeULE32(0); // 0 Contributions
    await binFileUtils.endWriteSection(fd);

        // write tau2G1
    ///////////
    await binFileUtils.startWriteSection(fd, 8);
    const nTau2G1 = (2 ** power2) * 2 -1;
    for (let i=0; i< nTau2G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("tau2G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // write tau2G2
    ///////////
    await binFileUtils.startWriteSection(fd, 9);
    const nTau2G2 = (2 ** power2);
    for (let i=0; i< nTau2G2; i++) {
        await fd.write(buffG2);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("tau2G2: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // Write alphaTau2G1
    ///////////
    await binFileUtils.startWriteSection(fd, 10);
    const nAlfaTau2G1 = (2 ** power2);
    for (let i=0; i< nAlfaTau2G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("alphaTau2G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    // Write betaTau2G1
    ///////////
    await binFileUtils.startWriteSection(fd, 11);
    const nBetaTau2G1 = (2 ** power2);
    for (let i=0; i< nBetaTau2G1; i++) {
        await fd.write(buffG1);
        if ((logger)&&((i%100000) == 0)&&i) logger.log("betaTau2G1: " + i);
    }
    await binFileUtils.endWriteSection(fd);

    await fd.close();

    const firstChallengeHash = ptauUtils.calculateFirstChallengeHash(curve, power, logger);

    if (logger) logger.debug(misc.formatHash(Blake2b(64).digest(), "Blank Contribution Hash:"));

    if (logger) logger.info(misc.formatHash(firstChallengeHash, "First Contribution Hash:"));

    return firstChallengeHash;

}
