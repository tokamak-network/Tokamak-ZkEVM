function P = pad(x,m)
%this is the padding function used by the sponge function to establish the
%proper message length such the the message length is an integer multiple
%of the rate (r).
j=mod(-m-2,x);
P=[1,zeros(1,j),1];
end