pragma circom 2.0.5;

template Load () {
    signal input in[16];
    signal output out[16];

    for (var i = 0; i < 16; i++){
      out[i] <== in[i];
    }
}