function [outputs_pt] = Decode(callcode)
global code oplist set_pushes set_ariths set_dups set_swaps set_logs cjmplist ...
    environ_pts codewdata call_pt calldepth op_pointer cjmp_pointer ...
    set_normalhalt storage_pt callcode_suffix callcode_suffix_pt ...
    callresultlist call_pointer vmTraceStep

pc_pt=environ_pts.pc_pt;
pc_len=environ_pts.pc_len;
Iv_pt=environ_pts.Iv_pt;
Iv_len=environ_pts.Iv_len;
Id_pt=environ_pts.Id_pt;
Id_len=environ_pts.Id_len;
Id_len_info_pt=environ_pts.Id_len_info_pt;
Id_len_info_len=environ_pts.Id_len_info_len;
Is_pt=environ_pts.Is_pt;
Is_len=environ_pts.Is_len;
od_pt=environ_pts.od_pt; %output data
od_len=environ_pts.od_len;
od_len_info_pt=environ_pts.od_len_info_pt;
od_len_info_len=environ_pts.od_len_info_len;
sd_pt=environ_pts.sd_pt; %storage data
sd_len=environ_pts.sd_len;
calldepth_pt=environ_pts.calldepth_pt;
calldepth_len=environ_pts.calldepth_len;
balance_pt=environ_pts.balance_pt; % sigma[I_a]_b
balance_len=environ_pts.balance_len;

codelen=length(callcode);

stack_pt=[]; %format: [op_pointer pt length]
mem_pt=containers.Map('KeyType','uint32','ValueType','any'); %valuetype = [op_pointer pt length]
outputs_pt=[];

pc=0;

while pc<codelen
    pc=pc+1;
    op=callcode{pc};
    display(vmTraceStep)
    display(pc)
    display(op)
    clear d
    clear a
    prev_stack_size=size(stack_pt,1);
    
    switch op
        case set_pushes   %pushes
            d=0;
            a=1;
            
            opnum=hex2dec(op);
            refnum=hex2dec('60'); %push1
            pushlen=opnum-refnum+1;
            stack_pt=[[0 pc+call_pt(calldepth,1) pushlen]; stack_pt];
            pc=pc+pushlen;
        case '50' %pop
            d=1;
            a=0;
            
            stack_pt=pop_stack(stack_pt,d);
        case '51' %mload
            d=1;
            a=1;
            
            addr=double(eval_EVM(stack_pt(1,:))+1);
            stack_pt=pop_stack(stack_pt,d);
            if isKey(mem_pt,addr)==0
                error('invalid memory access at pc %d',pc)
            end
            stack_pt=[mem_pt(addr); stack_pt];
            
        case '52'   %mstore
            d=2;
            a=0;
            
            addr=double(eval_EVM(stack_pt(1,:))+1);
            data=stack_pt(2,:);
            mem_pt(addr)=data;
            %addr=hex2dec(code(stack_pt(1,2):stack_pt(1,2)+stack_pt(1,3)-1));
            %mem_pt=[[{addr:addr+stack_pt(2,3)-1} stack_pt(2,:)];mem_pt];
%             mem_addrs=hex2dec(mem_pt(:,1));
%             [mem_addrs,idx]=sort(mem_addrs);
%             mem_pt=mem_pt(idx,:); %sorting by address
                        
            stack_pt=pop_stack(stack_pt,d);
        case '53' %mstores
            d=2;
            a=0;
            
            addr=double(eval_EVM(stack_pt(1,:))+1);
            data=stack_pt(2,:);
            data(3)=1; %1 byte
            mem_pt(addr)=data;
            
            stack_pt=pop_stack(stack_pt,d);
        case '54' %sload
            d=1;
            a=1;
          
            addr=hd_dec2hex(eval_EVM(stack_pt(1,:)), 64);
            %addr=sd_pt+double(eval_EVM(stack_pt(1,:)));
            stack_pt=pop_stack(stack_pt,d);
            
            if isKey(storage_pt, addr)
                sdata_pt=storage_pt(addr);
            else
                sdata_pt = [0 environ_pts.zero_pt environ_pts.zero_len];
            end
                        
