import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import { purchaseService } from '../../../services/admin/purchaseService';
import { getInitials } from './purchaseHelpers';

export default function SupplierFormModal({
  isOpen,
  onClose,
  supplier = null,
  onSaved,
}) {
  const isEditing = Boolean(supplier);

  const [code, setCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Santa Cruz');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCode(supplier?.code || '');
    setBusinessName(supplier?.business_name || '');
    setContactName(supplier?.contact_name || '');
    setTaxId(supplier?.tax_id || '');
    setPhone(supplier?.phone || '');
    setWhatsapp(supplier?.whatsapp || '');
    setSecondaryPhone(supplier?.secondary_phone || '');
    setEmail(supplier?.email || '');
    setCity(supplier?.city || 'Santa Cruz');
    setAddress(supplier?.address || '');
    setPaymentTerms(supplier?.payment_terms || '');
    setNotes(supplier?.notes || '');
    setIsActive(supplier ? Boolean(supplier.is_active) : true);
    setPhotoFile(null);
    setPreviewUrl(supplier?.photo_url || '');
    setRemovePhoto(false);
    setError('');
  }, [isOpen, supplier]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoFile(null);
    setPreviewUrl('');
    setRemovePhoto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setError('El nombre o razón social del proveedor es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      if (code.trim()) fd.append('code', code.trim());
      fd.append('business_name', businessName.trim());
      fd.append('contact_name', contactName.trim());
      fd.append('tax_id', taxId.trim());
      fd.append('phone', phone.trim());
      fd.append('whatsapp', whatsapp.trim());
      fd.append('secondary_phone', secondaryPhone.trim());
      fd.append('email', email.trim());
      fd.append('city', city.trim());
      fd.append('address', address.trim());
      fd.append('payment_terms', paymentTerms.trim());
      fd.append('notes', notes.trim());
      fd.append('is_active', isActive ? '1' : '0');
      if (removePhoto) fd.append('remove_photo', '1');
      if (photoFile) fd.append('photo', photoFile);

      if (isEditing) {
        await purchaseService.updateSupplier(supplier.id, fd);
      } else {
        await purchaseService.createSupplier(fd);
      }

      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Directorio de Proveedores"
      title={isEditing ? `Editar Proveedor · ${supplier.code}` : 'Nuevo Proveedor'}
      size="wide"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="supplier-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Proveedor'}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="supplier-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="pur-photo-preview-row">
          <div className="pur-avatar-lg">
            {previewUrl ? (
              <img src={previewUrl} alt={businessName || 'Proveedor'} />
            ) : (
              <span>{getInitials(businessName, 'P')}</span>
            )}
          </div>
          <div className="admin-field">
            <label>Fotografía / Tarjeta o Logo del Proveedor (Cloudflare R2)</label>
            <div className="admin-actions-row">
              <input
                type="file"
                accept="image/*"
                className="pur-file-input"
                onChange={handleFileChange}
              />
              {previewUrl && (
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                  onClick={handleRemovePhoto}
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Código (automático si se deja vacío)</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PRV-0001"
            />
          </div>

          <div className="admin-field">
            <label>Razón Social / Nombre Comercial *</label>
            <input
              type="text"
              maxLength={180}
              className="admin-input"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Textil Aurora S.R.L. / Importadora Moda"
              required
            />
          </div>

          <div className="admin-field">
            <label>Nombre de contacto / Vendedor</label>
            <input
              type="text"
              maxLength={150}
              className="admin-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ej: Sofía Mendoza"
            />
          </div>

          <div className="admin-field">
            <label>NIT / CI / RUC</label>
            <input
              type="text"
              maxLength={50}
              className="admin-input"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="Ej: 1029384015"
            />
          </div>

          <div className="admin-field">
            <label>WhatsApp (para pedidos directos)</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 70012345 o +59170012345"
            />
          </div>

          <div className="admin-field">
            <label>Teléfono principal</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 3-3456789"
            />
          </div>

          <div className="admin-field">
            <label>Teléfono secundario</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="admin-field">
            <label>Correo electrónico</label>
            <input
              type="email"
              maxLength={150}
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ventas@proveedor.com"
            />
          </div>

          <div className="admin-field">
            <label>Ciudad</label>
            <input
              type="text"
              maxLength={100}
              className="admin-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Santa Cruz"
            />
          </div>

          <div className="admin-field">
            <label>Condiciones de pago</label>
            <input
              type="text"
              maxLength={100}
              className="admin-input"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ej: Contado / 50% adelanto / 15 días"
            />
          </div>
        </div>

        <div className="admin-field">
          <label>Dirección / Puesto o Galería</label>
          <input
            type="text"
            maxLength={255}
            className="admin-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Av. Grigotá, Galería Central Pasillo 3 Puesto 18"
          />
        </div>

        <div className="admin-field">
          <label>Notas y observaciones del proveedor</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Horarios de atención, cuentas bancarias para QR, referencias..."
          />
        </div>

        <label className="pur-checkbox-row">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Proveedor activo para nuevas órdenes de compra</span>
        </label>
      </form>
    </BaseModal>
  );
}
