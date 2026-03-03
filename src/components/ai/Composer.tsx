"use client";

import { ArrowUpRight, Paperclip } from "lucide-react";

type ComposerProps = {
  value: string;
  disabled?: boolean;
  sending?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function Composer({ value, disabled, sending, onChange, onSubmit }: ComposerProps) {
  return (
    <div className="w-full rounded-[100vw] border border-white/25 bg-white/[0.12] p-2 shadow-[0_18px_20px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <div className="flex items-center gap-2 rounded-[100vw] bg-black/5 px-2">
        <button
          type="button"
          aria-label="Attach file"
          disabled
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!disabled && value.trim()) onSubmit();
            }
          }}
          disabled={disabled}
          aria-label="Message composer"
          placeholder="Where are my top project overruns?"
          className="h-12 w-full border-0 bg-transparent text-left text-[15px] font-light text-white outline-none placeholder:text-white/80 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[16px]"
        />

        <button
          type="button"
          onClick={onSubmit}
          aria-label="Send message"
          disabled={disabled || !value.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.28] text-white transition hover:bg-white/[0.4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowUpRight className="h-4.5 w-4.5" />
        </button>
      </div>

      {sending ? <div className="px-3 pb-1 pt-1 text-[11px] text-white/70">Sending...</div> : null}
    </div>
  );
}
