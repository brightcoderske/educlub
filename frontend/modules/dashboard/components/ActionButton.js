import React from 'react';

export function ActionButton({ children, variant = 'primary', size = 'medium', disabled, loading, icon, ...props }) {
  const variantClasses = {
    primary: '',
    secondary: 'secondary-button',
    danger: 'danger-button',
    compact: 'compact-action'
  };

  const sizeClasses = {
    small: 'min-h-36',
    medium: 'min-h-44',
    large: 'min-h-52'
  };

  return (
    <button 
      className={`${variantClasses[variant] || ''} ${sizeClasses[size] || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
        </svg>
      )}
      {icon && !loading && icon}
      {children}
    </button>
  );
}

export function ButtonGroup({ children, gap = '12px', align = 'flex-start', ...props }) {
  return (
    <div 
      style={{ 
        display: 'flex', 
        gap, 
        alignItems: 'center',
        justifyContent: align,
        flexWrap: 'wrap'
      }}
      {...props}
    >
      {children}
    </div>
  );
}
