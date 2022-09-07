clear
clc
global oplist code set_pushes set_ariths set_dups set_swaps set_logs cjmplist ...
    environ_pts codewdata call_pt calldepth op_pointer cjmp_pointer ...
 set_normalhalt storage_pt callcode_suffix callcode_suffix_pt ...
 callresultlist call_pointer vmTraceStep

code = text2code('test_simple\bytes_test_simple.txt');
codelen=length(code);

%suffix callcode used to prove and verify the bool result of each CALL: (current)calldepth<1024 && value<=balance
callcode_suffix_raw='63fffffffd5447101561040163fffffffe541016'; % assuming storage addresses 'fffffffe' and 'ffffffff' are not used by EVM.
callcode_suffix_pt=codelen+1;
callcode_suffix_len=length(callcode_suffix_raw)/2;
callcode_suffix=mat2cell(callcode_suffix_raw,1,2*ones(1,callcode_suffix_len));

%environment data pointers (hard coded)
environ_pts=struct();
environ_pts.pc_pt=callcode_suffix_pt+callcode_suffix_len;
environ_pts.pc_len=4;
environ_pts.Iv_pt=environ_pts.pc_pt+environ_pts.pc_len; % transaction value, I_v
environ_pts.Iv_len=32;
environ_pts.Id_pt=environ_pts.Iv_pt+environ_pts.Iv_len; %input data I_d
%Iddata= ...
%lower('a9059cbb000000000000000000000000ab8483f64d9c6d1ecf9b849ae677dd3315835cb2000000000000000000000000000000000000000000000000000000000000000a'); % Call Data in remix debugger
Iddata = lower('958ec7d1000000000000000000000000ab8483f64d9c6d1ecf9b849ae677dd3315835cb2000000000000000000000000000000000000000000000000000000000000000a');
environ_pts.Id_len=(length(Iddata))/2;
environ_pts.Id_len_info_pt=environ_pts.Id_pt+environ_pts.Id_len;
environ_pts.Id_len_info_len=2;
Id_lendata=lower(dec2hex(environ_pts.Id_len,environ_pts.Id_len_info_len*2));
environ_pts.Is_pt=environ_pts.Id_len_info_pt+environ_pts.Id_len_info_len; %caller address
environ_pts.Is_len=32;
environ_pts.od_pt=environ_pts.Is_pt+environ_pts.Is_len; %output data, o
environ_pts.od_len=32*4;
environ_pts.od_len_info_pt=environ_pts.od_pt+environ_pts.od_len;
environ_pts.od_len_info_len=1;
environ_pts.sd_pt=environ_pts.od_len_info_pt+environ_pts.od_len_info_len; %storage data
environ_pts.sd_len=32;
environ_pts.calldepth_pt=environ_pts.sd_pt+environ_pts.sd_len; %I_e
environ_pts.calldepth_len=2;
environ_pts.balance_pt=environ_pts.calldepth_pt+environ_pts.calldepth_len; % sigma[I_a]_b
environ_pts.balance_len=32;
zerodata = '00';
environ_pts.zero_pt = environ_pts.balance_pt+environ_pts.balance_len;
environ_pts.zero_len=1;

% storage data
storagedata = {'0f4236'; '0f4240';  '64746b0000000000000000000000000000000000000000000000000000000006'; '0a'; '646572697665000000000000000000000000000000000000000000000000000c'};
environ_pts.storage_pts = zeros(1, length(storagedata));
environ_pts.storage_lens = zeros(1, length(storagedata));
environ_pts.storage_pts(1) = environ_pts.zero_pt+environ_pts.zero_len;
environ_pts.storage_lens(1) = length(storagedata{1})/2;
for i=2:length(storagedata)
    environ_pts.storage_pts(i) = environ_pts.storage_pts(i-1) + environ_pts.storage_lens(i-1);
    environ_pts.storage_lens(i) = length(storagedata{2})/2;
end

%Arbitrary environment data
pcdata=replace(num2str(zeros(1,environ_pts.pc_len*2)),' ','');
Ivdata=replace(num2str(zeros(1,environ_pts.Iv_len*2)),' ','');
Ivdata(end)='0'; %Ethereum transfer value (0 when token transfer)

