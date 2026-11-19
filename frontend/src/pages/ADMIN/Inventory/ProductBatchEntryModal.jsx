import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const BATCH_ENTRY_TYPES = [
  { value: 'purchase_in', label: 'Ingreso por compra / proveedor' },
  { value: 'initial_stock', label: 'Carga de stock inicial' },
  { value: 'return_in', label: 'Devolución en lote' },
  { value: 'adjustment_in', label: 'Ajuste positivo en lote' },
];

const BATCH_REASONS = [
  'Recepción de mercadería / lote nuevo',
  'Reposición completa de tallas y colores',
  'Carga inicial de inventario físico',
];

export default function ProductBatchEntryModal({
  isOpen,
  onClose,
  product,
  warehouses = [],
  metaLoading = false,
  selectedWarehouseId,
  onSaved,
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('purchase_in');
  const [notes, setNotes] = useState('');
  const [updateVariantCost, setUpdateVariantCost] = useState(false);
  const [bulkQty, setBulkQty] = useState('5');
  const [rows, setRows] = useState({});
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
    if (!isOpen || !product) return;
    setWarehouseId(defaultWhId);
    setMovementType('purchase_in');
    setNotes('');
    setUpdateVariantCost(false);
    setBulkQty('5');
    setError('');

    const initialRows = {};
    (product.variants || []).forEach((v) => {
      initialRows[v.id] = {
        quantity: '0',
        unit_cost: String(Number(v.cost_price || 0).toFixed(2)),
      };
    });
    setRows(initialRows);
  }, [isOpen, product, defaultWhId]);

  const getCurrentStockForVariant = (variant) => {
    const found = (variant.warehouse_breakdown || []).find(
      (b) => String(b.warehouse_id) === String(warehouseId)
    );
    return found ? found.quantity_on_hand : 0;
  };

  const applyQtyToAll = () => {
    const parsed = Math.max(0, parseInt(bulkQty || '0', 10) || 0);
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], quantity: String(parsed) };
      });
      return next;
    });
  };

  const handleRowChange = (variantId, field, value) => {
    setRows((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value,
      },
    }));
  };

  const activeItems = useMemo(() => {
    if (!product) return [];
    return (product.variants || [])
      .map((v) => ({
        variant_id: v.id,
        quantity: parseInt(rows[v.id]?.quantity || '0', 10) || 0,
        unit_cost: Number(rows[v.id]?.unit_cost ?? v.cost_price ?? 0),
      }))
      .filter((item) => item.quantity > 0);
  }, [product, rows]);

  const totalUnitsToAdd = useMemo(
    () => activeItems.reduce((acc, item) => acc + item.quantity, 0),
    [activeItems]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product || !warehouseId) return;

    if (activeItems.length === 0) {
      setError('Ingresa una cantidad mayor a 0 en al menos una variante.');
      return;
    }

    if (notes.trim().length < 4) {
      setError('La justificación del ingreso es obligatoria (mínimo 4 caracteres).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await inventoryService.recordBatchEntry({
        warehouse_id: Number(warehouseId),
        product_id: product.id,
        movement_type: movementType,
        notes: notes.trim(),
        update_variant_cost: updateVariantCost,
        items: activeItems,
      });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al registrar ingreso masivo.');
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

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
      eyebrow={`Producto · ${product.sku_prefix}`}
      title={`Ingreso Masivo de Stock · ${product.name}`}
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="batch-entry-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving
              ? 'Registrando...'
              : `Registrar ingreso (+${totalUnitsToAdd} u. en ${activeItems.length} var.)`}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="batch-entry-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Almacén destino</label>
            <CustomSelect
              value={warehouseId}
              onChange={(val) => setWarehouseId(val)}
              options={warehouseOptions}
              loading={metaLoading}
              loadingText="Cargando almacenes..."
            />
          </div>

          <div className="admin-field">
            <label>Concepto de ingreso</label>
            <CustomSelect
              value={movementType}
              onChange={(val) => setMovementType(val)}
              options={BATCH_ENTRY_TYPES}
            />
          </div>

          <div className="admin-field">
            <label>Rellenar cantidad a todas</label>
            <div className="admin-actions-row">
              <input
                type="number"
                min="0"
                step="1"
                className="admin-input admin-input-sm"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
              />
              <button type="button" className="admin-btn admin-btn-sm" onClick={applyQtyToAll}>
                Aplicar a todas
              </button>
            </div>
          </div>

          <div className="admin-field">
            <label>Actualización de costos</label>
            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={updateVariantCost}
                onChange={(e) => setUpdateVariantCost(e.target.checked)}
              />
              <span>Guardar costo ingresado en variante</span>
            </label>
          </div>
        </div>

        <div className="modal-table-box">
          <table className="inv-variants-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Variante / Atributos</th>
                <th className="is-num">Stock Actual</th>
                <th className="is-num">Cantidad (+)</th>
                <th className="is-num">Costo Unit. (Bs.)</th>
                <th className="is-num">Stock Final</th>
              </tr>
            </thead>
            <tbody>
              {(product.variants || []).map((v) => {
                const current = getCurrentStockForVariant(v);
                const addQty = Math.max(0, parseInt(rows[v.id]?.quantity || '0', 10) || 0);
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="admin-code-tag">{v.sku}</span>
                    </td>
                    <td>{v.variant_label}</td>
                    <td className="is-num">{current}</td>
                    <td className="is-num">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="admin-input admin-input-sm inv-count-input"
                        value={rows[v.id]?.quantity ?? '0'}
                        onChange={(e) => handleRowChange(v.id, 'quantity', e.target.value)}
                      />
                    </td>
                    <td className="is-num">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-input admin-input-sm inv-count-input"
                        value={rows[v.id]?.unit_cost ?? '0'}
                        onChange={(e) => handleRowChange(v.id, 'unit_cost', e.target.value)}
                      />
                    </td>
                    <td className="is-num">
                      <strong className={addQty > 0 ? 'inv-delta-pos' : ''}>
                        {current + addQty}
                      </strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="admin-field">
          <label>Justificación / Nota de respaldo *</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Factura compra #104, reposición colección temporada..."
            required
          />
          <div className="inv-preset-pills">
            {BATCH_REASONS.map((reason) => (
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
      </form>
    </BaseModal>
  );
}
