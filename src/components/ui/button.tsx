import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}
