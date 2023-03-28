import { Address } from '@ethereumjs/util'

export class TransientStorage {

  constructor () {
    /**
     * The current values of the transient storage, keyed by contract address and then slot
     */
    this._storage = new Map()
    /**
     * Each change to storage is recorded in the journal. This is never cleared.
     */
    this._changeJournal = []
    /**
     * The length of the journal at the beginning of each call in the call stack.
     */
    this._indices = [0]
  }

  /**
   * Get the value for the given address and key
   * @param {Address} addr the address for which transient storage is accessed
   * @param {Buffer} key the key of the address to get
   * @returns {Buffer} the value of the transient storage slot
   */
  get(addr, key) {
    const map = this._storage.get(addr.toString())
    if (!map) {
      return Buffer.alloc(32)
    }
    const value = map.get(key.toString('hex'))
    if (!value) {
      return Buffer.alloc(32)
    }
    return value
  }

  /**
   * Put the given value for the address and key
   * @param {Address} addr the address of the contract for which the key is being set
   * @param {Buffer} key the slot to set for the address
   * @param {Buffer} value the new value of the transient storage slot to set
   */
  put(addr, key, value) {
    if (key.length !== 32) {
      throw new Error('Transient storage key must be 32 bytes long')
    }

    if (value.length > 32) {
      throw new Error('Transient storage value cannot be longer than 32 bytes')
    }

    const addrString = addr.toString()
    if (!this._storage.has(addrString)) {
      this._storage.set(addrString, new Map())
    }
    const map = this._storage.get(addrString)

    const keyStr = key.toString('hex')
    const prevValue = map.get(keyStr) ?? Buffer.alloc(32)

    this._changeJournal.push({
      addr: addrString,
      key: keyStr,
      prevValue,
    })

    map.set(keyStr, value)
  }
  /**
   * To be called whenever entering a new context. If revert is called after checkpoint, all changes after the latest checkpoint are reverted.
  */
  checkpoint() {
    this._indices.push(this._changeJournal.length)
  }
  
  /**
   * Revert transient storage to the last checkpoint
  */
  revert() {
    const lastCheckpoint = this._indices.pop()
    if (typeof lastCheckpoint === 'undefined') throw new Error('Nothing to revert')

    for (let i = this._changeJournal.length - 1; i >= lastCheckpoint; i--) {
      const { key, prevValue, addr } = this._changeJournal[i]
      if (this._storage.get(addr) === null) {
        throw Error('Wrong address');
      }
      this._storage.get(addr).set(key, prevValue)
    }
    this._changeJournal.splice(lastCheckpoint, this._changeJournal.length - lastCheckpoint)
  }
}
