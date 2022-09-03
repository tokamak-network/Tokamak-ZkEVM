function Ap = iota(A,ir)
%Iota function modifies some of the bits of lane(1,1) in a manner that
%depends on the round idex (ir). The other 24 lanes are not affected.
Ap=A;
RC=zeros(1,64);
for j=0:6
    RC(2^j)=rc(j+7*ir);
end
for z=1:64
    Ap(1,1,z)=bitxor(Ap(1,1,z),RC(z));
end
end