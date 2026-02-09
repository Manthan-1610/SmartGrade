import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: 'bg-bg-card border border-border',
  outlined: 'bg-transparent border-2 border-border',
  elevated: 'bg-bg-card border border-border shadow-lg',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className,
  variant = 'elevated',
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between', className)} {...props}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          {description && (
            <p className="text-sm text-text-secondary mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
