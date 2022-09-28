export default ({ A, B }) => {
  const C = []
  for (var i = 0; i < A.length; i++) {
    C.push(B.map(x => A[i][0] * x))
  }
  return C
}