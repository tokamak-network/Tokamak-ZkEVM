

export function hexToInteger(hex) {
  return parseInt(hex, 16);
}  

export function decimalToHex(d) {
  let hex = Number(d).toString(16)
  let padding = 2
  while (hex.length < padding) {
    hex = "0" + hex
  }
  return hex
}

export function pop_stack (stack_pt, d) {
  return stack_pt.slice(d)
}