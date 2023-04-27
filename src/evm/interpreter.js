import { MAX_UINT64, bigIntToHex, bufferToBigInt, intToHex } from '@ethereumjs/util'
import { Memory } from './memory.js'
import { Stack } from './stack.js'
import { EvmError, ERROR } from './exceptions.js'
export class Interpreter {
  _vm
  _runState
  _evm
  _env
  _eei
  _common

  _result

  constructor(evm, eei, env, gasLeft) {
    this._evm = evm
    this._eei = eei
    this._common = this._evm._common
    this._runState = {
      programCounter: 0,
      opCode: 0xfe, // INVALID opcode
      memory: new Memory(),
      memoryWordCount: BigInt(0),
      highestMemCost: BigInt(0),
      stack: new Stack(),
      returnStack: new Stack(1023), // 1023 return stack height limit per EIP 2315 spec
      code: Buffer.alloc(0),
      validJumps: Uint8Array.from([]),
      eei: this._eei,
      env,
      shouldDoJumpAnalysis: true,
      interpreter: this,
      gasRefund: env.gasRefund,
      gasLeft,
      returnBuffer: Buffer.alloc(0),
    }
    this._env = env
    this._result = {
      logs: [],
      returnValue: undefined,
      selfdestruct: {},
    }
  }

  async run(code, opts = {}) {
    console.log('code', code)
    if (!this._common.isActivatedEIP(3540) || code[0] !== EOF.FORMAT) {
      // EIP-3540 isn't active and first byte is not 0xEF - treat as legacy bytecode
      this._runState.code = code
    } else if (this._common.isActivatedEIP(3540)) {
      if (code[1] !== EOF.MAGIC) {
        // Bytecode contains invalid EOF magic byte
        return {
          runState: this._runState,
          exceptionError: new EvmError(ERROR.INVALID_BYTECODE_RESULT),
        }
      }
      if (code[2] !== EOF.VERSION) {
        // Bytecode contains invalid EOF version number
        return {
          runState: this._runState,
          exceptionError: new EvmError(ERROR.INVALID_EOF_FORMAT),
        }
      }
      // Code is EOF1 format
      const codeSections = EOF.codeAnalysis(code)
      console.log('codeSections', codeSections)
      if (!codeSections) {
        // Code is invalid EOF1 format if `codeSections` is falsy
        return {
          runState: this._runState,
          exceptionError: new EvmError(ERROR.INVALID_EOF_FORMAT),
        }
      }

      if (codeSections.data) {
        // Set code to EOF container code section which starts at byte position 10 if data section is present
        this._runState.code = code.slice(10, 10 + codeSections.code)
      } else {
        // Set code to EOF container code section which starts at byte position 7 if no data section is present
        this._runState.code = code.slice(7, 7 + codeSections.code)
      }
    }
    console.log(opts.pc)
    this._runState.programCounter = opts.pc ?? this._runState.programCounter
    // Check that the programCounter is in range
    const pc = this._runState.programCounter
    console.log('pc', pc)
    if (pc !== 0 && (pc < 0 || pc >= this._runState.code.length)) {
      throw new Error('Internal error: program counter not in range')
    }

    let err
    // Iterate through the given ops until something breaks or we hit STOP
    while (this._runState.programCounter < this._runState.code.length) {
      // _runState.code = code <- parameter
      const opCode = this._runState.code[this._runState.programCounter] // Buffer.alloc(0), Buffer[counter]
      // Buffer[index] -> 단일 옵코드? / Buffer로 받는 이유는 pc 관리를 용이하게 하기위함인듯
      if (
        this._runState.shouldDoJumpAnalysis &&
        (opCode === 0x56 || opCode === 0x57 || opCode === 0x5e)
      ) {
        // Only run the jump destination analysis if `code` actually contains a JUMP/JUMPI/JUMPSUB opcode
        this._runState.validJumps = this._getValidJumpDests(this._runState.code)
        this._runState.shouldDoJumpAnalysis = false
      }
      // runStep에서 사용할 옵코드 입력
      this._runState.opCode = opCode

      try {
        await this.runStep()
      } catch (e) {
        // re-throw on non-VM errors
        if (!('errorType' in e && e.errorType === 'EvmError')) {
          throw e
        }
        // STOP is not an exception
        if (e.error !== ERROR.STOP) {
          err = e
        }
        break
      }
    }

    return {
      runState: this._runState,
      exceptionError: err,
    }
  }

  /**
   * Executes the opcode to which the program counter is pointing,
   * reducing its base gas cost, and increments the program counter.
   */
   async runStep() {
    const opInfo = this.lookupOpInfo(this._runState.opCode)

    let gas = BigInt(opInfo.fee)
    // clone the gas limit; call opcodes can add stipend,
    // which makes it seem like the gas left increases
    const gasLimitClone = this.getGasLeft()

    // if (opInfo.dynamicGas) {
    //   const dynamicGasHandler = this._evm._dynamicGasHandlers.get(this._runState.opCode)
    //   // This function updates the gas in-place.
    //   // It needs the base fee, for correct gas limit calculation for the CALL opcodes
    //   gas = await dynamicGasHandler(this._runState, gas, this._common)
    // }

    // if (this._evm.events.listenerCount('step') > 0 || this._evm.DEBUG) {
    //   // Only run this stepHook function if there is an event listener (e.g. test runner)
    //   // or if the vm is running in debug mode (to display opcode debug logs)
    //   await this._runStepHook(gas, gasLimitClone)
    // }

    // Check for invalid opcode
    if (opInfo.name === 'INVALID') {
      throw new EvmError(ERROR.INVALID_OPCODE)
    }

    // Reduce opcode's base fee
    // this.useGas(gas, `${opInfo.name} fee`)
    // Advance program counter
    this._runState.programCounter++

    // Execute opcode handler
    const opFn = this.getOpHandler(opInfo)

    if (opInfo.isAsync) {
      await (opFn).apply(null, [this._runState, this._common])
    } else {
      opFn.apply(null, [this._runState, this._common])
    }
  }
    /**
   * Get the handler function for an opcode.
   */
     getOpHandler(opInfo) {
      return this._evm._handlers.get(opInfo.code)
    }
  
    /**
     * Get info for an opcode from EVM's list of opcodes.
     */
    lookupOpInfo(op) {
      // if not found, return 0xfe: INVALID
      return this._evm._opcodes.get(op) ?? this._evm._opcodes.get(0xfe)
    }

    getGasLeft() {
      return this._runState.gasLeft
    }
}

