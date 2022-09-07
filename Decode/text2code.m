function [code] = text2code(stringfile)
%UNTITLED Summary of this function goes here
%   Detailed explanation goes here
filename = stringfile;
FID = fopen(filename);
dataFromfile = textscan(FID, '%s');% %s for reading string values (hexadecimal numbers)
dataFromfile = dataFromfile{1};
strings = cell2mat(dataFromfile);
fclose(FID);

stringlen=length(strings);
codelen=stringlen/2;
code=cell(1,codelen);
for i=1:codelen
    code{i}=strings((i-1)*2+1:(i-1)*2+2);
end
code=code(2:end);

end

