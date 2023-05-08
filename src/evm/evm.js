import {
  Address,
  AsyncEventEmitter,
  KECCAK256_NULL,
  MAX_INTEGER,
  bigIntToBuffer,
  generateAddress,
  generateAddress2,
  short,
  zeros,
} from '@ethereumjs/util'
import { getOpcodesForHF } from './codes.js'
import { Interpreter } from './interpreter.js'

export class EVM {
  // _tx = {
  //   gasPrice,
  //   origin
  // }
  get precompiles() {
    return this._precompiles
  }

  get opcodes() {
    return this._opcodes
  }
  /**
   * EVM async constructor. Creates engine instance and initializes it.
   *
   * @param opts EVM engine constructor options
   */
   static async create(opts) {
    const evm = new this(opts)
    await evm.init()
    return evm
  }

  constructor(opts) {
    this.events = new AsyncEventEmitter()

    this._optsCached = opts

    this.eei = opts.eei

    // this._transientStorage = new TransientStorage()

    if (opts.common) {
      this._common = opts.common
    } else {
      const DEFAULT_CHAIN = Chain.Mainnet
      this._common = new Common({ chain: DEFAULT_CHAIN })
    }

    // Supported EIPs
    // const supportedEIPs = [
    //   1153, 1559, 2315, 2537, 2565, 2718, 2929, 2930, 3074, 3198, 3529, 3540, 3541, 3607, 3651,
    //   3670, 3855, 3860, 4399, 4895, 4844, 5133,
    // ]

    // for (const eip of this._common.eips()) {
    //   if (!supportedEIPs.includes(eip)) {
    //     throw new Error(`EIP-${eip} is not supported by the EVM`)
    //   }
    // }

    // if (!EVM.supportedHardforks.includes(this._common.hardfork())) {
    //   throw new Error(
    //     `Hardfork ${this._common.hardfork()} not set as supported in supportedHardforks`
    //   )
    // }

    this._allowUnlimitedContractSize = opts.allowUnlimitedContractSize ?? false
    this._allowUnlimitedInitCodeSize = opts.allowUnlimitedInitCodeSize ?? false
    this._customOpcodes = opts.customOpcodes
    this._customPrecompiles = opts.customPrecompiles

    this._common.on('hardforkChanged', () => {
      this.getActiveOpcodes()
      this._precompiles = getActivePrecompiles(this._common, this._customPrecompiles)
    })

    // Initialize the opcode data
    this.getActiveOpcodes()
    // this._precompiles = getActivePrecompiles(this._common, this._customPrecompiles)

    if (this._common.isActivatedEIP(2537)) {
      if (isBrowser() === true) {
        throw new Error('EIP-2537 is currently not supported in browsers')
      } else {
        this._mcl = mcl
      }
    }

    // We cache this promisified function as it's called from the main execution loop, and
    // promisifying each time has a huge performance impact.
    this._emit = (topic, data) => (
      promisify(this.events.emit.bind(this.events))
    )

    // Skip DEBUG calls unless 'ethjs' included in environmental DEBUG variables
    this.DEBUG = process?.env?.DEBUG?.includes('ethjs') ?? false
  }

  async init() {
    if (this._isInitialized) {
      return
    }

    if (this._common.isActivatedEIP(2537)) {
      if (isBrowser() === true) {
        throw new Error('EIP-2537 is currently not supported in browsers')
      } else {
        const mcl = this._mcl
        await mclInitPromise // ensure that mcl is initialized.
        mcl.setMapToMode(mcl.IRTF) // set the right map mode; otherwise mapToG2 will return wrong values.
        mcl.verifyOrderG1(1) // subgroup checks for G1
        mcl.verifyOrderG2(1) // subgroup checks for G2
      }
    }

    this._isInitialized = true
  }

  evalEVM (pt) {
    this.getActiveOpcodes()
    const op_pointer = pt[0]
    const wire_pointer = pt[1]
    const byte_size = pt[3]



  }

