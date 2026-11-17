import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import ProductVariantsModal from './ProductVariantsModal';
import ProductImagesModal from './ProductImagesModal';
import { catalogService } from '../../../services/admin/catalogService';
import { productService } from '../../../services/admin/productService';

const EMPTY_FORM = {
  sku_prefix: '',
  name: '',
  department_id: '',
  category_id: '',
  brand_id: '',
  season_id: '',
  size_guide_id: '',
  product_type: 'single',
  set_stock_mode: 'none',
  base_price: '',
  cost_price: '',
  short_description: '',
  description: '',
  care_instructions: '',
  is_taxable: true,
  tax_rate: '0',
  is_active: true,
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, sets: 0 });
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [sizeGuides, setSizeGuides] = useState([]);
  const [attributes, setAttributes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modales
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Modal Variantes e Imágenes
  const [variantProduct, setVariantProduct] = useState(null);
  const [imageProduct, setImageProduct] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, deptRes, catRes, brandRes, seasonRes, guideRes, attrRes] = await Promise.all([
        productService.getAll(),
        catalogService.getDepartments(),
        catalogService.getCategories(),
        catalogService.getBrands(),
        catalogService.getSeasons(),
        catalogService.getSizeGuides(),
        catalogService.getAttributes(),
      ]);

      const prodData = prodRes.data || {};
      setProducts(prodData.items || []);
      setStats(prodData.stats || { total: 0, active: 0, inactive: 0, sets: 0 });
      setDepartments(deptRes.data || []);
      setCategories(catRes.data || []);
      setBrands(brandRes.data || []);
      setSeasons(seasonRes.data || []);
      setSizeGuides(guideRes.data || []);
      setAttributes(attrRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = search.trim().toLowerCase();
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku_prefix.toLowerCase().includes(term);
      const matchCategory =
        !filterCategory || String(p.category_id) === String(filterCategory);
      const matchStatus =
        filterStatus === '' ||
        (filterStatus === 'active' && p.is_active) ||
        (filterStatus === 'inactive' && !p.is_active);
      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, filterCategory, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      department_id: departments[0]?.id ? String(departments[0].id) : '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
    });
    setFormOpen(true);
  };

  const openEdit = (product) => {
    const defaultVariant = product.product_variants?.[0];
    setEditing(product);
    setForm({
      sku_prefix: product.sku_prefix || '',
      name: product.name || '',
      department_id: String(product.department_id || ''),
      category_id: String(product.category_id || ''),
      brand_id: product.brand_id ? String(product.brand_id) : '',
      season_id: product.season_id ? String(product.season_id) : '',
      size_guide_id: product.size_guide_id ? String(product.size_guide_id) : '',
      product_type: product.product_type || 'single',
      set_stock_mode: product.set_stock_mode || 'none',
      base_price: defaultVariant?.base_price ?? '',
      cost_price: defaultVariant?.cost_price ?? '',
      short_description: product.short_description || '',
      description: product.description || '',
      care_instructions: product.care_instructions || '',
      is_taxable: !!product.is_taxable,
      tax_rate: String(product.tax_rate ?? 0),
      is_active: !!product.is_active,
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        department_id: Number(form.department_id),
        category_id: Number(form.category_id),
        brand_id: form.brand_id ? Number(form.brand_id) : null,
        season_id: form.season_id ? Number(form.season_id) : null,
        size_guide_id: form.size_guide_id ? Number(form.size_guide_id) : null,
        base_price: Number(form.base_price || 0),
        cost_price: Number(form.cost_price || 0),
        tax_rate: Number(form.tax_rate || 0),
      };

      if (editing) {
        const res = await productService.update(editing.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? res.data : p)));
      } else {
        const res = await productService.create(payload);
        setProducts((prev) => [res.data, ...prev]);
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          active: res.data.is_active ? prev.active + 1 : prev.active,
          inactive: !res.data.is_active ? prev.inactive + 1 : prev.inactive,
          sets: res.data.product_type === 'set' ? prev.sets + 1 : prev.sets,
        }));
      }
      setFormOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await productService.remove(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVariantsChanged = (productId, updatedVariants) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, product_variants: updatedVariants } : p
      )
    );
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Productos</h1>
          <p>Catálogo de prendas, conjuntos, precios base y variantes.</p>
        </div>
        <div className="admin-actions-row">
          <button
            type="button"
            className="admin-btn"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" strokeLinejoin="round" />
            </svg>
            Filtros
          </button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nuevo Producto
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Total Productos</span>
          <strong className="admin-kpi-value">{stats.total}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Activos</span>
          <strong className="admin-kpi-value">{stats.active}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Inactivos</span>
          <strong className="admin-kpi-value">{stats.inactive}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Conjuntos (Sets)</span>
          <strong className="admin-kpi-value">{stats.sets}</strong>
        </article>
      </section>

      {error && <div className="admin-alert">{error}</div>}

      {filtersOpen && (
        <div className="admin-toolbar">
          <input
            className="admin-input"
            placeholder="Buscar por nombre o código (ej. P0001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CustomSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { value: '', label: 'Todas las categorías' },
              ...categories.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'active', label: 'Activos' },
              { value: 'inactive', label: 'Inactivos' },
            ]}
          />
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Cargando productos...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="admin-empty">No se encontraron productos.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Marca / Colección</th>
                  <th>Tipo</th>
                  <th>Precio Base</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const defaultVar = p.product_variants?.[0];
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="admin-code-tag">{p.sku_prefix}</span>
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.short_description && (
                          <span className="admin-subtext">{p.short_description}</span>
                        )}
                      </td>
                      <td>
                        {p.category?.name || '—'}
                        <span className="admin-subtext">{p.department?.name}</span>
                      </td>
                      <td>
                        {p.brand?.name || 'Sin marca'}
                        {p.season && (
                          <span className="admin-subtext">
                            {p.season.name} {p.season.year}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="admin-badge">
                          {p.product_type === 'set' ? 'Conjunto' : 'Prenda'}
                        </span>
                      </td>
                      <td className="admin-price-cell">
                        Bs. {Number(defaultVar?.base_price ?? 0).toFixed(2)}
                      </td>
                      <td>
                        <span className={`admin-badge ${p.is_active ? '' : 'admin-badge-muted'}`}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-row">
                          <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setVariantProduct(p)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                            </svg>
                            Variantes ({p.product_variants?.length ?? 0})
                          </button>
                          <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setImageProduct(p)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Imágenes
                          </button>
                          <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => openEdit(p)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <BaseModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Catálogo"
        title={editing ? `Editar ${editing.name}` : 'Nuevo Producto'}
        wide
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="product-form" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </>
        }
      >
        <form id="product-form" className="admin-form" onSubmit={handleSave}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código SKU (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. P0001)"
                value={form.sku_prefix}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, sku_prefix: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="admin-field">
              <label>Nombre del Producto</label>
              <input
                className="admin-input"
                placeholder="Ej. Vestido Lino Verano"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Departamento</label>
              <CustomSelect
                value={form.department_id}
                onChange={(val) => setForm({ ...form, department_id: val })}
                placeholder="Seleccionar departamento..."
                options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </div>
            <div className="admin-field">
              <label>Categoría</label>
              <CustomSelect
                value={form.category_id}
                onChange={(val) => setForm({ ...form, category_id: val })}
                placeholder="Seleccionar categoría..."
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Marca</label>
              <CustomSelect
                value={form.brand_id}
                onChange={(val) => setForm({ ...form, brand_id: val })}
                options={[
                  { value: '', label: 'Sin marca' },
                  ...brands.map((b) => ({ value: String(b.id), label: b.name })),
                ]}
              />
            </div>
            <div className="admin-field">
              <label>Colección / Temporada</label>
              <CustomSelect
                value={form.season_id}
                onChange={(val) => setForm({ ...form, season_id: val })}
                options={[
                  { value: '', label: 'Sin colección' },
                  ...seasons.map((s) => ({ value: String(s.id), label: `${s.name} (${s.year})` })),
                ]}
              />
            </div>
            <div className="admin-field">
              <label>Guía de Tallas</label>
              <CustomSelect
                value={form.size_guide_id}
                onChange={(val) => setForm({ ...form, size_guide_id: val })}
                options={[
                  { value: '', label: 'Ninguna' },
                  ...sizeGuides.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Tipo de Producto</label>
              <CustomSelect
                value={form.product_type}
                onChange={(val) =>
                  setForm({
                    ...form,
                    product_type: val,
                    set_stock_mode: val === 'single' ? 'none' : 'independent',
                  })
                }
                options={[
                  { value: 'single', label: 'Prenda Individual' },
                  { value: 'set', label: 'Conjunto (Set)' },
                ]}
              />
            </div>
            <div className="admin-field">
              <label>Precio Base (Bs.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="admin-input"
                placeholder="0.00"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Costo Referencial (Bs.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="admin-input"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-field">
            <label>Descripción Corta</label>
            <input
              className="admin-input"
              placeholder="Resumen breve para catálogo..."
              value={form.short_description}
              onChange={(e) => setForm({ ...form, short_description: e.target.value })}
            />
          </div>

          <label className="admin-checkbox-row">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Producto activo en catálogo
          </label>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar"
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        message="El producto se moverá a papelera (soft delete)."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />

      <ProductVariantsModal
        product={variantProduct}
        attributes={attributes}
        onClose={() => setVariantProduct(null)}
        onVariantsChanged={handleVariantsChanged}
      />

      <ProductImagesModal
        product={imageProduct}
        attributes={attributes}
        onClose={() => setImageProduct(null)}
      />
    </>
  );
}
