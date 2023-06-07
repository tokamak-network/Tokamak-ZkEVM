/**
 * 
 * @param {number} value 
 * @param {number} ceiling 
 * @returns {number} ceil value
 */
const ceil = (value, ceiling) => {
  const r = value % ceiling
  if (r === 0) {
    return value
  } else {
    return value + ceiling - r
  }
}

const CONTAINER_SIZE = 8192

/**
 * Memory implements a simple memory model
 * for the ethereum virtual machine.
 */
export class Memory {
  constructor() {
    this._store = Buffer.alloc(0)
  }

  /**
   * Extends the memory given an offset and size. Rounds extended
   * memory to word-size.
   * @param {number} offset - Starting position
   * @param {number} size - How many bytes to extend
   */
  extend(offset, size) {
    if (size === 0) {
      return
    }

    const newSize = ceil(offset + size, 32)
    const sizeDiff = newSize - this._store.length
    if (sizeDiff > 0) {
      this._store = Buffer.concat([
        this._store,
        Buffer.alloc(Math.ceil(sizeDiff / CONTAINER_SIZE) * CONTAINER_SIZE),
      ])
    }
  }

  /**
   * Writes a byte array with length `size` to memory, starting from `offset`.
   * @param {number} offset - Starting position
   * @param {number} size - How many bytes to write
   * @param {Buffer} value - Value
   */
  write(offset, size, value) {
    if (size === 0) {
      return
    }

    this.extend(offset, size)

    if (value.length !== size) throw new Error('Invalid value size')
    if (offset + size > this._store.length) throw new Error('Value exceeds memory capacity')

    value.copy(this._store, offset)
  }

  /**
   * Reads a slice of memory from `offset` till `offset + size` as a `Buffer`.
   * It fills up the difference between memory's length and `offset + size` with zeros.
   * @param {number} offset - Starting position
   * @param {number} size - How many bytes to read
   * @param {boolean} avoidCopy - Avoid memory copy if possible for performance reasons (optional)
   * @returns {Buffer}
   */
  read(offset, size, avoidCopy) {
    this.extend(offset, size)

    const loaded = this._store.slice(offset, offset + size)
    if (avoidCopy === true) {
      return loaded
    }

    return Buffer.from(loaded)
  }
}
