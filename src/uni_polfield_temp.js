// Suppose degree of polynomial A > degree of polynomial B

import * as curves from "./curves.js"

export default class Polfield {

    // const curve = await curves.getCurveFromName("bn128");
    // const Fr = curve.Fr;

    constructor (prime) {
        this.p = prime;
    }

    

    

    // term that has maximum degree of x
    _mxdegTx(_A) {
        for (var i = _A.length - 1; i >= 0; i--) {
            for (var j = _A[i].length - 1; j >= 0; j--) {
                if (_A[i][j] !== 0) {
                    return [i, j];
                }
            }
        }
        return [0, 0];
    }

    // Find in vertical direction
    _mxdegTy(_A) {
        for (var j = _A[0].length - 1; j >= 0; j--) {
            for (var i = _A[j].length - 1; i >= 0; i--) {
                if (_A[i][j] !== 0) {
                    return [i, j];
                }
            }
        }
        return [0, 0];
    }

    // return highest degree term in both monovariate
    monoInCo(_A) {
        for (var i = _A.length - 1; i >= 0; i--) {
            if (_A[i] !== 0) {
                return [i, _A[i]];
            }
        }
        return [0, 0]; // index, coeff
    }

    uniInCo(_A) {
        for (var i = _A.length - 1; i >= 0; i--) {
            if (_A[i] !== [0]) {
                return [i, _A[i]];
            }
        }
        return [0, [0]]; // index, coeff
    }

    optAB(_A, _B) {
        const A = _A.slice(0);
        const B = _B.slice(0);

        for (var i = 0; i < A.length; i++) {
            const tempA = this.monoComp(_A[i]);
            A.splice(i, 1, tempA);
        }
        for (var j = 0; j < B.length; j++) {
            const tempB = this.monoComp(_B[j]);
            B.splice(j, 1, tempB);
        }

        return {A, B};
    }

    modAdd(a, b) {
        return ((a + b) % this.p + this.p) % this.p;
    }

    modSub(a, b) {
        return ((a - b) % this.p + this.p) % this.p;
    }

    modMul(a, b) {
        return ((a * b) % this.p + this.p) % this.p;
    }

    modDiv(a, b) {
        return ((a * (b ** (this.p - 2))) % this.p + this.p) % this.p;
    }

    // syn mono array for Add, Sub
    monoSynAS(_A, _B) {
        

        const mxtA = this.monoInCo(_A)[0];
        const mxtB = this.monoInCo(_B)[0];
        const mxtAB = Math.max(mxtA, mxtB);

        const sA = _A.slice(0, mxtA + 1);
        const sB = _B.slice(0, mxtB + 1);


        const diffA = mxtAB - mxtA;
        const diffB = mxtAB - mxtB;

        const fA = Array(diffA).fill(0);
        const fB = Array(diffB).fill(0);

        
        const A = sA.concat(fA);
        const B = sB.concat(fB);
        
        return {A, B};
    }

    monoComp(_A) {
        const mxtA = this.monoInCo(_A)[0];
        const A = _A.slice(0, mxtA + 1);
        return A;
    }

    // syn mono array for Mul
    mMulSize(_A, _B) {
        const mxtA = this.monoInCo(_A)[0];
        const mxtB = this.monoInCo(_B)[0];
        const mxtAB = mxtA + mxtB + 1;
        
        return mxtAB;
    }

    monoAdd(_A, _B) {
        // A + B
        const {A, B} = this.monoSynAS(_A, _B);

        const sizeAB = A.length;
        const mAdd = new Array(sizeAB).fill(0);

        for (var i = 0; i < sizeAB; i++) {
            const addAB = this.modAdd(A[i], B[i]);
            mAdd.splice(i, 1, addAB);
        }
        return this.monoComp(mAdd);
    }

    monoSub(_A, _B) {
        // A - B
        const {A, B} = this.monoSynAS(_A, _B);

        const sizeAB = A.length;
        const mSub = new Array(sizeAB).fill(0);

        for (var i = 0; i < sizeAB; i++) {
            const subAB = this.modSub(A[i], B[i]);
            mSub.splice(i, 1, subAB);
        }
        return this.monoComp(mSub);
    }

