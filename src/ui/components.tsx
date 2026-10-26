import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type BtnVariant = "primary" | "ghost" | "outline" | "dark";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40";
  const styles: Record<BtnVariant, string> = {
    primary: "bg-accent text-white",
    dark: "bg-ink text-cream dark:bg-cream dark:text-ink",
    outline: "border border-line bg-card text-ink dark:bg-[#241c14] dark:text-cream dark:border-[#3d3226]",
    ghost: "text-ink-soft dark:text-[#b7a895]",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-card/80 text-ink shadow-sm ring-1 ring-line dark:bg-[#241c14] dark:text-cream dark:ring-[#3d3226] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 shadow-sm dark:bg-[#241c14] dark:border-[#3d3226] ${className}`}>
      {children}
    </div>
  );
}

export function Chip({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
        active
          ? "bg-ink text-cream ring-ink dark:bg-cream dark:text-ink dark:ring-cream"
          : "bg-card text-ink-soft ring-line dark:bg-[#241c14] dark:text-[#b7a895] dark:ring-[#3d3226]"
      }`}
    >
      {active ? `${label} ✕` : label}
    </button>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none placeholder:text-ink-soft/60 focus:border-accent dark:bg-[#241c14] dark:border-[#3d3226] dark:text-cream ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none placeholder:text-ink-soft/60 focus:border-accent dark:bg-[#241c14] dark:border-[#3d3226] dark:text-cream ${className}`}
      {...rest}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">{label}</span>
      {children}
    </label>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-4 pb-8 sm:rounded-3xl dark:bg-[#1c1610]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <IconButton onClick={onClose} aria-label="Close">✕</IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div className="text-4xl">📖</div>
      <div className="text-base font-bold">{title}</div>
      {body && <div className="max-w-xs text-sm text-ink-soft dark:text-[#b7a895]">{body}</div>}
      {action}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-cream-2 dark:bg-[#332a20]">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
