import React from 'react';

export function Badge({ children, variant = 'default', size = 'medium', ...props }) {
  const variantClasses = {
    default: 'background: #f1f5f9; color: #475569;',
    success: 'background: #f0fdf4; color: #166534;',
    warning: 'background: #fef3c7; color: #92400e;',
    danger: 'background: #fef2f2; color: #991b1b;',
    info: 'background: #eff6ff; color: #1e40af;',
    primary: 'background: #eff6ff; color: #1e40af;'
  };

  const sizeClasses = {
    small: 'font-size: 0.75rem; padding: 4px 8px;',
    medium: 'font-size: 0.85rem; padding: 6px 12px;',
    large: 'font-size: 0.95rem; padding: 8px 16px;'
  };

  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        fontWeight: '600',
        ...variantClasses[variant] || variantClasses.default,
        ...sizeClasses[size] || sizeClasses.medium
      }}
      {...props}
    >
      {children}
    </span>
  );
}
