import { Memory } from "../../src/evm/memory.js";
import { assert } from 'chai';

describe('Memory', () => {
  const memory = new Memory();
  
  it('should have 0 capacity initially', () => {
    assert.equal(memory._store.length, 0);
  });

  it('should return zero from empty memory', () => {
    assert.deepEqual(memory.read(0, 3), Buffer.from([0, 0, 0]));
  });

  it('should extend capacity to 8192 bytes', () => {
    memory.extend(0, 8192);
    assert.equal(memory._store.length, 8192);
  });

  it('should write value', () => {
    memory.write(29, 3, Buffer.from([1, 2, 3]));
    assert.deepEqual(memory.read(29, 5), Buffer.from([1, 2, 3, 0, 0]));
  });

  it('should fail when value len and size are inconsitent', () => {
    assert.throws(() => memory.write(0, 5, Buffer.from([8, 8, 8])), /size/);
  });

  it('should expand by container (8192 bytes) properly when writing to previously untouched location',
  () => {
    const m = new Memory();
    assert.equal(m._store.length, 0, 'memory should start with zero length');
    m.write(0, 1, Buffer.from([1]));
    assert.equal(m._store.length, 8192, 'memory buffer length expanded to 8192 bytes');
  });

  it('should expand by container (8192 bytes) when reading a previously untouched location',
  () => {
    const m = new Memory();
    m.read(0, 8);
    assert.equal(m._store.length, 8192, 'memory buffer length expanded to 8192 bytes');

    m.read(8190, 8193);
    assert.equal(m._store.length, 16384, 'memory buffer length expanded to 16384 bytes');
  });
});