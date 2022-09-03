function output = eval_EVM(pt)
global oplist codewdata calldepth

op_pointer=pt(1);
wire_pointer=pt(2);
byte_size=pt(3);

digitsOld=digits(77);
if op_pointer==0
    ROM_value=vpa(hd_hex2dec(cell2mat(codewdata(wire_pointer:wire_pointer+byte_size-1))));
    output=ROM_value;
    digits(digitsOld);
    return
end

t_oplist=oplist(op_pointer);
if isempty(t_oplist.outputs)==0
    output=vpa(t_oplist.outputs(wire_pointer));
    digits(digitsOld);
    return
end

op=t_oplist.opcode;

if strcmp(op,'fff')
    new_pt=t_oplist.pt_outputs(wire_pointer,:);
    output=vpa(eval_EVM(new_pt));
else
    inputlen=size(t_oplist.pt_inputs,1);
    inputs=vpa(zeros(1,inputlen));
    pt_inputs=t_oplist.pt_inputs;
    for i=1:inputlen
        inputs(i)=vpa(eval_EVM(pt_inputs(i,:)));
    end
    switch op
        case '15' %iszero
            assert(inputlen==1)
            outputs=vpa(double(inputs==0));
        case '10' %lt: less than
            assert(inputlen==2)
            outputs=vpa(double(inputs(1)<inputs(2)));
        case '11' %gt: greater than
            assert(inputlen==2)
            outputs=vpa(double(inputs(1)>inputs(2)));
        case '14' %equality
            assert(inputlen==2)
            outputs= vpa(double(inputs(1)==inputs(2)));
        case '01' %add
            assert(inputlen==2)
            outputs=vpa(inputs(1)+inputs(2));
        case '02' %mul
            assert(inputlen==2)
            outputs=vpa(inputs(1)*inputs(2));
        case '03' %sub
            assert(inputlen==2)
            outputs=vpa(inputs(1)-inputs(2));
        case '04' %div
            assert(inputlen==2)
            if inputs(1)==0
                outputs=vpa(0);
            else
                outputs=vpa(floor(inputs(1)/inputs(2)));
            end
        case '06' %mod
            assert(inputlen==2)
            if inputs(2) == 0
                outputs = vpa(0);
            else
                outputs = vpa(mod(inputs(1),inputs(2)));
            end
        case '08' %addmod
            assert(inputlen==3)
            if inputs(3)==0
                outputs=vpa(0);
            else
                outputs=vpa(mod(inputs(1)+inputs(2),inputs(3)));
            end
        case '0a' %exp
            assert(inputlen==2)
            outputs=vpa(inputs(1)^inputs(2));
        case '12' %slt: signed less than
            assert(inputlen==2)
            inputlengths=[pt_inputs(1,3) pt_inputs(2,3)];
            bin_input{1}=hd_dec2bin(inputs(1),inputlengths(1)*8);
            bin_input{2}=hd_dec2bin(inputs(2),inputlengths(2)*8);
            signed_inputs=zeros(1,2);
            for i=1:2
                temp=bin_input{i};
                signed_inputs(i)=-hd_bin2dec(temp(1))*2^(inputlengths(i)*8-1)+hd_bin2dec(temp(2:end));
            end
            outputs= vpa(double(signed_inputs(1)<signed_inputs(2)));
        case {'1b', '1c1', '1c2'}
            assert(inputlen==2)
%             inputlength=pt_inputs(2,3);
%             bin_input=hd_dec2bin(inputs(2),inputlength*8);
%             word_bin_input=strcat(hd_dec2bin(0,(32-inputlength)*8),bin_input);
%             switch op
%                 case '1b' %shl: bit left shift
%                     bin_outputs=circshift(word_bin_input,-1*double(inputs(1)));
%                     bin_outputs(end-inputs(1)+1:end)='0';
%                 case '1c1' %shr-L: bit right shift for small number
%                     bin_outputs=circshift(word_bin_input,double(inputs(1)));
%                     bin_outputs(1:inputs(1))='0';
%                 case '1c2' %shr-H: bit right shift for big number
%                     bin_outputs=circshift(word_bin_input,double(inputs(1)-8));
%                     bin_outputs(1:inputs(1))='0';
%             end
%             bb=mat2cell(bin_outputs,1,8*ones(1,32));
%             cc=hd_bin2dec(bb);
%             dd=hd_dec2hex(cc,2);
%             outputs=hd_hex2dec(dd);
            switch op
                case '1b' %shl: bit left shift
                    outputs = vpa(inputs(2)*vpa(2^inputs(1)));
                case '1c1' %shr-L: bit right shift for small number
                    outputs = vpa(floor(inputs(2)/vpa(2^inputs(1))));
                case '1c2' %shr-H: bit right shift for big number
                    outputs = vpa(floor(inputs(2)/vpa(2^(inputs(1)-8))));
            end
        case '16' %and
            assert(inputlen==2)
            bin_input{1} = hd_dec2bin(inputs(1), 253);
            bin_input{2} = hd_dec2bin(inputs(2), 253);
            bin_and_result = replace(num2str((str2num(bin_input{1}.').*str2num(bin_input{2}.')).'), ' ', '');
            outputs=vpa(hd_bin2dec(bin_and_result));
        
        case '17' %or
            assert(inputlen==2)
            bin_input{1} = hd_dec2bin(inputs(1), 253);
            bin_input{2} = hd_dec2bin(inputs(2), 253);
            bin_or_result = replace(num2str(floor(0.5*(str2num(bin_input{1}.')+str2num(bin_input{2}.'))).'), ' ', '');
            outputs = vpa(hd_bin2dec(bin_or_result));
        
        case '19' %not
            assert(inputlen==1)
            bin_input = hd_dec2bin(inputs(1), 253);
            bin_not_result = replace(num2str(mod((str2num(bin_input.')+1),2).'), ' ', '');
            outputs = vpa(hd_bin2dec(bin_not_result));

        case '20'
            input_con = {};
            for i=1:inputlen
                input_con = [input_con {hd_dec2hex(inputs(i),64)}];
            end
            hex_input_con = cell2mat(input_con);
            outputs = hd_hex2dec(SHA3(hex_input_con,256));
        
        case 'f1' %call
            assert(inputlen==9) % 7 stack inputs + 2 environemt inputs
            if inputs(5)==0 %executing nothing
                if inputs(7)==0 %returning nothing
                    if calldepth<1024
                        outputs=vpa(1);
                    end
                end
            else
                digits(digitsOld);
                error('CALL is not implemented yet')
            end
        
        otherwise
            digits(digitsOld);
            error('opcode %s is not defined',op)
            
    end
    outputlen=size(t_oplist.pt_outputs,1);
    pt_outputs=t_oplist.pt_outputs;
    for i=1:outputlen
        pt=pt_outputs(i,:);
        bytes=pt(3);
        outputs(i)=mod(outputs(i),vpa(2^(8*bytes)));
    end
    
    oplist(op_pointer).outputs=outputs.';
    output=outputs(wire_pointer);
    digits(digitsOld);
end
    
    


end

