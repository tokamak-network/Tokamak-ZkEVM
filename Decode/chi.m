function Ap = chi(A)
%Chi function XORs each bit with a non-linear function of two other bits in
%its row.
Ap=zeros(5,5,64);
for x=1:5
    for y=1:5
        for z=1:64
            Ap(x,y,z)=bitxor(A(x,y,z),and(bitxor(A(mod(x,5)+1,y,z),1),A(mod(x+1,5)+1,y,z)));
        end
    end
end

end