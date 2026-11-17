import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { catalogService } from '../../../services/admin/catalogService';

export default function AttributesPage() {
  const [tab, setTab] = useState('attributes');
  const [attributes, setAttributes] = useState([]);
  const [guides, setGuides] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Modales Atributo
  const [attrModal, setAttrModal] = useState(false);
  const [attrForm, setAttrForm] = useState({ code: '', name: '', data_type: 'text', is_variant_axis: true });
  const [valueModalAttr, setValueModalAttr] = useState(null);
  const [valueForm, setValueForm] = useState({ code: '', value: '', meta_hex: '#000000' });

  // Modales Guía de Tallas
  const [guideModal, setGuideModal] = useState(false);
  const [guideForm, setGuideForm] = useState({ name: '', unit: 'cm', department_id: '', category_id: '', notes: '' });
  const [guideItemTarget, setGuideItemTarget] = useState(null);
  const [guideItemForm, setGuideItemForm] = useState({ size_label: '', busto: '', cintura: '', cadera: '' });

  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadAll = async () => {
    setError('');
    try {
      const [attrRes, guideRes, deptRes, catRes] = await Promise.all([
        catalogService.getAttributes(),
        catalogService.getSizeGuides(),
        catalogService.getDepartments(),
        catalogService.getCategories(),
      ]);
      setAttributes(attrRes.data || []);
      setGuides(guideRes.data || []);
      setDepartments(deptRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveAttr = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await catalogService.createAttribute(attrForm);
      setAttributes((prev) => [...prev, res.data]);
      setAttrModal(false);
      setAttrForm({ code: '', name: '', data_type: 'text', is_variant_axis: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveValue = async (e) => {
    e.preventDefault();
    if (!valueModalAttr || saving) return;
    setSaving(true);
    try {
      const payload = {
        code: valueForm.code,
        value: valueForm.value,
        meta_hex: valueModalAttr.data_type === 'color_hex' ? valueForm.meta_hex : null,
      };
      const res = await catalogService.createAttributeValue(valueModalAttr.id, payload);
      setAttributes((prev) =>
        prev.map((a) =>
          a.id === valueModalAttr.id
            ? { ...a, attribute_values: [...(a.attribute_values || []), res.data] }
            : a
        )
      );
      setValueModalAttr(null);
      setValueForm({ code: '', value: '', meta_hex: '#000000' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGuide = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await catalogService.createSizeGuide({
        ...guideForm,
        department_id: guideForm.department_id ? Number(guideForm.department_id) : null,
        category_id: guideForm.category_id ? Number(guideForm.category_id) : null,
      });
      setGuides((prev) => [...prev, res.data]);
      setGuideModal(false);
      setGuideForm({ name: '', unit: 'cm', department_id: '', category_id: '', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGuideItem = async (e) => {
    e.preventDefault();
    if (!guideItemTarget || saving) return;
    setSaving(true);
    try {
      const res = await catalogService.createSizeGuideItem(guideItemTarget.id, {
        size_label: guideItemForm.size_label,
        measurements: {
          busto: guideItemForm.busto,
          cintura: guideItemForm.cintura,
          cadera: guideItemForm.cadera,
        },
      });
      setGuides((prev) =>
        prev.map((g) =>
          g.id === guideItemTarget.id
            ? { ...g, size_guide_items: [...(g.size_guide_items || []), res.data] }
            : g
        )
      );
      setGuideItemTarget(null);
      setGuideItemForm({ size_label: '', busto: '', cintura: '', cadera: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      if (deleteTarget.type === 'attribute') {
        await catalogService.deleteAttribute(deleteTarget.id);
        setAttributes((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'value') {
        await catalogService.deleteAttributeValue(deleteTarget.id);
        setAttributes((prev) =>
          prev.map((a) => ({
            ...a,
            attribute_values: (a.attribute_values || []).filter((v) => v.id !== deleteTarget.id),
          }))
        );
      } else if (deleteTarget.type === 'guide') {
        await catalogService.deleteSizeGuide(deleteTarget.id);
        setGuides((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'guideItem') {
        await catalogService.deleteSizeGuideItem(deleteTarget.id);
        setGuides((prev) =>
          prev.map((g) => ({
            ...g,
            size_guide_items: (g.size_guide_items || []).filter((i) => i.id !== deleteTarget.id),
          }))
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Tallas, Atributos y Guías</h1>
          <p>Gestiona tallas, colores, materiales y medidas por prenda.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => (tab === 'attributes' ? setAttrModal(true) : setGuideModal(true))}
        >
          {tab === 'attributes' ? '+ Nuevo Atributo' : '+ Nueva Guía de Tallas'}
        </button>
      </header>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === 'attributes' ? 'is-active' : ''}`}
          onClick={() => setTab('attributes')}
        >
          Atributos y Valores
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'guides' ? 'is-active' : ''}`}
          onClick={() => setTab('guides')}
        >
          Guías de Tallas
        </button>
      </div>

      {error && <div className="admin-alert">{error}</div>}

      {tab === 'attributes' &&
        attributes.map((attr) => (
          <section key={attr.id} className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>{attr.name}</h2>
                <span className="admin-badge">
                  {attr.code} · {attr.data_type}
                </span>
              </div>
              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => {
                    setValueModalAttr(attr);
                    setValueForm({ code: '', value: '', meta_hex: '#000000' });
                  }}
                >
                  + Agregar valor
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => setDeleteTarget({ type: 'attribute', id: attr.id, name: attr.name })}
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div className="admin-chips">
              {(attr.attribute_values || []).length === 0 ? (
                <span className="admin-empty">Sin valores registrados.</span>
              ) : (
                attr.attribute_values.map((val) => (
                  <span key={val.id} className="admin-chip">
                    {val.meta_hex && (
                      <span className="admin-color-dot" title={val.meta_hex} />
                    )}
                    <span>{val.value}</span>
                    <button
                      type="button"
                      className="admin-chip-remove"
                      onClick={() => setDeleteTarget({ type: 'value', id: val.id, name: val.value })}
                      aria-label="Eliminar valor"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>
        ))}

      {tab === 'guides' &&
        (guides.length === 0 ? (
          <section className="admin-panel">
            <p className="admin-empty">No hay guías de tallas creadas.</p>
          </section>
        ) : (
          guides.map((g) => (
            <section key={g.id} className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>{g.name}</h2>
                  <span className="admin-badge">
                    Unidad: {g.unit} {g.category?.name ? `· ${g.category.name}` : ''}
                  </span>
                </div>
                <div className="admin-actions-row">
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setGuideItemTarget(g)}
                  >
                    + Agregar Talla
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => setDeleteTarget({ type: 'guide', id: g.id, name: g.name })}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Talla</th>
                      <th>Busto</th>
                      <th>Cintura</th>
                      <th>Cadera</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(g.size_guide_items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.size_label}</td>
                        <td>{item.measurements?.busto || '—'}</td>
                        <td>{item.measurements?.cintura || '—'}</td>
                        <td>{item.measurements?.cadera || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            onClick={() =>
                              setDeleteTarget({ type: 'guideItem', id: item.id, name: item.size_label })
                            }
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        ))}

      <BaseModal
        isOpen={attrModal}
        onClose={() => setAttrModal(false)}
        eyebrow="Atributos"
        title="Nuevo Atributo"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setAttrModal(false)}>
              Cancelar
            </button>
            <button type="submit" form="attr-form" className="admin-btn admin-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="attr-form" className="admin-form" onSubmit={handleSaveAttr}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. A0001)"
                value={attrForm.code}
                onChange={(e) => setAttrForm({ ...attrForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="admin-field">
              <label>Nombre</label>
              <input
                className="admin-input"
                placeholder="Talla, Color..."
                value={attrForm.name}
                onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="admin-field">
            <label>Tipo de dato</label>
            <CustomSelect
              value={attrForm.data_type}
              onChange={(val) => setAttrForm({ ...attrForm, data_type: val })}
              options={[
                { value: 'text', label: 'Texto (Tallas, Material)' },
                { value: 'color_hex', label: 'Color (Hexadecimal)' },
                { value: 'numeric', label: 'Numérico' },
              ]}
            />
          </div>
        </form>
      </BaseModal>

      <BaseModal
        isOpen={!!valueModalAttr}
        onClose={() => setValueModalAttr(null)}
        eyebrow={valueModalAttr?.name}
        title="Agregar Valor"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setValueModalAttr(null)}>
              Cancelar
            </button>
            <button type="submit" form="val-form" className="admin-btn admin-btn-primary">
              Agregar
            </button>
          </>
        }
      >
        <form id="val-form" className="admin-form" onSubmit={handleSaveValue}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. V0001)"
                value={valueForm.code}
                onChange={(e) => setValueForm({ ...valueForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="admin-field">
              <label>Valor visible</label>
              <input
                className="admin-input"
                placeholder="XS, S, Beige..."
                value={valueForm.value}
                onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
                required
              />
            </div>
          </div>
          {valueModalAttr?.data_type === 'color_hex' && (
            <div className="admin-field">
              <label>Color Hex</label>
              <input
                type="color"
                className="admin-input"
                value={valueForm.meta_hex}
                onChange={(e) => setValueForm({ ...valueForm, meta_hex: e.target.value })}
              />
            </div>
          )}
        </form>
      </BaseModal>

      <BaseModal
        isOpen={guideModal}
        onClose={() => setGuideModal(false)}
        eyebrow="Guías de Tallas"
        title="Nueva Guía de Tallas"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setGuideModal(false)}>
              Cancelar
            </button>
            <button type="submit" form="guide-form" className="admin-btn admin-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="guide-form" className="admin-form" onSubmit={handleSaveGuide}>
          <div className="admin-field">
            <label>Nombre</label>
            <input
              className="admin-input"
              placeholder="Ej. Vestidos Mujer"
              value={guideForm.name}
              onChange={(e) => setGuideForm({ ...guideForm, name: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Unidad</label>
              <CustomSelect
                value={guideForm.unit}
                onChange={(val) => setGuideForm({ ...guideForm, unit: val })}
                options={[
                  { value: 'cm', label: 'Centímetros (cm)' },
                  { value: 'in', label: 'Pulgadas (in)' },
                ]}
              />
            </div>
            <div className="admin-field">
              <label>Departamento</label>
              <CustomSelect
                value={guideForm.department_id}
                onChange={(val) => setGuideForm({ ...guideForm, department_id: val })}
                options={[
                  { value: '', label: 'General' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <div className="admin-field">
              <label>Categoría</label>
              <CustomSelect
                value={guideForm.category_id}
                onChange={(val) => setGuideForm({ ...guideForm, category_id: val })}
                options={[
                  { value: '', label: 'General' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          </div>
        </form>
      </BaseModal>

      <BaseModal
        isOpen={!!guideItemTarget}
        onClose={() => setGuideItemTarget(null)}
        eyebrow={guideItemTarget?.name}
        title="Agregar Talla a Guía"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setGuideItemTarget(null)}>
              Cancelar
            </button>
            <button type="submit" form="guide-item-form" className="admin-btn admin-btn-primary">
              Agregar
            </button>
          </>
        }
      >
        <form id="guide-item-form" className="admin-form" onSubmit={handleSaveGuideItem}>
          <div className="admin-field">
            <label>Etiqueta de Talla</label>
            <input
              className="admin-input"
              placeholder="S, M, L..."
              value={guideItemForm.size_label}
              onChange={(e) => setGuideItemForm({ ...guideItemForm, size_label: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Busto</label>
              <input
                className="admin-input"
                placeholder="86-90"
                value={guideItemForm.busto}
                onChange={(e) => setGuideItemForm({ ...guideItemForm, busto: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Cintura</label>
              <input
                className="admin-input"
                placeholder="66-70"
                value={guideItemForm.cintura}
                onChange={(e) => setGuideItemForm({ ...guideItemForm, cintura: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Cadera</label>
              <input
                className="admin-input"
                placeholder="92-96"
                value={guideItemForm.cadera}
                onChange={(e) => setGuideItemForm({ ...guideItemForm, cadera: e.target.value })}
              />
            </div>
          </div>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar"
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        message="Esta acción eliminará el registro seleccionado."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
