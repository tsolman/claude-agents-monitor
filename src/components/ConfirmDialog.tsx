import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantClasses = {
  danger: 'bg-danger/20 text-danger ring-1 ring-danger/30 hover:bg-danger/30',
  warning: 'bg-warn/20 text-warn ring-1 ring-warn/30 hover:bg-warn/30',
  default: 'bg-accent-dim text-accent ring-1 ring-accent/30 hover:bg-accent-medium',
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="card w-full max-w-[400px] p-6 animate-fade-in">
        <h3 className="text-[14px] font-semibold text-white/90">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-lg bg-surface-3 px-4 py-2 text-sm font-medium text-white/50 transition-colors hover:text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${variantClasses[confirmVariant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
