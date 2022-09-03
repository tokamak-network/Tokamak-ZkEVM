function Ap = theta(A)
%Theta function XORs each bit in the state array with the parities of two
%columns in the array.
C=zeros(5,64);
D=zeros(5,64);
Ap=zeros(5,5,64);
for x=1:5
    for z=1:64
        C(x,z)=bitxor(bitxor(bitxor(bitxor(A(x,1,z),A(x,2,z)),A(x,3,z)),A(x,4,z)),A(x,5,z));
    end
end
for x=1:5
    for z=1:64
        D(x,z)=bitxor(C(mod(x-2,5)+1,z),C(mod(x,5)+1,mod(z-2,64)+1));
    end
end    
for x=1:5
    for y=1:5
        for z=1:64
            Ap(x,y,z)=bitxor(A(x,y,z),D(x,z));
        end
    end
end
end