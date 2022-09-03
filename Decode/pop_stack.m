function [stack_out] = pop_stack(stack_in,d)

if size(stack_in,1)>=d
    stack_out=stack_in(d+1:end,:);
else
    error('warning: invalid popping stack')
end

end

