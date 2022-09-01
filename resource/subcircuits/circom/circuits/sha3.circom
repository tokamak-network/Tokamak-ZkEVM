pragma circom 2.0.5;

// Dummy circuit
template SHA3 () {
    signal input in[2];
    signal output out;

    out <-- 1;
    for (var i=0; i<2; i++){
        out * (in[i] - in[i]) === 0;
    }
    
}