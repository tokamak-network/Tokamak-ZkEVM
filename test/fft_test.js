import { mulPoly, fftMulPolys } from '../src/utils/poly_utils.js'
import { getCurveFromName } from '../src/curves.js'

const curve = await getCurveFromName('BN128')
const Fr = curve.Fr

// a * b
const a = [
  [Fr.e(0), Fr.e(1), Fr.e(4)]
]
// const a = [
//   [Fr.e(0), Fr.e(1), Fr.e(4)],
//   [Fr.e(1), Fr.e(2), Fr.e(0)],
//   [Fr.e(0), Fr.e(0), Fr.e(10)]
// ]
// const b = [
//   [Fr.e(0), Fr.e(1)],
//   [Fr.e(2), Fr.e(0)],
//   [Fr.e(0), Fr.e(0)]
// ]
// const b = [
//   [Fr.e(1)], 
//   [Fr.e(1)],
//   [Fr.e(0)],
//   [Fr.e(10)]
// ]
const b = [
  [Fr.e(1), Fr.e(0), Fr.e(1), Fr.e(0), Fr.e(0), Fr.e(0)]
]

// const result = await _fft1dMulPolys(
//   Fr, 
//   a[0],
//   b[0]
//   // [Fr.e(1), Fr.e(0), Fr.e(1), Fr.e(0), Fr.e(0), Fr.e(0)],
//   // [Fr.e(0), Fr.e(1), Fr.e(1), Fr.e(0), Fr.e(0), Fr.e(0)]
// )
// console.log(result)

const expect = await fftMulPolys(Fr, b, a)
const answer = mulPoly(Fr, a, b)


// console.log(answer)
// console.log('--------------------------')
// console.log(expect)

const row = (answer.length < expect.length) ? answer.length : expect.length
const col = (answer[0].length < expect[0].length) ? answer[0].length : expect[0].length

let isEqual = true
for (let i = 0; i < row; i++) {
  for (let j = 0; j < col; j++) {
    for (let k = 0; k < 32; k++) {
      if (answer[i][j][k] !== expect[i][j][k]) {
        isEqual = false
        break
      }
    }
  }
}
if (isEqual) console.log("CORRECT")
else console.log("WRONG")
process.exit()