%Isdata=replace(num2str(zeros(1,Is_len*2)),' ','');
Isdata=lower('0000000000000000000000005B38Da6a701c568545dCfcB03FcB875f56beddC4'); % msg.sender or tx.origin in remix debugger, loaded by opcode CALLER in 32 bytes
oddata=replace(num2str(zeros(1,environ_pts.od_len*2)),' ','');
od_lendata=lower(dec2hex(environ_pts.od_len,environ_pts.od_len_info_len*2));
sddata=replace(num2str(zeros(1,environ_pts.sd_len*2)),' ','');
sddata(end-1:end)='55';
calldepthdata=replace(num2str(zeros(1,environ_pts.calldepth_len*2)),' ','');
balancedata=lower(dec2hex(10^6, environ_pts.balance_len*2));

data=strcat(pcdata,Ivdata,Iddata,Id_lendata,Isdata,oddata,od_lendata,sddata, ...
    calldepthdata, balancedata, zerodata);
for i=1:length(storagedata)
    data = [data storagedata{i}];
end
environdata=mat2cell(data,1,2*ones(1,length(data)/2));
environlen=length(environdata);
codewdata=[code callcode_suffix environdata];


%opcode classes
set_pushes=mat2cell(lower(dec2hex(96:127,2)),ones(1,32),2); %127-96+1=32
set_ariths=mat2cell(lower(dec2hex([1:11 16:29 32],2)),ones(1,26),2); %29-16+1 + 11-1+1 + 1= 26
set_dups=mat2cell(lower(dec2hex(128:143,2)),ones(1,16),2); %143-128+1=16
set_swaps=mat2cell(lower(dec2hex(144:159,2)),ones(1,16),2); %159-144+1=16
set_logs=mat2cell(lower(dec2hex(160:164,2)),ones(1,5),2); %164-160+1=5
set_normalhalt={'00', 'f3', 'fd', 'ff'};


oplist=struct('opcode',[],'pt_inputs',[],'pt_outputs',[], 'inputs', [], 'outputs',[]);
op_pointer=1;
cjmplist=struct('pc',[],'pt_inputs',[],'condition',[],'destination',[]);
cjmp_pointer=0;
storage_pt=containers.Map('KeyType','char','ValueType','any'); %valuetype = [op_pointer pt length]
call_pt=[]; %[ROM_offset call_code_length]
calldepth=0;
callresultlist=[]; %op_pointers
call_pointer=0;

% Hardcode Initial storage keys
storage_keys = {'58f8e73c330daffe64653449eb9a999c1162911d5129dd8193c7233d46ade2d5'; '0000000000000000000000000000000000000000000000000000000000000002'; '0000000000000000000000000000000000000000000000000000000000000004'; '1a1017a437881fd8fee8ab135586d886995df9286bd91e5d3c250f79b2327f02'; '646572697665000000000000000000000000000000000000000000000000000c'};
for i=1:length(storage_keys)
    storage_pt(storage_keys{i}) = [0 environ_pts.storage_pts(i) environ_pts.storage_lens(i)];
end


%Decode starts
vmTraceStep=0;
calldepth=calldepth+1;
codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)= ...
    mat2cell(lower(dec2hex(calldepth,environ_pts.calldepth_len*2)),1,2*ones(1,environ_pts.calldepth_len));
% curr_calldepth=hex2dec(cell2mat(codewdata(environ_pts.calldepth_pt:environ_pts.calldepth_pt+environ_pts.calldepth_len-1)));
call_pt(calldepth,:)=[1 codelen];
outputs_pt=Decode(code);
oplist(1).pt_inputs=[oplist(1).pt_inputs;outputs_pt];
%%%% decode end %%%%

s_F=length(oplist);
%Find input and output values
p=vpa(21888242871839275222246405745257275088548364400416034343698204186575808495617, 77);
for k=1:s_F
    k_pt_inputs=oplist(k).pt_inputs;
    k_inputs=[];
    for i=1:size(k_pt_inputs,1)
        k_inputs=[k_inputs; eval_EVM(k_pt_inputs(i,:))];
    end
    
    k_pt_outputs=oplist(k).pt_outputs;
    k_outputs=[];
    for i=1:size(k_pt_outputs,1)
        oldDigits=digits(77);
        k_output = eval_EVM(k_pt_outputs(i,:));
        flag=double(k_output>=p);
        digits(oldDigits);
        if flag
            warning('output value of opcode %s at the %d-th index can be overflowed in circom', oplist(k).opcode, k);
        end
        k_outputs=[k_outputs; k_output];
    end
    oplist(k).inputs=k_inputs;
    oplist(k).outputs=k_outputs;
end

