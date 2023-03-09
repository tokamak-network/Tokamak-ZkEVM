import { Stack } from '../../src/vm/stack.js';
import { functions } from '../../src/vm/functions.js';
import chai from 'chai';
const assert = chai.assert;

import testcases_add from './testdata/testcases_add.json' assert {type: 'json'};
import testcases_sub from './testdata/testcases_sub.json' assert {type: 'json'};

const RunState = {
  opcode: 0x00,
  programCounter: 0,
  stack: new Stack(),
  code: [],
}

describe("0x01 ADD function", () => {
  testcases_add.forEach(({ X, Y, Expected }) => {
    it("should add two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x01)(RunState) // X + Y
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})

describe("0x03 SUB function", () => {
  testcases_sub.forEach(({ X, Y, Expected }) => {
    it("should subtract two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x03)(RunState) // Y - X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})