%             if addr+32-1>sd_pt+sd_len-1
%                 error('invalid storage access at pc %d',pc)
%             end
            
            %stack_pt=[[0 addr 32]; stack_pt];
            stack_pt=[sdata_pt; stack_pt];
        case '55' %sstore
            d=2;
            a=0;
            
            addr=hd_dec2hex(eval_EVM(stack_pt(1,:)), 64);
            sdata_pt=stack_pt(2,:);
            stack_pt=pop_stack(stack_pt,d);
            
            storage_pt(addr)=sdata_pt;
        case '33' %caller
            d=0;
            a=1;
            
            stack_pt=[[0 Is_pt Is_len]; stack_pt];
        case '34' %callvalue
            d=0;
            a=1;
            
            stack_pt=[[0 Iv_pt Iv_len]; stack_pt];
        case '35' %calldataload
            d=1;
            a=1;
            offset=double(eval_EVM(stack_pt(1,:)));
            pt=Id_pt+offset;
            chosen_data_len=min(Id_len-offset,32);
            
            stack_pt=pop_stack(stack_pt,d);
            
            if pt>=Id_pt && pt+chosen_data_len-1<=Id_pt+Id_len-1
                stack_pt=[[0 pt chosen_data_len]; stack_pt];
            else
                error('invalid calldata offset at pc %d, op %s',pc,op)
            end
        case '36' %calldatasize
            d=0;
            a=1;
            
            stack_pt=[[0 Id_len_info_pt Id_len_info_len]; stack_pt];
        case '47' %selfbalance
            d=0;
            a=1;
            
            stack_pt=[[0 balance_pt balance_len]; stack_pt];
        case set_dups
            d=1;
            a=2;
            
            opnum=hex2dec(op);
            refnum=hex2dec('80'); %dup1
            target_index=opnum-refnum+1;
            stack_pt=[stack_pt(target_index,:); stack_pt];    
        case set_swaps
            d=0;
            a=0;
            
            opnum=hex2dec(op);
            refnum=hex2dec('90'); %swap1
            target_index=opnum-refnum+1+1;
            temp=stack_pt(1,:);
            stack_pt(1,:)=stack_pt(target_index,:);
            stack_pt(target_index,:)=temp;
        case set_ariths  %arithmetic operations
            switch op
                case {'15', '19'}
                    d=1;
                    a=1;
                    
                case {'10', '1c', '14', '01', '02', '03', '04', '16', '17', '0a', '1b', '12', '11', '06'}
                    d=2;
                    a=1;
                    
                case {'08'}
                    d=3;
                    a=1;
                    
                case '20' % keccak256
                    a=1;
                    
                    addr=double(eval_EVM(stack_pt(1,:))+1);
                    len=double(eval_EVM(stack_pt(2,:)));
                    stack_pt=pop_stack(stack_pt,2);
                    if isKey(mem_pt,addr)==0 || mod(len,32)~=0
                        error('Keccak: invalid memory access at pc %d',pc)
                    end
                    len_left = len;
                    data_lengths=[];
                    target_mem = [];
                    target_addr = addr;
                    while len_left>0
                        target = mem_pt(target_addr);
                        target_mem = [target_mem; target];
                        len_left = len_left - 32;
                        target_addr = target_addr + 32;
                    end
                    d = size(target_mem, 1);
                    stack_pt=[target_mem; stack_pt];
            end
             
            op_pointer=op_pointer+1;
            oplist=wire_mapping(op,stack_pt, d, a);
            
            stack_pt=pop_stack(stack_pt,d); % remove d items from stack
            stack_pt=[oplist(op_pointer).pt_outputs; stack_pt]; %add a items into stack
            if strcmp(op, '20')
                d=2;
            end
        case '56' %jump
            d=1;
            a=0;
            target_pc=double(eval_EVM(stack_pt(1,:)));
            pc=target_pc;
            
            stack_pt=pop_stack(stack_pt,d);
        case '57' %jumpi
%             d=34; % subcircuit has 34 inputs but instruction has 2 inputs: jump dest. and flag
%             a=33; % subcircuit has 33 outputs but nothig is added to stack
%             %output1=input2: flag in stack[1]
%             %output2~17=input3~18: stack[2~17]
%             %output18~33=input19~34: memory

            cjmp_pointer=cjmp_pointer+1;
            
            d=2;
            a=0;
            
            
            target_pc=double(eval_EVM(stack_pt(1,:)));
            condition=double(eval_EVM(stack_pt(2,:)));
            
            cjmplist(cjmp_pointer).pc=pc;
            if condition~=0
                if strcmp(callcode{calldepth,target_pc+1},'5b')
                    pc=target_pc;
                else
                    error('invalid jump destination from pc %d',pc);
                end
            end
            
            cjmplist(cjmp_pointer).pt_inputs=[stack_pt(1,:);stack_pt(2,:)];
            cjmplist(cjmp_pointer).condition=condition;
            cjmplist(cjmp_pointer).destination=target_pc+1;
            
            stack_pt=pop_stack(stack_pt,d);