%Make wireMap
Instruction_Wire_Numbers=jsondecode(fileread('subcircuit_info.json'));
Instruction_Wire_Numbers=Instruction_Wire_Numbers.wire_list;
Con_Instruction_Wire_Numbers=containers.Map('KeyType','uint32','ValueType','any');
Con_Instruction_Idx=containers.Map('KeyType','uint32','ValueType','any');
s_D=length(Instruction_Wire_Numbers);
for k=1:s_D
    Con_Instruction_Wire_Numbers(hex2dec(Instruction_Wire_Numbers(k).opcode))=Instruction_Wire_Numbers(k).Nwires;
    Con_Instruction_Idx(hex2dec(Instruction_Wire_Numbers(k).opcode))=k-1;
end
NWires=zeros(1,s_F);
for k=1:s_F
    NWires(k)=Con_Instruction_Wire_Numbers(hex2dec(oplist(k).opcode));  
end
CoDomain_Len=sum(NWires);

% Initialize RangeCell
NCONSTWIRES=1;
NINPUT=(NWires(1)-NCONSTWIRES)/2;
if floor(NINPUT) ~= NINPUT
    error('Invalid NWires for load subcircuit');
end
RangeCell=cell(s_F,max(max(NWires),NCONSTWIRES+2*NINPUT));
% Load subcircuit with 32 inputs and 32 outputs, where every input refers
% the corresponding output
for i=1+NCONSTWIRES:NINPUT+NCONSTWIRES
    RangeCell{1,i}=[RangeCell{1,i}; [1 i]; [1 i+NINPUT]];
end
for k=1:s_F
    RangeCell{1,1}=[RangeCell{1,1}; [k 1]];
end
for k=2:s_F
    oplist_k=oplist(k);
    k_pt_inputs=oplist_k.pt_inputs;
    inlen=size(oplist_k.pt_inputs, 1);
    outlen=size(oplist_k.pt_outputs, 1);
    NWires_k=NWires(k);
    for j=1:NWires_k
        if (j>NCONSTWIRES && j<=NCONSTWIRES+outlen) || (j>NCONSTWIRES+outlen+inlen)
            RangeCell{k,j}=[RangeCell{k,j}; [k,j]];
        end
    end
end
% Apply oplist into RangeCell
for k=2:s_F
    oplist_k=oplist(k);
    k_pt_inputs=oplist_k.pt_inputs;
    inlen=size(oplist_k.pt_inputs, 1);
    outlen=size(oplist_k.pt_outputs, 1);
    NWires_k=NWires(k);
    for i=1:inlen
        RangeCell{k_pt_inputs(i,1), NCONSTWIRES+k_pt_inputs(i,2)}= ...
        [RangeCell{k_pt_inputs(i,1), NCONSTWIRES+k_pt_inputs(i,2)}; [k,NCONSTWIRES+outlen+i]];
    end
end

WireListm=[];
for k=1:s_F
    NWires_k=NWires(k);
    for i=1:NWires_k
        if ~isempty(RangeCell{k,i})
            WireListm=[WireListm; [k-1, i-1]];
        end
    end
end
mWires=size(WireListm,1);

OpLists=zeros(1,s_F);
for k=1:s_F
    OpLists(k)=Con_Instruction_Idx(hex2dec(oplist(k).opcode));
end

% Following definition (applicable when CJUMP is implemented)
% I_V=[];
% I_P=[];
% for i=1:mWires
%     k=WireListm(i,1)+1;
%     wireIdx=WireListm(i,2)+1;
%     oplist_k=oplist(k);
%     if k==0
%         inlen=NINPUT;
%         outlen=NINPUT;
%     else 
%         inlen=size(oplist_k.pt_inputs, 1);
%         outlen=size(oplist_k.pt_outputs, 1);
%     end
%     if size(RangeCell{k,wireIdx},1)>1
%         I_V=[I_V i-1];
%     elseif size(RangeCell{k,wireIdx},1)==1
%         I_P=[I_P i-1];
%     else
%         error('error')
%     end
% end

% Temporary construnction berfore implementing CJUMP
I_V=[];
I_P=[];
for i=1:mWires
    k=WireListm(i,1);
    wireIdx=WireListm(i,2);
    oplist_k=oplist(k+1);
    if k==0
        inlen=NINPUT;
        outlen=NINPUT;
    else 
        inlen=size(oplist_k.pt_inputs, 1);
        outlen=size(oplist_k.pt_outputs, 1);
    end
    if wireIdx>=NCONSTWIRES && wireIdx<NCONSTWIRES+outlen
        I_V=[I_V i-1];
    else
        I_P=[I_P i-1];
    end
