pragma circom 2.1.6;

template Load () {
    signal input in[64];
    signal output out[64] <== in;
}