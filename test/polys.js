import * as polyUtils from "../src/uni_poly_utils.js"
import * as curves from "../src/curves.js"


const curve = await curves.getCurveFromName('bn128');
const Fr = curve.Fr;
const rs = {};
rs.curve = curve;
rs.n = 128;
rs.omega_x = await Fr.e(3);

const Lagrange_basis = await polyUtils.buildCommonPolys(rs, true)

const testPol = await polyUtils.scalePoly(Fr, Lagrange_basis[0], Fr.zero);
console.log(testPol)