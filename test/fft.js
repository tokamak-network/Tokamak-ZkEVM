import { mulPoly } from '../src/utils/poly_utils.js'
import { Scalar, F1Field } from 'ffjavascript'
const p = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617")
const Fr = new F1Field(p)


// TODO: test code to compare with MulPoly()


// TODO: curve Fr로 테스트 해야 함.

/**
 * FIXME: 자동으로 차원 패딩해야 함.
 * 최고차항 계산해서 총 몇개의 좌표가 필요한지로 패딩해야 함.
 * 곱했을 때 하나의 변수의 최고차수를 포함하는 2의 제곱수로 패딩하면 됨.
*/

// x + y
// const a = [
//   [Fr.e(0), Fr.e(1), Fr.e(0), Fr.e(0)],
//   [Fr.e(1), Fr.e(0), Fr.e(0), Fr.e(0)],
//   [Fr.e(0), Fr.e(0), Fr.e(0), Fr.e(0)],
//   [Fr.e(0), Fr.e(0), Fr.e(0), Fr.e(0)]
// ]

// x^2 + y
const a = [
  [Fr.e(0), Fr.e(0), Fr.e(0), Fr.e(0)],
  [Fr.e(1), Fr.e(1), Fr.e(0), Fr.e(0)],
  [Fr.e(0), Fr.e(0), Fr.e(0), Fr.e(0)],
  [Fr.e(0), Fr.e(0), Fr.e(0), Fr.e(0)]
]

const fftA = []

// respective of x
for (let i = 0; i < a.length; i++) {
  fftA.push(Fr.fft(a[i]))
}

console.log('fftA')
console.log(fftA)

const fft2A = []

// respective of y
for (let i = 0; i < fftA[0].length; i++) {
  const temp = []
  for (let j = 0; j < fftA.length; j++) {
    temp.push(fftA[j][i])
  }
  fft2A.push(Fr.fft(temp))
}
// fft2A.push(Fr.fft([fftA[0][0], fftA[1][0], fftA[2][0], fftA[3][0]]))
// fft2A.push(Fr.fft([fftA[0][1], fftA[1][1], fftA[2][1], fftA[3][1]]))
// fft2A.push(Fr.fft([fftA[0][2], fftA[1][2], fftA[2][2], fftA[3][2]]))
// fft2A.push(Fr.fft([fftA[0][3], fftA[1][3], fftA[2][3], fftA[3][3]]))

console.log('fft2A')
console.log(fft2A)


// multiply polynomial
for (let i = 0; i < fft2A.length; i++) {
  for (let j = 0; j < fft2A[0].length; j++) {
    fft2A[i][j] = fft2A[i][j] * fft2A[i][j]
  }
}

// respetive of y
const ifft2A = []

for (let i = 0; i < fft2A.length; i++) {
  ifft2A.push(Fr.ifft(fft2A[i]))
}

// ifft2A.push(Fr.ifft(fft2A[0]))
// ifft2A.push(Fr.ifft(fft2A[1]))
// ifft2A.push(Fr.ifft(fft2A[2]))
// ifft2A.push(Fr.ifft(fft2A[3]))

console.log('ifft2A')
console.log(ifft2A)


// respective of x
const ifftA = []

for (let i = 0; i < ifft2A[0].length; i++) {
  const temp = []
  for (let j = 0; j < ifft2A.length; j++) {
    temp.push(ifft2A[j][i])
  }
  ifftA.push(Fr.ifft(temp))
}

// ifftA.push(Fr.ifft([ifft2A[0][0], ifft2A[1][0], ifft2A[2][0], ifft2A[3][0]]))
// ifftA.push(Fr.ifft([ifft2A[0][1], ifft2A[1][1], ifft2A[2][1], ifft2A[3][1]]))
// ifftA.push(Fr.ifft([ifft2A[0][2], ifft2A[1][2], ifft2A[2][2], ifft2A[3][2]]))
// ifftA.push(Fr.ifft([ifft2A[0][3], ifft2A[1][3], ifft2A[2][3], ifft2A[3][3]]))

console.log('ifftA')
console.log(ifftA)


console.log(mulPoly(Fr, a, a))