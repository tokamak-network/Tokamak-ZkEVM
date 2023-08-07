import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EVM } from '../evm.js'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import { EEI } from '@ethereumjs/vm'
import { Decoder } from '../../decode.js'
// import { config } from '../../../resource/circuits/erc20_transfer/config.json' 
import { Buffer } from 'node:buffer';
import fs from 'fs'

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
  const path = '/Users/hwangjaeseung/workspace/zkp/UniGro16js/resource/circuits/erc20_approve'
  
  const json = fs.readFileSync(`${path}/config.json`, 'utf8')
  const jsonData = JSON.parse(json);
  const {
    config,
    code
  } = jsonData
  evm.events.on('step', function (data) {
    // Note that data.stack is not immutable, i.e. it is a reference to the vm's internal stack object
    console.log(`Opcode: ${data.opcode.name}\tStack: ${data.stack}`)
  })

  decoder.runCode(
    Buffer.from(code.join(''), 'hex'),
    config,
    path
  )
}

void main()
