// Suppose degree of polynomial A > degree of polynomial B

import * as curves from "./curves.js"

export default class Polfield {

    // const curve = await curves.getCurveFromName("bn128");
    // const Fr = curve.Fr;

    constructor (prime) {
        this.p = prime;
    }
    // make size of two arrays equal; max polynomial degree
    // TODO: pass by reference to pass by value
    synSqr(_A, _B) {
        const A = _A.slice(0);
        const B = _B.slice(0);
        const ax = A.length;
        const bx = B.length;
        const ay = A[0].length;
        const by = B[0].length;

        const n = Math.max(ax, bx, ay, by);

        for (var i = 0; i < n; i++) {
            if (A[i] != undefined) {
            }
            else {
                A.push([0]);
            }

            if (B[i] != undefined) {
            }
            else {
                B.push([0]);
            }

            for (var j = 0; j < n; j++) {
                if (A[i][j] != undefined) {
                }
                else {
                    A[i].push(0);
                }
    
                if (B[i][j] != undefined) {
                }
                else {
                    B[i].push(0);
                }
            }
        }
        return {A, B};
    }

    synSqr2(_A, _B) {
        const A = _A.slice(0);
        const B = _B.slice(0);
        const ax = A.length;
        const bx = B.length;
        const ay = A[0].length;
        const by = B[0].length;

        const n = Math.max(ax + bx, ay + by);

        for (var i = 0; i < n; i++) {
            if (A[i] != undefined) {
            }
            else {
                A.push([0]);
            }

            if (B[i] != undefined) {
            }
            else {
                B.push([0]);
            }

            for (var j = 0; j < n; j++) {
                if (A[i][j] != undefined) {
                }
                else {
                    A[i].push(0);
                }
    
                if (B[i][j] != undefined) {
                }
                else {
                    B[i].push(0);
                }
            }
        }
        return {A, B};
    }

    _mdegFind(_A) {
        for (var i = _A.length - 1; i >= 0; i--) {
            for (var j = _A[i].length - 1; j >= 0; j--) {
                if (_A[i][j] !== 0) {
                    return [_A[i][j], i, j]; // coefficient in A at max degree, max degree of x in A, max degree of y in A
                }
            }
        }
        return;
    }

    // Find max degree of A and B; also coefficients of them
    mdegFind(_A, _B) {
        const {A, B} = this.synSqr(_A, _B);
        const mdeg = [];
        mdeg.push(this._mdegFind(A))
        mdeg.push(this._mdegFind(B))
        return mdeg; // [[A coeff, deg.x, deg.y],[B coeff, deg.x, deg.y]]
    }

    modAdd(a, b) {
        return (a + b) % this.p;
    }

    modSub(a, b) {
        return (a - b) % this.p;
    }

    modMul(a, b) {
        return (a * b) % this.p;
    }

    modDiv(a, b) {
        return (a * (b ** (this.p - 2))) % this.p;
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
        const {A, B} = this.synSqr2(_A, _B);
        
        // prepare for result array in a size of mL(max degree of bivariate polynomial)
        const mL = Math.max((A.length + B.length), (A[0].length + B[0].length));

        // const zeroArr = new Array(mL).fill(0);
        // const Umul = new Array(mL).fill(zeroArr);
        const Umul = Array.from(Array(mL), () => Array(mL).fill(0));

        // i,j for selecting coefficient in A; k,l for selecting coefficient in B;
        // need to optimize by FFT; n^4
        for (var i = 0; i < A.length; i++) {
            for (var j = 0; j < A[i].length; j++) {
                for (var k = 0; k < B.length; k++) {
                    for (var l = 0; l < B[k].length; l++) {
                        Umul[i + k][j + l] += this.modMul(A[i][j], B[k][l]);
                    }
                }
            }
        }
        return Umul;
    }

    // return monomial quotient of single division
    singleDivQ(_A, _B) {
        // get coefficient, max degree of A and B
        const mdegdiv = this.mdegFind(_A, _B);

        const coefA = mdegdiv[0][0];
        const coefB = mdegdiv[1][0];

        const maxdegA = [mdegdiv[0][1], mdegdiv[0][2]];
        const maxdegB = [mdegdiv[1][1], mdegdiv[1][2]];

        const coefR = this.modDiv(coefA, coefB, this.p); // divide
        const degR = [] // degree; [x,y]
        degR.push(maxdegA[0] - maxdegB[0])
        degR.push(maxdegA[1] - maxdegB[1])

        const sdQ = Array.from(Array(A.length), () => Array(A.length).fill(0));

        sdQ[degR[0]][degR[1]] = coefR;

        return sdQ;

    }

    // return monomial remainder of single division
    singleDivR(_A, _B) {
        return _A - this.uniMul(_B, this.singleDivQ(_A, _B));
    }

    // output final Q, R
    uniDiv(_A, _B) {
        const {A, B} = this.synSqr(_A, _B);

        const A1 = A;
        const B1 = B;

        const Q1 = this.singleDivQ(A, B);
        const R1 = this.singleDivR(A, B);

        while (true) {
            const detR = this.mdegFind(Q1, R1);
            const detB = this.mdegFind(A1, B1);

            if (detR[1][1] < detB[1][1] || detR[1][2] < detB[1][2]) {
                break;
            }
            else {
                Q1 += this.singleDivQ(Q1, B);
                R1 += this.singleDivR(R1, B);
            }
        }
        return Q1;
    }
}

// TEST 1 evaluation
// A = B * Q
// A = 3(x^5)(y^2) + 3(x^4)(y) + 1(x^3)(y) + (x^2)(y^3) + (x)(y^2) + 2(y^2) + 4(x^2)(y) + 4(x) + 3
// const A = [[3,0,2,0,0,0], [4,0,1,0,0,0], [0,4,0,1,0,0], [0,1,0,0,0,0], [0,3,0,0,0,0], [0,0,3,0,0,0]]; // bivariate polynomial 1;

// B = 3(x^3)(y) + (y^2) + 4
// const B = [[4,0,1,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0], [0,3,0,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0]]; // bivariate polynomial 2;

// Q = (x^2)(y) + (x) + 2
// const Q = [[2,0,0,0,0,0], [1,0,0,0,0,0], [0,1,0,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0], [0,0,0,0,0,0]];

// A * B
// const mulAB = [[2,0,1,0,2,0,0,0,0], [1,0,3,0,1,0,0,0,0], [0,0,0,3,0,1,0,0,0], [0,1,0,2,0,0,0,0,0], // 0 ~ 3
            // [0,2,0,6,0,0,0,0,0], [0,0,4,0,3,3,0,0,0], [0,0,3,0,0,0,0,0,0], [0,0,4,0,0,0,0,0,0], [0,0,0,4,0,0,0,0,0]]; // 4 ~ 8

// const p = 5; // mod 5

// TEST 2 time consumption
// n = 2047 --> order of X, s_max 31 --> order of Y
// p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
// 

const A = [
    [3,0,2,0],
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
const polfield = new Polfield(5);
console.log(polfield.uniDiv(C, B))