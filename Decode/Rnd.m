function Ap = Rnd(A,ir)
%State array (A) is input and round index (ir). This function executes each
%transformation in the proper sequence. This function is executed several
%times from the KECCAK function for proper permutation.
Ap=iota(chi(pI(rho(theta(A)))),ir);
end