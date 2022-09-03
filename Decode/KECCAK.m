function Sp = KECCAK(S)
A=reshape(reshape(S,[64,25])',[5,5,64]);
%takes binary vector input and converts to state array
for ir=0:23
    A=Rnd(A,ir);%conducts permuting of state array
end
Sp = reshape(permute(A, [3,1,2]), 1, []);
%changes state array back to binary vector
end