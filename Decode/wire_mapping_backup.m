function oplist_out=wire_mapping(op, stack_pt, d, a)
global oplist op_pointer
oplist(1).opcode='fff';
for i=1:d
    if stack_pt(i,1)==0
        data=stack_pt(i,:);
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
    end
end

oplist(op_pointer).opcode=op;
if strcmp(op,'1c')
    oplist(op_pointer).pt_inputs=
else
    oplist(op_pointer).pt_inputs=[oplist(op_pointer).pt_inputs; stack_pt(1:d,:)];
end
oplist(op_pointer).pt_outputs=[ones(a,1)*op_pointer (1:a).' ones(a,1)*32];
oplist_out=oplist;
end

