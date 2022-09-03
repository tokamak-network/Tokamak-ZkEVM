function Ap = rho(A)
%Rho function rotates the bits of each lane by a length (offset), which
%depends on the fixed x and y corrdinates of the lane.
Ap=zeros(5,5,64);
Ap(1, 1, :) = A(1, 1, :); 
x=1;
y=0;
for t=0:23
    for z=0:63
        Ap(x+1,y+1,z+1)=A(x+1,y+1,mod((z-(t+1)*(t+2)/2),64)+1);
    end
    temp=y;
    y=mod(2*x+3*y,5);
    x=temp;
end
end