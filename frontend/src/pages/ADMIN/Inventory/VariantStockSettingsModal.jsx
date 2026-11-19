import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

export default function VariantStockSettingsModal({
  isOpen,
  onClose,
  variant,
  product,
  warehouses = [],
  metaLoading = false,
  selectedWarehouseId,
  onSaved,
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [minAlert, setMinAlert] = useState('3');
  const [maxLimit, setMaxLimit] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultWhId = useMemo(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      return String(selectedWarehouseId);
    }
    const def = warehouses.find((w) => w.is_default) || warehouses[0];
    return def ? String(def.id) : '';
  }, [selectedWarehouseId, warehouses]);

  useEffect(() => {
    if (!isOpen || !variant) return;
    setWarehouseId(defaultWhId);
    setError('');
  }, [isOpen, variant, defaultWhId]);

  useEffect(() => {
    if (!isOpen || !variant || !warehouseId) return;
    const found = (variant.warehouse_breakdown || []).find(
      (b) => String(b.warehouse_id) === String(warehouseId)
    );
    setMinAlert(String(found ? found.min_stock_alert : variant.min_stock_alert ?? 3));
    setMaxLimit(found?.max_stock_limit !== null && found?.max_stock_limit !== undefined ? String(found.max_stock_limit) : '');
    setBinLocation(found?.bin_location || '');
  }, [isOpen, variant, warehouseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!variant || !warehouseId) return;

    const minVal = parseInt(minAlert || '0', 10);
    const maxVal = maxLimit !== '' ? parseInt(maxLimit, 10) : null;

    if (maxVal !== null && maxVal < minVal) {
      setError('El límite máximo no puede ser menor al stock mínimo de alerta.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await inventoryService.updateSettings({
        warehouse_id: Number(warehouseId),
        variant_id: variant.id,
        min_stock_alert: minVal,
        max_stock_limit: maxVal,
        bin_location: binLocation.trim() || null,
      });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los parámetros.');
    } finally {
      setSaving(false);
    }
  };

  if (!variant) return null;

  const warehouseOptions = warehouses
    .filter((w) => w.is_active)
    .map((w) => ({
      value: String(w.id),
      label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
    }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Parámetros de Reposición"
      title={`Alertas y Ubicación · ${variant.sku}`}
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="variant-settings-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar parámetros'}
          </button>
        </>
      }
    >
      <div className="inv-variant-banner">
        <div>
          <div className="inv-variant-banner-title">
            {product?.name} · {variant.variant_label}
          </div>
          <div className="inv-variant-banner-sub">SKU: {variant.sku}</div>
        </div>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="variant-settings-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-field">
          <label>Almacén</label>
          <CustomSelect
            value={warehouseId}
            onChange={(val) => setWarehouseId(val)}
            options={warehouseOptions}
            loading={metaLoading}
            loadingText="Cargando almacenes..."
          />
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Stock mínimo de alerta *</label>
            <input
              type="number"
              min="0"
              step="1"
              className="admin-input"
              value={minAlert}
              onChange={(e) => setMinAlert(e.target.value)}
              required
            />
          </div>

          <div className="admin-field">
            <label>Stock máximo (opcional)</label>
            <input
              type="number"
              min="0"
              step="1"
              className="admin-input"
              value={maxLimit}
              onChange={(e) => setMaxLimit(e.target.value)}
              placeholder="Sin límite"
            />
          </div>
        </div>

        <div className="admin-field">
          <label>Ubicación física (Pasillo / Perchero / Estante)</label>
          <input
            type="text"
            maxLength={50}
            className="admin-input"
            value={binLocation}
            onChange={(e) => setBinLocation(e.target.value)}
            placeholder="Ej: VIT-A2, EST-04, PERCH-DAMAS"
          />
        </div>
      </form>
    </BaseModal>
  );
}
