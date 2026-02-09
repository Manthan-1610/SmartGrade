import { type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

const variantStyles = {
  info: {
    container: 'bg-primary/10 border-primary/30 text-primary',
    icon: Info,
  },
  success: {
    container: 'bg-success/10 border-success/30 text-success',
    icon: CheckCircle2,
  },
  warning: {
    container: 'bg-warning/10 border-warning/30 text-warning',
    icon: AlertTriangle,
  },
  error: {
    container: 'bg-danger/10 border-danger/30 text-danger',
    icon: AlertCircle,
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className,
  id,
}: AlertProps) {
  const { container, icon: Icon } = variantStyles[variant];

  return (
    <div
      id={id}
      role="alert"
      className={cn(
        'rounded-lg border p-4 animate-fade-in',
        container,
        className
      )}
    >
      <div className="flex gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-medium mb-1">{title}</h4>
          )}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
