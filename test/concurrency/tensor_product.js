// 입력 A:  m-by-1 array
// 입력 B: 1-by-n array
// C: empty m-by-n array
// for i=1:n
//    C(: , i) = B(1 , i)*A (: , 1);
// end
// return C
// 여기서 항상 m>n 인거 감안해서 연산량이 더 작은 방법으로 부탁드려요. 

import {A, B} from './data.js'
import { Piscina } from 'piscina'
// console.log(A)


const D=[];
D.push(B);
// console.log(D)

console.time('baseline')
const C = []
// 1. Baseline 
for (var i = 0; i < A.length; i++) {
  C.push(D[0].map(x => A[i][0] * x))
}
//console.log(C)
console.timeEnd('baseline')

console.time('baseline_for')
const E = []
// 1. Baseline 
for (var i = 0; i < A.length; i++) {
  const temprow = [];
  for (var j = 0; j<D[0].length; j++) {
    temprow.push(D[0][j] * A[i][0]);
  }
  E.push(temprow);
  
}
//console.log(E)
console.timeEnd('baseline_for')

console.time('baseline_for_alloc')
let F = new Array(A.length);
// 1. Baseline 
for (var i = 0; i < A.length; i++) {
  let temprow = new Array(D[0].length);
  for (var j = 0; j<D[0].length; j++) {
    temprow[j] = D[0][j] * A[i][0];
  }
  F[i] = temprow;
}
//console.log(F)
console.timeEnd('baseline_for_alloc')

console.time('baseline_for_alloc2')
let G = Array.from(Array(A.length), () => new Array(D[0].length));
// 1. Baseline 
for (var i = 0; i < A.length; i++) {
  for (var j = 0; j<D[0].length; j++) {
    G[i][j] = D[0][j] * A[i][0];
  }
}
//console.log(G)
console.timeEnd('baseline_for_alloc2')

console.time('baseline_conv')
const N1_X = A.length;
const N1_Y = A[0].length;
const N2_X = D.length;
const N2_Y = D[0].length;

const N3_X = N1_X+N2_X-1;
const N3_Y = N1_Y+N2_Y-1;
let res = Array.from(Array(N3_X), () => new Array(N3_Y));
for (var i=0; i<N3_X; i++){
    for (var j=0; j<N3_Y; j++){
        let sum = 0;
        for (var ii=0; ii<=Math.min(i,N1_X-1); ii++){
            for (var jj=0; jj<=Math.min(j,N1_Y-1); jj++){
                if (((i-ii)>=0 && i-ii<N2_X) && ((j-jj)>=0 && j-jj<N2_Y)){
                    let term = A[ii][jj] * D[i-ii][j-jj];
                    sum += term;
                    res[i][j] = sum;
                }
            }
        }
    }
}
console.timeEnd('baseline_conv')

// 2. Worker
console.time('worker')
const pool = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
})
console.time('promise')
const result = await Promise.all([pool.run({A: A.slice(0, A.length / 2), B: B}), pool.run({A: A.slice(A.length / 2), B: B})])
console.timeEnd('promise')
console.timeEnd('worker')