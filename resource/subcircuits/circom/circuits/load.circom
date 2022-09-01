pragma circom 2.0.5;

template Load () {
    signal input in[70];
    signal output out[70];

    for (var i = 0; i < 70; i++){
      out[i] <== in[i];
    }
}