end

I_V_len=length(I_V);
I_P_len=length(I_P);
rowInv_I_V=[];
rowInv_I_P=[];
for i=I_V+1
    k=WireListm(i,1);
    wireIdx=WireListm(i,2);
    InvSet=RangeCell{k+1,wireIdx+1}-1;
    NInvSet=size(InvSet,1);
    InvSet=reshape(InvSet.',NInvSet*2,1).';
    rowInv_I_V=[rowInv_I_V NInvSet InvSet];
end
for i=I_P+1
    k=WireListm(i,1);
    wireIdx=WireListm(i,2);
    InvSet=RangeCell{k+1,wireIdx+1}-1;
    NInvSet=size(InvSet,1);
    InvSet=reshape(InvSet.',NInvSet*2,1).';
    rowInv_I_P=[rowInv_I_P NInvSet InvSet];
end

% set_i_v.bin format with data_size=4 bytes:
% [I_V_len(4) I_V(4*I_V_len) NPreImages_I_V_1(4) ...
% PreImages_I_V_1(4*2*NPreImages_I_V_1) NPreImages_I_V_2(4) ...
% PreImages_I_V_2(4*2*NPreImages_I_V_2) ...],
% where PreImages = [k1, i1, k2, i2, k3, i3, ...]

SetData_I_V=[I_V_len I_V rowInv_I_V];
SetData_I_P=[I_P_len I_P rowInv_I_P];
fdset1=fopen('test_simple\Set_I_V.bin', 'w');
fdset2=fopen('test_simple\Set_I_P.bin', 'w');
fdOpList=fopen('test_simple\OpList.bin', 'w');
fdWireList=fopen('test_simple\WireList.bin', 'w');
fwrite(fdset1, SetData_I_V, 'uint32');
fwrite(fdset2, SetData_I_P, 'uint32');
fwrite(fdOpList, [length(OpLists) OpLists], 'uint32');
fwrite(fdWireList, [size(WireListm,1) reshape(WireListm.', 1, numel(WireListm))], 'uint32');
fclose(fdset1);
fclose(fdset2);
fclose(fdOpList);
fclose(fdWireList);

InstanceFormatIn = struct();
InstanceFormatOut = struct();
for k=1:length(oplist)
    outputs = oplist(k).outputs;
    if k==1
        inputs = outputs;
        inputs_hex = cell(1, NINPUT);
        outputs_hex = cell(1, NINPUT);
    else
        inputs = oplist(k).inputs;
        inputs_hex = cell(1, length(inputs));
        outputs_hex = cell(1, length(outputs));
    end
    
    if length(inputs)>NINPUT
        error('Too many inputs')
    end
    for i=1:length(inputs_hex)
        if i<=length(inputs)
            inputs_hex{i} = strcat('0x', hd_dec2hex(inputs(i),64));
        else
            inputs_hex{i} = '0x0';
        end
    end
    
    for i=1:length(outputs_hex)
        if i<=length(outputs)
            outputs_hex{i} = strcat('0x', hd_dec2hex(outputs(i),64));
        else
            outputs_hex{i} = '0x0';
        end
    end
    
    if k==1
        for i=1:length(inputs)
            sourcevalue=cell2mat(codewdata(oplist(k).pt_outputs(i,2):oplist(k).pt_outputs(i,2)+oplist(k).pt_outputs(i,3)-1));
            sourcevalue=strcat(replace(num2str(zeros(1,64-length(sourcevalue))), ' ',''), sourcevalue);
            sourcevalue=strcat('0x', sourcevalue);
            if ~strcmp(sourcevalue, outputs_hex{i})
                error('source value mismatch')
            end
        end
    end
 
    InstanceFormatIn(k).in=inputs_hex;
    InstanceFormatOut(k).out=outputs_hex;
    fdInput=fopen(['test_simple\instance\Input_opcode' num2str(k-1) '.json'], 'w');
    fdOutput=fopen(['test_simple\instance\Output_opcode' num2str(k-1) '.json'], 'w');
    
    fprintf(fdInput, jsonencode(InstanceFormatIn(k)));
    fprintf(fdOutput, jsonencode(InstanceFormatOut(k)));
    fclose(fdInput);
    fclose(fdOutput);
end









