import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const ENTRY_TYPES = [
  { value: 'purchase_in', label: 'Ingreso por compra / reposición' },
  { value: 'initial_stock', label: 'Carga de stock inicial' },
  { value: 'return_in', label: 'Devolución de cliente' },
  { value: 'adjustment_in', label: 'Ajuste positivo manual' },
];

const EXIT_TYPES = [
  { value: 'adjustment_out', label: 'Ajuste negativo de inventario' },
  { value: 'damaged_out', label: 'Baja por merma / prenda dañada' },
];

const PRESET_REASONS = {
  entry: [
    'Reposición de proveedor',
    'Carga de inventario inicial',
    'Devolución en buen estado',
    'Sobrante encontrado en revisión',
  ],
  exit: [
    'Prenda dañada / falla de fábrica',
    'Faltante detectado en piso de venta',
    'Muestra / uso interno de tienda',
    'Corrección de carga duplicada',
  ],
  exact: [
    'Cuadre tras verificación física en estante',
    'Ajuste por diferencia de conteo',
    'Sincronización con stock real de depósito',
  ],
};

function formatCurrency(val) {
  return `Bs. ${Number(val || 0).toFixed(2)}`;
}

export default function StockMovementModal({
  isOpen,
  onClose,
  variant,
  product,
  warehouses = [],
  metaLoading = false,
  selectedWarehouseId,
  initialTab = 'entry',
  onSaved,
}) {
  const [tab, setTab] = useState(initialTab);
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('purchase_in');
  const [quantity, setQuantity] = useState('1');
  const [targetQuantity, setTargetQuantity] = useState('0');
  const [unitCost, setUnitCost] = useState('0');
  const [updateVariantCost, setUpdateVariantCost] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultWhId = useMemo(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      return String(selectedWarehouseId);
    }
    const activeWhs = warehouses.filter((w) => w.is_active);
    const def = activeWhs.find((w) => w.is_default) || activeWhs[0];
    return def ? String(def.id) : '';
  }, [selectedWarehouseId, warehouses]);

  const currentWarehouseStock = useMemo(() => {
    if (!variant || !warehouseId) {
      return { quantity_on_hand: 0, quantity_reserved: 0, available: 0 };
    }
    const found = (variant.warehouse_breakdown || []).find(
      (b) => String(b.warehouse_id) === String(warehouseId)
    );
    return found || { quantity_on_hand: 0, quantity_reserved: 0, available: 0 };
  }, [variant, warehouseId]);

  useEffect(() => {
    if (!isOpen || !variant) return;
    setTab(initialTab);
    setWarehouseId(defaultWhId);
    setMovementType(initialTab === 'exit' ? 'adjustment_out' : 'purchase_in');
    setQuantity('1');
    setUnitCost(String(Number(variant.cost_price || 0).toFixed(2)));
    setUpdateVariantCost(false);
    setNotes('');
    setError('');
  }, [isOpen, variant, initialTab, defaultWhId]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'entry') {
      setMovementType('purchase_in');
    } else if (tab === 'exit') {
      setMovementType('adjustment_out');
    }
    setTargetQuantity(String(currentWarehouseStock.quantity_on_hand));
    setError('');
  }, [tab, currentWarehouseStock.quantity_on_hand, isOpen]);

  const preview = useMemo(() => {
    const current = Number(currentWarehouseStock.quantity_on_hand || 0);
    if (tab === 'exact') {
      const target = Math.max(0, Number(targetQuantity || 0));
      const delta = target - current;
      return { current, delta, final: target };
    }
    const qty = Math.max(0, Number(quantity || 0));
    const delta = tab === 'entry' ? qty : -qty;
    return { current, delta, final: current + delta };
  }, [tab, quantity, targetQuantity, currentWarehouseStock.quantity_on_hand]);

  const warehouseOptions = warehouses
    .filter((w) => w.is_active)
    .map((w) => ({
      value: String(w.id),
      label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!variant || !warehouseId) return;

    if (notes.trim().length < 4) {
      setError('Debes ingresar una justificación clara (mínimo 4 caracteres).');
      return;
    }

    if (tab === 'exact' && preview.delta === 0) {
      setError('El stock ingresado coincide con el stock actual en este almacén.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        warehouse_id: Number(warehouseId),
        variant_id: variant.id,
        mode: tab === 'exact' ? 'set_exact' : 'movement',
        notes: notes.trim(),
      };

      if (tab === 'exact') {
        payload.target_quantity = Number(targetQuantity || 0);
      } else {
        payload.movement_type = movementType;
        payload.quantity = Number(quantity || 0);
        if (tab === 'entry' && unitCost !== '') {
          payload.unit_cost = Number(unitCost);
          payload.update_variant_cost = updateVariantCost;
        }
      }

      await inventoryService.recordMovement(payload);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  if (!variant) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Control de existencias"
      title={`Movimiento de Stock · ${variant.sku}`}
      size="wide"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="stock-movement-form"
            className={tab === 'exit' ? 'admin-btn admin-btn-danger' : 'admin-btn admin-btn-primary'}
            disabled={saving}
          >
            {saving ? 'Registrando...' : 'Confirmar movimiento'}
          </button>
        </>
      }
    >
      <div className="inv-variant-banner">
        <div>
          <div className="inv-variant-banner-title">
            {product?.name} · {variant.variant_label}
          </div>
          <div className="inv-variant-banner-sub">
            SKU: <strong>{variant.sku}</strong> · Costo: {formatCurrency(variant.cost_price)} · PVP:{' '}
            {formatCurrency(variant.base_price)}
          </div>
        </div>
        <div className="inv-variant-banner-stats">
          <div className="inv-metric-pill">
            <span className="inv-metric-pill-label">En almacén</span>
            <span className="inv-metric-pill-val">{currentWarehouseStock.quantity_on_hand} u.</span>
          </div>
          <div className="inv-metric-pill">
            <span className="inv-metric-pill-label">Reservado</span>
            <span className="inv-metric-pill-val">{currentWarehouseStock.quantity_reserved} u.</span>
          </div>
        </div>
      </div>

      <div className="inv-mode-switch-bar" role="tablist">
        <button
          type="button"
          className={`inv-mode-btn ${tab === 'entry' ? 'is-active' : ''}`}
          onClick={() => setTab('entry')}
        >
          Ingreso (+)
        </button>
        <button
          type="button"
          className={`inv-mode-btn ${tab === 'exit' ? 'is-active' : ''}`}
          onClick={() => setTab('exit')}
        >
          Salida / Merma (-)
        </button>
        <button
          type="button"
          className={`inv-mode-btn ${tab === 'exact' ? 'is-active' : ''}`}
          onClick={() => setTab('exact')}
        >
          Fijar Stock Exacto
        </button>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="stock-movement-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Almacén</label>
            <CustomSelect
              value={warehouseId}
              onChange={(val) => setWarehouseId(val)}
              options={warehouseOptions}
              loading={metaLoading}
              loadingText="Cargando almacenes..."
              placeholder="Seleccionar almacén..."
            />
          </div>

          {tab !== 'exact' ? (
            <div className="admin-field">
              <label>Tipo de operación</label>
              <CustomSelect
                value={movementType}
                onChange={(val) => setMovementType(val)}
                options={tab === 'entry' ? ENTRY_TYPES : EXIT_TYPES}
              />
            </div>
          ) : (
            <div className="admin-field">
              <label>Stock físico real</label>
              <input
                type="number"
                min="0"
                step="1"
                className="admin-input"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                required
              />
            </div>
          )}

          {tab !== 'exact' && (
            <div className="admin-field">
              <label>Cantidad (unidades)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="admin-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
          )}

          {tab === 'entry' && (
            <div className="admin-field">
              <label>Costo unitario de ingreso (Bs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="admin-input"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              <label className="inv-checkbox-row">
                <input
                  type="checkbox"
                  checked={updateVariantCost}
                  onChange={(e) => setUpdateVariantCost(e.target.checked)}
                />
                <span>Actualizar costo maestro de la variante</span>
              </label>
            </div>
          )}
        </div>

        <div className="admin-field">
          <label>Justificación obligatoria *</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe el motivo del ingreso, merma o ajuste para el Kardex..."
            required
          />
          <div className="inv-preset-pills">
            {(PRESET_REASONS[tab] || []).map((reason) => (
              <button
                key={reason}
                type="button"
                className="inv-preset-pill"
                onClick={() => setNotes(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div className="inv-preview-strip">
          <div className="inv-preview-cell">
            <span className="inv-preview-label">Stock Actual</span>
            <span className="inv-preview-val">{preview.current} u.</span>
          </div>
          <div className="inv-preview-cell">
            <span className="inv-preview-label">Variación</span>
            <span
              className={`inv-preview-val ${
                preview.delta > 0 ? 'inv-delta-pos' : preview.delta < 0 ? 'inv-delta-neg' : ''
              }`}
            >
              {preview.delta > 0 ? `+${preview.delta}` : preview.delta} u.
            </span>
          </div>
          <div className="inv-preview-cell">
            <span className="inv-preview-label">Saldo Final Proyectado</span>
            <span className={`inv-preview-val ${preview.final < 0 ? 'inv-delta-neg' : ''}`}>
              {preview.final} u.
            </span>
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
