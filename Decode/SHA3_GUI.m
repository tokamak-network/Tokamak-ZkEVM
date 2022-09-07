function SHA3_GUI()
%David Hill
%Version 1.1.0
%12-24-2019
%Implimented from SHA-3 Standard: Permutation-Based Hash and
%Extendable-Output Functions (FIPS PUB 202, dated August 2015)
%Select the hash function desired in the popup menu 
%(a 224, 256, 384, or 512 bit hexidecimal output). Input a message 
%that you want to hash into the message box. Hit the hash button to 
%hash the message and display the digest in the digest box. The reset
%button clears the boxes. I have tested the hash functions and they are
%working.
global bLen;
bLen=224;
gui = figure('MenuBar','none','Name','SHA3_GUI','Visible','off','Position',[300,300,850,500]);

cipher = uipanel('Title','SHA3','Units','pixels','Position',[8 8 700 484],'BackgroundColor',[0.9 0.9 0.9]);
    input1 = uicontrol('Parent',cipher,'Style','text','String','Message:','Units','pixels','Position',[3 420 50 16],'BackgroundColor',[0.9 0.9 0.9],'HorizontalAlignment','left');
    input_area1 = uicontrol('Parent',cipher,'Style','edit','String','','Max',2,'Units','pixels','Position',[52 380 638 70],'BackgroundColor',[1 1 1],'HorizontalAlignment','left');
    input2 = uicontrol('Parent',cipher,'Style','popupmenu','Position',[52 350 100 20],'BackgroundColor',[1 1 1],'HorizontalAlignment','left');
    input2.String = {'SHA3-224','SHA3-256','SHA3-384','SHA3-512'};
    input2.Callback = @selection;
    output = uicontrol('Parent',cipher,'Style','text','String','Digest:','Units','pixels','Position',[3 315 50 16],'BackgroundColor',[0.9 0.9 0.9],'HorizontalAlignment','left');
    output_area = uicontrol('Parent',cipher,'Style','edit','String','','Max',2,'Units','pixels','Position',[52 270 638 70],'BackgroundColor',[1 1 1],'HorizontalAlignment','left');

options = uibuttongroup('Title','Options','Units','pixels','Position',[714 260 130 232],'BackgroundColor',[0.9 0.9 0.9]);
    hash = uicontrol('Parent',options,'Style','pushbutton','String','Hash','Units','pixels','Position',[4 70 120 60],'BackgroundColor',[0.9 0.9 0.9],'Callback',@hash_Callback);
    reset = uicontrol('Parent',options,'Style','pushbutton','String','Reset','Units','pixels','Position',[4 5 120 60],'BackgroundColor',[0.9 0.9 0.9],'Callback',@reset_Callback);

gui.Visible = 'on';

function hash_Callback(src,event)
   output_area.String = SHA3(input_area1.String,bLen);
end

function selection(src,event)
   val = input2.Value;
   b_length = [224,256,384,512];
   bLen=b_length(val);
end

function reset_Callback(src,event)
   input_area1.String = '';
   output_area.String = '';
end

end