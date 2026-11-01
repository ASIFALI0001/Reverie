"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Field } from "@/components/ui/Field";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode };

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"
        >
          {visible ? <EyeSlash size={18} weight="light" /> : <Eye size={18} weight="light" />}
        </button>
      }
    />
  );
});
