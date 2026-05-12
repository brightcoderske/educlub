import React from 'react';

export function DashboardCard({ children, className = '', title, ...props }) {
  return (
    <div className={`panel ${className}`} {...props}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, trend, color = 'blue', className = '', ...props }) {
  const colorClasses = {
    blue: 'school-stat blue',
    green: 'school-stat green',
    gold: 'school-stat gold',
    coral: 'school-stat coral'
  };

  return (
    <div className={`${colorClasses[color] || 'school-stat blue'} ${className}`} {...props}>
      <span>{label}</span>
      <strong>{value}</strong>
      {trend && <small>{trend}</small>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, ...props }) {
  return (
    <div className="empty-state" {...props}>
      {icon && <div style={{ fontSize: '3rem', marginBottom: '12px', color: '#94a3b8' }}>{icon}</div>}
      <p>{title}</p>
      {description && <span>{description}</span>}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-block">
      <p>{message}</p>
    </div>
  );
}
