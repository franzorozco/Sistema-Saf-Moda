import CustomSelect from '../../../components/CustomSelect';

const TIER_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'vip', label: 'VIP' },
  { value: 'wholesale', label: 'Mayorista' },
];

export default function CustomerFormFields({ value, onChange, branches }) {
  const updateField = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  const updateAddress = (field, val) => {
    onChange({
      ...value,
      address: {
        ...(value.address || {}),
        [field]: val,
      },
    });
  };

  return (
    <div className="user-form-section">
      <div className="user-form-section-title">
        <span>Perfil Comercial (Cliente)</span>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Código Cliente (Opcional)</label>
          <input
            className="admin-input"
            placeholder="Automático (ej. CL0001)"
            value={value.customer_code || ''}
            onChange={(e) => updateField('customer_code', e.target.value.toUpperCase())}
          />
        </div>
        <div className="admin-field">
          <label>Nivel / Categoría</label>
          <CustomSelect
            value={value.customer_tier || 'regular'}
            onChange={(val) => updateField('customer_tier', val)}
            options={TIER_OPTIONS}
          />
        </div>
        <div className="admin-field">
          <label>Sucursal de Registro</label>
          <CustomSelect
            value={value.acquired_branch_id || ''}
            onChange={(val) => updateField('acquired_branch_id', val)}
            options={[
              { value: '', label: 'Ninguna (General)' },
              ...branches.map((b) => ({
                value: String(b.id),
                label: `${b.name} (${b.code})`,
              })),
            ]}
          />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Crédito en Tienda (Bs.)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            placeholder="0.00"
            value={value.store_credit ?? ''}
            onChange={(e) => updateField('store_credit', e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label>Preferencias</label>
          <div className="user-switches-row">
            <label className="user-switch-item">
              <span className="admin-switch">
                <input
                  type="checkbox"
                  checked={!!value.accepts_marketing}
                  onChange={(e) => updateField('accepts_marketing', e.target.checked)}
                />
                <span className="admin-switch-slider" />
              </span>
              Acepta promociones
            </label>
            <label className="user-switch-item">
              <span className="admin-switch">
                <input
                  type="checkbox"
                  checked={value.is_active !== false}
                  onChange={(e) => updateField('is_active', e.target.checked)}
                />
                <span className="admin-switch-slider" />
              </span>
              Cliente activo
            </label>
          </div>
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Ciudad (Opcional)</label>
          <input
            className="admin-input"
            placeholder="Ej. Santa Cruz"
            value={value.address?.city || ''}
            onChange={(e) => updateAddress('city', e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label>Dirección Principal (Opcional)</label>
          <input
            className="admin-input"
            placeholder="Av. / Calle y número"
            value={value.address?.address_line1 || ''}
            onChange={(e) => updateAddress('address_line1', e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label>Referencia (Opcional)</label>
          <input
            className="admin-input"
            placeholder="Casa, edificio o punto de referencia"
            value={value.address?.reference_notes || ''}
            onChange={(e) => updateAddress('reference_notes', e.target.value)}
          />
        </div>
      </div>

      <div className="admin-field">
        <label>Notas del Cliente</label>
        <textarea
          className="admin-textarea"
          rows="2"
          placeholder="Tallas habituales, preferencias de estilo, observaciones..."
          value={value.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
        />
      </div>
    </div>
  );
}
