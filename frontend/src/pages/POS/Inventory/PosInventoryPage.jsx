import { useEffect, useMemo, useState } from 'react';
import CustomSelect from '../../../components/CustomSelect';
import { saleService } from '../../../services/pos/saleService';
import './posInventory.css';

function formatMoney(val) {
  return `Bs. ${Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getInitials(name) {
  const parts = String(name || 'P').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '') || 'P').toUpperCase();
}

export default function PosInventoryPage({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    total_products: 0,
    total_variants: 0,
    available_here_variants: 0,
    only_other_branches_variants: 0,
    out_of_stock_variants: 0,
  });

  // Filtros
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [availability, setAvailability] = useState('all');

  // Productos colapsados por defecto
  const [expandedIds, setExpandedIds] = useState([]);

  const loadInventory = async (branchIdParam = undefined) => {
    setLoading(true);
    setError('');
    try {
      const res = await saleService.getInventory(
        branchIdParam ? { branch_id: branchIdParam } : {}
      );
      const d = res.data || {};
      setBranches(d.branches || []);
      setCategories(d.categories || []);
      setBrands(d.brands || []);
      setProducts(d.items || []);
      if (d.stats) setStats(d.stats);
      if (d.selected_branch_id) setSelectedBranchId(String(d.selected_branch_id));
    } catch (err) {
      setError(err.message || 'No se pudo cargar el inventario de tienda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleBranchChange = (nextBrId) => {
    setSelectedBranchId(nextBrId);
    setExpandedIds([]);
    loadInventory(nextBrId);
  };

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .map((prod) => {
        if (categoryId && String(prod.category_id) !== String(categoryId)) return null;
        if (brandId && String(prod.brand_id) !== String(brandId)) return null;

        let vars = prod.variants || [];

        if (term) {
          const prodMatches =
            (prod.name || '').toLowerCase().includes(term) ||
            (prod.sku_prefix || '').toLowerCase().includes(term);

          if (!prodMatches) {
            vars = vars.filter(
              (v) =>
                (v.sku || '').toLowerCase().includes(term) ||
                (v.barcode || '').toLowerCase().includes(term) ||
                (v.variant_label || '').toLowerCase().includes(term) ||
                (v.attributes || []).some((a) =>
                  (a.value || '').toLowerCase().includes(term)
                )
            );
          }
        }

        if (availability !== 'all') {
          vars = vars.filter((v) => v.availability_status === availability);
        }

        if (vars.length === 0) return null;

        return { ...prod, variants: vars };
      })
      .filter(Boolean);
  }, [products, search, categoryId, brandId, availability]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allExpanded =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => expandedIds.includes(p.id));

  const toggleExpandAll = () => {
    setExpandedIds(allExpanded ? [] : filteredProducts.map((p) => p.id));
  };

  return (
    <section>
      <div className="pos-page-head">
        <div>
          <span className="pos-eyebrow">Consulta de Tienda · Solo Lectura</span>
          <h1>Inventario y Disponibilidad</h1>
          <p className="pos-page-sub">
            Revisa precios de venta, atributos y disponibilidad en tu sucursal o en otras sucursales (consulta sin edición).
          </p>
        </div>

        <div className="admin-actions-row">
          <button
            type="button"
            className="pos-btn"
            onClick={() => loadInventory(selectedBranchId)}
            disabled={loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
          {onNavigate && (
            <button type="button" className="pos-btn" onClick={() => onNavigate('pos.main')}>
              Volver al Inicio POS
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE MI SUCURSAL */}
      <div className="pos-inv-top-bar">
        <div className="pos-inv-branch-box">
          <span className="pos-field-label">Mi Sucursal</span>
          <div className="pos-inv-branch-select">
            <CustomSelect
              value={selectedBranchId}
              onChange={handleBranchChange}
              loading={loading && branches.length === 0}
              loadingText="Cargando sucursales..."
              options={branches.map((b) => ({
                value: String(b.id),
                label: `${b.code} · ${b.name} (${b.city})`,
              }))}
              placeholder="Seleccionar mi sucursal..."
            />
          </div>
        </div>

        <span className="pos-inv-readonly-pill">
          Otras sucursales: solo consulta de disponibilidad
        </span>
      </div>

      {/* KPIS SIN COSTOS */}
      <div className="pos-inv-kpi-grid">
        <article className="pos-inv-kpi">
          <span className="pos-inv-kpi-label">Productos en Catálogo</span>
          <strong className="pos-inv-kpi-val">{stats.total_products}</strong>
          <span className="pos-inv-kpi-sub">{stats.total_variants} variantes activas</span>
        </article>

        <article className="pos-inv-kpi">
          <span className="pos-inv-kpi-label">Disponibles Aquí</span>
          <strong className="pos-inv-kpi-val">{stats.available_here_variants}</strong>
          <span className="pos-inv-kpi-sub">
            En {selectedBranch ? selectedBranch.name : 'tu sucursal'}
          </span>
        </article>

        <article className="pos-inv-kpi">
          <span className="pos-inv-kpi-label">En Otra Sucursal</span>
          <strong className="pos-inv-kpi-val">{stats.only_other_branches_variants}</strong>
          <span className="pos-inv-kpi-sub">Sin stock aquí, pero sí en otra tienda</span>
        </article>

        <article className="pos-inv-kpi">
          <span className="pos-inv-kpi-label">Agotadas en Todas</span>
          <strong className="pos-inv-kpi-val">{stats.out_of_stock_variants}</strong>
          <span className="pos-inv-kpi-sub">Sin unidades disponibles</span>
        </article>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <div className="pos-panel">
        <div className="pos-inv-filters">
          <div>
            <span className="pos-field-label">Buscar producto, SKU, código o talla/color</span>
            <input
              type="text"
              className="pos-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: Vestido, Negro, M, P0001..."
            />
          </div>

          <div>
            <span className="pos-field-label">Categoría</span>
            <CustomSelect
              value={categoryId}
              onChange={setCategoryId}
              loading={loading && categories.length === 0}
              loadingText="Cargando..."
              options={[
                { value: '', label: 'Todas' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          </div>

          <div>
            <span className="pos-field-label">Marca</span>
            <CustomSelect
              value={brandId}
              onChange={setBrandId}
              loading={loading && brands.length === 0}
              loadingText="Cargando..."
              options={[
                { value: '', label: 'Todas' },
                ...brands.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
            />
          </div>

          <div>
            <span className="pos-field-label">Disponibilidad</span>
            <CustomSelect
              value={availability}
              onChange={setAvailability}
              options={[
                { value: 'all', label: 'Todo el catálogo' },
                { value: 'available_here', label: 'Disponibles en mi sucursal' },
                { value: 'only_other_branches', label: 'Solo en otras sucursales' },
                { value: 'out_of_stock', label: 'Agotados en todas' },
              ]}
            />
          </div>

          <button
            type="button"
            className="pos-btn"
            onClick={toggleExpandAll}
            disabled={filteredProducts.length === 0}
          >
            {allExpanded ? 'Colapsar' : 'Expandir'}
          </button>
        </div>

        <div className="pos-inv-stack">
          {loading ? (
            [1, 2, 3, 4].map((n) => <div key={n} className="pos-inv-sk-card" aria-hidden="true" />)
          ) : filteredProducts.length === 0 ? (
            <div className="pos-empty-module">
              <p>No se encontraron productos con los filtros seleccionados.</p>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isOpen = expandedIds.includes(prod.id);
              return (
                <article
                  key={prod.id}
                  className={`pos-inv-card ${isOpen ? 'is-expanded' : ''}`}
                >
                  <div className="pos-inv-card-head" onClick={() => toggleExpand(prod.id)}>
                    <div className="pos-inv-prod-main">
                      <span className="pos-inv-chev" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>

                      <div className="pos-inv-thumb">
                        {prod.cover_image ? (
                          <img src={prod.cover_image} alt={prod.name} />
                        ) : (
                          <span>{getInitials(prod.name)}</span>
                        )}
                      </div>

                      <div>
                        <div className="admin-actions-row">
                          <span className="admin-code-tag">{prod.sku_prefix}</span>
                          <strong>{prod.name}</strong>
                        </div>
                        <div className="admin-subtext">
                          {prod.category_name || 'Sin categoría'}
                          {prod.brand_name ? ` · ${prod.brand_name}` : ''} · {prod.variants.length}{' '}
                          variante(s)
                        </div>
                      </div>
                    </div>

                    <div className="pos-inv-summary">
                      <div>
                        <div className="pos-inv-kpi-label">Precio PVP</div>
                        <strong>
                          {prod.min_price === prod.max_price
                            ? formatMoney(prod.min_price)
                            : `${formatMoney(prod.min_price)} - ${formatMoney(prod.max_price)}`}
                        </strong>
                      </div>

                      {prod.availability_status === 'available_here' ? (
                        <span className="pos-inv-badge is-here">
                          Disponible aquí: {prod.my_branch_available} u.
                        </span>
                      ) : prod.availability_status === 'only_other_branches' ? (
                        <span className="pos-inv-badge is-other">
                          No hay aquí · En otras suc.: {prod.other_branches_available} u.
                        </span>
                      ) : (
                        <span className="pos-inv-badge is-out">Agotado en todas</span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="pos-inv-table-wrap">
                      <table className="pos-inv-table">
                        <thead>
                          <tr>
                            <th>Variante / SKU</th>
                            <th>Atributos</th>
                            <th className="is-num">Precio Venta</th>
                            <th className="is-num">
                              Mi Sucursal ({selectedBranch?.code || 'Actual'})
                            </th>
                            <th>Disponibilidad en Otras Sucursales</th>
                            <th className="is-num">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prod.variants.map((v) => (
                            <tr key={v.id}>
                              <td>
                                <div className="admin-actions-row">
                                  <span className="admin-code-tag">{v.sku}</span>
                                  {v.barcode && (
                                    <span className="admin-subtext">CB: {v.barcode}</span>
                                  )}
                                </div>
                              </td>

                              <td>
                                {v.attributes && v.attributes.length > 0 ? (
                                  <div className="inv-attr-chips">
                                    {v.attributes.map((attr) => (
                                      <span key={attr.attribute_id} className="inv-attr-chip">
                                        <span className="inv-attr-chip-key">
                                          {attr.attribute_name}:
                                        </span>
                                        <strong>{attr.value}</strong>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span>{v.variant_label}</span>
                                )}
                              </td>

                              <td className="is-num">
                                <strong>{formatMoney(v.base_price)}</strong>
                                {v.min_sale_price !== null && (
                                  <div className="admin-subtext">
                                    Mín: {formatMoney(v.min_sale_price)}
                                  </div>
                                )}
                              </td>

                              <td className="is-num">
                                {v.my_branch_available > 0 ? (
                                  <>
                                    <span className="pos-inv-badge is-here">
                                      {v.my_branch_available} disp.
                                    </span>
                                    {v.my_branch_reserved > 0 && (
                                      <div className="admin-subtext">
                                        Reservadas: {v.my_branch_reserved}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="pos-inv-badge is-out">0 aquí</span>
                                    {v.my_branch_reserved > 0 && (
                                      <div className="admin-subtext">
                                        ({v.my_branch_reserved} reservadas)
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>

                              <td>
                                {v.other_branches && v.other_branches.length > 0 ? (
                                  <div className="pos-inv-other-list">
                                    {v.other_branches.map((ob) => (
                                      <span key={ob.branch_id} className="pos-inv-other-chip">
                                        {ob.branch_code} {ob.branch_name}: {ob.available} u.
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="admin-subtext">
                                    Sin stock en otras sucursales
                                  </span>
                                )}
                              </td>

                              <td className="is-num">
                                {v.my_branch_available > 0 ? (
                                  <button
                                    type="button"
                                    className="pos-btn pos-btn-primary"
                                    onClick={() => onNavigate?.('pos.sell')}
                                  >
                                    Ir a Vender
                                  </button>
                                ) : v.other_branches_available > 0 ? (
                                  <span className="admin-subtext">Solo consulta</span>
                                ) : (
                                  <span className="admin-subtext">Agotado</span>
                                )}
                              </td>
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
      </div>
    </section>
  );
}
