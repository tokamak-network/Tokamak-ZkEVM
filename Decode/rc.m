function R = rc(t)
%This function is used by the iota function in the transformation of state
%arrays. It returns a single bit.
if mod(t,255)==0
    R=1;
else
    R=[1 0 0 0 0 0 0 0];
    for i=1:mod(t,255)
        R=[0,R];
        R(1)=bitxor(R(1),R(9));
        R(5)=bitxor(R(5),R(9));
        R(6)=bitxor(R(6),R(9));
        R(7)=bitxor(R(7),R(9));
        R=R(1:8);
    end
    R=R(1);
end
end