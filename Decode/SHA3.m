function H = SHA3(N,d)
%N is character array of any length, d is 224, 256, 384, or 512
%Output, H, is hex character array.
%Implimented from SHA-3 Standard: Permutation-Based Hash and
%Extendable-Output Functions (FIPS PUB 202, dated August 2015)
if mod(length(N),2)~=0
    N = strcat('0', N);
end
N2 = mat2cell(N, 1, 2*ones(1,ceil(length(N)/2)));
%N=flip(dec2bin(unicode2native(N,'UTF-8'),8)');%converts message text to binary array
N=flip(dec2bin(hex2dec(N2),8)');
%B=[N(:)'-'0',0,1];%appends 0,1 to message for SHA-3
B=[N(:)'-'0'];%Keccak
Z=SPONGE(B,d);
T=[Z,zeros(1,mod(-d,8))];
H=dec2hex(bin2dec(flip(reshape(char(T+'0'),8,''))'))';%converts binary digest to hex
H=lower(H(:)');%converts digest to lower case
end