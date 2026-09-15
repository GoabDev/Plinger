import * as React from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} data-slot="input" className={`ui-input ${className ?? ""}`} {...props} />
  ),
);
Input.displayName = "Input";

export { Input };