    monoMul(_A, _B) {
        // A * B
        const A = this.monoComp(_A);
        const B = this.monoComp(_B);

        const mMul = new Array(this.mMulSize(A, B)).fill(0);

        for (var i = 0; i < A.length; i++) {
            for (var j = 0; j < B.length; j++) {
                const mulAB = this.modMul(A[i], B[j]);
                mMul[i + j] = this.modAdd(mMul[i + j], mulAB);
            }
        }
        return this.monoComp(mMul);
    }

    uniAdd(_A, _B) {
        const {A, B} = this.synSqr(_A, _B)

        const Uadd = [[]];
        for (var i = 0; i < A.length; i++) {
            Uadd[i] = [];
            for (var j = 0; j < A[i].length; j++) {
                Uadd[i].push(this.modAdd(A[i][j], B[i][j]));
                // Uadd[i].push(Fr.add(Fr.e(A[i][j]), Fr.e(B[i][j])))
                // Uadd[i].push(Fr.toObject(Fr.add(Fr.e(A[i][j]), Fr.e(B[i][j]))))
            }
        }
        return Uadd;
    }

    uniSub(_A, _B) {
        const {A, B} = this.synSqr(_A, _B);

        const Usub = [[]];
        for (var i = 0; i < A.length; i++) {
            Usub[i] = [];
            for (var j = 0; j < A[i].length; j++) {
                Usub[i].push(this.modSub(A[i][j], B[i][j]));
            }
        }
        return Usub;
    }

    uniMul(_A, _B) {
        const {A, B} = this.synSqr(_A, _B);

        // max degree of A; [x,y]; index: x - 0, y - 1
        const max_Ax = this._mxdegTx(A)[0];
        const max_Ay = this._mxdegTy(A)[1];
        const max_Bx = this._mxdegTx(B)[0];
        const max_By = this._mxdegTy(B)[1];
        
        // prepare for result array in a size of mL(max degree of bivariate polynomial)
        const mL = Math.max((max_Ax + max_Bx + 1), (max_Ay + max_By + 1));
        //console.log(mL)

        const Umul = Array.from(Array(mL), () => Array(mL).fill(0));

        // i,j for selecting coefficient in A; k,l for selecting coefficient in B;
        // need to optimize by FFT; n^4
        for (var i = 0; i <= max_Ax; i++) {
            for (var j = 0; j <= max_Ay; j++) {
                for (var k = 0; k <= max_Bx; k++) {
                    for (var l = 0; l <= max_By; l++) {
                        Umul[i + k][j + l] = this.modAdd(Umul[i + k][j + l], this.modMul(A[i][j], B[k][l]));
                    }
                }
            }
        }
        return Umul;
    }

    _monoSdivQ(_A, _B) {
        // Quotient; (A / B); hightest term of A >= highest term of B
        let Q;

        const max_A = this.monoInCo(_A)[1];
        const max_B = this.monoInCo(_B)[1];
        const difAB = this.monoInCo(_A)[0] - this.monoInCo(_B)[0];
        Q = [difAB, this.modDiv(max_A, max_B)];

        return Q; // [term, coeff]
    }

    monoSdivQ(_A, _B) {
        const Q = new Array(_A.length).fill(0);
        const inQ = this._monoSdivQ(_A, _B);

        Q.splice(inQ[0], 1, inQ[1]);
        return this.monoComp(Q);
    }

    monoSdivR(_A, _B) {
        // Remainder; (A / B); hightest term of A >= highest term of B
        // A - B * Q
        const BQ = this.monoMul(_B, this.monoSdivQ(_A, _B));
        const R = this.monoSub(_A, BQ);
        return R;
    }

