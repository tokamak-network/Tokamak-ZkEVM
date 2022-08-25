import chai from 'chai'
const assert = chai.assert

import Polfield from '../src/uni_polfield.js'

describe('polfield', function () {

  let polfield;
  before (async () => {
    polfield = new Polfield(5)
  })
  it('MUL', async () => {
    const A = [
      [3,0,2,0,0,0],
      [4,0,1,0,0,0],
      [0,4,0,1,0,0],
      [0,1,0,0,0,0],
      [0,3,0,0,0,0],
      [0,0,3,0,0,0]
    ]
    const B = [
      [4,0,1,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,3,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0]
    ];
    const C = [
      [2,0,1,0,2,0,0,0,0],
      [1,0,3,0,1,0,0,0,0],
      [0,0,0,3,0,1,0,0,0],
      [0,1,0,2,0,0,0,0,0],
      [0,2,0,6,0,0,0,0,0], 
      [0,0,4,0,3,3,0,0,0], 
      [0,0,3,0,0,0,0,0,0], 
      [0,0,4,0,0,0,0,0,0], 
      [0,0,0,4,0,0,0,0,0]
    ];

    assert(polfield.uniMul(A, B) === C)
    console.log(polfield.modMul(4, 7))
  })
})
