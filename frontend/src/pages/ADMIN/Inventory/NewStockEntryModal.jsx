import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const ENTRY_TYPES = [
  { value: 'purchase_in', label: 'Ingreso por compra / proveedor' },
  { value: 'initial_stock', label: 'Carga de stock inicial en sucursal' },
  { value: 'return_in', label: 'Devolución de cliente' },
  { value: 'adjustment_in', label: 'Ajuste positivo de inventario' },
];

const ENTRY_REASONS = [
  'Recepción de mercadería en sucursal',
  'Carga inicial de stock para apertura / vitrina',
  'Reposición de tallas y colores desde proveedor',
];

export default function NewStockEntryModal({
  isOpen,
  onClose,
  branches = [],
  warehouses = [],
  catalogProducts = [],
  metaLoading = false,
  selectedBranchId = 'all',
  selectedWarehouseId = 'all',
  onSaved,
}) {
  const isBranchLocked = selectedBranchId !== 'all';

  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [productVariants, setProductVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [movementType, setMovementType] = useState('purchase_in');
  const [notes, setNotes] = useState('');
  const [updateVariantCost, setUpdateVariantCost] = useState(false);
  const [bulkQty, setBulkQty] = useState('5');
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeBranches = useMemo(
    () => branches.filter((b) => b.is_active),
    [branches]
  );

  const effectiveBranchId = isBranchLocked ? String(selectedBranchId) : branchId;

  const branchObj = useMemo(
    () => activeBranches.find((b) => String(b.id) === String(effectiveBranchId)) || null,
    [activeBranches, effectiveBranchId]
  );

  const warehousesForBranch = useMemo(() => {
    if (!effectiveBranchId) return [];
    return warehouses.filter(
      (w) => String(w.branch_id) === String(effectiveBranchId) && w.is_active
    );
  }, [warehouses, effectiveBranchId]);

  const selectedProduct = useMemo(
    () => catalogProducts.find((p) => String(p.id) === String(productId)) || null,
    [catalogProducts, productId]
  );

  // Inicializar al abrir modal
  useEffect(() => {
    if (!isOpen) return;
    setBranchId(isBranchLocked ? String(selectedBranchId) : '');
    setProductId('');
    setProductVariants([]);
    setMovementType('purchase_in');
    setNotes('');
    setUpdateVariantCost(false);
    setBulkQty('5');
    setRows({});
    setError('');
  }, [isOpen, isBranchLocked, selectedBranchId]);

  // Cargar variantes bajo demanda cuando se elige un producto
  useEffect(() => {
    if (!isOpen || !productId) {
      setProductVariants([]);
      return;
    }
    let cancelled = false;
    setVariantsLoading(true);
    setError('');
    inventoryService
      .getProductVariants(productId)
      .then((res) => {
        if (!cancelled) {
          setProductVariants(res.data?.variants || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar las variantes del producto.');
          setProductVariants([]);
        }
      })
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId]);

  // Sincronizar almacén cuando cambia la sucursal
  useEffect(() => {
    if (!isOpen) return;
    if (!effectiveBranchId) {
      setWarehouseId('');
      return;
    }
    if (
      isBranchLocked &&
      selectedWarehouseId !== 'all' &&
      warehousesForBranch.some((w) => String(w.id) === String(selectedWarehouseId))
    ) {
      setWarehouseId(String(selectedWarehouseId));
      return;
    }
    const defWh = warehousesForBranch.find((w) => w.is_default) || warehousesForBranch[0];
    setWarehouseId(defWh ? String(defWh.id) : '');
  }, [isOpen, effectiveBranchId, isBranchLocked, selectedWarehouseId, warehousesForBranch]);

  // Inicializar filas de variantes cuando llegan las variantes del producto o cambia almacén
  useEffect(() => {
    if (!selectedProduct || productVariants.length === 0) {
      setRows({});
      return;
    }
    const nextRows = {};
    productVariants.forEach((v) => {
      const existingWh = (v.warehouse_breakdown || []).find(
        (b) => String(b.warehouse_id) === String(warehouseId)
      );
      nextRows[v.id] = {
        quantity: '0',
        unit_cost: String(Number(v.cost_price || 0).toFixed(2)),
        bin_location: existingWh?.bin_location || '',
      };
    });
    setRows(nextRows);
  }, [selectedProduct, productVariants, warehouseId]);

  const getCurrentStockForVariant = (variant) => {
    if (!warehouseId) return 0;
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
    if (!selectedProduct || productVariants.length === 0) return [];
    return productVariants
      .map((v) => ({
        variant_id: v.id,
        quantity: parseInt(rows[v.id]?.quantity || '0', 10) || 0,
        unit_cost: Number(rows[v.id]?.unit_cost ?? v.cost_price ?? 0),
        bin_location: (rows[v.id]?.bin_location || '').trim() || null,
      }))
      .filter((item) => item.quantity > 0);
  }, [selectedProduct, productVariants, rows]);

  const totalUnitsToAdd = useMemo(
    () => activeItems.reduce((acc, item) => acc + item.quantity, 0),
    [activeItems]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveBranchId) {
      setError('Selecciona primero la sucursal donde ingresarás el stock.');
      return;
    }
    if (!warehouseId) {
      setError('Esta sucursal no tiene un almacén activo asignado.');
      return;
    }
    if (!selectedProduct) {
      setError('Selecciona el producto del catálogo para ingresar stock.');
      return;
    }
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
        product_id: selectedProduct.id,
        movement_type: movementType,
        notes: notes.trim(),
        update_variant_cost: updateVariantCost,
        items: activeItems,
      });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ingreso de stock.');
    } finally {
      setSaving(false);
    }
  };

  const branchOptions = activeBranches.map((b) => ({
    value: String(b.id),
    label: `${b.code} · ${b.name} (${b.city})`,
  }));

  const warehouseOptions = warehousesForBranch.map((w) => ({
    value: String(w.id),
    label: `${w.code} · ${w.name}`,
  }));

  const productOptions = catalogProducts.map((p) => ({
    value: String(p.id),
    label: `${p.sku_prefix} · ${p.name}${p.brand_name ? ` (${p.brand_name})` : ''}`,
  }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Abastecimiento de Sucursal"
      title="Nuevo Ingreso de Stock"
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="new-stock-entry-form"
            className="admin-btn admin-btn-primary"
            disabled={saving || !selectedProduct || activeItems.length === 0}
          >
            {saving
              ? 'Registrando...'
              : `Registrar Ingreso (+${totalUnitsToAdd} u. en ${activeItems.length} var.)`}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="new-stock-entry-form" className="admin-form" onSubmit={handleSubmit}>
        {isBranchLocked && branchObj ? (
          <div className="inv-variant-banner">
            <div>
              <div className="inv-variant-banner-title">
                Sucursal destino: {branchObj.code} · {branchObj.name}
              </div>
              <div className="inv-variant-banner-sub">
                {branchObj.city}
                {warehousesForBranch.length === 1
                  ? ` · Almacén: ${warehousesForBranch[0].code} ${warehousesForBranch[0].name}`
                  : ''}
              </div>
            </div>
            <span className="inv-stock-badge is-ok">Sucursal seleccionada</span>
          </div>
        ) : (
          <div className="admin-field">
            <label>Sucursal destino *</label>
            <CustomSelect
              value={branchId}
              onChange={setBranchId}
              options={branchOptions}
              loading={metaLoading}
              loadingText="Cargando sucursales..."
              placeholder="Elige la sucursal donde ingresará el stock..."
            />
          </div>
        )}

        <div className="admin-form-grid">
          {warehousesForBranch.length > 1 && (
            <div className="admin-field">
              <label>Almacén dentro de la sucursal *</label>
              <CustomSelect
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouseOptions}
                loading={metaLoading}
                loadingText="Cargando almacenes..."
                placeholder="Seleccionar almacén..."
              />
            </div>
          )}

          <div className="admin-field">
            <label>Producto del catálogo *</label>
            <CustomSelect
              value={productId}
              onChange={setProductId}
              options={productOptions}
              loading={metaLoading}
              loadingText="Cargando catálogo..."
              placeholder="Seleccionar producto creado..."
            />
          </div>

          <div className="admin-field">
            <label>Concepto de ingreso</label>
            <CustomSelect
              value={movementType}
              onChange={setMovementType}
              options={ENTRY_TYPES}
            />
          </div>
        </div>

        {selectedProduct && (
          <>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Rellenar cantidad a todas las variantes</label>
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
                  <span>Actualizar costo maestro en variantes ingresadas</span>
                </label>
              </div>
            </div>

            <div className="modal-table-box">
              <table className="inv-variants-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Variante / Atributos</th>
                    <th className="is-num">Stock en Sucursal</th>
                    <th className="is-num">Cantidad (+)</th>
                    <th className="is-num">Costo Unit. (Bs.)</th>
                    <th>Estante / Perchero (opc.)</th>
                    <th className="is-num">Saldo Final</th>
                  </tr>
                </thead>
                <tbody>
                  {variantsLoading ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">Cargando variantes del producto...</div>
                      </td>
                    </tr>
                  ) : productVariants.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">Este producto aún no tiene variantes registradas.</div>
                      </td>
                    </tr>
                  ) : (
                    productVariants.map((v) => {
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
                          <td>
                            <input
                              type="text"
                              maxLength={50}
                              className="admin-input admin-input-sm"
                              value={rows[v.id]?.bin_location ?? ''}
                              onChange={(e) => handleRowChange(v.id, 'bin_location', e.target.value)}
                              placeholder="Ej: VIT-A1"
                            />
                          </td>
                          <td className="is-num">
                            <strong className={addQty > 0 ? 'inv-delta-pos' : ''}>
                              {current + addQty}
                            </strong>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="admin-field">
          <label>Justificación / Nota de respaldo *</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Ingreso de mercadería nueva, compra factura #205..."
            required
          />
          <div className="inv-preset-pills">
            {ENTRY_REASONS.map((reason) => (
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
