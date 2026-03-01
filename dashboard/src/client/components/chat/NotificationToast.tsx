import { useEffect, useState, useCallback } from 'react';

export type NotificationLevel = 'critical' | 'important' | 'info' | 'debug';

export interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: string;
  autoDismissMs?: number;
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const levelConfig: Record<NotificationLevel, { color: string; icon: string; label: string }> = {
  critical: { color: 'var(--color-danger)', icon: '⚠', label: 'Critical' },
  important: { color: 'var(--color-warning)', icon: '!', label: 'Important' },
  info: { color: 'var(--color-info)', icon: 'i', label: 'Info' },
  debug: { color: 'var(--text-muted)', icon: '·', label: 'Debug' },
};

export default function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2 max-w-sm"
      role="alert"
      aria-live="assertive"
      aria-label="Notifications"
    >
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const config = levelConfig[notification.level];

  useEffect(() => {
    if (notification.autoDismissMs) {
      const timer = setTimeout(() => onDismiss(notification.id), notification.autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.autoDismissMs, onDismiss]);

  return (
    <div
      className="bg-[var(--bg-surface)] border rounded-lg p-3 shadow-lg animate-slide-in"
      style={{ borderColor: config.color }}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: config.color, color: '#fff' }}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {notification.title}
            </span>
            <button
              onClick={() => onDismiss(notification.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium" style={{ color: config.color }}>
              {config.label}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
