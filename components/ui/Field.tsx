import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Element rendered inside the field, right-aligned (e.g. a show-password toggle). */
  trailing?: ReactNode;
};

/** Editorial underline field: the rule draws in from the left on focus, in the page tint. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, trailing, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-msg`;
  const message = error ?? hint;

  return (
    <div className={cn("block", className)}>
      <label htmlFor={inputId} className="text-meta text-muted">
        {label}
      </label>
      <div className="relative mt-1.5 flex items-center">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            "peer h-12 w-full rounded-none border-0 border-b bg-transparent pr-2 text-[1.0625rem] text-text outline-none",
            "placeholder:text-faint focus-visible:outline-none",
            error ? "border-danger" : "border-hairline-strong",
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-[var(--tint)] transition-transform duration-500 ease-out peer-focus-visible:scale-x-100 peer-focus:scale-x-100"
        />
        {trailing ? <div className="absolute right-0 flex h-12 items-center">{trailing}</div> : null}
      </div>
      {message ? (
        <p id={messageId} className={cn("mt-2 text-meta", error ? "text-danger" : "text-muted")} role={error ? "alert" : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
});
