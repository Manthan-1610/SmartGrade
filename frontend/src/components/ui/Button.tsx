import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles = {
  primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary shadow-md hover:shadow-lg',
  secondary: 'bg-bg-card text-text-primary border border-border hover:bg-bg-hover focus:ring-border',
  danger: 'bg-danger text-white hover:bg-danger-dark focus:ring-danger',
  success: 'bg-success text-white hover:bg-success-dark focus:ring-success',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover focus:ring-border',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[0.98]',
          // Variant and size
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
