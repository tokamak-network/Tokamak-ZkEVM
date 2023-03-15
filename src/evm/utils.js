/**
 * Wraps error message as EvmError
 * @param {string} err The error message
 */
export function trap(err) {
  // facilitate extra data along with errors
  throw new EvmError(err)
}

/**
 * mod operator
 * @param {bigint} a 
 * @param {bigint} b 
 * @returns {bigint} positive valud of a % b
 */
export function mod(a, b) {
  let r = a % b
  if (r < BigInt(0)) {
    r = b + r
  }
  return r
}

/**
 * @param {bigint} a 
 */
export function fromTwos(a) {
  return BigInt.asIntN(256, a)
}

/**
 * @param {bigint} a 
 */
export function toTwos(a) {
  return BigInt.asUintN(256, a)
}


/**
 * @param {bigint} base base of exponentiation
 * @param {bigint} exp exponent
 * @returns {bigint} base^exp
 */
const N = BigInt(115792089237316195423570985008687907853269984665640564039457584007913129639936)
export function exponentiation(base, exp) {
  let t = BigInt(1)
  while (exp > BigInt(0)) {
    if (exp % BigInt(2) !== BigInt(0)) {
      t = (t * base) % N
    }
    base = (base * base) % N
    exp = exp / BigInt(2)
  }
  return t
}

/**
 * Returns an overflow-safe slice of an array. It right-pads
 * the data with zeros to `length`.
 * @param {Buffer} data The data to slice
 * @param {bigint} offset The offset to start slicing from
 * @param {bigint} length The length of the slice
 * @returns {Buffer} The slice
 */
export function getDataSlice(data, offset, length) {
  const len = BigInt(data.length)
  if (offset > len) {
    offset = len
  }

  let end = offset + length
  if (end > len) {
    end = len
  }

  data = data.slice(Number(offset), Number(end))
  // Right-pad with zeros to fill dataLength bytes
  data = setLengthRight(data, Number(length))

  return data
}

/**
 * Error message helper - generates location string
 * @param {RunState} runState
 */
export function describeLocation(runState) {
  const hash = bytesToHex(keccak256(runState.interpreter.getCode()))
  const address = runState.interpreter.getAddress().buf.toString('hex')
  const pc = runState.programCounter - 1
  return `${hash}/${address}:${pc}`
}

/**
 * Checks if a jump is valid given a destination (defined as a 1 in the validJumps array)
 * @param {RunState} runState
 * @param {number} dest
 * @returns {boolean} success
 */
export function jumpIsValid(runState, dest) {
  return runState.validJumps[dest] === 1
}

/**
 * Checks if a jumpsub is valid given a destination (defined as a 2 in the validJumps array)
 * @param {RunState} runState
 * @param {number} dest
 */
export function jumpSubIsValid(runState, dest) {
  return runState.validJumps[dest] === 2
}