pragma circom 2.1.6;

// Dummy circuit: rather verify sha3 outside of circuits since proving sha3 overhead is humongous.
template SHA3 () {
    signal input in[4];
    signal output out[2];

    out <-- [1,1];
    for (var i=0; i<2; i++){
        out[i] * (in[i] - in[i]) === 0;
    }
}