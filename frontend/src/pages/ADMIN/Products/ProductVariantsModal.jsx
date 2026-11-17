import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { productService } from '../../../services/admin/productService';

function buildCombinations(axesWithValues) {
  if (axesWithValues.length === 0) return [];
  return axesWithValues.reduce(
    (acc, axis) =>
      acc.flatMap((combo) =>
        axis.values.map((val) => [...combo, { attribute_id: axis.id, value: val }])
      ),
    [[]]
  );
}

function buildDraftFromVariant(v) {
  const attrs = {};
  const axisIds = [];
  (v.variant_attribute_values || []).forEach((vav) => {
    axisIds.push(vav.attribute_id);
    attrs[vav.attribute_id] = String(vav.attribute_value_id);
  });
  return {
    sku: v.sku || '',
    base_price: String(v.base_price ?? ''),
    cost_price: String(v.cost_price ?? ''),
    axisIds,
    attrs,
    dirty: false,
  };
}

export default function ProductVariantsModal({
  product,
  attributes,
  onClose,
  onVariantsChanged,
}) {
  const [tab, setTab] = useState('matrix'); // 'matrix' | 'list'
  const [variants, setVariants] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [error, setError] = useState('');

  // Modo Ejes (Fácil)
  const [activeAxisIds, setActiveAxisIds] = useState([]);
  const [selectedAxes, setSelectedAxes] = useState({});
  const [globalPrice, setGlobalPrice] = useState('');
  const [globalCost, setGlobalCost] = useState('');
  const [previewRows, setPreviewRows] = useState([]);

  const syncDrafts = (list) => {
    const map = {};
    list.forEach((v) => {
      map[v.id] = buildDraftFromVariant(v);
    });
    setDrafts(map);
  };

  useEffect(() => {
    if (!product) return;
    const defaultPrice = String(product.product_variants?.[0]?.base_price ?? '');
    const defaultCost = String(product.product_variants?.[0]?.cost_price ?? '');
    const existingList = product.product_variants || [];
    setTab(existingList.length > 0 ? 'list' : 'matrix');
    setGlobalPrice(defaultPrice);
    setGlobalCost(defaultCost);
    setActiveAxisIds([]);
    setSelectedAxes({});
    setPreviewRows([]);
    setVariants(existingList);
    syncDrafts(existingList);
    setError('');

    productService
      .getVariants(product.id)
      .then((res) => {
        const list = res.data || [];
        setVariants(list);
        syncDrafts(list);
      })
      .catch((err) => setError(err.message));
  }, [product]);

  useEffect(() => {
    const activeAxes = activeAxisIds
      .map((axisId) => attributes.find((a) => a.id === axisId))
      .filter(Boolean)
      .map((attr) => {
        const chosenIds = selectedAxes[attr.id] || [];
        const chosenValues = (attr.attribute_values || []).filter((v) =>
          chosenIds.includes(v.id)
        );
        return { id: attr.id, name: attr.name, values: chosenValues };
      })
      .filter((ax) => ax.values.length > 0);

    const combos = buildCombinations(activeAxes);
    setPreviewRows((prev) => {
      const prevMap = new Map(prev.map((r) => [r.key, r]));
      return combos.map((combo) => {
        const key = combo.map((c) => `${c.attribute_id}:${c.value.id}`).join('|');
        const existing = prevMap.get(key);
        return (
          existing || {
            key,
            enabled: true,
            label: combo.map((c) => c.value.value).join(' / '),
            attributes: combo.map((c) => ({
              attribute_id: c.attribute_id,
              attribute_value_id: c.value.id,
            })),
            base_price: globalPrice,
            cost_price: globalCost,
          }
        );
      });
    });
  }, [activeAxisIds, selectedAxes, attributes]);

  const handleSelectNewAxis = (val) => {
    if (!val) return;
    const id = Number(val);
    if (!activeAxisIds.includes(id)) {
      setActiveAxisIds((prev) => [...prev, id]);
    }
  };

  const handleRemoveAxis = (axisId) => {
    setActiveAxisIds((prev) => prev.filter((id) => id !== axisId));
    setSelectedAxes((prev) => {
      const copy = { ...prev };
      delete copy[axisId];
      return copy;
    });
  };

  const toggleAxisValue = (attrId, valueId) => {
    setSelectedAxes((prev) => {
      const current = prev[attrId] || [];
      const exists = current.includes(valueId);
      return {
        ...prev,
        [attrId]: exists ? current.filter((id) => id !== valueId) : [...current, valueId],
      };
    });
  };

  const applyGlobalToPreview = () => {
    setPreviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        base_price: globalPrice !== '' ? globalPrice : row.base_price,
        cost_price: globalCost !== '' ? globalCost : row.cost_price,
      }))
    );
  };

  const updatePreviewRow = (key, field, value) => {
    setPreviewRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  };

  const executeGenerateBatch = async (replaceExisting = false) => {
    const activeRows = previewRows.filter((r) => r.enabled);
    if (activeRows.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await productService.createVariantsBatch(product.id, {
        replace_existing: replaceExisting,
        variants: activeRows.map((r) => ({
          base_price: Number(r.base_price || 0),
          cost_price: Number(r.cost_price || 0),
          attributes: r.attributes,
        })),
      });
      const updated = replaceExisting ? (res.data || []) : [...variants, ...(res.data || [])];
      setVariants(updated);
      syncDrafts(updated);
      onVariantsChanged(product.id, updated);
      setSelectedAxes({});
      setPreviewRows([]);
      setTab('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBatch = () => {
    if (variants.length > 0) {
      setConfirmReplaceOpen(true);
    } else {
      executeGenerateBatch(false);
    }
  };

  const updateDraft = (variantId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], ...patch, dirty: true },
    }));
  };

  const handleToggleActive = async (variant) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await productService.updateVariant(variant.id, {
        is_active: !variant.is_active,
      });
      const updated = variants.map((v) => (v.id === variant.id ? { ...v, ...res.data } : v));
      setVariants(updated);
      onVariantsChanged(product.id, updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async (variantId) => {
    const draft = drafts[variantId];
    if (!draft || saving) return;
    setSaving(true);
    setError('');
    try {
      const attrsPayload = draft.axisIds
        .filter((axisId) => Boolean(draft.attrs[axisId]))
        .map((axisId) => ({
          attribute_id: Number(axisId),
          attribute_value_id: Number(draft.attrs[axisId]),
        }));

      const res = await productService.updateVariant(variantId, {
        sku: draft.sku,
        base_price: Number(draft.base_price || 0),
        cost_price: Number(draft.cost_price || 0),
        attributes: attrsPayload,
      });

      const updated = variants.map((v) => (v.id === variantId ? res.data : v));
      setVariants(updated);
      setDrafts((prev) => ({
        ...prev,
        [variantId]: buildDraftFromVariant(res.data),
      }));
      onVariantsChanged(product.id, updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await productService.deleteVariant(variantId);
      const updated = variants.filter((v) => v.id !== variantId);
      setVariants(updated);
      onVariantsChanged(product.id, updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddCard = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const basePrice = Number(variants[0]?.base_price ?? globalPrice ?? 0);
      const costPrice = Number(variants[0]?.cost_price ?? globalCost ?? 0);
      const res = await productService.createVariant(product.id, {
        base_price: basePrice,
        cost_price: costPrice,
        attributes: [],
      });
      const created = res.data;
      const updated = [...variants, created];
      setVariants(updated);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: buildDraftFromVariant(created),
      }));
      onVariantsChanged(product.id, updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = previewRows.filter((r) => r.enabled).length;

  return (
    <BaseModal
      isOpen={!!product}
      onClose={onClose}
      eyebrow={product?.sku_prefix}
      title={`Variantes — ${product?.name || ''}`}
      size="xl"
      footer={
        <button type="button" className="admin-btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="admin-form">
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${tab === 'matrix' ? 'is-active' : ''}`}
            onClick={() => setTab('matrix')}
          >
            Generador por Ejes (Fácil)
          </button>
          <button
            type="button"
            className={`admin-tab ${tab === 'list' ? 'is-active' : ''}`}
            onClick={() => setTab('list')}
          >
            Variantes Actuales ({variants.length})
          </button>
        </div>

        {error && <div className="admin-alert">{error}</div>}

        {tab === 'matrix' && (
          <>
            {variants.length > 0 && (
              <div className="admin-alert">
                Este producto ya tiene {variants.length} variantes registradas. Si generas una nueva matriz, las variantes actuales se eliminarán y serán reemplazadas.
              </div>
            )}

            <div className="axis-grid">
              {activeAxisIds.map((axisId) => {
                const attr = attributes.find((a) => a.id === axisId);
                if (!attr) return null;
                const chosen = selectedAxes[attr.id] || [];
                return (
                  <div key={attr.id} className="axis-box">
                    <div className="axis-box-header">
                      <span className="axis-box-title">{attr.name}</span>
                      <button
                        type="button"
                        className="admin-chip-remove"
                        onClick={() => handleRemoveAxis(attr.id)}
                        aria-label="Quitar eje"
                      >
                        ×
                      </button>
                    </div>
                    <div className="axis-pills">
                      {(attr.attribute_values || []).length === 0 ? (
                        <span className="admin-subtext">Sin valores configurados</span>
                      ) : (
                        attr.attribute_values.map((val) => {
                          const isSelected = chosen.includes(val.id);
                          return (
                            <button
                              key={val.id}
                              type="button"
                              className={`axis-pill ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => toggleAxisValue(attr.id, val.id)}
                            >
                              {val.value}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {attributes.some((a) => !activeAxisIds.includes(a.id)) && (
                <div className="axis-box-slot">
                  <span className="axis-box-title">+ Agregar Eje</span>
                  <CustomSelect
                    value=""
                    onChange={handleSelectNewAxis}
                    placeholder="Elegir atributo..."
                    options={attributes
                      .filter((a) => !activeAxisIds.includes(a.id))
                      .map((a) => ({ value: String(a.id), label: a.name }))}
                  />
                </div>
              )}
            </div>

            <div className="matrix-global-bar">
              <div className="admin-field">
                <label>Precio Global (Bs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="admin-input admin-input-sm"
                  value={globalPrice}
                  onChange={(e) => setGlobalPrice(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>Costo Global (Bs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="admin-input admin-input-sm"
                  value={globalCost}
                  onChange={(e) => setGlobalCost(e.target.value)}
                />
              </div>
              <button type="button" className="admin-btn" onClick={applyGlobalToPreview}>
                Aplicar a todas
              </button>
            </div>

            {previewRows.length === 0 ? (
              <p className="admin-empty">
                Selecciona valores arriba (ej. Colores y Tallas) para previsualizar las combinaciones.
              </p>
            ) : (
              <>
                <div className="modal-table-box">
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Usar</th>
                          <th>Combinación</th>
                          <th>Precio (Bs.)</th>
                          <th>Costo (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.key}>
                            <td>
                              <label className="admin-switch">
                                <input
                                  type="checkbox"
                                  checked={row.enabled}
                                  onChange={(e) => updatePreviewRow(row.key, 'enabled', e.target.checked)}
                                />
                                <span className="admin-switch-slider" />
                              </label>
                            </td>
                            <td><strong>{row.label}</strong></td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="admin-input admin-input-sm"
                                value={row.base_price}
                                onChange={(e) => updatePreviewRow(row.key, 'base_price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="admin-input admin-input-sm"
                                value={row.cost_price}
                                onChange={(e) => updatePreviewRow(row.key, 'cost_price', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-actions-row">
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={saving || enabledCount === 0}
                    onClick={handleGenerateBatch}
                  >
                    {saving ? 'Generando...' : `Generar ${enabledCount} Variantes`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'list' && (
          <div className="variant-cards-list">
            {variants.map((v) => {
              const draft = drafts[v.id] || buildDraftFromVariant(v);
              const availableToAdd = attributes.filter((a) => !draft.axisIds.includes(a.id));

              return (
                <article key={v.id} className="variant-card">
                  <div className="variant-card-header">
                    <div className="variant-card-meta">
                      <span className="admin-code-tag">{v.sku}</span>
                      <strong>{v.variant_label || 'Estándar'}</strong>
                      {v.is_default && <span className="admin-badge">Principal</span>}
                    </div>

                    <div className="variant-card-controls">
                      <label className="admin-switch" title={v.is_active ? 'Activa' : 'Inactiva'}>
                        <input
                          type="checkbox"
                          checked={!!v.is_active}
                          disabled={saving}
                          onChange={() => handleToggleActive(v)}
                        />
                        <span className="admin-switch-slider" />
                      </label>
                      {draft.dirty && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          disabled={saving}
                          onClick={() => handleSaveCard(v.id)}
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                        disabled={saving}
                        onClick={() => handleDeleteVariant(v.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>

                  <div className="variant-card-body">
                    {draft.axisIds.map((axisId) => {
                      const attr = attributes.find((a) => a.id === axisId);
                      if (!attr) return null;
                      return (
                        <div key={attr.id} className="admin-field">
                          <div className="variant-attr-label-row">
                            <label>{attr.name}</label>
                            <button
                              type="button"
                              className="admin-chip-remove"
                              onClick={() => {
                                const nextAttrs = { ...draft.attrs };
                                delete nextAttrs[attr.id];
                                updateDraft(v.id, {
                                  axisIds: draft.axisIds.filter((id) => id !== attr.id),
                                  attrs: nextAttrs,
                                });
                              }}
                              aria-label="Quitar eje"
                            >
                              ×
                            </button>
                          </div>
                          <CustomSelect
                            value={draft.attrs[attr.id] || ''}
                            onChange={(val) =>
                              updateDraft(v.id, {
                                attrs: { ...draft.attrs, [attr.id]: val },
                              })
                            }
                            placeholder={`Elegir ${attr.name.toLowerCase()}...`}
                            options={(attr.attribute_values || []).map((av) => ({
                              value: String(av.id),
                              label: av.value,
                            }))}
                          />
                        </div>
                      );
                    })}

                    {availableToAdd.length > 0 && (
                      <div className="admin-field">
                        <label>+ Atributo</label>
                        <CustomSelect
                          value=""
                          onChange={(val) => {
                            if (!val) return;
                            const id = Number(val);
                            updateDraft(v.id, {
                              axisIds: [...draft.axisIds, id],
                            });
                          }}
                          placeholder="Agregar..."
                          options={availableToAdd.map((a) => ({
                            value: String(a.id),
                            label: a.name,
                          }))}
                        />
                      </div>
                    )}

                    <div className="admin-field">
                      <label>Precio Base (Bs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-input admin-input-sm"
                        value={draft.base_price}
                        onChange={(e) => updateDraft(v.id, { base_price: e.target.value })}
                      />
                    </div>

                    <div className="admin-field">
                      <label>Costo (Bs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-input admin-input-sm"
                        value={draft.cost_price}
                        onChange={(e) => updateDraft(v.id, { cost_price: e.target.value })}
                      />
                    </div>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              className="variant-card-slot"
              disabled={saving}
              onClick={handleQuickAddCard}
            >
              {saving ? 'Creando variante...' : '+ Agregar nueva variante'}
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmReplaceOpen}
        onClose={() => setConfirmReplaceOpen(false)}
        eyebrow="Reemplazar Variantes"
        title="¿Reemplazar las variantes actuales?"
        message={`Se eliminarán las ${variants.length} variantes existentes y se crearán las ${enabledCount} nuevas combinaciones.`}
        confirmLabel="Reemplazar y Generar"
        variant="danger"
        onConfirm={() => executeGenerateBatch(true)}
      />
    </BaseModal>
  );
}
