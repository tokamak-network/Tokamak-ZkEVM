import { Stack } from "../../src/evm/stack.js";
import { assert } from 'chai';

describe('Stack', () => {
  it('should be empty initially', () => {
    const stack = new Stack();
    assert.equal(stack._store.length, 0);
    assert.throws(() => stack.pop());
  });

  it('popN should throw for empty stack', () => {
    const stack = new Stack();
    assert.deepEqual(stack.popN(0), []);
    assert.throws(() => stack.popN(1));
  });

  it('should not push invalid type values', () => {
    const stack = new Stack();
    assert.throws(() => stack.push('str'));
    assert.throws(() => stack.push(1));
    assert.throws(() => stack.push({}));
  });

  it('should push item', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    assert.deepEqual(stack.pop(), BigInt(5));
  });

  it('popN should return array for n = 1', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    assert.deepEqual(stack.popN(1), [BigInt(5)]);
  })

  it('popN should fail on underflow', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    assert.throws(() => stack.popN(2));
  });

  it('popN should return in correct order', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    stack.push(BigInt(7));
    assert.deepEqual(stack.popN(2), [BigInt(7), BigInt(5)]);
  });

  it('should throw on overflow', () => {
    const stack = new Stack();
    for (let i = 0; i < 1024; i++) {
      stack.push(BigInt(i));
    }
    assert.throws(() => stack.push(BigInt(1024)));
  });

  it('overflow limit should be configurable', () => {
    const stack = new Stack(1023);
    for (let i = 0; i < 1023; i++) {
      stack.push(BigInt(i));
    }
    assert.throws(() => stack.push(BigInt(1023)));
  });

  it('should swap top with itself', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    stack.swap(0);
    assert.deepEqual(stack.pop(), BigInt(5));
  });

  it('swap should throw on underflow', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    assert.throws(() => stack.swap(1));
  });

  it('should swap', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    stack.push(BigInt(7));
    stack.swap(1);
    assert.deepEqual(stack.pop(), BigInt(5));
    assert.deepEqual(stack.pop(), BigInt(7));
  });

  it('dup should throw on underflow', () => {
    const stack = new Stack();
    assert.throws(() => stack.dup(1));
    stack.push(BigInt(5));
    assert.throws(() => stack.dup(2));
  });

  it('should dup', () => {
    const stack = new Stack();
    stack.push(BigInt(5));
    stack.push(BigInt(7));
    stack.dup(2);
    assert.deepEqual(stack.pop(), BigInt(5));
  });

  it('should validate value overflow', () => {
    const stack = new Stack();
    const max = BigInt(2) ** BigInt(256) - BigInt(1);
    stack.push(max);
    assert.deepEqual(stack.pop(), max);
    assert.throws(() => stack.push(max + BigInt(1)));
  });
});