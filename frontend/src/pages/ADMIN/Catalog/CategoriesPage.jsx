import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { catalogService } from '../../../services/admin/catalogService';

const TABS = [
  { id: 'categories', label: 'Categorías' },
  { id: 'brands', label: 'Marcas' },
  { id: 'seasons', label: 'Colecciones' },
  { id: 'departments', label: 'Departamentos' },
];

export default function CategoriesPage() {
  const [tab, setTab] = useState('categories');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = async (currentTab = tab) => {
    setLoading(true);
    setError('');
    try {
      const loaders = {
        categories: catalogService.getCategories,
        brands: catalogService.getBrands,
        seasons: catalogService.getSeasons,
        departments: catalogService.getDepartments,
      };
      const res = await loaders[currentTab]();
      setItems(res.data || []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      description: '',
      parent_id: '',
      year: new Date().getFullYear(),
      starts_at: '',
      ends_at: '',
      sort_order: 0,
      is_active: true,
    });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      parent_id: item.parent_id || '',
      year: item.year || new Date().getFullYear(),
      starts_at: item.starts_at ? item.starts_at.slice(0, 10) : '',
      ends_at: item.ends_at ? item.ends_at.slice(0, 10) : '',
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active ?? true,
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      let res;
      if (tab === 'categories') {
        payload.parent_id = payload.parent_id ? Number(payload.parent_id) : null;
        res = editing
          ? await catalogService.updateCategory(editing.id, payload)
          : await catalogService.createCategory(payload);
      } else if (tab === 'brands') {
        res = editing
          ? await catalogService.updateBrand(editing.id, payload)
          : await catalogService.createBrand(payload);
      } else if (tab === 'seasons') {
        payload.year = Number(payload.year);
        payload.starts_at = payload.starts_at || null;
        payload.ends_at = payload.ends_at || null;
        res = editing
          ? await catalogService.updateSeason(editing.id, payload)
          : await catalogService.createSeason(payload);
      } else if (tab === 'departments') {
        res = editing
          ? await catalogService.updateDepartment(editing.id, payload)
          : await catalogService.createDepartment(payload);
      }

      if (res?.data) {
        setItems((prev) =>
          editing ? prev.map((it) => (it.id === editing.id ? res.data : it)) : [res.data, ...prev]
        );
      }
      setFormOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      const deleters = {
        categories: catalogService.deleteCategory,
        brands: catalogService.deleteBrand,
        seasons: catalogService.deleteSeason,
        departments: catalogService.deleteDepartment,
      };
      await deleters[tab](deleteTarget.id);
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = TABS.find((t) => t.id === tab)?.label || '';

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Categorías, Marcas y Colecciones</h1>
          <p>Configura la estructura del catálogo de prendas.</p>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Nuevo registro
        </button>
      </header>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="admin-alert">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>{currentLabel}</h2>
          <span className="admin-badge">{items.length} registros</span>
        </div>

        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="admin-empty">No hay registros en {currentLabel.toLowerCase()}.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  {tab === 'categories' && <th>Categoría Padre</th>}
                  {tab === 'seasons' && <th>Año / Vigencia</th>}
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    {tab === 'categories' && <td>{item.category?.name || '—'}</td>}
                    {tab === 'seasons' && (
                      <td>
                        {item.year}
                        {item.starts_at ? ` (${item.starts_at.slice(0, 10)})` : ''}
                      </td>
                    )}
                    <td>
                      <span className={`admin-badge ${item.is_active ? '' : 'admin-badge-muted'}`}>
                        {item.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions-row">
                        <button type="button" className="admin-btn" onClick={() => openEdit(item)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <BaseModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow={currentLabel}
        title={editing ? `Editar ${editing.name}` : `Nuevo en ${currentLabel}`}
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="catalog-form" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="catalog-form" className="admin-form" onSubmit={handleSave}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. C0001)"
                value={form.code || ''}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="admin-field">
              <label>Nombre</label>
              <input
                className="admin-input"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

          {tab === 'categories' && (
            <>
              <div className="admin-field">
                <label>Categoría Padre (Opcional)</label>
                <CustomSelect
                  value={form.parent_id || ''}
                  onChange={(val) => setForm({ ...form, parent_id: val })}
                  options={[
                    { value: '', label: 'Ninguna (Principal)' },
                    ...items
                      .filter((c) => !editing || c.id !== editing.id)
                      .map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              <div className="admin-field">
                <label>Descripción</label>
                <textarea
                  className="admin-textarea"
                  rows="2"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </>
          )}

          {tab === 'seasons' && (
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Año</label>
                <input
                  type="number"
                  className="admin-input"
                  value={form.year || ''}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  required
                />
              </div>
              <div className="admin-field">
                <label>Inicio</label>
                <input
                  type="date"
                  className="admin-input"
                  value={form.starts_at || ''}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Fin</label>
                <input
                  type="date"
                  className="admin-input"
                  value={form.ends_at || ''}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
          )}

          <label className="admin-checkbox-row">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Activo
          </label>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar"
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        message="Esta acción eliminará el registro de la base de datos."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
