import BaseModal from './BaseModal';

/**
 * Modal de confirmación reutilizable para todo el Dashboard:
 * - Confirmación simple (ej. cerrar sesión, procesar solicitud)
 * - Decisión dual (ej. rechazar vs procesar)
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  eyebrow = 'Confirmación',
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  rejectLabel,
  variant = 'primary', // 'primary' | 'danger'
  onConfirm,
  onReject,
}) {
  const confirmClass =
    variant === 'danger' ? 'admin-btn admin-btn-danger' : 'admin-btn admin-btn-primary';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose}>
            {cancelLabel}
          </button>
          {rejectLabel && onReject && (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={() => {
                onReject();
                onClose();
              }}
            >
              {rejectLabel}
            </button>
          )}
          <button
            type="button"
            className={confirmClass}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </BaseModal>
  );
}
