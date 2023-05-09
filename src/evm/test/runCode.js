import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EVM } from '../evm.js'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import { EEI } from '@ethereumjs/vm'
import { Decoder } from '../../decode.js'

const main = async () => {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
  const stateManager = new DefaultStateManager()
  const blockchain = await Blockchain.create()
  const eei = new EEI(stateManager, common, blockchain)

  const evm = new EVM({
    common,
    eei,
  })

  const decoder = new Decoder({})

  const STOP = '00'
  const ADD = '01'
const JUMP = '56'
const JUMPDEST = '5b'
const PUSH1 = '60'
  

  // Note that numbers added are hex values, so '20' would be '32' as decimal e.g.
  const code = [PUSH1, '03', PUSH1, '05', ADD, STOP]

  evm.events.on('step', function (data) {
    // Note that data.stack is not immutable, i.e. it is a reference to the vm's internal stack object
    console.log(`Opcode: ${data.opcode.name}\tStack: ${data.stack}`)
  })
  // evm.runCode({
  //   code: Buffer.from(code.join(''), 'hex'),
  //   gasLimit: BigInt(0xffff),
  // }).then((results) => {
  //   console.log(`Returned: ${results.returnValue.toString('hex')}`)
  //   console.log(`gasUsed: ${results.executionGasUsed.toString()}`)
  // })
  // .catch(console.error)

  // sload에선 문제없음 스택에 뭔가가 남는 문제 확인
  decoder.runCode(
    // Buffer.from(code.join(''), 'hex'),
    Buffer.from('6000546000540a6003549006806000526002540a60035490066004556001546002540a60035490066000540260016003540303600160035403900660016003540360005106016001600354039006806005556020526040602060006040522060605260206060f3', 'hex')
  //Buffer.from('6000546000540a6003549006806000526002540a60035490066004556001546002540a60035490066000540260016003540303600160035403900660016003540360005106016001600354039006806005556020526040602060006040522060605260206060f3', 'hex')
  //                                                                                                                            1
  )
  
    

}

void main()
