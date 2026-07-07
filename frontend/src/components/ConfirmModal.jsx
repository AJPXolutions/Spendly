import './ConfirmModal.css';
import { useI18n } from '../context/I18nContext';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  tone = 'danger',
  loading = false,
  onCancel,
  onConfirm,
}) {
  const { language } = useI18n();
  if (!open) return null;

  const resolvedTitle = title || (language === 'en' ? 'Confirm action' : 'Confirmar acción');
  const resolvedConfirm = confirmText || (language === 'en' ? 'Confirm' : 'Confirmar');
  const resolvedCancel = cancelText || (language === 'en' ? 'Cancel' : 'Cancelar');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal confirm-modal">
        <h2>{resolvedTitle}</h2>
        <p className="confirm-message">{message}</p>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            {resolvedCancel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (language === 'en' ? 'Processing…' : 'Procesando…') : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
