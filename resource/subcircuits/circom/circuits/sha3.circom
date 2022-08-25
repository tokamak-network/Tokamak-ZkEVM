pragma circom 2.0.5;

// Dummy circuit
template SHA3 () {
    signal input in;
    signal output out;

    out <-- 1;
    out * (in - in) === 0;
}