  getActiveOpcodes() {
    const data = getOpcodesForHF(this._common, this._customOpcodes)
    this._opcodes = data.opcodes
    this._dynamicGasHandlers = data.dynamicGasHandlers
    this._handlers = data.handlers
    return data.opcodes
  }

  async runCode(opts) {
    this._block = opts.block ?? defaultBlock()

    this._tx = {
      gasPrice: opts.gasPrice ?? BigInt(0),
      origin: opts.origin ?? opts.caller ?? Address.zero(),
    }
    const message = {
      code: opts.code,
      data: opts.data,
      gasLimit: opts.gasLimit,
      to: opts.address ?? Address.zero(),
      caller: opts.caller,
      value: opts.value,
      depth: opts.depth,
      selfdestruct: opts.selfdestruct ?? {},
      isStatic: opts.isStatic,
      versionedHashes: opts.versionedHashes,
    }

    // const message = new Message({
    //   code: opts.code,
    //   data: opts.data,
    //   gasLimit: opts.gasLimit,
    //   to: opts.address ?? Address.zero(),
    //   caller: opts.caller,
    //   value: opts.value,
    //   depth: opts.depth,
    //   selfdestruct: opts.selfdestruct ?? {},
    //   isStatic: opts.isStatic,
    //   versionedHashes: opts.versionedHashes,
    // })
    console.log('message', message)
    return this.runInterpreter(message, { pc: opts.pc })
  }

   /**
   * Starts the actual bytecode processing for a CALL or CREATE, providing
   * it with the {@link EEI}.
   */
    async runInterpreter(
      message,
      opts = {}
    ) {
      const env = {
        address: message.to ?? Address.zero(),
        caller: message.caller ?? Address.zero(),
        callData: message.data ?? Buffer.from([0]),
        callValue: message.value ?? BigInt(0),
        code: message.code,
        isStatic: message.isStatic ?? false,
        depth: message.depth ?? 0,
        // gasPrice: this._tx!.gasPrice,
        // origin: this._tx!.origin ?? message.caller ?? Address.zero(),
        block: this._block ?? defaultBlock(),
        contract: await this.eei.getAccount(message.to ?? Address.zero()),
        codeAddress: message.codeAddress,
        gasRefund: message.gasRefund,
        containerCode: message.containerCode,
        versionedHashes: message.versionedHashes ?? [],
      }
      // console.log('this', message.code, opts)
      const interpreter = new Interpreter(this, this.eei, env, message.gasLimit)
      if (message.selfdestruct) {
        interpreter._result.selfdestruct = message.selfdestruct
      }
      // console.log('interpreter',interpreter)
      // opts: program counter
      const interpreterRes = await interpreter.run(message.code, opts)
      console.log('interpreterRes', interpreterRes._result)
      let result = interpreter._result
  
      let gasUsed = message.gasLimit - interpreterRes.runState.gasLeft
      if (interpreterRes.exceptionError) {
        if (
          interpreterRes.exceptionError.error !== ERROR.REVERT &&
          interpreterRes.exceptionError.error !== ERROR.INVALID_EOF_FORMAT
        ) {
          gasUsed = message.gasLimit
        }
  
        // Clear the result on error
        result = {
          ...result,
          logs: [],
          selfdestruct: {},
        }
      }
  
      return {
        ...result,
        runState: {
          ...interpreterRes.runState,
          ...result,
          ...interpreter._env,
        },
        exceptionError: interpreterRes.exceptionError,
        gas: interpreterRes.runState?.gasLeft,
        executionGasUsed: gasUsed,
        gasRefund: interpreterRes.runState.gasRefund,
        returnValue: result.returnValue ? result.returnValue : Buffer.alloc(0),
      }
    }
}

function defaultBlock() {
  return {
    header: {
      number: BigInt(0),
      cliqueSigner: () => Address.zero(),
      coinbase: Address.zero(),
      timestamp: BigInt(0),
      difficulty: BigInt(0),
      prevRandao: zeros(32),
      gasLimit: BigInt(0),
      baseFeePerGas: undefined,
    },
  }
}