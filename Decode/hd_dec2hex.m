function h = hd_dec2hex(d,n)
%DEC2HEX Convert decimal integer to its hexadecimal representation
%   DEC2HEX(D) returns a character array where each row is the
%   hexadecimal representation of each decimal integer in D.
%   D must contain non-negative integers. If D contains any 
%   integers greater than flintmax, DEC2HEX might not return 
%   exact representations of those integers.
%
%   DEC2HEX(D,N) produces a character array where each row
%   represents a hexadecimal number with at least N digits.
%
%   Example
%       dec2hex(2748) returns 'ABC'.
%
%   See also HEX2DEC, HEX2NUM, DEC2BIN, DEC2BASE, FLINTMAX.

%   Copyright 1984-2010 The MathWorks, Inc.

narginchk(1,2);
digitsOld = digits(77);


d = vpa(d(:)); % Make sure d is a column vector.

if ~isreal(d) || any(d < 0) || any(d ~= fix(d))
    error(message('MATLAB:dec2hex:FirstArgIsInvalid'))
end

numD = numel(d);

if nargin==1,
    n = 1; % Need at least one digit even for 0.
end

e = vpa(floor(log2(max(d))+1));%#ok
n = max(n,ceil(e/4));
n0 = n;

if numD>1
    n = n*ones(numD,1);
end

bits32 = vpa(2^32);

%For small enough numbers, we can do this the fast way.
if all(d<bits32),
    h = sprintf('%0*x',[n,d]');
else
    %Division acts differently for integers
    ds=vpa(zeros(1,8));
    dnext=vpa(d);
    for i=1:7
        shifting=vpa(bits32^(8-i));
        ds(i)=vpa(floor(vpa(dnext./shifting)));
        dnext=vpa(rem(dnext,shifting));
    end
    ds(8)=vpa(rem(dnext,bits32));
    
%     ds(1:7)=vpa(floor(d./(bits32.^(7:-1:1))),77);
%     ds(end)=vpa(rem(d,(bits32)),77);
    
    h=sprintf('%08x',ds');
    h=h(end-n+1:end);
    
    
%     d1 = vpa(floor(d/bits32),77);
%     d2 = vpa(rem(d,bits32),77);
%     h = sprintf('%0*x%08x',[n-8,d1,d2]');
digits(digitsOld);
end

% h = reshape(h,n0,numD)';
