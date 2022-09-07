function oplist_out=wire_mapping(op, stack_pt, d, a)
global oplist op_pointer
oplist(1).opcode='fff';
% Dividing SHR into SHR-H(high) and SHR-L(low)
if strcmp(op, '1c')
    % assumption that inputs from other opcodes' outputs always result in SHR-L
    digitsOld = digits(77);
    target_val = eval_EVM(stack_pt(2,:));
    threshold = vpa(2^248); % 31 bytes precision
    flag=double(target_val < threshold);
    digits(digitsOld);
    shiftamount = eval_EVM(stack_pt(1,:));
    if flag
        op='1c1';
    elseif ~flag && shiftamount>=8
        op='1c2';
    else
        error('SHR: high target value but small shift amount');
    end
end
for i=1:d
    if stack_pt(i,1)==0
        data=stack_pt(i,:);
        if i==2 && (strcmp(op, '1c1') || strcmp(op, '1c2'))
            % if SHR-L, read lowest 31 bytes, and if SHR-R, read highest 31 bytes
            original_bytelength=data(3);
            data(3) = min(31, original_bytelength);
            if strcmp(op, '1c1')
                data(1) = data(1) + max(original_bytelength-data(3),0); % shift offset
            end
        end
        if isempty(oplist(1).pt_outputs)
            checks=0;
        else
            checks=ismember(oplist(1).pt_outputs,data,'rows');
        end
        if sum(checks)==0
            oplist(1).pt_outputs=[oplist(1).pt_outputs; data];
            stack_pt(i,:)=[1 size(oplist(1).pt_outputs,1) 32];
        else
            stack_pt(i,:)=[1 find(checks==1) 32];
        end
        if strcmp(op, '20')
            stack_pt(i,3) = data(3);
        end
    end
end

oplist(op_pointer).opcode=op;
oplist(op_pointer).pt_inputs=[oplist(op_pointer).pt_inputs; stack_pt(1:d,:)];
oplist(op_pointer).pt_outputs=[ones(a,1)*op_pointer (1:a).' ones(a,1)*32];
oplist_out=oplist;
end