%             
%             
%             op_pointer=op_pointer+1;
%             data=code2data(code,stack_pt(1,2),stack_pt(1,3));
%             jumpdest=hex2dec(data);
%             if stack_pt(1,1)~=0
%                 error('wrong jump dest')
%             end
%             jump_map=[jump_map;[op_pointer jumpdest]];
%             stack_pt=stack_pt(2:end,:);
%             
%             stack_buffer=stack_pt;
%             if size(stack_buffer,1)<d
%                 stack_buffer=[stack_buffer; zeros(d-size(stack_buffer,1),3)];
%             end
%             oplist=wire_mapping(op_pointer,op, stack_buffer, d, a);
%             stack_pt=stack_pt(2:end,:);

        case '58' %pc
            d=0;
            a=1;
            
            codewdata(pc_pt:pc_pt+pc_len-1)=mat2cell(dec2hex(pc,pc_len*2),1,2*ones(1,pc_len));
            stack_pt=[[0 pc_pt pc_len];stack_pt];
        case '5b' %jumpdestination, do nothing.
            d=0;
            a=0;
            
        case '39' %codecopy
            d=3;
            a=0;
            
            addr_offset=double(eval_EVM(stack_pt(1,:))+1);
            addr_len=double(eval_EVM(stack_pt(3,:)));
            addr_slots=ceil(addr_len/32);
            addrs=zeros(addr_slots,1);
            codept_offset=double(eval_EVM(stack_pt(2,:))+1);
            if length(callcode(codept_offset:end))<addr_len
                pc=codelen;
                display('codecopy is STOPed at pc %d, code %s',pc, op)
            else
                left_code_length=addr_len;
                for i=0:addr_slots-1
                    addrs(i+1)=addr_offset+i*32;
                    if left_code_length>=32
                        mem_pt(addrs(i+1))=[0 codept_offset+i*32 32];
                        left_code_length=left_code_length-32;
                    else
                        mem_pt(addrs(i+1))=[0 codept_offset+i*32 left_code_length];
                    end
                end
            end
            
            stack_pt=pop_stack(stack_pt,d);
        case 'e3' %returndatacopy
            d=3;
            a=0;
            
            addr_offset=double(eval_EVM(stack_pt(1,:))+1);
            addr_len=double(eval_EVM(stack_pt(3,:)));
            addr_slots=ceil(addr_len/32);
            addrs=zeros(addr_slots,1);
            od_offset=od_pt+double(eval_EVM(stack_pt(2,:)));
            
            left_od_length=addr_len;
            for i=0:addr_slots-1
                addrs(i+1)=addr_offset+i*32;
                if left_od_length>=32
                    mem_pt(addrs(i+1))=[0 od_offset+i*32 32];
                    left_od_length=left_od_length-32;
                else
                    mem_pt(addrs(i+1))=[0 od_offset+i*32 left_od_length];
                end    
            end
            
            stack_pt=pop_stack(stack_pt,d);
        case '3d' %returndatasize
            d=0;
            a=1;
            
            stack_pt=[[0 od_len_info_pt od_len_info_len];stack_pt];
        case 'f1' %call
            d=7;
            a=1;
                    
            gas=eval_EVM(stack_pt(1,:));
            to=eval_EVM(stack_pt(2,:));
            value=eval_EVM(stack_pt(3,:));
            value_pt=stack_pt(3,:);
            in_offset=double(eval_EVM(stack_pt(4,:))+1);
            in_size=double(eval_EVM(stack_pt(5,:)));
            out_offset=double(eval_EVM(stack_pt(6,:))+1);
            out_size=double(eval_EVM(stack_pt(7,:)));
            
            stack_pt=pop_stack(stack_pt,d);
         
            in_slots=ceil(in_size/32);
            addrs=zeros(in_slots,1);
            mem_pt_data=zeros(in_slots,1);
 
            left_in_size=in_size;
            for i=0:in_slots-1
                addrs(i+1)=in_offset+i*32;
                pt=mem_pt(addrs(i+1));
                if pt(1)~=0
                    error('invalid callcode offset')
                end
                if left_in_size>=32
                    pt(3)=32;
                    left_in_size=left_in_size-32;
%                     next_callcode(32*i+1:32*(i+1))=code(pt(2):pt(2)+32-1);
                else
                    pt(3)=left_in_size;
