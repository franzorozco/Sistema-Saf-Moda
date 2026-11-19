import { useEffect, useMemo, useState } from 'react';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';
import InventoryCountsTab from './InventoryCountsTab';
import InventoryMovementsTab from './InventoryMovementsTab';
import NewStockEntryModal from './NewStockEntryModal';
import ProductBatchEntryModal from './ProductBatchEntryModal';
import StockMovementModal from './StockMovementModal';
import VariantStockSettingsModal from './VariantStockSettingsModal';
import WarehousesTransfersTab from './WarehousesTransfersTab';
import './inventory.css';

const STOCK_STATUS_BADGE = {
  ok: { label: 'Óptimo', tone: 'is-ok' },
  low: { label: 'Stock bajo', tone: 'is-low' },
  out: { label: 'Agotado', tone: 'is-out' },
  overstock: { label: 'Sobre límite', tone: 'is-overstock' },
};

function formatCurrency(val) {
  return `Bs. ${Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getInitials(name) {
  const parts = String(name || 'P').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '') || 'P').toUpperCase();
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'movements' | 'counts' | 'warehouses'
  const [meta, setMeta] = useState({
    branches: [],
    warehouses: [],
    catalog_products: [],
    categories: [],
    brands: [],
    movement_types: [],
  });

  // Selector principal: Sucursal ('all' = Todas juntas, o ID de sucursal)
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  // Sub-selector opcional cuando la sucursal elegida tiene múltiples almacenes
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');

  const [products, setProducts] = useState([]);
  const [allProductsCatalog, setAllProductsCatalog] = useState([]);
  const [stats, setStats] = useState({
    total_products: 0,
    total_variants: 0,
    total_units: 0,
    total_reserved: 0,
    total_available: 0,
    low_stock_variants: 0,
    out_of_stock_variants: 0,
    total_cost_value: 0,
    total_retail_value: 0,
  });

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [stockStatus, setStockStatus] = useState('all');

  // Expanded products
  const [expandedProductIds, setExpandedProductIds] = useState([]);

  // Modals
  const [movementModal, setMovementModal] = useState({
    open: false,
    product: null,
    variant: null,
    initialTab: 'entry',
  });
  const [batchModal, setBatchModal] = useState({ open: false, product: null });
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState({
    open: false,
    product: null,
    variant: null,
  });

  const [newAuditTrigger, setNewAuditTrigger] = useState(0);
  const [newTransferTrigger, setNewTransferTrigger] = useState(0);
  const [newBranchTrigger, setNewBranchTrigger] = useState(0);

  const loadMeta = async () => {
    setMetaLoading(true);
    try {
      const res = await inventoryService.getMeta();
      const data = res.data || {};
      setMeta({
        branches: data.branches || [],
        warehouses: data.warehouses || [],
        catalog_products: data.catalog_products || [],
        categories: data.categories || [],
        brands: data.brands || [],
        movement_types: data.movement_types || [],
      });
    } catch (err) {
      setError(err.message || 'Error al cargar metadatos de inventario.');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadStock = async (brId = selectedBranchId, whId = selectedWarehouseId) => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getProductsStock({
        branch_id: brId,
        warehouse_id: whId,
      });
      const list = res.data?.items || [];
      setProducts(list);
      setAllProductsCatalog(list);
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message || 'Error al cargar el inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadStock(selectedBranchId, selectedWarehouseId);
  }, [selectedBranchId, selectedWarehouseId]);

  const handleSelectBranch = (nextBranchId) => {
    setSelectedBranchId(nextBranchId);
    setSelectedWarehouseId('all');
  };

  const handleInventoryMutated = async () => {
    await Promise.all([loadMeta(), loadStock(selectedBranchId, selectedWarehouseId)]);
    setRefreshKey((k) => k + 1);
  };

  const activeBranches = useMemo(
    () => meta.branches.filter((b) => b.is_active),
    [meta.branches]
  );

  const totalUnitsAllBranches = useMemo(
    () => activeBranches.reduce((sum, b) => sum + Number(b.total_units || 0), 0),
    [activeBranches]
  );

  const selectedBranchObj = useMemo(
    () => activeBranches.find((b) => String(b.id) === String(selectedBranchId)) || null,
    [activeBranches, selectedBranchId]
  );

  const branchWarehouses = useMemo(() => {
    if (selectedBranchId === 'all') return meta.warehouses;
    return meta.warehouses.filter((w) => String(w.branch_id) === String(selectedBranchId));
  }, [meta.warehouses, selectedBranchId]);

  // Almacén preseleccionado para los modales según la sucursal activa
  const effectiveModalWarehouseId = useMemo(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      return selectedWarehouseId;
    }
    if (selectedBranchObj?.default_warehouse_id) {
      return String(selectedBranchObj.default_warehouse_id);
    }
    const def = meta.warehouses.find((w) => w.is_default) || meta.warehouses[0];
    return def ? String(def.id) : 'all';
  }, [selectedWarehouseId, selectedBranchObj, meta.warehouses]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products
      .map((product) => {
        if (categoryId && String(product.category_id) !== String(categoryId)) return null;
        if (brandId && String(product.brand_id) !== String(brandId)) return null;

        let variants = product.variants || [];

        if (term) {
          const prodMatches =
            (product.name || '').toLowerCase().includes(term) ||
            (product.sku_prefix || '').toLowerCase().includes(term);

          if (!prodMatches) {
            variants = variants.filter(
              (v) =>
                (v.sku || '').toLowerCase().includes(term) ||
                (v.barcode || '').toLowerCase().includes(term) ||
                (v.variant_label || '').toLowerCase().includes(term)
            );
          }
        }

        if (stockStatus !== 'all') {
          variants = variants.filter((v) => {
            if (stockStatus === 'in_stock') return v.quantity_on_hand > 0;
            if (stockStatus === 'low') return v.stock_status === 'low';
            if (stockStatus === 'out') return v.stock_status === 'out';
            if (stockStatus === 'alert') return ['low', 'out'].includes(v.stock_status);
            if (stockStatus === 'overstock') return v.stock_status === 'overstock';
            return true;
          });
        }

        if (variants.length === 0) return null;

        return {
          ...product,
          variants,
        };
      })
      .filter(Boolean);
  }, [products, search, categoryId, brandId, stockStatus]);

  const toggleExpandProduct = (productId) => {
    setExpandedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const allExpanded =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => expandedProductIds.includes(p.id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedProductIds([]);
    } else {
      setExpandedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setBrandId('');
    setStockStatus('all');
  };

  const activeFiltersCount =
    (search ? 1 : 0) + (categoryId ? 1 : 0) + (brandId ? 1 : 0) + (stockStatus !== 'all' ? 1 : 0);

  const warehouseOptions = [
    {
      value: 'all',
      label:
        selectedBranchId === 'all'
          ? 'Todos los almacenes (Global)'
          : `Todos los almacenes de ${selectedBranchObj?.name || 'la sucursal'}`,
    },
    ...branchWarehouses.map((w) => ({
      value: String(w.id),
      label: `${w.code} · ${w.name}${w.is_default ? ' (Principal)' : ''}`,
    })),
  ];

  const handleQuickAudit = () => {
    setActiveTab('counts');
    setNewAuditTrigger((n) => n + 1);
  };

  const handleQuickTransfer = () => {
    setActiveTab('warehouses');
    setNewTransferTrigger((n) => n + 1);
  };

  const handleQuickNewBranch = () => {
    setActiveTab('warehouses');
    setNewBranchTrigger((n) => n + 1);
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow">Operaciones y Depósito</span>
          <h1>Inventario y Almacenes</h1>
          <p className="admin-subtext">
            El catálogo es global de la marca; selecciona una sucursal o todas juntas para controlar existencias, ingresos, auditorías y traslados.
          </p>
        </div>

        <div className="inv-page-head-actions">
          <button
            type="button"
            className="admin-btn"
            onClick={() => handleInventoryMutated()}
            disabled={loading}
          >
            <svg className="inv-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>

          <button type="button" className="admin-btn admin-btn-primary" onClick={() => setNewEntryOpen(true)}>
            <svg className="inv-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo Ingreso
          </button>

          <button type="button" className="admin-btn" onClick={handleQuickTransfer}>
            <svg className="inv-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Nuevo Traslado
          </button>

          <button type="button" className="admin-btn" onClick={handleQuickAudit}>
            <svg className="inv-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Nueva Auditoría
          </button>
        </div>
      </header>

      {/* SELECTOR PRINCIPAL DE SUCURSAL AL INICIO DE LA PÁGINA */}
      <section className="inv-branch-section" aria-label="Selección de sucursal">
        <div className="inv-branch-section-head">
          <span className="inv-branch-section-title">
            Ubicación de Inventario · Elige una sucursal o visualiza todas juntas
          </span>
          <button type="button" className="admin-btn admin-btn-sm" onClick={handleQuickNewBranch}>
            + Nueva Sucursal
          </button>
        </div>

        <div className="inv-branch-grid">
          {metaLoading && activeBranches.length === 0 ? (
            [1, 2, 3, 4].map((idx) => (
              <div key={idx} className="inv-branch-card inv-skeleton-card" aria-hidden="true">
                <div className="inv-branch-card-top">
                  <span className="inv-skeleton-block inv-sk-badge" />
                  <span className="inv-skeleton-block inv-sk-qty" />
                </div>
                <div className="inv-skeleton-lines">
                  <span className="inv-skeleton-block inv-sk-title" />
                  <span className="inv-skeleton-block inv-sk-sub" />
                </div>
              </div>
            ))
          ) : (
            <>
              <button
                type="button"
                className={`inv-branch-card ${selectedBranchId === 'all' ? 'is-active' : ''}`}
                onClick={() => handleSelectBranch('all')}
              >
                <div className="inv-branch-card-top">
                  <span className="inv-branch-code">TODAS</span>
                  <span className="inv-branch-units">{totalUnitsAllBranches} u.</span>
                </div>
                <div>
                  <div className="inv-branch-name">Todas las Sucursales</div>
                  <div className="inv-branch-meta">
                    Vista consolidada · {activeBranches.length} sucursal(es) activa(s)
                  </div>
                </div>
              </button>

              {activeBranches.map((br) => (
                <button
                  key={br.id}
                  type="button"
                  className={`inv-branch-card ${String(selectedBranchId) === String(br.id) ? 'is-active' : ''}`}
                  onClick={() => handleSelectBranch(String(br.id))}
                >
                  <div className="inv-branch-card-top">
                    <span className="inv-branch-code">{br.code}</span>
                    <span className="inv-branch-units">{br.total_units} u.</span>
                  </div>
                  <div>
                    <div className="inv-branch-name">{br.name}</div>
                    <div className="inv-branch-meta">
                      {br.city} · {br.warehouses_count} almacén(es)
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">
            Valorización ({selectedBranchObj ? selectedBranchObj.code : 'Todas'})
          </span>
          <strong className="admin-kpi-value">{formatCurrency(stats.total_cost_value)}</strong>
          <span className="admin-kpi-hint">
            Potencial PVP: {formatCurrency(stats.total_retail_value)}
          </span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Unidades Disponibles</span>
          <strong className="admin-kpi-value">{stats.total_available}</strong>
          <span className="admin-kpi-hint">
            En mano: {stats.total_units} u. · Reservadas: {stats.total_reserved} u.
          </span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Alertas de Reposición</span>
          <strong className="admin-kpi-value">
            {stats.low_stock_variants + stats.out_of_stock_variants}
          </strong>
          <span className="admin-kpi-hint">
            {stats.low_stock_variants} stock bajo · {stats.out_of_stock_variants} agotadas
          </span>
        </article>

        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Catálogo de Marca</span>
          <strong className="admin-kpi-value">{stats.total_products}</strong>
          <span className="admin-kpi-hint">{stats.total_variants} variantes SKU activas</span>
        </article>
      </section>

      <nav className="admin-tabs" aria-label="Secciones de inventario">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'stock' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          Existencias por Producto ({stats.total_products})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'movements' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          Kardex y Movimientos
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'counts' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('counts')}
        >
          Auditorías Físicas
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'warehouses' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('warehouses')}
        >
          Sucursales, Almacenes y Traslados
        </button>
      </nav>

      {error && <div className="admin-alert is-error">{error}</div>}

      {activeTab === 'stock' && (
        <section className="admin-panel">
          <div className="inv-warehouse-bar">
            <div className="inv-warehouse-picker">
              <span className="inv-warehouse-label">
                {selectedBranchObj
                  ? `Almacén en ${selectedBranchObj.name}`
                  : 'Vista Consolidada'}
              </span>
              {branchWarehouses.length > 1 ? (
                <div className="inv-warehouse-select-wrap">
                  <CustomSelect
                    value={selectedWarehouseId}
                    onChange={setSelectedWarehouseId}
                    options={warehouseOptions}
                    loading={metaLoading}
                    loadingText="Cargando almacenes..."
                  />
                </div>
              ) : (
                <span className="admin-subtext">
                  {selectedBranchObj
                    ? branchWarehouses[0]
                      ? `${branchWarehouses[0].code} · ${branchWarehouses[0].name}`
                      : 'Sin almacén asignado'
                    : `Mostrando stock sumado y desglosado por sucursal (${activeBranches.length} sucursal/es)`}
                </span>
              )}
            </div>

            <div className="inv-bar-controls">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-primary"
                onClick={() => setNewEntryOpen(true)}
              >
                + Nuevo Ingreso
              </button>

              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={toggleExpandAll}
                disabled={filteredProducts.length === 0}
              >
                {allExpanded ? 'Colapsar todos' : 'Expandir todos'}
              </button>

              <button
                type="button"
                className={`admin-btn admin-btn-sm ${filtersOpen || activeFiltersCount > 0 ? 'admin-btn-primary' : ''}`}
                onClick={() => setFiltersOpen((o) => !o)}
              >
                Filtros {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="inv-filter-card">
              <div className="inv-filter-grid">
                <div className="admin-field">
                  <label>Buscar producto, SKU, código o variante</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ej: Vestido, P0001, Talla M..."
                  />
                </div>

                <div className="admin-field">
                  <label>Categoría</label>
                  <CustomSelect
                    value={categoryId}
                    onChange={setCategoryId}
                    loading={metaLoading}
                    loadingText="Cargando categorías..."
                    options={[
                      { value: '', label: 'Todas las categorías' },
                      ...meta.categories.map((c) => ({ value: String(c.id), label: c.name })),
                    ]}
                  />
                </div>

                <div className="admin-field">
                  <label>Marca</label>
                  <CustomSelect
                    value={brandId}
                    onChange={setBrandId}
                    loading={metaLoading}
                    loadingText="Cargando marcas..."
                    options={[
                      { value: '', label: 'Todas las marcas' },
                      ...meta.brands.map((b) => ({ value: String(b.id), label: b.name })),
                    ]}
                  />
                </div>

                <div className="admin-field">
                  <label>Estado de stock</label>
                  <CustomSelect
                    value={stockStatus}
                    onChange={setStockStatus}
                    options={[
                      { value: 'all', label: 'Todos los estados' },
                      { value: 'alert', label: 'En alerta o agotado' },
                      { value: 'low', label: 'Solo stock bajo' },
                      { value: 'out', label: 'Solo agotados (0)' },
                      { value: 'in_stock', label: 'Con stock disponible (> 0)' },
                      { value: 'overstock', label: 'Sobre límite máximo' },
                    ]}
                  />
                </div>

                <div className="inv-filter-actions">
                  <button type="button" className="admin-btn admin-btn-sm" onClick={resetFilters}>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="inv-products-stack">
            {loading ? (
              [1, 2, 3, 4].map((idx) => (
                <div key={idx} className="inv-product-card inv-skeleton-product" aria-hidden="true">
                  <div className="inv-product-main">
                    <span className="inv-skeleton-block inv-sk-chev" />
                    <span className="inv-skeleton-block inv-sk-thumb" />
                    <div className="inv-skeleton-lines">
                      <span className="inv-skeleton-block inv-sk-prod-title" />
                      <span className="inv-skeleton-block inv-sk-prod-sub" />
                    </div>
                  </div>
                  <div className="inv-product-summary">
                    <span className="inv-skeleton-block inv-sk-metric" />
                    <span className="inv-skeleton-block inv-sk-metric" />
                    <span className="inv-skeleton-block inv-sk-btn" />
                  </div>
                </div>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="admin-empty inv-empty-cta">
                <p>
                  {selectedBranchObj
                    ? `Aún no hay productos con stock registrado en ${selectedBranchObj.name}.`
                    : 'No hay productos con stock que coincidan con los filtros seleccionados.'}
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setNewEntryOpen(true)}
                >
                  + Registrar Nuevo Ingreso
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isExpanded = expandedProductIds.includes(product.id);
                const prodBadge = STOCK_STATUS_BADGE[product.stock_status] || STOCK_STATUS_BADGE.ok;

                return (
                  <article
                    key={product.id}
                    className={`inv-product-card ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    <div
                      className="inv-product-header"
                      onClick={() => toggleExpandProduct(product.id)}
                    >
                      <div className="inv-product-main">
                        <span className="inv-chevron-btn" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>

                        <div className="inv-product-thumb">
                          {product.cover_image ? (
                            <img src={product.cover_image} alt={product.name} />
                          ) : (
                            <span>{getInitials(product.name)}</span>
                          )}
                        </div>

                        <div className="inv-product-meta">
                          <div className="inv-product-title-row">
                            <span className="admin-code-tag">{product.sku_prefix}</span>
                            <span className="inv-product-name">{product.name}</span>
                            {!product.is_active && (
                              <span className="inv-stock-badge is-neutral">Inactivo</span>
                            )}
                          </div>
                          <div className="inv-product-sub">
                            <span>{product.category_name || 'Sin categoría'}</span>
                            {product.brand_name && <span>· {product.brand_name}</span>}
                            <span>· {product.variants.length} variante(s)</span>
                          </div>

                          {selectedBranchId === 'all' &&
                            product.branch_breakdown &&
                            product.branch_breakdown.length > 0 && (
                              <div className="inv-branch-dist-row">
                                {product.branch_breakdown.map((bb) => (
                                  <span
                                    key={bb.branch_id}
                                    className={`inv-branch-dist-chip ${
                                      bb.quantity_on_hand === 0 ? 'is-empty' : ''
                                    }`}
                                  >
                                    {bb.branch_code}: <strong>{bb.quantity_on_hand} u.</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="inv-product-summary">
                        <div className="inv-metric-pill">
                          <span className="inv-metric-pill-label">
                            {selectedBranchObj ? `Stock ${selectedBranchObj.code}` : 'Stock Total'}
                          </span>
                          <span
                            className={`inv-metric-pill-val ${
                              product.stock_status === 'out'
                                ? 'is-danger'
                                : product.stock_status === 'low'
                                ? 'is-warn'
                                : ''
                            }`}
                          >
                            {product.total_on_hand} u.
                          </span>
                        </div>

                        <div className="inv-metric-pill">
                          <span className="inv-metric-pill-label">Disponible</span>
                          <span className="inv-metric-pill-val">{product.total_available} u.</span>
                        </div>

                        <div className="inv-metric-pill">
                          <span className="inv-metric-pill-label">Valor Costo</span>
                          <span className="inv-metric-pill-val">{formatCurrency(product.cost_value)}</span>
                        </div>

                        <span className={`inv-stock-badge ${prodBadge.tone}`}>{prodBadge.label}</span>

                        <div
                          className="inv-product-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-primary"
                            onClick={() => setBatchModal({ open: true, product })}
                          >
                            + Ingreso en Lote
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="inv-variants-wrap">
                        <table className="inv-variants-table">
                          <thead>
                            <tr>
                              <th>Variante / SKU</th>
                              <th>Atributos y Distribución</th>
                              <th>Ubicación</th>
                              <th className="is-num">Costo</th>
                              <th className="is-num">PVP</th>
                              <th className="is-num">
                                {selectedBranchObj
                                  ? `Stock ${selectedBranchObj.code}`
                                  : 'Stock Global'}
                              </th>
                              <th className="is-num">Mín. Alerta</th>
                              <th>Estado</th>
                              <th className="is-num">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.variants.map((variant) => {
                              const vBadge =
                                STOCK_STATUS_BADGE[variant.stock_status] || STOCK_STATUS_BADGE.ok;
                              return (
                                <tr key={variant.id}>
                                  <td>
                                    <div className="inv-variant-cell">
                                      <div className="inv-variant-thumb">
                                        {variant.image_url ? (
                                          <img src={variant.image_url} alt={variant.sku} />
                                        ) : (
                                          <span>{getInitials(variant.variant_label)}</span>
                                        )}
                                      </div>
                                      <div>
                                        <div>
                                          <span className="admin-code-tag">{variant.sku}</span>
                                          {variant.is_default && (
                                            <span className="admin-subtext"> · Principal</span>
                                          )}
                                        </div>
                                        {variant.barcode && (
                                          <div className="admin-subtext">CB: {variant.barcode}</div>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td>
                                    {variant.attributes && variant.attributes.length > 0 ? (
                                      <div className="inv-attr-chips">
                                        {variant.attributes.map((attr) => (
                                          <span key={attr.attribute_id} className="inv-attr-chip">
                                            <span className="inv-attr-chip-key">{attr.attribute_name}:</span>
                                            <strong>{attr.value}</strong>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span>{variant.variant_label}</span>
                                    )}

                                    {selectedBranchId === 'all' &&
                                      variant.branch_breakdown &&
                                      variant.branch_breakdown.length > 0 && (
                                        <div className="inv-branch-dist-row">
                                          {variant.branch_breakdown.map((bb) => (
                                            <span
                                              key={bb.branch_id}
                                              className={`inv-branch-dist-chip ${
                                                bb.quantity_on_hand === 0 ? 'is-empty' : ''
                                              }`}
                                            >
                                              {bb.branch_code}: <strong>{bb.quantity_on_hand}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                    {selectedBranchId !== 'all' &&
                                      variant.other_branches_stock &&
                                      variant.other_branches_stock.length > 0 && (
                                        <div className="inv-branch-dist-row">
                                          {variant.other_branches_stock.map((ob) => (
                                            <span
                                              key={ob.branch_id}
                                              className="inv-branch-dist-chip is-other"
                                            >
                                              Otras · {ob.branch_code}: <strong>{ob.quantity_on_hand} u.</strong>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                  </td>

                                  <td>
                                    <div className="inv-location-cell">
                                      {variant.scoped_locations && variant.scoped_locations.length > 0 ? (
                                        variant.scoped_locations.map((loc) => (
                                          <div key={loc.warehouse_id} className="inv-location-item">
                                            <span className="inv-location-main">
                                              <strong>{loc.branch_code}</strong> · {loc.warehouse_name}
                                              {selectedBranchId === 'all' && ` (${loc.quantity_on_hand} u.)`}
                                            </span>
                                            {loc.bin_location && (
                                              <span className="inv-bin-tag">{loc.bin_location}</span>
                                            )}
                                          </div>
                                        ))
                                      ) : selectedBranchObj ? (
                                        <span className="inv-location-main">
                                          <strong>{selectedBranchObj.code}</strong> · {selectedBranchObj.name}
                                        </span>
                                      ) : (
                                        <span className="admin-subtext">-</span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="is-num">
                                    Bs. {Number(variant.cost_price || 0).toFixed(2)}
                                  </td>

                                  <td className="is-num">
                                    <strong>Bs. {Number(variant.base_price || 0).toFixed(2)}</strong>
                                  </td>

                                  <td className="is-num">
                                    <div className="inv-qty-strong">{variant.quantity_on_hand}</div>
                                    <div className="inv-qty-reserved">
                                      Disp: {variant.available} · Res: {variant.quantity_reserved}
                                    </div>
                                  </td>

                                  <td className="is-num">
                                    {variant.min_stock_alert}
                                    {variant.max_stock_limit !== null && (
                                      <div className="admin-subtext">Máx: {variant.max_stock_limit}</div>
                                    )}
                                  </td>

                                  <td>
                                    <span className={`inv-stock-badge ${vBadge.tone}`}>
                                      {vBadge.label}
                                    </span>
                                  </td>

                                  <td className="is-num">
                                    <div className="inv-row-actions">
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-sm admin-btn-primary"
                                        onClick={() =>
                                          setMovementModal({
                                            open: true,
                                            product,
                                            variant,
                                            initialTab: 'entry',
                                          })
                                        }
                                      >
                                        + Ingreso
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-sm"
                                        onClick={() =>
                                          setMovementModal({
                                            open: true,
                                            product,
                                            variant,
                                            initialTab: 'exact',
                                          })
                                        }
                                      >
                                        Ajustar
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                        onClick={() =>
                                          setMovementModal({
                                            open: true,
                                            product,
                                            variant,
                                            initialTab: 'exit',
                                          })
                                        }
                                      >
                                        Baja
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-sm admin-btn-ghost"
                                        onClick={() =>
                                          setSettingsModal({
                                            open: true,
                                            product,
                                            variant,
                                          })
                                        }
                                      >
                                        Config
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'movements' && (
        <InventoryMovementsTab
          warehouses={meta.warehouses}
          movementTypes={meta.movement_types}
          metaLoading={metaLoading}
          globalBranchId={selectedBranchId}
          globalWarehouseId={selectedWarehouseId}
          refreshKey={refreshKey}
        />
      )}

      {activeTab === 'counts' && (
        <InventoryCountsTab
          warehouses={meta.warehouses}
          categories={meta.categories}
          productsList={meta.catalog_products}
          metaLoading={metaLoading}
          globalBranchId={selectedBranchId}
          globalWarehouseId={selectedWarehouseId}
          onInventoryChanged={handleInventoryMutated}
          openNewTrigger={newAuditTrigger}
        />
      )}

      {activeTab === 'warehouses' && (
        <WarehousesTransfersTab
          branches={meta.branches}
          productsList={allProductsCatalog}
          metaLoading={metaLoading}
          globalBranchId={selectedBranchId}
          onInventoryChanged={handleInventoryMutated}
          openNewTransferTrigger={newTransferTrigger}
          openNewBranchTrigger={newBranchTrigger}
        />
      )}

      <NewStockEntryModal
        isOpen={newEntryOpen}
        onClose={() => setNewEntryOpen(false)}
        branches={meta.branches}
        warehouses={meta.warehouses}
        catalogProducts={meta.catalog_products}
        metaLoading={metaLoading}
        selectedBranchId={selectedBranchId}
        selectedWarehouseId={selectedWarehouseId}
        onSaved={handleInventoryMutated}
      />

      <StockMovementModal
        isOpen={movementModal.open}
        onClose={() => setMovementModal((prev) => ({ ...prev, open: false }))}
        product={movementModal.product}
        variant={movementModal.variant}
        warehouses={meta.warehouses}
        metaLoading={metaLoading}
        selectedWarehouseId={effectiveModalWarehouseId}
        initialTab={movementModal.initialTab}
        onSaved={handleInventoryMutated}
      />

      <ProductBatchEntryModal
        isOpen={batchModal.open}
        onClose={() => setBatchModal({ open: false, product: null })}
        product={batchModal.product}
        warehouses={meta.warehouses}
        metaLoading={metaLoading}
        selectedWarehouseId={effectiveModalWarehouseId}
        onSaved={handleInventoryMutated}
      />

      <VariantStockSettingsModal
        isOpen={settingsModal.open}
        onClose={() => setSettingsModal((prev) => ({ ...prev, open: false }))}
        product={settingsModal.product}
        variant={settingsModal.variant}
        warehouses={meta.warehouses}
        metaLoading={metaLoading}
        selectedWarehouseId={effectiveModalWarehouseId}
        onSaved={handleInventoryMutated}
      />
    </div>
  );
}
