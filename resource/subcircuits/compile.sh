names=("load" "add" "mul" "sub" "div" "sdiv" "mod" "smod" "addmod" "mulmod" "exp" "lt" "gt" "slt" "sgt" "eq" "iszero" "and" "or" "xor" "not" "shl" "shr_l" "shr_r" "sar" "sha3")

for (( i = 0 ; i < ${#names[@]} ; i++ )) ; do
  echo "id[$i] = ${names[$i]}"
  circom circom/${names[$i]}_test.circom --r1cs -o r1cs && \
  mv r1cs/${names[$i]}_test.r1cs r1cs/subcircuit$i.r1cs

  circom circom/${names[$i]}_test.circom --wasm -o wasm && \
  mv wasm/${names[$i]}_test_js/${names[$i]}_test.wasm wasm/subcircuit$i.wasm
  rm -rf wasm/${names[$i]}_test_js
done