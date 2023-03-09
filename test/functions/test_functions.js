import { Stack } from '../../src/vm/stack.js';
import { functions } from '../../src/vm/functions.js';
import chai from 'chai';
const assert = chai.assert;

import testcases_add from './testdata/testcases_add.json' assert {type: 'json'};
import testcases_mul from './testdata/testcases_mul.json' assert {type: 'json'};
import testcases_sub from './testdata/testcases_sub.json' assert {type: 'json'};
import testcases_div from './testdata/testcases_div.json' assert {type: 'json'};
import testcases_sdiv from './testdata/testcases_sdiv.json' assert {type: 'json'};
import testcases_mod from './testdata/testcases_mod.json' assert {type: 'json'};
import testcases_smod from './testdata/testcases_smod.json' assert {type: 'json'};
import testcases_exp from './testdata/testcases_exp.json' assert {type: 'json'};
import testcases_signext from './testdata/testcases_signext.json' assert {type: 'json'};
import testcases_lt from './testdata/testcases_lt.json' assert {type: 'json'};
import testcases_gt from './testdata/testcases_gt.json' assert {type: 'json'};
import testcases_slt from './testdata/testcases_slt.json' assert {type: 'json'};
import testcases_sgt from './testdata/testcases_sgt.json' assert {type: 'json'};
import testcases_eq from './testdata/testcases_eq.json' assert {type: 'json'};
import testcases_and from './testdata/testcases_and.json' assert {type: 'json'};
import testcases_or from './testdata/testcases_or.json' assert {type: 'json'};
import testcases_xor from './testdata/testcases_xor.json' assert {type: 'json'};
import testcases_byte from './testdata/testcases_byte.json' assert {type: 'json'};
import testcases_shl from './testdata/testcases_shl.json' assert {type: 'json'};
import testcases_shr from './testdata/testcases_shr.json' assert {type: 'json'};
import testcases_sar from './testdata/testcases_sar.json' assert {type: 'json'};


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
      functions.get(0x01)(RunState) // Y + X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})

describe("0x02 MUL function", () => {
  testcases_mul.forEach(({ X, Y, Expected }) => {
    it("should multiply two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x02)(RunState) // Y * X
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
describe("0x04 DIV function", () => {
  testcases_div.forEach(({ X, Y, Expected }) => {
    it("should divide two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x04)(RunState) // Y / X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x05 SDIV function", () => {
  testcases_sdiv.forEach(({ X, Y, Expected }) => {
    it("should divide two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x05)(RunState) // Y / X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x06 MOD function", () => {
  testcases_mod.forEach(({ X, Y, Expected }) => {
    it("should mod two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x06)(RunState) // Y % X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x07 SMOD function", () => {
  testcases_smod.forEach(({ X, Y, Expected }) => {
    it("should mod two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x07)(RunState) // Y % X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x0A EXP function", () => {
  testcases_exp.forEach(({ X, Y, Expected }) => {
    it("should exponentiate two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x0A)(RunState) // Y ** X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x0B SIGNEXTEND function", () => {
  testcases_signext.forEach(({ X, Y, Expected }) => {
    it("should sign extend a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x0B)(RunState)
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x10 LT function", () => {
  testcases_lt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x10)(RunState) // Y < X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x11 GT function", () => {
  testcases_gt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x11)(RunState) // Y > X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x12 SLT function", () => {
  testcases_slt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x12)(RunState) // Y < X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x13 SGT function", () => {
  testcases_sgt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x13)(RunState) // Y > X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x14 EQ function", () => {
  testcases_eq.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x14)(RunState) // Y == X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x16 AND function", () => {
  testcases_and.forEach(({ X, Y, Expected }) => {
    it("should and two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x16)(RunState) // Y & X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x17 OR function", () => {
  testcases_or.forEach(({ X, Y, Expected }) => {
    it("should or two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x17)(RunState) // Y | X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x18 XOR function", () => {
  testcases_xor.forEach(({ X, Y, Expected }) => {
    it("should xor two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x18)(RunState) // Y ^ X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1A BYTE function", () => {
  testcases_byte.forEach(({ X, Y, Expected }) => {
    it("should get a byte from a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x1A)(RunState)
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1B SHL function", () => {
  testcases_shl.forEach(({ X, Y, Expected }) => {
    it("should shift left a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      functions.get(0x1B)(RunState) // Y << X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})