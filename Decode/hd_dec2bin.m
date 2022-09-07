function s=hd_dec2bin(d,n)
%DEC2BIN Convert decimal integer to its binary representation
%   DEC2BIN(D) returns the binary representation of D as a character vector.
%   D must be a non-negative integer. If D is greater than flintmax, 
%   DEC2BIN might not return an exact representation of D.
%
%   DEC2BIN(D,N) produces a binary representation with at least
%   N bits.
%
%   Example
%      dec2bin(23) returns '10111'
%
%   See also BIN2DEC, DEC2HEX, DEC2BASE, FLINTMAX.

%   Copyright 1984-2016 The MathWorks, Inc.

%
% Input checking
%
if nargin<1
    narginchk(1,2);
end
if isempty(d)
    s = '';
    return;
end

digitsOld = digits(77);

d = vpa(d(:)); % Make sure d is a column vector.
if any(d < 0) || any(~isfinite(d))
    error(message('MATLAB:dec2bin:MustBeNonNegativeFinite'));
end


if nargin<2
    n=1; % Need at least one digit even for 0.
else
    if ~(isnumeric(n) || ischar(n)) || ~isscalar(n) || n<0
        error(message('MATLAB:dec2bin:InvalidBitArg'));
    end
    n = double(n);
    n = round(n); % Make sure n is an integer.
end

%
% Actual algorithm
%
e=vpa(ceil(log2(max(vpa(d))))); % How many digits do we need to represent the numbers?
s=char(double(rem(floor(vpa(d)*vpa(2.^(1-max(n,e):0))),2))+'0');
digits(digitsOld);
