import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const STATUS_BADGE = {
  in_progress: { label: 'En progreso', tone: 'is-low' },
  pending_approval: { label: 'Por aprobar', tone: 'is-overstock' },
  approved: { label: 'Aprobada', tone: 'is-ok' },
  cancelled: { label: 'Cancelada', tone: 'is-out' },
};

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Todo el catálogo de variantes' },
  { value: 'low_stock', label: 'Solo variantes en stock bajo o agotadas' },
  { value: 'category', label: 'Por categoría específica' },
  { value: 'product', label: 'Un producto específico' },
];

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function InventoryCountsTab({
  warehouses = [],
  categories = [],
  productsList = [],
  metaLoading = false,
  globalBranchId = 'all',
  globalWarehouseId = 'all',
  onInventoryChanged,
  openNewTrigger = 0,
}) {
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newWarehouseId, setNewWarehouseId] = useState('');
  const [newScope, setNewScope] = useState('all');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Detail / Execution modal
  const [activeCount, setActiveCount] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [itemEdits, setItemEdits] = useState({});
  const [headerNotes, setHeaderNotes] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const defaultWhId = useMemo(() => {
    if (globalWarehouseId && globalWarehouseId !== 'all') {
      return String(globalWarehouseId);
    }
    const pool =
      globalBranchId !== 'all'
        ? warehouses.filter((w) => String(w.branch_id) === String(globalBranchId) && w.is_active)
        : warehouses.filter((w) => w.is_active);
    const def = pool.find((w) => w.is_default) || pool[0] || warehouses[0];
    return def ? String(def.id) : '';
  }, [globalBranchId, globalWarehouseId, warehouses]);

  const loadCounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getCounts({
        branch_id: globalBranchId !== 'all' ? globalBranchId : undefined,
        warehouse_id: globalWarehouseId !== 'all' ? globalWarehouseId : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setCounts(res.data?.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las auditorías.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, [globalBranchId, globalWarehouseId, filterStatus]);

  useEffect(() => {
    if (openNewTrigger > 0) {
      openCreateModal();
    }
  }, [openNewTrigger]);

  const openCreateModal = () => {
    setNewWarehouseId(defaultWhId);
    setNewScope('all');
    setNewCategoryId('');
    setNewProductId('');
    setNewNotes('');
    setCreateError('');
    setCreateOpen(true);
  };

  const syncActiveCountState = (detail) => {
    setActiveCount(detail);
    setHeaderNotes(detail.notes || '');
    const map = {};
    (detail.items || []).forEach((item) => {
      map[item.id] = {
        counted_quantity: String(item.counted_quantity),
        notes: item.notes || '',
      };
    });
    setItemEdits(map);
  };

  const openCountDetail = async (id) => {
    setDetailLoading(true);
    setDetailError('');
    setItemSearch('');
    setOnlyDiffs(false);
    try {
      const res = await inventoryService.getCountDetail(id);
      syncActiveCountState(res.data);
    } catch (err) {
      setError(err.message || 'Error al abrir la auditoría.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCount = async (e) => {
    e.preventDefault();
    if (!newWarehouseId) {
      setCreateError('Selecciona el almacén a auditar.');
      return;
    }
    if (newScope === 'category' && !newCategoryId) {
      setCreateError('Selecciona una categoría.');
      return;
    }
    if (newScope === 'product' && !newProductId) {
      setCreateError('Selecciona un producto.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const res = await inventoryService.createCount({
        warehouse_id: Number(newWarehouseId),
        scope: newScope,
        category_id: newScope === 'category' ? Number(newCategoryId) : null,
        product_id: newScope === 'product' ? Number(newProductId) : null,
        notes: newNotes.trim() || null,
      });
      setCreateOpen(false);
      await loadCounts();
      if (res.data) {
        setItemSearch('');
        setOnlyDiffs(false);
        syncActiveCountState(res.data);
      }
    } catch (err) {
      setCreateError(err.message || 'No se pudo iniciar la auditoría.');
    } finally {
      setCreating(false);
    }
  };

  const handleItemEdit = (itemId, field, value) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const auditSummary = useMemo(() => {
    if (!activeCount) {
      return { total: 0, diffs: 0, netUnits: 0, diffCost: 0 };
    }
    let diffs = 0;
    let netUnits = 0;
    let diffCost = 0;

    (activeCount.items || []).forEach((item) => {
      const editedQty = parseInt(itemEdits[item.id]?.counted_quantity ?? item.counted_quantity, 10) || 0;
      const diff = editedQty - item.expected_quantity;
      if (diff !== 0) {
        diffs++;
        netUnits += diff;
        diffCost += diff * Number(item.cost_price || 0);
      }
    });

    return {
      total: (activeCount.items || []).length,
      diffs,
      netUnits,
      diffCost,
    };
  }, [activeCount, itemEdits]);

  const filteredDetailItems = useMemo(() => {
    if (!activeCount) return [];
    const term = itemSearch.trim().toLowerCase();
    return (activeCount.items || []).filter((item) => {
      const editedQty = parseInt(itemEdits[item.id]?.counted_quantity ?? item.counted_quantity, 10) || 0;
      const diff = editedQty - item.expected_quantity;
      if (onlyDiffs && diff === 0) return false;
      if (!term) return true;
      return (
        (item.sku || '').toLowerCase().includes(term) ||
        (item.product_name || '').toLowerCase().includes(term) ||
        (item.variant_label || '').toLowerCase().includes(term)
      );
    });
  }, [activeCount, itemEdits, itemSearch, onlyDiffs]);

  const persistCountItems = async (markPendingApproval = false) => {
    if (!activeCount) return null;
    const payloadItems = (activeCount.items || []).map((item) => ({
      id: item.id,
      counted_quantity: Math.max(0, parseInt(itemEdits[item.id]?.counted_quantity ?? item.counted_quantity, 10) || 0),
      notes: (itemEdits[item.id]?.notes ?? '').trim() || null,
    }));

    const res = await inventoryService.updateCountItems(activeCount.id, {
      notes: headerNotes.trim() || null,
      mark_pending_approval: markPendingApproval,
      items: payloadItems,
    });
    syncActiveCountState(res.data);
    await loadCounts();
    return res.data;
  };

  const handleSaveItems = async (markPending = false) => {
    if (!activeCount) return;
    setSavingItems(true);
    setDetailError('');
    try {
      await persistCountItems(markPending);
    } catch (err) {
      setDetailError(err.message || 'No se pudo guardar el conteo.');
    } finally {
      setSavingItems(false);
    }
  };

  const handleApproveAudit = async () => {
    if (!activeCount) return;
    setSavingItems(true);
    setDetailError('');
    try {
      await persistCountItems(false);
      await inventoryService.approveCount(activeCount.id, {
        notes: headerNotes.trim() || null,
      });
      setConfirmApproveOpen(false);
      setActiveCount(null);
      await loadCounts();
      await onInventoryChanged?.();
    } catch (err) {
      setConfirmApproveOpen(false);
      setDetailError(err.message || 'No se pudo aprobar la auditoría.');
    } finally {
      setSavingItems(false);
    }
  };

  const handleCancelAudit = async () => {
    if (!activeCount) return;
    setSavingItems(true);
    setDetailError('');
    try {
      await inventoryService.cancelCount(activeCount.id, {
        notes: headerNotes.trim() || 'Auditoría cancelada por usuario',
      });
      setConfirmCancelOpen(false);
      setActiveCount(null);
      await loadCounts();
    } catch (err) {
      setConfirmCancelOpen(false);
      setDetailError(err.message || 'No se pudo cancelar la auditoría.');
    } finally {
      setSavingItems(false);
    }
  };

  const isEditable =
    activeCount && ['in_progress', 'pending_approval'].includes(activeCount.status);

  const warehouseOptions = warehouses
    .filter((w) => w.is_active)
    .map((w) => ({
      value: String(w.id),
      label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
    }));

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));
  const productOptions = productsList.map((p) => ({
    value: String(p.id),
    label: `${p.sku_prefix} · ${p.name}`,
  }));

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Auditorías Físicas y Tomas de Inventario</h2>
          <p className="admin-subtext">
            Compara existencias en sistema vs. conteo físico real y aplica ajustes auditados con justificación.
          </p>
        </div>

        <div className="admin-actions-row">
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'in_progress', label: 'En progreso' },
              { value: 'pending_approval', label: 'Pendientes de aprobación' },
              { value: 'approved', label: 'Aprobadas' },
              { value: 'cancelled', label: 'Canceladas' },
            ]}
          />
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCreateModal}>
            + Nueva Auditoría
          </button>
        </div>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Almacén</th>
              <th>Estado</th>
              <th className="is-right">Variantes</th>
              <th className="is-right">Discrepancias</th>
              <th className="is-right">Dif. Neta</th>
              <th>Responsables</th>
              <th>Fecha Inicio</th>
              <th className="is-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!loading && counts.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="admin-empty">
                    No hay auditorías físicas registradas todavía. Crea la primera para validar tu stock.
                  </div>
                </td>
              </tr>
            ) : (
              counts.map((c) => {
                const badge = STATUS_BADGE[c.status] || { label: c.status, tone: 'is-neutral' };
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="admin-code-tag">{c.count_number}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{c.branch_code || '-'}</strong> · {c.branch_name || ''}
                      </div>
                      <div className="admin-subtext">
                        {c.warehouse_code} · {c.warehouse_name}
                      </div>
                    </td>
                    <td>
                      <span className={`inv-stock-badge ${badge.tone}`}>{badge.label}</span>
                    </td>
                    <td className="is-right">{c.total_items}</td>
                    <td className="is-right">{c.discrepancy_items}</td>
                    <td className="is-right">
                      <span
                        className={
                          c.net_diff_units > 0
                            ? 'inv-delta-pos'
                            : c.net_diff_units < 0
                            ? 'inv-delta-neg'
                            : ''
                        }
                      >
                        {c.net_diff_units > 0 ? `+${c.net_diff_units}` : c.net_diff_units} u.
                      </span>
                      <div className="admin-subtext">Bs. {Number(c.diff_cost_value || 0).toFixed(2)}</div>
                    </td>
                    <td>
                      <div>Inició: {c.conducted_by_name}</div>
                      {c.approved_by_name && c.status === 'approved' && (
                        <div className="admin-subtext">Aprobó: {c.approved_by_name}</div>
                      )}
                    </td>
                    <td>{formatDate(c.started_at)}</td>
                    <td className="is-right">
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => openCountDetail(c.id)}
                        disabled={detailLoading}
                      >
                        {['in_progress', 'pending_approval'].includes(c.status)
                          ? 'Realizar Conteo'
                          : 'Ver Detalle'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Auditoría */}
      <BaseModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        eyebrow="Toma de Inventario"
        title="Iniciar Nueva Auditoría Física"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </button>
            <button
              type="submit"
              form="create-audit-form"
              className="admin-btn admin-btn-primary"
              disabled={creating}
            >
              {creating ? 'Generando lista...' : 'Iniciar Auditoría'}
            </button>
          </>
        }
      >
        {createError && <div className="admin-alert is-error">{createError}</div>}

        <form id="create-audit-form" className="admin-form" onSubmit={handleCreateCount}>
          <div className="admin-field">
            <label>Almacén a auditar *</label>
            <CustomSelect
              value={newWarehouseId}
              onChange={setNewWarehouseId}
              options={warehouseOptions}
              loading={metaLoading}
              loadingText="Cargando almacenes..."
              placeholder="Seleccionar almacén..."
            />
          </div>

          <div className="admin-field">
            <label>Alcance del conteo</label>
            <CustomSelect value={newScope} onChange={setNewScope} options={SCOPE_OPTIONS} />
          </div>

          {newScope === 'category' && (
            <div className="admin-field">
              <label>Categoría *</label>
              <CustomSelect
                value={newCategoryId}
                onChange={setNewCategoryId}
                options={categoryOptions}
                loading={metaLoading}
                loadingText="Cargando categorías..."
                placeholder="Elegir categoría..."
              />
            </div>
          )}

          {newScope === 'product' && (
            <div className="admin-field">
              <label>Producto *</label>
              <CustomSelect
                value={newProductId}
                onChange={setNewProductId}
                options={productOptions}
                loading={metaLoading}
                loadingText="Cargando productos..."
                placeholder="Elegir producto..."
              />
            </div>
          )}

          <div className="admin-field">
            <label>Observaciones / Objetivo de la auditoría</label>
            <textarea
              className="admin-textarea"
              rows={2}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Ej: Conteo mensual de cierre, revisión de vitrina principal..."
            />
          </div>
        </form>
      </BaseModal>

      {/* Modal Ejecutar / Ver Auditoría */}
      <BaseModal
        isOpen={Boolean(activeCount)}
        onClose={() => setActiveCount(null)}
        eyebrow={activeCount ? `${activeCount.warehouse_code} · ${activeCount.warehouse_name}` : ''}
        title={activeCount ? `Auditoría ${activeCount.count_number}` : ''}
        size="xl"
        footer={
          activeCount && (
            <>
              {isEditable && (
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost-danger"
                  onClick={() => setConfirmCancelOpen(true)}
                  disabled={savingItems}
                >
                  Anular Auditoría
                </button>
              )}
              <button
                type="button"
                className="admin-btn"
                onClick={() => setActiveCount(null)}
                disabled={savingItems}
              >
                Cerrar
              </button>
              {isEditable && (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => handleSaveItems(false)}
                    disabled={savingItems}
                  >
                    {savingItems ? 'Guardando...' : 'Guardar Avance'}
                  </button>
                  {activeCount.status === 'in_progress' && (
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => handleSaveItems(true)}
                      disabled={savingItems}
                    >
                      Pasar a Revisión
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => setConfirmApproveOpen(true)}
                    disabled={savingItems}
                  >
                    Aprobar y Aplicar Stock
                  </button>
                </>
              )}
            </>
          )
        }
      >
        {activeCount && (
          <div className="inv-audit-layout">
            {detailError && <div className="admin-alert is-error">{detailError}</div>}

            <div className="inv-audit-summary-bar">
              <div className="inv-audit-stat">
                <div className="inv-audit-stat-label">Variantes Auditadas</div>
                <div className="inv-audit-stat-val">{auditSummary.total}</div>
              </div>
              <div className="inv-audit-stat">
                <div className="inv-audit-stat-label">Con Discrepancia</div>
                <div className="inv-audit-stat-val">{auditSummary.diffs}</div>
              </div>
              <div className="inv-audit-stat">
                <div className="inv-audit-stat-label">Diferencia Neta</div>
                <div
                  className={`inv-audit-stat-val ${
                    auditSummary.netUnits > 0
                      ? 'inv-delta-pos'
                      : auditSummary.netUnits < 0
                      ? 'inv-delta-neg'
                      : ''
                  }`}
                >
                  {auditSummary.netUnits > 0 ? `+${auditSummary.netUnits}` : auditSummary.netUnits} u.
                </div>
              </div>
              <div className="inv-audit-stat">
                <div className="inv-audit-stat-label">Valorización Dif.</div>
                <div className="inv-audit-stat-val">Bs. {auditSummary.diffCost.toFixed(2)}</div>
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Filtrar variantes</label>
                <input
                  type="text"
                  className="admin-input"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Buscar por SKU o producto..."
                />
              </div>
              <div className="admin-field">
                <label>Vista de conteo</label>
                <label className="inv-checkbox-row">
                  <input
                    type="checkbox"
                    checked={onlyDiffs}
                    onChange={(e) => setOnlyDiffs(e.target.checked)}
                  />
                  <span>Mostrar solo variantes con diferencia</span>
                </label>
              </div>
            </div>

            <div className="modal-table-box">
              <table className="inv-variants-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto / Variante</th>
                    <th className="is-num">Sistema</th>
                    <th className="is-num">Conteo Físico</th>
                    <th className="is-num">Diferencia</th>
                    <th>Justificación por ítem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetailItems.map((item) => {
                    const editedVal = itemEdits[item.id]?.counted_quantity ?? String(item.counted_quantity);
                    const editedNum = parseInt(editedVal || '0', 10) || 0;
                    const diff = editedNum - item.expected_quantity;

                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="admin-code-tag">{item.sku}</span>
                        </td>
                        <td>
                          <div>
                            <strong>{item.product_name}</strong>
                          </div>
                          <div className="admin-subtext">{item.variant_label}</div>
                        </td>
                        <td className="is-num">{item.expected_quantity}</td>
                        <td className="is-num">
                          {isEditable ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="admin-input admin-input-sm inv-count-input"
                              value={editedVal}
                              onChange={(e) =>
                                handleItemEdit(item.id, 'counted_quantity', e.target.value)
                              }
                            />
                          ) : (
                            <strong>{item.counted_quantity}</strong>
                          )}
                        </td>
                        <td className="is-num">
                          <span
                            className={
                              diff > 0 ? 'inv-delta-pos' : diff < 0 ? 'inv-delta-neg' : 'admin-subtext'
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                        <td>
                          {isEditable ? (
                            <input
                              type="text"
                              maxLength={255}
                              className="admin-input admin-input-sm inv-note-input"
                              value={itemEdits[item.id]?.notes ?? ''}
                              onChange={(e) => handleItemEdit(item.id, 'notes', e.target.value)}
                              placeholder={diff !== 0 ? 'Motivo de diferencia...' : 'Opcional'}
                            />
                          ) : (
                            item.notes || '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-field">
              <label>
                Justificación general de auditoría {auditSummary.diffs > 0 ? '(recomendada/obligatoria si falta por ítem)' : ''}
              </label>
              {isEditable ? (
                <textarea
                  className="admin-textarea"
                  rows={2}
                  value={headerNotes}
                  onChange={(e) => setHeaderNotes(e.target.value)}
                  placeholder="Describe el resultado o motivo general de los ajustes detectados..."
                />
              ) : (
                <div className="inv-readonly-box">{activeCount.notes || 'Sin observaciones'}</div>
              )}
            </div>
          </div>
        )}
      </BaseModal>

      <ConfirmModal
        isOpen={confirmApproveOpen}
        onClose={() => setConfirmApproveOpen(false)}
        eyebrow="Confirmación de Auditoría"
        title="¿Aprobar conteo y ajustar inventario?"
        message={`Se procesarán ${auditSummary.diffs} variantes con diferencia (impacto neto: ${
          auditSummary.netUnits > 0 ? `+${auditSummary.netUnits}` : auditSummary.netUnits
        } unidades). Todos los ajustes quedarán registrados en el Kardex.`}
        confirmLabel={savingItems ? 'Aplicando...' : 'Aprobar y Ajustar'}
        onConfirm={handleApproveAudit}
      />

      <ConfirmModal
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        eyebrow="Anulación"
        title="¿Anular esta auditoría?"
        message="La toma física pasará a estado Cancelada y no aplicará cambios al stock."
        confirmLabel="Sí, anular"
        variant="danger"
        onConfirm={handleCancelAudit}
      />
    </section>
  );
}