    monoDiv(_A, _B) {
        let R = this.monoSdivR(_A, _B);
        let detR = this.monoInCo(R)[0];
        const detB = this.monoInCo(_B)[0];

        const Q = this.monoSdivQ(_A, _B);


        while (true) {
            if (detR < detB) {
                if (R = [0]) {
                    return Q;
                }
                else {
                    return "remainder";
                }
            }
            else {
                const tempQ = this._monoSdivQ(R, _B); // calculate next slice of a quotient
                Q.splice(tempQ[0], 1, tempQ[1]); // replace 0 with the value
                R = this.monoSdivR(R, _B); // set next remainder with previous remainder
                detR = this.monoInCo(R)[0];
            }
        }
    }

    _uniSdivQ(_A, _B) {
        // Quotient; (A / B); hightest term of A >= highest term of B
        let Q;

        const max_A = this.uniInCo(_A)[1];
        console.log(max_A)
        const max_B = this.uniInCo(_B)[1];
        const difAB = this.uniInCo(_A)[0] - this.uniInCo(_B)[0];
        console.log(difAB)
        console.log(this.monoDiv(max_A, max_B))
        Q = [difAB, this.monoDiv(max_A, max_B)]; // [degree, [polynomial Y]]

        return Q;
    }

    // return monomial quotient of single division

    uniSdivR(_A, _B) {

    }

    // return monomial remainder of single division
    singleDivR(_A, _B) {
        //console.log({_A, _B})
        // A - B * Q = R
        return this.uniSub(_A, this.uniMul(_B, this.biDiv(_A, _B)));
    }

    uniDiv(_A, _B) {

        /*
        A / B -> Q1, R1; singleDivQ, singleDivR
        A -> R1
        Q1

        R1 / B -> Q2, R2
        R1 -> R2
        Q1 + Q2; uniAdd

        ...

        Rn 차수 < B 차수

        return 몫: Q1 + ... + Qn; 나머지: Rn

        */

        let Q = this.biDiv(A, B) // TODO: 2d array index
        let R = this.singleDivR(A, B) // ;;

        while (true) {
            const tempQ = this.biDiv(R, _B)
            R = this.singleDivR(R, _B)
            this.uniAdd(Q, tempQ)

            // TODO: Rn 차수 < B 차수 break
            if (this._mxdegTx(R) > this._mxdegTx(_B) ||
            this._mxdegTy(R) > this._mxdegTy(_B)) break
        }
    }
}

// const p = 5; // mod 5

// TEST 2 time consumption
// n = 2047 --> order of X, s_max 31 --> order of Y
// p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
// 

const A = [
    [3,0,2,0,0],
    [0,0,1,0],
    [0,0,0,0],
    [0,1,0,0],
];
const B = [
    [4,0,1,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
];
//mul
const C = [
    [2,0,1,0,2],
    [0,0,4,0,1],
    [0,0,0,0,0],
    [0,4,0,1,0],
    [0,0,0,0,0],
];

const Z = [
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
]

const B1 = [
    [4,0,1],
    [0],
    [0],
    [0],
];
const C1 = [
    [2,0,1,0,2],
    [0,0,4,0,1],
    [0],
    [0,4,0,1],
    [0],
]; 

const Y = [1,3,3,1];
const D = [1,1];
const polfield = new Polfield(5);
//console.log(polfield.uniMul(A, B))
//console.log(polfield.uniDiv(C, B))
//console.log(polfield.uniSub(C, B))
//console.log(polfield.mdegFind(A, B))

//console.log(polfield.optAB(A, B))
console.log(polfield._uniSdivQ(C1, B1))

//console.log(polfield.uniSub(C, C))

//console.log(polfield._mdegFindx(Z))

//console.log(polfield.biDiv(C, B))
//console.log(polfield.singleDivR(C, B))
//console.log(polfield.uniDiv(C, B))
//console.log(polfield._mdegFindx(C))
//console.log(polfield._mdegFindy(C))
//console.log(polfield.monoSynAS(P, S))
//console.log(polfield.monoSub(P, Q))
//console.log(polfield.monoMul(P, S))
//console.log(polfield.monoSdivQ(P, Q))


