import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  loading = false,
  loadingText = 'Cargando...',
  emptyText = 'Sin opciones disponibles',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const isDisabled = Boolean(loading || disabled);
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    if (isDisabled && open) {
      setOpen(false);
    }
  }, [isDisabled, open]);

  const updatePosition = () => {
    if (!triggerRef.current || !menuRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    menuRef.current.style.top = `${rect.bottom + 6}px`;
    menuRef.current.style.left = `${rect.left}px`;
    menuRef.current.style.width = `${rect.width}px`;
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      const insideTrigger = containerRef.current?.contains(e.target);
      const insideMenu = menuRef.current?.contains(e.target);
      if (!insideTrigger && !insideMenu) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open]);

  return (
    <div
      className={`custom-select ${open ? 'is-open' : ''} ${loading ? 'is-loading' : ''} ${
        isDisabled ? 'is-disabled' : ''
      }`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        onClick={() => {
          if (!isDisabled) setOpen((prev) => !prev);
        }}
        disabled={isDisabled}
        aria-expanded={open}
        aria-busy={loading}
      >
        <span className={loading || !selectedOption ? 'custom-select-placeholder' : 'custom-select-value'}>
          {loading ? loadingText : selectedOption ? selectedOption.label : placeholder}
        </span>
        {loading ? (
          <span className="custom-select-spinner" aria-hidden="true" />
        ) : (
          <svg
            className="custom-select-chevron"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open &&
        !isDisabled &&
        createPortal(
          <ul ref={menuRef} className="custom-select-menu" role="listbox">
            {options.length === 0 ? (
              <li className="custom-select-empty">{emptyText}</li>
            ) : (
              options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
