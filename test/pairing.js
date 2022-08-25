import chai from 'chai'
const assert = chai.assert
import { Scalar } from 'ffjavascript'
import { getCurveFromName } from '../src/curves.js'
// import { createTauKey } from '../src/uni_setup.js'
import * as misc from '../src/misc.js'

// Uni-setup is not working yet; this function can be imported if the file is completed
function createTauKey(Field, rng) {
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

describe('Zkey New', function () {
	this.timeout(100000)
	let curve
	const params = {}

	// Uni zkey new arguments
	let n = 10
	let s_max = 1

	before (async () => {
		curve = await getCurveFromName('bn128')
		params.sG1 = curve.G1.F.n8 * 2
		params.sG2 = curve.G2.F.n8 * 2
		params.buffG1 = curve.G1.oneAffine
		params.buffG2 = curve.G2.oneAffine
		params.Fr = curve.Fr
		params.G1 = curve.G1
		params.G2 = curve.G2

		params.primeQ = curve.q
		params.n8q = (Math.floor((Scalar.bitLength(params.primeQ) - 1) / 64) + 1) * 8
		// Group parameters
		params.primeR = curve.r
		params.n8r = (Math.floor((Scalar.bitLength(params.primeR) - 1) / 64) + 1) * 8
		params.Rr = Scalar.mod(Scalar.shl(1, params.n8r * 8), params.primeR)
		params.R2r = curve.Fr.e(Scalar.mod(Scalar.mul(params.Rr, params.Rr), params.primeR))
	})
	after (async () => {
		await curve.terminate()
	})
	it('Omega, Zeta', async () => {
		const Fr = curve.Fr
		const Fq = curve.Fq
		// QAP constants

		n = BigInt(n)
		let q_x = (params.primeR - BigInt(1)) / n
		while ((params.primeR - BigInt(1)) !== q_x * n){
			n += BigInt(1)
			q_x = (params.primeR - BigInt(1)) / n
		}

		const exp_omega_x = q_x
		const omega_x = Fr.exp(Fr.e(n), exp_omega_x)
		
		s_max = BigInt(s_max)

		let q_y = (params.primeR - BigInt(1)) / s_max
		while ((params.primeR - BigInt(1)) !== s_max * q_y){
			s_max += BigInt(1)
			q_y = (params.primeR - BigInt(1)) / s_max
		}
		const exp_omega_y = q_y
		const omega_y = Fr.exp(Fr.e(n), exp_omega_y)

		 // console.log(`one: ${Fr.e(1)}`)
		 // console.log(`omega_x ${omega_x}, Fr.e(s_max) ${Fr.e(s_max)}`)
		 // console.log(`exp(omega_x, Fr.e(s_max)) ${Fr.exp(omega_x, Fr.e(s_max))}, Fr.one ${Fr.one} `)
    assert(Fr.eq(Fr.exp(Fr.e(n), params.primeR), Fr.e(n)))
    assert(Fr.eq(Fr.exp(Fr.e(omega_x), n), Fr.one))
    assert(Fr.eq(Fr.exp(Fr.e(omega_y), s_max), Fr.one))
	})
	// Test code //
	// for all i<n-1 and all j<s_max-1
	// let vk1_xy_pows[i][j]= G1.timesFr(buffG1, xy_pows[i][j])
	// let vk2_t_xy= G2.timesFr(buffG2, t_xy)
	// assert e(vk1_xy_pows[i][j], vk2_t_xy) == e(vk1_xy_pows_tg,vk2_gamma_a) verify->pairing curve.paingEq
	// End of the test code //
	it('paring curve', async () => {
		const Fr = curve.Fr

		// Tau
		const num_keys = 6 // the number of keys in tau
		const rng = new Array(num_keys)
		for(var i = 0; i < num_keys; i++) {
				rng[i] = await misc.getRandomRng('entropy' + i)
		}
		const tau = createTauKey(Fr, rng)

		const x = tau.x
		const y = tau.y

		n = Number(n)
		s_max = Number(s_max)

		// xy_pows
    const xy_pows = Array.from(Array(n), () => new Array(s_max)) // n by s_max 2d array

    for(var i = 0; i < n; i++) {
        for(var j = 0; j < s_max; j++){
					xy_pows[i][j] = await Fr.mul(Fr.exp(x, i), Fr.exp(y, j))
        }
    }

		// t_xy
		const gamma_a_inv = Fr.inv(tau.gamma_a)
		const t_xy = Fr.mul(Fr.sub(Fr.exp(x, n), Fr.one), Fr.sub(Fr.exp(y, s_max),Fr.one))
		const vk2_gamma_a = await params.G2.timesFr(params.buffG2, tau.gamma_a)
		const t_xy_g = Fr.mul(t_xy, gamma_a_inv)

		for (let i = 0; i < n - 1; i++) {
			for (let j = 0; j < s_max - 1; j++) {
				const xy_pows_tg = await Fr.mul(xy_pows[i][j], t_xy_g)
				const vk1_xy_pows_tg = await params.G1.timesFr(params.buffG1, xy_pows_tg);
				assert(
					curve.pairingEq(
						params.G1.timesFr(params.buffG1, xy_pows[i][j]),
						params.G2.timesFr(params.buffG2, t_xy), 
						params.G1.neg(vk1_xy_pows_tg),
						vk2_gamma_a
					)
				)
			}
		}
	})
})
