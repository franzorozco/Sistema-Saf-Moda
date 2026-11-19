import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { customerService } from '../../../services/admin/customerService';

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'CI', label: 'Cédula de Identidad (CI)' },
  { value: 'DNI', label: 'DNI' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'non_binary', label: 'No binario' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

const TIER_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'vip', label: 'VIP' },
  { value: 'wholesale', label: 'Mayorista' },
];

export default function CustomerFormModal({
  isOpen,
  editingCustomer,
  branches,
  onClose,
  onSaved,
}) {
  const [person, setPerson] = useState({});
  const [customer, setCustomer] = useState({});
  const [hasSystemAccess, setHasSystemAccess] = useState(false);
  const [account, setAccount] = useState({});
  const [address, setAddress] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setShowPassword(false);
    setError('');

    if (editingCustomer) {
      const p = editingCustomer.person || {};
      const u = editingCustomer.user;

      setPerson({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        document_type: p.document_type || '',
        document_number: p.document_number || '',
        phone: p.phone || '',
        email: p.email || '',
        birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : '',
        gender: p.gender || '',
      });

      setCustomer({
        customer_code: editingCustomer.customer_code || '',
        customer_tier: editingCustomer.customer_tier || 'regular',
        store_credit:
          editingCustomer.store_credit !== null ? String(editingCustomer.store_credit) : '0',
        accepts_marketing: !!editingCustomer.accepts_marketing,
        acquired_branch_id: editingCustomer.acquired_branch_id
          ? String(editingCustomer.acquired_branch_id)
          : '',
        is_active: editingCustomer.is_active !== false,
        notes: editingCustomer.notes || '',
      });

      setHasSystemAccess(!!u && u.status !== 'inactive');
      setAccount({
        email: u?.email || p.email || '',
        username: u?.username || '',
        password: '',
      });
      setAddress({});
    } else {
      setPerson({
        first_name: '',
        last_name: '',
        document_type: 'CI',
        document_number: '',
        phone: '',
        email: '',
        birth_date: '',
        gender: 'female',
      });
      setCustomer({
        customer_code: '',
        customer_tier: 'regular',
        loyalty_points: '0',
        store_credit: '0',
        accepts_marketing: false,
        acquired_branch_id: branches?.[0]?.id ? String(branches[0].id) : '',
        is_active: true,
        notes: '',
      });
      setHasSystemAccess(false);
      setAccount({ email: '', username: '', password: '' });
      setAddress({
        label: 'Casa',
        city: '',
        address_line1: '',
        reference_notes: '',
      });
    }
  }, [isOpen, editingCustomer, branches]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      const payload = {
        person,
        customer: {
          ...customer,
          acquired_branch_id: customer.acquired_branch_id
            ? Number(customer.acquired_branch_id)
            : null,
          store_credit: customer.store_credit !== '' ? Number(customer.store_credit) : 0,
          loyalty_points: !editingCustomer
            ? Number(customer.loyalty_points || 0)
            : undefined,
        },
        has_system_access: hasSystemAccess,
      };

      if (hasSystemAccess) {
        payload.account = account;
      }

      if (!editingCustomer && address.city && address.address_line1) {
        payload.address = address;
      }

      const res = editingCustomer
        ? await customerService.update(editingCustomer.id, payload)
        : await customerService.create(payload);

      onSaved(res.data, !!editingCustomer);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={editingCustomer ? editingCustomer.customer_code : 'Nuevo Cliente'}
      title={
        editingCustomer
          ? `${editingCustomer.person?.first_name || ''} ${editingCustomer.person?.last_name || ''}`.trim()
          : 'Registrar Cliente'
      }
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="customer-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving
              ? 'Guardando...'
              : editingCustomer
                ? 'Guardar Cambios'
                : 'Registrar Cliente'}
          </button>
        </>
      }
    >
      <form id="customer-form" className="admin-form" onSubmit={handleSubmit}>
        {error && <div className="admin-alert">{error}</div>}

        <div className="cust-form-section">
          <div className="cust-form-section-title">
            <span>1. Datos Personales</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Nombre</label>
              <input
                className="admin-input"
                placeholder="Ej. Sofía"
                value={person.first_name || ''}
                onChange={(e) => setPerson({ ...person, first_name: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Apellido</label>
              <input
                className="admin-input"
                placeholder="Ej. Justiniano"
                value={person.last_name || ''}
                onChange={(e) => setPerson({ ...person, last_name: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Teléfono / WhatsApp</label>
              <input
                className="admin-input"
                placeholder="Ej. 70098765"
                value={person.phone || ''}
                onChange={(e) => setPerson({ ...person, phone: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Correo Electrónico</label>
              <input
                className="admin-input"
                placeholder="cliente@correo.com"
                value={person.email || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setPerson({ ...person, email: val });
                  if (hasSystemAccess && !editingCustomer?.user) {
                    setAccount((prev) => ({ ...prev, email: val }));
                  }
                }}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Tipo Documento</label>
              <CustomSelect
                value={person.document_type || ''}
                onChange={(val) => setPerson({ ...person, document_type: val })}
                options={DOC_TYPE_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Nro. Documento / NIT</label>
              <input
                className="admin-input"
                placeholder="Ej. 6281904"
                value={person.document_number || ''}
                onChange={(e) => setPerson({ ...person, document_number: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Género</label>
              <CustomSelect
                value={person.gender || ''}
                onChange={(val) => setPerson({ ...person, gender: val })}
                options={GENDER_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Fecha Nacimiento</label>
              <input
                type="date"
                className="admin-input"
                value={person.birth_date || ''}
                onChange={(e) => setPerson({ ...person, birth_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="cust-form-section">
          <div className="cust-form-section-title">
            <span>2. Perfil Comercial y Fidelidad</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código Cliente (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. CL0001)"
                value={customer.customer_code || ''}
                onChange={(e) =>
                  setCustomer({ ...customer, customer_code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="admin-field">
              <label>Nivel / Categoría</label>
              <CustomSelect
                value={customer.customer_tier || 'regular'}
                onChange={(val) => setCustomer({ ...customer, customer_tier: val })}
                options={TIER_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Sucursal de Registro</label>
              <CustomSelect
                value={customer.acquired_branch_id || ''}
                onChange={(val) => setCustomer({ ...customer, acquired_branch_id: val })}
                options={[
                  { value: '', label: 'Ninguna (General)' },
                  ...(branches || []).map((b) => ({
                    value: String(b.id),
                    label: `${b.name} (${b.code})`,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            {!editingCustomer && (
              <div className="admin-field">
                <label>Puntos Iniciales</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={customer.loyalty_points ?? '0'}
                  onChange={(e) => setCustomer({ ...customer, loyalty_points: e.target.value })}
                />
              </div>
            )}
            <div className="admin-field">
              <label>Crédito en Tienda (Bs.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="admin-input"
                value={customer.store_credit ?? '0'}
                onChange={(e) => setCustomer({ ...customer, store_credit: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Estado y Preferencias</label>
              <div className="cust-switches-row">
                <label className="cust-switch-item">
                  <span className="admin-switch">
                    <input
                      type="checkbox"
                      checked={customer.is_active !== false}
                      onChange={(e) => setCustomer({ ...customer, is_active: e.target.checked })}
                    />
                    <span className="admin-switch-slider" />
                  </span>
                  Cliente activo
                </label>
                <label className="cust-switch-item">
                  <span className="admin-switch">
                    <input
                      type="checkbox"
                      checked={!!customer.accepts_marketing}
                      onChange={(e) =>
                        setCustomer({ ...customer, accepts_marketing: e.target.checked })
                      }
                    />
                    <span className="admin-switch-slider" />
                  </span>
                  Acepta promociones
                </label>
              </div>
            </div>
          </div>

          <div className="admin-field">
            <label>Notas</label>
            <textarea
              className="admin-textarea"
              rows="2"
              placeholder="Tallas habituales, preferencias de prendas, observaciones..."
              value={customer.notes || ''}
              onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="cust-form-section">
          <div className="cust-form-section-title">
            <span>3. Acceso a Tienda Web (Opcional)</span>
            <label className="cust-switch-item">
              <span className="admin-switch">
                <input
                  type="checkbox"
                  checked={hasSystemAccess}
                  onChange={(e) => setHasSystemAccess(e.target.checked)}
                />
                <span className="admin-switch-slider" />
              </span>
              Habilitar acceso
            </label>
          </div>

          {hasSystemAccess ? (
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Correo de Acceso</label>
                <input
                  className="admin-input"
                  placeholder="cliente@correo.com"
                  value={account.email || ''}
                  onChange={(e) => setAccount({ ...account, email: e.target.value })}
                  required
                />
              </div>
              <div className="admin-field">
                <label>Usuario (Opcional)</label>
                <input
                  className="admin-input"
                  placeholder="Ej. sofiaj"
                  value={account.username || ''}
                  onChange={(e) => setAccount({ ...account, username: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>
                  {editingCustomer?.user ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                </label>
                <div className="cust-pass-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="admin-input"
                    placeholder={
                      editingCustomer?.user ? 'Dejar vacío para mantener' : 'Mínimo 4 caracteres'
                    }
                    value={account.password || ''}
                    onChange={(e) => setAccount({ ...account, password: e.target.value })}
                    required={!editingCustomer?.user}
                  />
                  <button
                    type="button"
                    className="cust-pass-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="cust-section-note">
              Cliente presencial sin cuenta web. Puedes habilitarle acceso a tienda online cuando lo desees.
            </div>
          )}
        </div>

        {!editingCustomer && (
          <div className="cust-form-section">
            <div className="cust-form-section-title">
              <span>4. Dirección Principal (Opcional)</span>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Etiqueta</label>
                <input
                  className="admin-input"
                  placeholder="Casa, Oficina..."
                  value={address.label || ''}
                  onChange={(e) => setAddress({ ...address, label: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Ciudad</label>
                <input
                  className="admin-input"
                  placeholder="Ej. Santa Cruz"
                  value={address.city || ''}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Dirección</label>
                <input
                  className="admin-input"
                  placeholder="Av. / Calle y número"
                  value={address.address_line1 || ''}
                  onChange={(e) => setAddress({ ...address, address_line1: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Referencia</label>
                <input
                  className="admin-input"
                  placeholder="Edificio, piso o referencia..."
                  value={address.reference_notes || ''}
                  onChange={(e) => setAddress({ ...address, reference_notes: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </BaseModal>
  );
}
