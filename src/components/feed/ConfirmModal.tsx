import React, { useEffect, useRef } from 'react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, title, description, confirmLabel, confirmColor = '#c53030',
  onConfirm, onCancel, loading = false,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#111318',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4,
        padding: '20px 24px',
        maxWidth: 420, width: '100%',
        fontFamily: F,
      }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700,
          color: 'rgba(255,255,255,0.90)',
          margin: '0 0 8px', letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 13, color: 'rgba(255,255,255,0.50)',
          margin: '0 0 20px', lineHeight: 1.5,
        }}>
          {description}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.50)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3, padding: '7px 14px',
              fontSize: 12, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: F,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: confirmColor,
              color: '#fff',
              border: 'none',
              borderRadius: 3, padding: '7px 18px',
              fontSize: 12, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: F,
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.1s',
            }}
          >
            {loading ? 'Executando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
