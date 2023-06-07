import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EVM } from '../evm.js'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import { EEI } from '@ethereumjs/vm'
import { Decoder } from '../../decode.js'
import { decodes } from '../decoder.js'


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

  decoder.runCode(
    // Buffer.from(code.join(''), 'hex'),          1c                       
    Buffer.from('608060405260043610601c5760003560e01c', 'hex')
  //Buffer.from('608060405260043610601c5760003560e01c806373ffd5b7146021575b600080fd5b60376004803603810190603391906095565b6039565b005b3373ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f19350505050158015607e573d6000803e3d6000fd5b5050565b600081359050608f8160cc565b92915050565b60006020828403121560a85760a760c7565b5b600060b4848285016082565b91505092915050565b6000819050919050565b600080fd5b60d38160bd565b811460dd57600080fd5b5056fea2646970667358221220636baf301ef7dcfbad4a06503059606cddffb049b12f23eef7f26f8899149d7d64736f6c63430008070033', 'hex')
  //                                                                                                                            1
  )
  
  // decodes({
  //   // code: Buffer.from(code.join('') ,'hex'),
  //   code: Buffer.from('6000546000540a6003549006806000526002540a60035490066004556001546002540a60035490066000540260016003540303600160035403900660016003540360005106016001600354039006806005556020526040602060006040522060605260206060f3', 'hex'),
  //   pc: 0
  // })
    

}

void main()
