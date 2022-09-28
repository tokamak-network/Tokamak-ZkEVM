const A_LENGTH = 1024
const B_LENGTH = 128

const A = new Array(A_LENGTH).fill().map(() => new Array(1).fill(Math.floor(Math.random() * 10)))
const B = Array.from({length: B_LENGTH}, () => Math.floor(Math.random() * 10))

export {A, B}