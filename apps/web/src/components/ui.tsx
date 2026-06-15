import type { ReactNode } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function shortAddress(address?: string | null) {
  if (!address) return 'not connected';
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
}

export function Button({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        'rounded-2xl px-4 py-3 text-sm font-black transition-all duration-300 ease-in-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'funding'
      ? 'bg-emerald-500/10 text-emerald-400'
      : status === 'graduated'
        ? 'bg-blue-500/10 text-blue-400'
        : status === 'liquidity_pending'
          ? 'bg-cyan-500/10 text-cyan-300'
          : status === 'awaiting_deploy' || status === 'deploy_submitted'
            ? 'bg-amber-500/10 text-amber-300'
            : 'bg-slate-500/10 text-slate-300';

  return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide', color)}>{status.replace('_', ' ')}</span>;
}
