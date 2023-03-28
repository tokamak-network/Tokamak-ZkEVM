import { assert } from 'chai';
import { Address } from '@ethereumjs/util'
import { TransientStorage } from '../../src/evm/storage.js'

describe('Storage', () => {
  it('should set and get storage', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value = Buffer.alloc(32, 0x99)

    transientStorage.put(address, key, value)
    const got = transientStorage.get(address, key)
    assert.equal(value, got);
  })

  it('should return bytes32(0) if there is no key set', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value = Buffer.alloc(32, 0x11)

    // No address set
    const got = transientStorage.get(address, key)
    assert.deepEqual(Buffer.alloc(32, 0x00), got)

    // Address set, no key set
    transientStorage.put(address, key, value)
    const got2 = transientStorage.get(address, Buffer.alloc(32, 0x22))
    assert.deepEqual(Buffer.alloc(32, 0x00), got2)
  })

  it('should revert', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value = Buffer.alloc(32, 0x99)

    transientStorage.put(address, key, value)

    transientStorage.checkpoint()

    const value2 = Buffer.alloc(32, 0x22)
    transientStorage.put(address, key, value2)
    const got = transientStorage.get(address, key)
    assert.deepEqual(got, value2)

    transientStorage.revert()

    const got2 = transientStorage.get(address, key)
    assert.deepEqual(got2, value)
  })


  it('should fail with wrong size key/value', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')

    assert.throws(() => {
      transientStorage.put(address, Buffer.alloc(10), Buffer.alloc(1))
    }, /Transient storage key must be 32 bytes long/)

    assert.throws(() => {
      transientStorage.put(address, Buffer.alloc(32), Buffer.alloc(33))
    }, /Transient storage value cannot be longer than 32 bytes/)
  })

  it('keys are stringified', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value = Buffer.alloc(32, 0x99)

    transientStorage.put(address, key, value)
    const got = transientStorage.get(
      Address.fromString('0xff00000000000000000000000000000000000002'),
      Buffer.alloc(32, 0xff)
    )
    assert.deepEqual(value, got)
  })

  it('revert applies changes in correct order', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value1 = Buffer.alloc(32, 0x01)
    const value2 = Buffer.alloc(32, 0x02)
    const value3 = Buffer.alloc(32, 0x03)

    transientStorage.put(address, key, value1)
    transientStorage.checkpoint()
    transientStorage.put(address, key, value2)
    transientStorage.put(address, key, value3)
    transientStorage.revert()

    assert.deepEqual(transientStorage.get(address, key), value1)
  })

  it('nested reverts', () => {
    const transientStorage = new TransientStorage()

    const address = Address.fromString('0xff00000000000000000000000000000000000002')
    const key = Buffer.alloc(32, 0xff)
    const value0 = Buffer.alloc(32, 0x00)
    const value1 = Buffer.alloc(32, 0x01)
    const value2 = Buffer.alloc(32, 0x02)
    const value3 = Buffer.alloc(32, 0x03)

    transientStorage.put(address, key, value1)
    transientStorage.checkpoint()
    transientStorage.put(address, key, value2)
    transientStorage.put(address, key, value3)
    transientStorage.checkpoint()
    transientStorage.put(address, key, value2)
    transientStorage.checkpoint()

    assert.deepEqual(transientStorage.get(address, key), value2)
    transientStorage.revert()
    // not changed since nothing happened after latest checkpoint
    assert.deepEqual(transientStorage.get(address, key), value2)
    transientStorage.revert()
    assert.deepEqual(transientStorage.get(address, key), value3)
    transientStorage.revert()
    assert.deepEqual(transientStorage.get(address, key), value1)
    transientStorage.revert()
    assert.deepEqual(transientStorage.get(address, key), value0)
  })
})