%                     next_callcode(32*i+1:32*(i+1))=code(pt(2):pt(2)+left_in_size-1);
                end
                mem_pt_data(i+1)=pt;
            end  

            % start a call process to get output data
            call_output_pt=[];
            
            if calldepth<1024 && value<=eval_EVM([0 balance_pt balance_len])
                calldepth=calldepth+1;
                codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)= ...
                    mat2cell(dec2hex(calldepth,environ_pts.calldepth_len*2),1,2*ones(1,environ_pts.calldepth_len));
                if isempty(mem_pt_data)
                    curr_offset=1;
                else
                    curr_offset=mem_pt_data(1,2);
                end
                callcode_pt_offset=call_pt(calldepth-1,1)+curr_offset-1;
                call_pt(calldepth,:)=[callcode_pt_offset in_size];
                
                next_callcode=code(callcode_pt_offset:callcode_pt_offset+in_size-1); %assuming target codes are consecutive
                call_output_pt=Decode(next_callcode);
                
                calldepth=calldepth-1;
                codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)= ...
                    mat2cell(dec2hex(calldepth,environ_pts.calldepth_len*2),1,2*ones(1,environ_pts.calldepth_len));
                call_pt=call_pt(1:calldepth,:);
                
                if isempty(call_output_pt)
                    actual_out_len=1;
                else
                    actual_out_len=sum(call_output_pt(:,3));
                end
                n=min(actual_out_len,out_size);
                out_slots=ceil(n/32);
                addrs=zeros(n,1);
                left_n=n;
                for i=0:out_slots-1
                    addrs(i+1)=out_offset+i*32;
                    pt=call_output_pt(i+1,:);
                    pt(3)=min(left_n,32);
                    mem_pt(addrs(i+1))=pt;
                    left_n=left_n-32;
                end
            end
            
            % start another call process under the same condition to get the boolean call result
            call_pointer=call_pointer+1;
            
            storage_pt(hex2dec('fffffffe'))=value_pt;
            storage_pt(hex2dec('ffffffff'))=[0 calldepth_pt calldepth_len];
            
            calldepth=calldepth+1;
            codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)= ...
                mat2cell(dec2hex(calldepth,environ_pts.calldepth_len*2),1,2*ones(1,environ_pts.calldepth_len));
            
            callcode_pt_offset=callcode_suffix_pt;
            call_pt(calldepth,:)=[callcode_pt_offset length(callcode_suffix)];
            
            next_callcode=callcode_suffix;
            vmTraceStep_old = vmTraceStep;
            trash=Decode(next_callcode);
            vmTraceStep=vmTraceStep_old;
            
            calldepth=calldepth-1;
            codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)= ...
                mat2cell(dec2hex(calldepth,environ_pts.calldepth_len*2),1,2*ones(1,environ_pts.calldepth_len));
            call_pt=call_pt(1:calldepth,:);
            
            if ~strcmp(oplist(op_pointer).opcode, '16') % the call result is pointed by op_pointer-th opcode's output
                error('error in retrieving call result')
            else
                x_pointer=oplist(op_pointer).pt_outputs;
                callresultlist(call_pointer)=op_pointer;
            end
            
            stack_pt=[x_pointer; stack_pt];
            
        case set_normalhalt
            switch op
                case {'f3', 'fd'} %return or revert
                    d=2;
                    a=0;
                    
                    addr_offset=double(eval_EVM(stack_pt(1,:))+1);
                    addr_len=double(eval_EVM(stack_pt(2,:)));
                    outputs_pt = [];
                    len_left = addr_len;
                    addr = addr_offset;
                    while len_left>0
                        target_data = mem_pt(addr);
                        outputs_pt=[outputs_pt; target_data];
                        len_left = len_left - target_data(3);
                        addr = addr_offset + target_data(3);
                    end
                    
                    stack_pt=pop_stack(stack_pt,d);

                case 'ff' %selfdestruct
                    error('not defiend opcode %s at pc %d',op,pc)
                case '00'
                    d=0;
                    a=0;
                    
                    outputs_pt=[];
            end
            pc=codelen;
            
        case set_logs
            opnum=hex2dec(op);
            refnum=hex2dec('a0'); %log0
            lognum=opnum-refnum;
            
            d=lognum+2;
            a=0;
            stack_pt=pop_stack(stack_pt,d);
        otherwise
            error('not defiend opcode %s at pc %d',op,pc)

        
    end
    new_stack_size=size(stack_pt,1);
    
%     if size(stack_pt,1)>0
%         display(hd_dec2hex(eval_EVM(stack_pt(1,:))))
%     end
    display(stack_pt);
    if new_stack_size-prev_stack_size~= a-d
        error('invalid stack manipulation at pc %d, op %s',pc,op)
    end
    
    vmTraceStep=vmTraceStep+1;    
end
end

