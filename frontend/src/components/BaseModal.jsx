import { createPortal } from 'react-dom';

export default function BaseModal({
  isOpen,
  onClose,
  eyebrow,
  title,
  wide = false,
  size,
  children,
  footer,
}) {
  if (!isOpen) return null;

  const sizeClass = size === 'xl' ? 'is-xl' : wide || size === 'wide' ? 'is-wide' : '';

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            {eyebrow && <span className="modal-eyebrow">{eyebrow}</span>}
            <h3 className="modal-title">{title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
