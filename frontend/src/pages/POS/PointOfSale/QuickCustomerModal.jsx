import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import { saleService } from '../../../services/pos/saleService';

export default function QuickCustomerModal({
  isOpen,
  onClose,
  branchId,
  onCreated,
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFirstName('');
    setLastName('');
    setPhone('');
    setDocumentNumber('');
    setError('');
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await saleService.createQuickCustomer({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        document_number: documentNumber.trim() || null,
        branch_id: branchId ? Number(branchId) : null,
      });
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Registro Rápido en Tienda"
      title="Nuevo Cliente POS"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="quick-customer-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Registrar y Seleccionar'}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="quick-customer-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Nombre *</label>
            <input
              type="text"
              maxLength={100}
              className="admin-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ej: Valeria"
              required
            />
          </div>

          <div className="admin-field">
            <label>Apellido *</label>
            <input
              type="text"
              maxLength={100}
              className="admin-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ej: Suárez"
              required
            />
          </div>

          <div className="admin-field">
            <label>Teléfono / WhatsApp</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="70012345"
            />
          </div>

          <div className="admin-field">
            <label>CI / NIT (opcional)</label>
            <input
              type="text"
              maxLength={40}
              className="admin-input"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Ej: 8123456"
            />
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
