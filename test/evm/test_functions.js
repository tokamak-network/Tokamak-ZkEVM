import { assert } from 'chai';
import { Stack } from '../../src/evms/stack.js';
import { Memory } from "../../src/evms/memory.js";
import { handlers } from '../../src/evms/functions.js';

import { default as testcases_add     } from './testdata/testcases_add.js';
import { default as testcases_mul     } from './testdata/testcases_mul.js';
import { default as testcases_sub     } from './testdata/testcases_sub.js';
import { default as testcases_div     } from './testdata/testcases_div.js';
import { default as testcases_sdiv    } from './testdata/testcases_sdiv.js';
import { default as testcases_mod     } from './testdata/testcases_mod.js';
import { default as testcases_smod    } from './testdata/testcases_smod.js';
import { default as testcases_exp     } from './testdata/testcases_exp.js';
import { default as testcases_signext } from './testdata/testcases_signext.js';
import { default as testcases_lt      } from './testdata/testcases_lt.js';
import { default as testcases_gt      } from './testdata/testcases_gt.js';
import { default as testcases_slt     } from './testdata/testcases_slt.js';
import { default as testcases_sgt     } from './testdata/testcases_sgt.js';
import { default as testcases_eq      } from './testdata/testcases_eq.js';
import { default as testcases_and     } from './testdata/testcases_and.js';
import { default as testcases_or      } from './testdata/testcases_or.js';
import { default as testcases_xor     } from './testdata/testcases_xor.js';
import { default as testcases_byte    } from './testdata/testcases_byte.js';
import { default as testcases_shl     } from './testdata/testcases_shl.js';
import { default as testcases_shr     } from './testdata/testcases_shr.js';
import { default as testcases_sar     } from './testdata/testcases_sar.js';


const RunState = {
  opcode: 0x00,
  programCounter: -1,
  stack: new Stack(),
  memory: new Memory(),
  code: [],
}

describe("0x01 ADD function", () => {
  testcases_add.forEach(({ X, Y, Expected }) => {
    it("should add two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x01)(RunState) // Y + X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})

describe("0x02 MUL function", () => {
  testcases_mul.forEach(({ X, Y, Expected }) => {
    it("should multiply two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x02)(RunState) // Y * X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    }) 
  })
})

describe("0x03 SUB function", () => {
  testcases_sub.forEach(({ X, Y, Expected }) => {
    it("should subtract two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x03)(RunState) // Y - X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x04 DIV function", () => {
  testcases_div.forEach(({ X, Y, Expected }) => {
    it("should divide two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x04)(RunState) // Y / X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x05 SDIV function", () => {
  testcases_sdiv.forEach(({ X, Y, Expected }) => {
    it("should divide two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x05)(RunState) // Y / X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x06 MOD function", () => {
  testcases_mod.forEach(({ X, Y, Expected }) => {
    it("should mod two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x06)(RunState) // Y % X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x07 SMOD function", () => {
  testcases_smod.forEach(({ X, Y, Expected }) => {
    it("should mod two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x07)(RunState) // Y % X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x0A EXP function", () => {
  testcases_exp.forEach(({ X, Y, Expected }) => {
    it("should exponentiate two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x0A)(RunState) // Y ** X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x0B SIGNEXTEND function", () => {
  testcases_signext.forEach(({ X, Y, Expected }) => {
    it("should sign extend a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x0B)(RunState)
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x10 LT function", () => {
  testcases_lt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x10)(RunState) // Y < X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x11 GT function", () => {
  testcases_gt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x11)(RunState) // Y > X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x12 SLT function", () => {
  testcases_slt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x12)(RunState) // Y < X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x13 SGT function", () => {
  testcases_sgt.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x13)(RunState) // Y > X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x14 EQ function", () => {
  testcases_eq.forEach(({ X, Y, Expected }) => {
    it("should compare two numbers", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x14)(RunState) // Y == X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x16 AND function", () => {
  testcases_and.forEach(({ X, Y, Expected }) => {
    it("should and two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x16)(RunState) // Y & X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x17 OR function", () => {
  testcases_or.forEach(({ X, Y, Expected }) => {
    it("should or two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x17)(RunState) // Y | X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x18 XOR function", () => {
  testcases_xor.forEach(({ X, Y, Expected }) => {
    it("should xor two numbers in bitwise", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x18)(RunState) // Y ^ X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1A BYTE function", () => {
  testcases_byte.forEach(({ X, Y, Expected }) => {
    it("should get a byte from a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x1A)(RunState)
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1B SHL function", () => {
  testcases_shl.forEach(({ X, Y, Expected }) => {
    it("should shift left a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x1B)(RunState) // Y << X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1C SHR function", () => {
  testcases_shr.forEach(({ X, Y, Expected }) => {
    it("should shift right a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x1C)(RunState) // Y >> X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe("0x1D SAR function", () => {
  testcases_sar.forEach(({ X, Y, Expected }) => {
    it("should shift right a number", () => {
      RunState.stack.push(BigInt('0x' + X))
      RunState.stack.push(BigInt('0x' + Y))
      handlers.get(0x1D)(RunState) // Y >> X
      assert.equal(RunState.stack.pop(), BigInt('0x' + Expected))
    })
  })
})
describe('0x51 MLOAD function', () => {
  it('should load a word from memory', () => {
    const memory = new Memory();
    memory.write(32 - 3, 3, Buffer.from([1, 2, 3]));
    RunState.memory = memory;
    RunState.stack.push(BigInt(0));
    handlers.get(0x51)(RunState);
    assert.equal(RunState.stack.pop(), BigInt('0x010203'));
  });
  it('should load a word from memory', () => {
    const memory = new Memory();
    memory.write(
      64 - 10, 10, 
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    );
    RunState.memory = memory;
    RunState.stack.push(BigInt(32));
    handlers.get(0x51)(RunState);
    assert.equal(RunState.stack.pop(), BigInt('0x0102030405060708090A'));
  });
});
describe('0x52 MSTORE function', () => {
  it('should store a word to memory', () => {
    RunState.memory = new Memory();
    RunState.stack.push(BigInt('0x010203'));
    RunState.stack.push(BigInt(0));
    handlers.get(0x52)(RunState);
    assert.equal(
      RunState.memory.read(32 - 3, 3).toString('hex'), 
      '010203'
    );
  });
  it('should store a word to memory', () => {
    RunState.memory = new Memory();
    RunState.stack.push(BigInt('0x0102030405060708'));
    RunState.stack.push(BigInt(32));
    handlers.get(0x52)(RunState);
    assert.equal(
      RunState.memory.read(64 - 8, 8).toString('hex'), 
      '0102030405060708'
    );
  });
});