import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { purchaseService } from '../../../services/admin/purchaseService';
import ManualPriceModal from './ManualPriceModal';
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal';
import PurchaseOrderFormModal from './PurchaseOrderFormModal';
import SupplierDetailModal from './SupplierDetailModal';
import SupplierFormModal from './SupplierFormModal';
import {
  buildWhatsappHref,
  formatCurrency,
  formatDate,
  getInitials,
  PAYMENT_STATUS,
  PO_STATUS,
} from './purchaseHelpers';
import './purchases.css';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'history' | 'suppliers'

  // Meta compartida
  const [meta, setMeta] = useState({
    suppliers: [],
    branches: [],
    warehouses: [],
    catalog_products: [],
    unregistered_suggestions: [],
  });
  const [metaLoading, setMetaLoading] = useState(true);

  // Tab 1: Órdenes
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [stats, setStats] = useState({
    total_orders: 0,
    month_spent: 0,
    pending_receipt_count: 0,
    pending_payment_total: 0,
    unlinked_items_count: 0,
    suppliers_active_count: 0,
  });
  const [ordSearch, setOrdSearch] = useState('');
  const [ordStatus, setOrdStatus] = useState('all');
  const [ordPayStatus, setOrdPayStatus] = useState('all');
  const [ordSupplierId, setOrdSupplierId] = useState('all');
  const [ordDateFrom, setOrdDateFrom] = useState('');
  const [ordDateTo, setOrdDateTo] = useState('');

  // Tab 2: Historial de precios
  const [historyMode, setHistoryMode] = useState('grouped'); // 'grouped' | 'flat'
  const [historyGrouped, setHistoryGrouped] = useState([]);
  const [historyFlat, setHistoryFlat] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [histSupplierId, setHistSupplierId] = useState('all');
  const [histOnlyUnlinked, setHistOnlyUnlinked] = useState(false);
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState([]);

  // Tab 3: Proveedores
  const [supScope, setSupScope] = useState('active'); // 'active' | 'trashed'
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supSearch, setSupSearch] = useState('');

  const [error, setError] = useState('');

  // Modales
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [manualPriceOpen, setManualPriceOpen] = useState(false);
  const [supFormModal, setSupFormModal] = useState({ open: false, supplier: null });
  const [detailSupplierId, setDetailSupplierId] = useState(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState(null);
  const [forceSupplierTarget, setForceSupplierTarget] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);

  const loadMeta = async () => {
    setMetaLoading(true);
    try {
      const res = await purchaseService.getMeta();
      setMeta({
        suppliers: res.data?.suppliers || [],
        branches: res.data?.branches || [],
        warehouses: res.data?.warehouses || [],
        catalog_products: res.data?.catalog_products || [],
        unregistered_suggestions: res.data?.unregistered_suggestions || [],
      });
    } catch (err) {
      setError(err.message || 'Error al cargar metadatos de compras.');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    setError('');
    try {
      const res = await purchaseService.getOrders({
        status: ordStatus !== 'all' ? ordStatus : undefined,
        payment_status: ordPayStatus !== 'all' ? ordPayStatus : undefined,
        supplier_id: ordSupplierId !== 'all' ? ordSupplierId : undefined,
        date_from: ordDateFrom || undefined,
        date_to: ordDateTo || undefined,
        search: ordSearch.trim() || undefined,
      });
      setOrders(res.data?.items || []);
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las órdenes de compra.');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setError('');
    try {
      const res = await purchaseService.getPriceHistory({
        search: histSearch.trim() || undefined,
        supplier_id: histSupplierId !== 'all' ? histSupplierId : undefined,
        only_unlinked: histOnlyUnlinked ? '1' : undefined,
      });
      setHistoryGrouped(res.data?.grouped || []);
      setHistoryFlat(res.data?.items || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial de precios.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSuppliers = async () => {
    setSuppliersLoading(true);
    setError('');
    try {
      const res = await purchaseService.getSuppliers({
        scope: supScope,
        search: supSearch.trim() || undefined,
      });
      setSuppliers(res.data?.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los proveedores.');
    } finally {
      setSuppliersLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [ordStatus, ordPayStatus, ordSupplierId, ordDateFrom, ordDateTo]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'suppliers') {
      loadSuppliers();
    }
  }, [activeTab, histSupplierId, histOnlyUnlinked, supScope]);

  const handleGlobalRefresh = async () => {
    await Promise.all([loadMeta(), loadOrders()]);
    if (activeTab === 'history') await loadHistory();
    if (activeTab === 'suppliers') await loadSuppliers();
  };

  const toggleHistoryExpand = (itemKey) => {
    setExpandedHistoryKeys((prev) =>
      prev.includes(itemKey) ? prev.filter((k) => k !== itemKey) : [...prev, itemKey]
    );
  };

  const handleSoftDeleteSupplier = async () => {
    if (!deleteSupplierTarget) return;
    setActionSaving(true);
    setError('');
    try {
      await purchaseService.softDeleteSupplier(deleteSupplierTarget.id);
      setDeleteSupplierTarget(null);
      await Promise.all([loadSuppliers(), loadMeta(), loadOrders()]);
    } catch (err) {
      setDeleteSupplierTarget(null);
      setError(err.message || 'No se pudo enviar a papelera.');
    } finally {
      setActionSaving(false);
    }
  };

  const handleRestoreSupplier = async (sup) => {
    setError('');
    try {
      await purchaseService.restoreSupplier(sup.id);
      await Promise.all([loadSuppliers(), loadMeta(), loadOrders()]);
    } catch (err) {
      setError(err.message || 'No se pudo restaurar el proveedor.');
    }
  };

  const handleForceDeleteSupplier = async () => {
    if (!forceSupplierTarget) return;
    setActionSaving(true);
    setError('');
    try {
      await purchaseService.forceDeleteSupplier(forceSupplierTarget.id);
      setForceSupplierTarget(null);
      await Promise.all([loadSuppliers(), loadMeta()]);
    } catch (err) {
      setForceSupplierTarget(null);
      setError(err.message || 'No se pudo eliminar definitivamente.');
    } finally {
      setActionSaving(false);
    }
  };

  const supplierFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los proveedores' },
      ...meta.suppliers.map((s) => ({
        value: String(s.id),
        label: `${s.code} · ${s.business_name}`,
      })),
    ],
    [meta.suppliers]
  );

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow">Abastecimiento y Costos</span>
          <h1>Proveedores y Compras</h1>
          <p className="admin-subtext">
            Registra compras de productos catalogados o nuevos sin catalogar, historial evolutivo de precios, recibos y fotografías en R2.
          </p>
        </div>

        <div className="pur-head-actions">
          <button type="button" className="admin-btn" onClick={handleGlobalRefresh}>
            <svg className="pur-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Actualizar
          </button>

          <button
            type="button"
            className="admin-btn"
            onClick={() => setSupFormModal({ open: true, supplier: null })}
          >
            + Nuevo Proveedor
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setPoFormOpen(true)}
          >
            + Nueva Compra
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Comprado este Mes</span>
          <strong className="admin-kpi-value">{formatCurrency(stats.month_spent)}</strong>
          <span className="admin-kpi-hint">{stats.total_orders} órdenes activas registradas</span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Pendientes de Recepción</span>
          <strong className="admin-kpi-value">{stats.pending_receipt_count}</strong>
          <span className="admin-kpi-hint">Borradores, pedidas o parciales</span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Saldo por Pagar</span>
          <strong className="admin-kpi-value">{formatCurrency(stats.pending_payment_total)}</strong>
          <span className="admin-kpi-hint">Cuentas pendientes con proveedores</span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Proveedores / Sin Catalogar</span>
          <strong className="admin-kpi-value">
            {stats.suppliers_active_count} / {stats.unlinked_items_count}
          </strong>
          <span className="admin-kpi-hint">
            {stats.unlinked_items_count} ítem(s) por vincular al catálogo
          </span>
        </article>
      </section>

      <nav className="admin-tabs" aria-label="Secciones de compras">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'orders' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Órdenes de Compra ({orders.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'history' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Historial de Precios
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'suppliers' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Proveedores ({stats.suppliers_active_count})
        </button>
      </nav>

      {error && <div className="admin-alert is-error">{error}</div>}

      {/* TAB 1: ÓRDENES DE COMPRA */}
      {activeTab === 'orders' && (
        <section className="admin-panel">
          <form
            className="pur-filter-grid"
            onSubmit={(e) => {
              e.preventDefault();
              loadOrders();
            }}
          >
            <div className="admin-field">
              <label>Buscar por orden, factura, proveedor o prenda</label>
              <input
                type="text"
                className="admin-input"
                value={ordSearch}
                onChange={(e) => setOrdSearch(e.target.value)}
                placeholder="Ej: CMP-0001, vestido, proveedor..."
              />
            </div>

            <div className="admin-field">
              <label>Proveedor</label>
              <CustomSelect
                value={ordSupplierId}
                onChange={setOrdSupplierId}
                loading={metaLoading}
                loadingText="Cargando proveedores..."
                options={supplierFilterOptions}
              />
            </div>

            <div className="admin-field">
              <label>Estado recepción</label>
              <CustomSelect
                value={ordStatus}
                onChange={setOrdStatus}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'received', label: 'Recibida' },
                  { value: 'ordered', label: 'Ordenada' },
                  { value: 'partial', label: 'Parcial' },
                  { value: 'draft', label: 'Borrador' },
                  { value: 'cancelled', label: 'Cancelada' },
                ]}
              />
            </div>

            <div className="admin-field">
              <label>Estado de pago</label>
              <CustomSelect
                value={ordPayStatus}
                onChange={setOrdPayStatus}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'paid', label: 'Pagada' },
                  { value: 'partial', label: 'Pago parcial' },
                  { value: 'pending', label: 'Por pagar' },
                ]}
              />
            </div>

            <div className="admin-field">
              <label>Desde</label>
              <input
                type="date"
                className="admin-input"
                value={ordDateFrom}
                onChange={(e) => setOrdDateFrom(e.target.value)}
              />
            </div>

            <div className="admin-field">
              <label>Hasta</label>
              <input
                type="date"
                className="admin-input"
                value={ordDateTo}
                onChange={(e) => setOrdDateTo(e.target.value)}
              />
            </div>

            <div className="admin-field">
              <button type="submit" className="admin-btn admin-btn-primary">
                Buscar
              </button>
            </div>
          </form>

          {ordersLoading ? (
            <div className="admin-table-wrap">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="pur-skeleton-row" aria-hidden="true">
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Orden / Fecha</th>
                    <th>Proveedor y WhatsApp</th>
                    <th>Destino Stock</th>
                    <th>Estado</th>
                    <th>Pago</th>
                    <th className="is-right">Unidades / Ítems</th>
                    <th className="is-right">Total</th>
                    <th className="is-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="admin-empty">
                          No hay órdenes de compra registradas con estos filtros.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => {
                      const st = PO_STATUS[ord.status] || PO_STATUS.draft;
                      const pay = PAYMENT_STATUS[ord.payment_status] || PAYMENT_STATUS.pending;
                      const waHref = buildWhatsappHref(ord.supplier_whatsapp);

                      return (
                        <tr key={ord.id}>
                          <td>
                            <span className="admin-code-tag">{ord.po_number}</span>
                            <div className="admin-subtext">
                              {formatDate(ord.order_date)}
                              {ord.invoice_number ? ` · Fac: ${ord.invoice_number}` : ''}
                            </div>
                          </td>

                          <td>
                            <div>
                              <strong>{ord.supplier_name}</strong>
                            </div>
                            <div className="admin-actions-row">
                              {ord.supplier_contact_name && (
                                <span className="admin-subtext">{ord.supplier_contact_name}</span>
                              )}
                              {waHref && (
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="pur-whatsapp-link"
                                >
                                  WA: {ord.supplier_whatsapp}
                                </a>
                              )}
                            </div>
                          </td>

                          <td>
                            <div>
                              <strong>{ord.branch_code}</strong> · {ord.branch_name}
                            </div>
                            <div className="admin-subtext">{ord.warehouse_name}</div>
                          </td>

                          <td>
                            <span className={`pur-badge ${st.tone}`}>{st.label}</span>
                            {ord.unlinked_count > 0 && (
                              <div className="admin-subtext">
                                {ord.unlinked_count} sin catalogar
                              </div>
                            )}
                          </td>

                          <td>
                            <span className={`pur-badge ${pay.tone}`}>{pay.label}</span>
                            {ord.attachments_count > 0 && (
                              <div className="admin-subtext">
                                {ord.attachments_count} foto(s)
                              </div>
                            )}
                          </td>

                          <td className="is-right">
                            <strong>
                              {ord.received_units}/{ord.total_units} u.
                            </strong>
                            <div className="admin-subtext">{ord.items_count} línea(s)</div>
                          </td>

                          <td className="is-right">
                            <strong>{formatCurrency(ord.total_amount)}</strong>
                            {ord.payment_status !== 'paid' && (
                              <div className="admin-subtext">
                                Pag: {formatCurrency(ord.amount_paid)}
                              </div>
                            )}
                          </td>

                          <td className="is-right">
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm admin-btn-primary"
                              onClick={() => setDetailOrderId(ord.id)}
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: HISTORIAL DE PRECIOS DE COMPRA */}
      {activeTab === 'history' && (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Historial Evolutivo de Precios de Compra</h2>
              <p className="admin-subtext">
                Registra y compara cómo varía el precio de cada producto o prenda a lo largo del tiempo (mes pasado vs. actual), catalogado o nuevo.
              </p>
            </div>

            <div className="admin-actions-row">
              <div className="pur-line-mode-switch">
                <button
                  type="button"
                  className={`pur-mode-pill-btn ${historyMode === 'grouped' ? 'is-active' : ''}`}
                  onClick={() => setHistoryMode('grouped')}
                >
                  Agrupado por Producto
                </button>
                <button
                  type="button"
                  className={`pur-mode-pill-btn ${historyMode === 'flat' ? 'is-active' : ''}`}
                  onClick={() => setHistoryMode('flat')}
                >
                  Cronológico Completo
                </button>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setManualPriceOpen(true)}
              >
                + Registrar Precio / Cotización
              </button>
            </div>
          </div>

          <form
            className="pur-filter-grid-4"
            onSubmit={(e) => {
              e.preventDefault();
              loadHistory();
            }}
          >
            <div className="admin-field">
              <label>Buscar producto, SKU o nota</label>
              <input
                type="text"
                className="admin-input"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder="Ej: Vestido Lino, P0001..."
              />
            </div>

            <div className="admin-field">
              <label>Proveedor</label>
              <CustomSelect
                value={histSupplierId}
                onChange={setHistSupplierId}
                loading={metaLoading}
                loadingText="Cargando proveedores..."
                options={supplierFilterOptions}
              />
            </div>

            <div className="admin-field">
              <label>Filtro de catálogo</label>
              <label className="pur-checkbox-row">
                <input
                  type="checkbox"
                  checked={histOnlyUnlinked}
                  onChange={(e) => setHistOnlyUnlinked(e.target.checked)}
                />
                <span>Solo productos sin catalogar</span>
              </label>
            </div>

            <div className="admin-field">
              <button type="submit" className="admin-btn admin-btn-primary">
                Filtrar Historial
              </button>
            </div>
          </form>

          {historyLoading ? (
            <div className="admin-table-wrap">
              {[1, 2, 3].map((n) => (
                <div key={n} className="pur-skeleton-row" aria-hidden="true">
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                </div>
              ))}
            </div>
          ) : historyMode === 'grouped' ? (
            <div className="pur-history-group-stack">
              {historyGrouped.length === 0 ? (
                <div className="admin-empty">
                  Aún no hay historial de precios registrado. Registra una compra o cotización para iniciar la comparativa.
                </div>
              ) : (
                historyGrouped.map((grp) => {
                  const isOpen = expandedHistoryKeys.includes(grp.item_key);
                  return (
                    <article
                      key={grp.item_key}
                      className={`pur-history-card ${isOpen ? 'is-expanded' : ''}`}
                    >
                      <div
                        className="pur-history-header"
                        onClick={() => toggleHistoryExpand(grp.item_key)}
                      >
                        <div className="pur-history-main">
                          <div className="pur-avatar">
                            {grp.photo_url ? (
                              <img src={grp.photo_url} alt={grp.item_name} />
                            ) : (
                              <span>{getInitials(grp.item_name)}</span>
                            )}
                          </div>
                          <div>
                            <div className="admin-actions-row">
                              <strong>{grp.item_name}</strong>
                              {grp.item_sku && <span className="admin-code-tag">{grp.item_sku}</span>}
                              <span
                                className={`pur-badge ${grp.is_catalog_linked ? 'is-ok' : 'is-warn'}`}
                              >
                                {grp.is_catalog_linked ? 'Catalogado' : 'Sin catalogar'}
                              </span>
                            </div>
                            <div className="admin-subtext">
                              Último proveedor: {grp.latest_supplier_name} ({formatDate(grp.latest_date)}) ·{' '}
                              {grp.records_count} registro(s)
                            </div>
                          </div>
                        </div>

                        <div className="pur-history-metrics">
                          <div className="pur-metric-col">
                            <span className="pur-metric-label">Último Precio</span>
                            <span className="pur-metric-val">{formatCurrency(grp.latest_cost)}</span>
                          </div>

                          <div className="pur-metric-col">
                            <span className="pur-metric-label">Variación</span>
                            <span
                              className={`pur-metric-val ${
                                grp.price_diff > 0
                                  ? 'pur-price-up'
                                  : grp.price_diff < 0
                                  ? 'pur-price-down'
                                  : 'pur-price-flat'
                              }`}
                            >
                              {grp.price_diff === null
                                ? 'Primer reg.'
                                : grp.price_diff > 0
                                ? `+${formatCurrency(grp.price_diff)} (+${grp.price_diff_pct}%)`
                                : grp.price_diff < 0
                                ? `${formatCurrency(grp.price_diff)} (${grp.price_diff_pct}%)`
                                : 'Sin cambio'}
                            </span>
                          </div>

                          <div className="pur-metric-col">
                            <span className="pur-metric-label">Mín / Prom / Máx</span>
                            <span className="admin-subtext">
                              {formatCurrency(grp.min_cost)} · {formatCurrency(grp.avg_cost)} ·{' '}
                              {formatCurrency(grp.max_cost)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="inv-variants-wrap">
                          <table className="inv-variants-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th>Orden / Factura</th>
                                <th>Foto</th>
                                <th className="is-num">Cant.</th>
                                <th className="is-num">Precio Anterior</th>
                                <th className="is-num">Precio Registrado</th>
                                <th className="is-num">Cambio</th>
                                <th>Notas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(grp.history || []).map((row) => (
                                <tr key={row.id}>
                                  <td>{formatDate(row.recorded_at)}</td>
                                  <td>{row.supplier_name}</td>
                                  <td>
                                    {row.po_number ? (
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-sm"
                                        onClick={() => setDetailOrderId(row.purchase_order_id)}
                                      >
                                        {row.po_number}
                                      </button>
                                    ) : (
                                      <span className="admin-subtext">Cotización manual</span>
                                    )}
                                  </td>
                                  <td>
                                    {row.photo_url ? (
                                      <a href={row.photo_url} target="_blank" rel="noreferrer">
                                        <img
                                          src={row.photo_url}
                                          alt={row.item_name}
                                          className="pur-inline-thumb"
                                        />
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="is-num">{row.quantity} u.</td>
                                  <td className="is-num">
                                    {row.previous_unit_cost !== null
                                      ? formatCurrency(row.previous_unit_cost)
                                      : '-'}
                                  </td>
                                  <td className="is-num">
                                    <strong>{formatCurrency(row.unit_cost)}</strong>
                                  </td>
                                  <td className="is-num">
                                    {row.price_diff === null ? (
                                      <span className="pur-price-flat">Base</span>
                                    ) : row.price_diff > 0 ? (
                                      <span className="pur-price-up">
                                        +{formatCurrency(row.price_diff)} (+{row.price_diff_pct}%)
                                      </span>
                                    ) : row.price_diff < 0 ? (
                                      <span className="pur-price-down">
                                        {formatCurrency(row.price_diff)} ({row.price_diff_pct}%)
                                      </span>
                                    ) : (
                                      <span className="pur-price-flat">Igual</span>
                                    )}
                                  </td>
                                  <td>{row.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto / Prenda</th>
                    <th>Proveedor</th>
                    <th>Orden</th>
                    <th>Foto</th>
                    <th className="is-right">Cant.</th>
                    <th className="is-right">Precio Ant.</th>
                    <th className="is-right">Precio Unit.</th>
                    <th className="is-right">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {historyFlat.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="admin-empty">Sin registros de precios todavía.</div>
                      </td>
                    </tr>
                  ) : (
                    historyFlat.map((h) => (
                      <tr key={h.id}>
                        <td>{formatDate(h.recorded_at)}</td>
                        <td>
                          <strong>{h.item_name}</strong>
                          <div className="admin-subtext">
                            {h.item_sku || 'Sin SKU'} ·{' '}
                            {h.is_catalog_linked ? 'Catalogado' : 'Sin catalogar'}
                          </div>
                        </td>
                        <td>{h.supplier_name}</td>
                        <td>
                          {h.po_number ? (
                            <span className="admin-code-tag">{h.po_number}</span>
                          ) : (
                            'Manual'
                          )}
                        </td>
                        <td>
                          {h.photo_url ? (
                            <a href={h.photo_url} target="_blank" rel="noreferrer">
                              <img
                                src={h.photo_url}
                                alt={h.item_name}
                                className="pur-inline-thumb"
                              />
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="is-right">{h.quantity}</td>
                        <td className="is-right">
                          {h.previous_unit_cost !== null
                            ? formatCurrency(h.previous_unit_cost)
                            : '-'}
                        </td>
                        <td className="is-right">
                          <strong>{formatCurrency(h.unit_cost)}</strong>
                        </td>
                        <td className="is-right">
                          {h.price_diff === null ? (
                            <span className="pur-price-flat">Base</span>
                          ) : h.price_diff > 0 ? (
                            <span className="pur-price-up">
                              +{formatCurrency(h.price_diff)} (+{h.price_diff_pct}%)
                            </span>
                          ) : h.price_diff < 0 ? (
                            <span className="pur-price-down">
                              {formatCurrency(h.price_diff)} ({h.price_diff_pct}%)
                            </span>
                          ) : (
                            <span className="pur-price-flat">Igual</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PROVEEDORES */}
      {activeTab === 'suppliers' && (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Directorio de Proveedores</h2>
              <p className="admin-subtext">
                Contactos, números telefónicos, enlaces directos de WhatsApp, NIT, condiciones de pago y fotografía o tarjeta.
              </p>
            </div>

            <div className="admin-actions-row">
              <div className="pur-line-mode-switch">
                <button
                  type="button"
                  className={`pur-mode-pill-btn ${supScope === 'active' ? 'is-active' : ''}`}
                  onClick={() => setSupScope('active')}
                >
                  Activos
                </button>
                <button
                  type="button"
                  className={`pur-mode-pill-btn ${supScope === 'trashed' ? 'is-active' : ''}`}
                  onClick={() => setSupScope('trashed')}
                >
                  Papelera
                </button>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setSupFormModal({ open: true, supplier: null })}
              >
                + Nuevo Proveedor
              </button>
            </div>
          </div>

          <form
            className="pur-filter-grid-4"
            onSubmit={(e) => {
              e.preventDefault();
              loadSuppliers();
            }}
          >
            <div className="admin-field">
              <label>Buscar por nombre, contacto, WhatsApp, NIT o ciudad</label>
              <input
                type="text"
                className="admin-input"
                value={supSearch}
                onChange={(e) => setSupSearch(e.target.value)}
                placeholder="Ej: Textil Aurora, 70012345..."
              />
            </div>

            <div className="admin-field">
              <button type="submit" className="admin-btn admin-btn-primary">
                Buscar Proveedor
              </button>
            </div>
          </form>

          {suppliersLoading ? (
            <div className="admin-table-wrap">
              {[1, 2, 3].map((n) => (
                <div key={n} className="pur-skeleton-row" aria-hidden="true">
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                  <span className="pur-skeleton-block" />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Contacto y Teléfonos</th>
                    <th>WhatsApp</th>
                    <th>Ciudad / Condiciones</th>
                    <th className="is-right">Compras</th>
                    <th>Estado</th>
                    <th className="is-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">
                          {supScope === 'trashed'
                            ? 'La papelera de proveedores está vacía.'
                            : 'No hay proveedores registrados todavía.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => {
                      const waHref = buildWhatsappHref(sup.whatsapp || sup.phone);
                      return (
                        <tr key={sup.id}>
                          <td>
                            <div className="pur-supplier-cell">
                              <div className="pur-avatar">
                                {sup.photo_url ? (
                                  <img src={sup.photo_url} alt={sup.business_name} />
                                ) : (
                                  <span>{getInitials(sup.business_name)}</span>
                                )}
                              </div>
                              <div>
                                <div>
                                  <strong>{sup.business_name}</strong>
                                </div>
                                <div className="admin-subtext">
                                  <span className="admin-code-tag">{sup.code}</span>
                                  {sup.tax_id ? ` · NIT: ${sup.tax_id}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div>
                              <strong>{sup.contact_name || '-'}</strong>
                            </div>
                            <div className="admin-subtext">
                              {sup.phone || 'Sin teléfono'}
                              {sup.secondary_phone ? ` / ${sup.secondary_phone}` : ''}
                            </div>
                          </td>

                          <td>
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noreferrer"
                                className="pur-whatsapp-link"
                              >
                                {sup.whatsapp || sup.phone}
                              </a>
                            ) : (
                              <span className="admin-subtext">Sin WhatsApp</span>
                            )}
                          </td>

                          <td>
                            <div>{sup.city || '-'}</div>
                            <div className="admin-subtext">{sup.payment_terms || 'Sin definir'}</div>
                          </td>

                          <td className="is-right">
                            <strong>{formatCurrency(sup.total_purchased)}</strong>
                            <div className="admin-subtext">{sup.orders_count} orden(es)</div>
                          </td>

                          <td>
                            <span className={`pur-badge ${sup.is_active ? 'is-ok' : 'is-muted'}`}>
                              {sup.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>

                          <td className="is-right">
                            <div className="pur-row-actions">
                              {supScope === 'active' ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-sm"
                                    onClick={() => setDetailSupplierId(sup.id)}
                                  >
                                    Ver Ficha
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-sm"
                                    onClick={() => setSupFormModal({ open: true, supplier: sup })}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                    onClick={() => setDeleteSupplierTarget(sup)}
                                  >
                                    Eliminar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-sm admin-btn-primary"
                                    onClick={() => handleRestoreSupplier(sup)}
                                  >
                                    Restaurar
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                    onClick={() => setForceSupplierTarget(sup)}
                                  >
                                    Borrar Definitivo
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <PurchaseOrderFormModal
        isOpen={poFormOpen}
        onClose={() => setPoFormOpen(false)}
        meta={meta}
        metaLoading={metaLoading}
        onSaved={handleGlobalRefresh}
        onQuickCreateSupplier={() => setSupFormModal({ open: true, supplier: null })}
      />

      <PurchaseOrderDetailModal
        isOpen={Boolean(detailOrderId)}
        onClose={() => setDetailOrderId(null)}
        orderId={detailOrderId}
        catalogProducts={meta.catalog_products}
        metaLoading={metaLoading}
        onMutated={handleGlobalRefresh}
      />

      <ManualPriceModal
        isOpen={manualPriceOpen}
        onClose={() => setManualPriceOpen(false)}
        suppliers={meta.suppliers}
        catalogProducts={meta.catalog_products}
        metaLoading={metaLoading}
        onSaved={loadHistory}
      />

      <SupplierFormModal
        isOpen={supFormModal.open}
        onClose={() => setSupFormModal({ open: false, supplier: null })}
        supplier={supFormModal.supplier}
        onSaved={handleGlobalRefresh}
      />

      <SupplierDetailModal
        isOpen={Boolean(detailSupplierId)}
        onClose={() => setDetailSupplierId(null)}
        supplierId={detailSupplierId}
        onEditSupplier={(sup) => setSupFormModal({ open: true, supplier: sup })}
      />

      <ConfirmModal
        isOpen={Boolean(deleteSupplierTarget)}
        onClose={() => setDeleteSupplierTarget(null)}
        eyebrow="Papelera de Proveedores"
        title={`¿Enviar a ${deleteSupplierTarget?.business_name} a papelera?`}
        message="Su historial de compras y precios se conservará intacto y podrás restaurarlo cuando necesites."
        confirmLabel={actionSaving ? 'Moviendo...' : 'Enviar a Papelera'}
        variant="danger"
        onConfirm={handleSoftDeleteSupplier}
      />

      <ConfirmModal
        isOpen={Boolean(forceSupplierTarget)}
        onClose={() => setForceSupplierTarget(null)}
        eyebrow="Eliminación Permanente"
        title={`¿Borrar definitivamente a ${forceSupplierTarget?.business_name}?`}
        message="Esta acción no se puede deshacer. Solo es posible si no tiene órdenes de compra asociadas."
        confirmLabel={actionSaving ? 'Eliminando...' : 'Borrar Definitivamente'}
        variant="danger"
        onConfirm={handleForceDeleteSupplier}
      />
    </div>
  );
}
