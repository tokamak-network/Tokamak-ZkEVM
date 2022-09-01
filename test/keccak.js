import hash from 'js-sha3'
const { keccak256 } = hash

const input1 = '0x58f8e73c330daffe64653449eb9a999c1162911d5129dd8193c7233d46ade2d5'
const input2 = ''
const expected = '0x2f4efd012f30b85c3b205250c3dad4cd9208919ba8889723a8325ec6826f69e1'
const hashout = keccak256(hexToString(input1.slice(2)+input2.slice(2)));
console.log(`Result: ${hashout}`)
console.log(`Expected: ${expected.slice(2)}`)
console.log(`compare: ${hashout == expected.slice(2)}`)


function hexToString(hex) {
  if (!hex.match(/^[0-9a-fA-F]+$/)) {
    throw new Error('is not a hex string.');
  }
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  var bytes = [];
  for (var n = 0; n < hex.length; n += 2) {
    var code = parseInt(hex.substr(n, 2), 16)
    bytes.push(code);
  }
  return bytes;
}