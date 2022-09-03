function Ap = pI(A)
%pI function rearranges the positions of the lanes.
Ap=zeros(5,5,64);
for x=1:5
    for y=1:5
        for z=1:64
            Ap(x,y,z)=A(mod(x+3*y-4,5)+1,x,z);
        end
    end
end
end