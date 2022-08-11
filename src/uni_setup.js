import * as curves from "./curves.js"
import * as misc from 'misc.js'
import * as zkeyUtils from "./uni_zkey_utils.js";
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

export default async function uni_Setup(curveName, s_D, min_s_max, r1csName, RSName, entropy) {
    const r1cs = new Array();
    const sR1cs = new Array();
    // let max_constraints
    for(var i=0; i<s_D; i++){
        let r1csIdx = string(i);
        const {fd: fdR1cs, sections: sectionsR1cs} = await readBinFile(r1csName+r1csIdx+".r1cs", "r1cs", 1, 1<<22, 1<<24);
        r1cs.push(await readR1csHeader(fdR1cs, sectionsR1cs, false));
        sR1cs.push(await readSection(fdR1cs, sectionsR1cs, 2));
        fdR1cs.close();
        // if(max_constraints == undefined){
        //     max_constraints = r1cs[i].nConstraints;
        // } else {
        //     if(r1cs[i].nConstraints>max_constraints){
        //         max_constraints = r1cs[i].nConstraints;
        //     }
        // }
    }
    const fdRS = await createBinFile(RSName+".urs", "zkey", 1, 4+s_D, 1<<22, 1<<24)
   
    const curve = await curves.getCurveFromName(curveName)
    // const sG1 = curve.G1.F.n8*2              // unused
    // const sG2 = curve.G2.F.n8*2              // unused
    const buffG1 = curve.G1.oneAffine;
    const buffG2 = curve.G2.oneAffine;
    const Fr = curve.Fr;
    const G1 = curve.G1;
    const G2 = curve.G2;

    if (r1cs.prime != curve.r) {
        throw new Error("r1cs curve does not match powers of tau ceremony curve")
        //return -1
    }

    // const cirPower = log2(r1cs.nConstraints + r1cs.nPubInputs + r1cs.nOutputs +1 -1) +1
    // const domainSize = 2 ** cirPower;

    if (r1cs.nConstraints > n) {
        throw new Error(`circuit is too big`)
    }

    // Generate tau
    var num_keys = 6 // the number of keys in tau
    let rng = new Array(num_keys)
    for(var i = 0; i < num_keys; i++) {
        rng[i] = await misc.getRandomRng(entropy + i)
    }
    const tau = createTauKey(Fr, rng)
 
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
    const Rr = Scalar.mod(Scalar.shl(1, n8r*8), primeR);
    const R2r = curve.Fr.e(Scalar.mod(Scalar.mul(Rr,Rr), primeR));

    await fdRS.writeULE32(n8q);                   // byte length of primeQ
    await writeBigInt(fdRS, primeQ, n8q);
    await fdRS.writeULE32(n8r);                   // byte length of primeR
    await writeBigInt(fdRS, primeR, n8r);

    // Instruction set constants
    await fdRS.writeULE32(s_D)
    const m = new Array()          // the numbers of wires
    const mPublic = new Array()    // the numbers of public wires (not including constant wire at zero index)
    const mPrivate = new Array()
    for(var i=0; i<s_D; i++){
        m.push(r1cs[i].nVars);
        mPublic.push(r1cs[i].nOutputs + r1cs[i].nPubInputs) 
        mPrivate.push(m[i] - mPublic[i])
        await fdRS.writeULE32(m[i])
        await fdRS.writeULE32(mPublic[i])
    }

    // QAP constants
    const sum_mPublic = mPublic.reduce((accu,curr) => accu + curr)
    const sum_mPrivate = mPrivate.reduce((accu,curr) => accu + curr)
    const NEqs = Math.max(sum_mPublic, sum_mPrivate)
    let n = BigInt(Math.ceil(NEqs/3))

    let q_x = (parameters.primeR - BigInt(1)) / n
    while ((parameters.primeR - BigInt(1)) !== q_x * n){
        n += BigInt(1)
        q_x = (parameters.primeR - BigInt(1)) / n
    }

    const exp_omega_x = q_x
    const omega_x = Fr.exp(Fr.e(n), exp_omega_x)

    let s_max = BigInt(min_s_max)
    let q_y = (parameters.primeR - BigInt(1)) / s_max
    while ((parameters.primeR - BigInt(1)) !== s_max * q_y){
        s_max += BigInt(1)
        q_y = (parameters.primeR - BigInt(1)) / s_max
    }
    const exp_omega_y = q_y
    const omega_y = Fr.exp(Fr.e(n), exp_omega_y)
    // Test code // --> DONE (\test\universial.zvm\pairing.js)
    //assert(Fr.eq(Fr.exp(Fr.e(n), parameters.primeR), Fr.e(n)))
    //assert(Fr.eq(Fr.exp(Fr.e(omega_x), n), Fr.one))
    //assert(Fr.eq(Fr.exp(Fr.e(omega_y), s_max), Fr.one))
    // End of test code //

    await fdRS.writeULE32(n);                     // the maximum number of gates in each subcircuit: n>=NEqs/3 and n|(r-1)
    await fdRS.writeULE32(s_max);                  // the maximum number of subcircuits in a p-code: s_max>min_s_max and s_max|(r-1)
    await fdRS.writeULE32(omega_x);                    // Generator for evaluation points on X
    await fdRS.writeULE32(omega_y);                    // Generator for evaluation points on Y

    await endWriteSection(fdRS);
    // End of the parameters section

     // Write the sigma_G section
    ///////////
    await startWriteSection(fdRS, 3);
    let vk1_alpha_u;
    vk1_alpha_u = await G1.timesFr( buffG1, tau.alpha_u );
    let vk1_alpha_v;
    vk1_alpha_v = await G1.timesFr( buffG1, tau.alpha_v );
    let vk1_gamma_a;
    vk1_gamma_a = await G1.timesFr( buffG1, tau.gamma_a );

    await zkeyUtils.writeG1(fdRS, curve, vk1_alpha_u);
    await zkeyUtils.writeG1(fdRS, curve, vk1_alpha_v);
    await zkeyUtils.writeG1(fdRS, curve, vk1_gamma_a);

    const x=tau.x;
    const y=tau.y;
    let vk1_xy_pows;
    let xy_pows = Array.from(Array(n), () => new Array(s_max)); // n by s_max 2d array

    for(var i = 0; i < n; i++) {
        for(var j = 0; j < s_max; j++){
            xy_pows[i][j] = await Fr.mul(Fr.exp(x,i),Fr.exp(y,j));
            vk1_xy_pows = await G1.timesFr(buffG1, xy_pows[i][j]);
            await zkeyUtils.writeG1(fdRS, curve, vk1_xy_pows);
            // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(s_max-1)], [x^1*y^0], ...
        }
    }

    const gamma_a_inv=Fr.inv(tau.gamma_a);
    let vk1_xy_pows_tg;
    let xy_pows_tg;
    const t_xy=Fr.mul(Fr.sub(Fr.exp(x,n),Fr.one), Fr.sub(Fr.exp(y,s_max),Fr.one));
    const t_xy_g=Fr.mul(t_xy,gamma_a_inv);
    for(var i = 0; i < n-1; i++) {
        for(var j=0; j<s_max-1; j++){
            xy_pows_tg= await Fr.mul(xy_pows[i][j], t_xy_g);
            vk1_xy_pows_tg= await G1.timesFr( buffG1, xy_pows_tg );
            await zkeyUtils.writeG1( fdRS, curve, vk1_xy_pows_tg );
            // [x^0*y^0*t*g], [x^0*y^1*t*g], ..., [x^0*y^(s_max-1)*t*g], [x^1*y^0*t*g], ...
        }
    }
    await endWriteSection(fdRS);
    // End of the sigma_G section
    ///////////

     // Write the sigma_H section
    ///////////
    await startWriteSection(fdRS, 4);
    let vk2_alpha_u;
    vk2_alpha_u = await G2.timesFr( buffG2, tau.alpha_u );
    let vk2_gamma_z;
    vk2_gamma_z = await G2.timesFr( buffG2, tau.gamma_z );
    let vk2_gamma_a;
    vk2_gamma_a = await G2.timesFr( buffG2, tau.gamma_a );
    await zkeyUtils.writeG2(fdRS, curve, vk2_alpha_u);
    await zkeyUtils.writeG2(fdRS, curve, vk2_gamma_z);
    await zkeyUtils.writeG2(fdRS, curve, vk2_gamma_a);

    let vk2_xy_pows
    for(var i = 0; i < n; i++) {
        for(var j=0; j<s_max; j++){
            vk2_xy_pows= await G2.timesFr( buffG2, xy_pows[i][j] );
            await zkeyUtils.writeG2(fdRS, curve, vk2_xy_pows );
            // [x^0*y^0], [x^0*y^1], ..., [x^0*y^(s_max-1)], [x^1*y^0], ...
        }
    }
    await endWriteSection(fdRS);
    // End of the sigma_H section
    ///////////

    // Test code //
    // for all i<n-1 and all j<s_max-1
    // let vk1_xy_pows[i][j]= G1.timesFr(buffG1, xy_pows[i][j])
    // let vk2_t_xy= G2.timesFr(buffG2, t_xy)
    // assert e(vk1_xy_pows[i][j], vk2_t_xy) == e(vk1_xy_pows_tg,vk2_gamma_a) verify->pairing curve.paingEq
    // End of the test code //

    // Write the theta_G[i] sections for i in [0, 1, ..., s_D]
    ///////////
    let Lagrange_basis = new Array(n);
    let term
    let acc
    let multiplier
    for(var i=0; i<n; i++){
        term=Fr.one;
        acc=Fr.one;
        multiplier=Fr.mul(Fr.exp(omega_x,i),x);
        for(var j=1; j<n; j++){
            term=Fr.mul(term,multiplier);
            acc=Fr.add(acc,term);
        }
        Lagrange_basis[i]=Fr.mul(Fr.inv(n),acc);
    }

    for(var k = 0; k < s_D; k++){
               
        const U = new BigArray();
        const Uid = new BigArray();
        const V = new BigArray();
        const Vid = new BigArray();
        const W = new BigArray();
        const Wid = new BigArray();
        await processConstraints(); // to fill U, V, W
    
        let ux = new Array(m[k]);
        let vx = new Array(m[k]);
        let wx = new Array(m[k]);
        for(var i=0; i<m; i++){
            ux[i]=Fr.e(0);
            vx[i]=Fr.e(0);
            wx[i]=Fr.e(0);
        }
    
        let U_ids
        let U_coefs
        let V_ids
        let V_coefs
        let W_ids
        let W_coefs
        let Lagrange_term
        let U_idx
        let V_idx
        let W_idx
    
        for(var i=0; i<r1cs[k].nConstraints; i++){
            U_ids=Uid[i];
            U_coefs=U[i];
            V_ids=Vid[i];
            V_coefs=V[i];
            W_ids=Wid[i];
            W_coefs=W[i];
            for(var j=0; j<U_ids.length; j++){
                U_idx=U_ids[j]
                if(U_idx>=0){
                    Lagrange_term=Fr.mul(U_coefs[j],Lagrange_basis[i]);
                    ux[j]=Fr.add(ux[U_idx],Lagrange_term);
                }
                V_idx=V_ids[j]
                if(V_idx>=0){
                    Lagrange_term=Fr.mul(V_coefs[j],Lagrange_basis[i]);
                    vx[j]=Fr.add(vx[V_idx],Lagrange_term);
                }
                W_idx=W_ids[j]
                if(W_idx>=0){
                    Lagrange_term=Fr.mul(W_coefs[j],Lagrange_basis[i]);
                    wx[j]=Fr.add(wx[W_idx],Lagrange_term);
                }
            }
        }
    
        let vk1_ux = new Array(m[k])
        let vk1_vx = new Array(m[k])
        let vk2_vx = new Array(m[k])
        let vk1_zx = new Array(mPublic)
        let vk1_ax = new Array(mPrivate)
        let combined_i
        let zx_i
        let ax_i
        for(var i=0; i<m[k]; i++){
            vk1_ux[i] = await G1.timesFr(buffG1, ux[i])
            vk1_vx[i] = await G1.timesFr(buffG1, vx[i])
            vk2_vx[i] = await G2.timesFr(buffG2, vx[i])
            combined_i = Fr.add(Fr.add(Fr.mul(tau.alpha_u, ux[i]), Fr.mul(tau.alpha_v, vx[i])), wx[i]);
            if(i<mPublic){
                zx_i=Fr.mul(combined_i, Fr.inv(tau.gamma_z));
                vk1_zx[i] = await G1.timesFr(buffG1, zx_i);
            }
            else{
                ax_i=Fr.mul(combined_i, Fr.inv(tau.gamma_a));
                vk1_ax[i-mPublic] = await G1.timesFr(buffG1, ax_i);
            }
        }

        // Test code //
        // let vk2_alpha_v
        // vk2_alpha_v = await G2.timesFr(buffG2, tau.alpha_v)
        // for(var i=0; i<m; i++){ // 모든 i 대신 랜덤한 몇 개의 i만 해봐도 good
        //  RHS = Fr.mul(Fr.mul(pairing(vk1_ux[i],vk2_alpha_u), pairing(vk1_vx[i],vk2_alpha_v)), pairing(vk1_wx[i],buffG2))
        //  if(i<mPublic){
        //      assert(pairing(vk1_zx[i], vk2_gamma_z) == RHS)
        //  }
        //  else{
        //      assert(pairing(vk1_ax[i-mPublic], vk2_gamma_a) == RHS)
        //  }
        // }
        // End of the test code //
        
        await startWriteSection(fdRS, 5+k);
        let multiplier
        let vk1_uxy_ij
        let vk1_vxy_ij
        let vk1_zxy_ij
        let vk1_axy_ij
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.one
            await zkeyUtils.writeG1(fdRS, curve, vk1_ux[i])
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                vk1_uxy_ij=G1.timesFr(vk1_ux[i],multiplier)
                await zkeyUtils.writeG1(fdRS, curve, vk1_uxy_ij)
            }
        }
        for(var i=0; i < m[k]; i++){
            multiplier=Fr.one
            await zkeyUtils.writeG1(fdRS, curve, vk1_vx[i])
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                vk1_vxy_ij=G1.timesFr(vk1_vx[i],multiplier)
                await zkeyUtils.writeG1(fdRS, curve, vk1_vxy_ij)
            }
        }
        for(var i=0; i < mPublic[k]; i++){
            multiplier=Fr.one
            await zkeyUtils.writeG1(fdRS, curve, vk1_zx[i])
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                vk1_zxy_ij=G1.timesFr(vk1_zx[i],multiplier)
                await zkeyUtils.writeG1(fdRS, curve, vk1_zxy_ij)
            }
        }
        for(var i=0; i < mPrivate[k]; i++){
            multiplier=Fr.one
            await zkeyUtils.writeG1(fdRS, curve, vk1_ax[i])
            for(var j=1; j < s_max; j++){
                multiplier=Fr.mul(multiplier, y)
                vk1_axy_ij=G1.timesFr(vk1_ax[i],multiplier)
                await zkeyUtils.writeG1(fdRS, curve, vk1_axy_ij)
            }
        }
    }

    // End of the theta_G section
    ///////////
    
    // Test code //
    // Init: s_D=1, min_s_max=1, r1csName = (any small subcircuit)
    // Hardcode any testing wire instance and witness (in BigInt) into: const wire = new Array(m[0])
    // let vk2_alpha_v
    // vk2_alpha_v = await G2.timesFr(buffG2, tau.alpha_v)
    // let vk1_U
    // let vk2_V
    // let vk1_W
    // vk1_U = await G1.timesFr(buffG1, Fr.zero)
    // vk2_V = await G2.timesFr(buffG2, Fr.zero)
    // vk1_W = vk1_U
    // for(var i=0; i<m[0]; i++){
    //   vk1_U = await G1.add(vk1_U, await G1.timesFr(vk1_ux[i], wire[i]))
    //   vk2_V = await G2.add(vk2_V, await G2.timesFr(vk2_vx[i], wire[i]))
    //   if( i < mPublic[0] ){
    //       vk1_W = await G1.add(vk1_W, await G1.timesFr(vk1_zx[i], wire[i]))
    //   } else{
    //       vk1_W = await G1.add(vk1_W, await G1.timesFr(vk1_ax[i-mPublic[0]], wire[i]))
    //   }
    // }
    // let LHS1
    // let LHS2
    // let LHS3
    // let RHS
    // LHS1 = pairing( vk1_U, vk2_V )
    // LHS2 = pairing( vk1_U, vk2_alpha_u )
    // LHS3 = pairing( vk1_V, vk2_alpha_v )
    // RHS = pairing( vk1_W, buffG2 )
    // assert( Fr.mul(Fr.mul(LHS1, LHS2), LHS3) == RHS )
    // End of the test code //

    fdRS.close()



    async function processConstraints() { 
        let r1csPos = 0;
    
        function r1cs_readULE32toUInt() {
            const buff = sR1cs.slice(r1csPos, r1csPos+4);
            r1csPos += 4;
            const buffV = new DataView(buff.buffer);
            return buffV.getUint32(0, true);
        }
        function r1cs_readULE256toFr() {
            const buff = sR1cs.slice(r1csPos, r1csPos+32);
            r1csPos += 32;
            const buffV = curve.Fr.fromRprLE(buff);
            return buffV
        }
        
        for (let c=0; c<r1cs.nConstraints; c++) {
            //if ((logger)&&(c%10000 == 0)) logger.debug(`processing constraints: ${c}/${r1cs.nConstraints}`);
            const nA = r1cs_readULE32toUInt();
            let coefs = new array(nA);
            let ids = new array(nA);
            for (let i=0; i<nA; i++) {
                ids[i] = r1cs_readULE32toUInt();
                coefs[i] = r1cs_readULE256toFr();
            }
            //if (typeof A[s] === "undefined") A[s] = [];
            U.push(coefs);
            Uid.push(ids);
            delete(coefs);
            delete(ids);
    
            const nB = r1cs_readULE32toUInt();
            let coefs = new array(nB);
            let ids = new array(nB);
            for (let i=0; i<nB; i++) {
                ids[i] = r1cs_readULE32toUInt();
                coefs[i] = r1cs_readULE256toFr();
            }
            V.push(coefs);
            Vid.push(ids);
            delete(coefs);
            delete(ids);
    
            const nC = r1cs_readULE32toUInt();
            let coefs = new array(nC);
            let ids = new array(nC);
            for (let i=0; i<nC; i++) {
                ids[i] = r1cs_readULE32toUInt();
                coefs[i] = r1cs_readULE256toFr();
            }
            W.push(coefs);
            Wid.push(ids);
            delete(coefs);
            delete(ids);
        }
    }
}
