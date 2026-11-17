import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { productService } from '../../../services/admin/productService';

export default function ProductImagesModal({ product, attributes, onClose }) {
  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [scope, setScope] = useState('product'); // 'product' | 'attribute' | 'variant'
  const [variantId, setVariantId] = useState('');
  const [attributeId, setAttributeId] = useState('');
  const [attributeValueId, setAttributeValueId] = useState('');
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return;
    setImages([]);
    setVariants(product.product_variants || []);
    setScope('product');
    setVariantId(product.product_variants?.[0]?.id ? String(product.product_variants[0].id) : '');
    setAttributeId('');
    setAttributeValueId('');
    setFile(null);
    setAltText(product.name || '');
    setIsPrimary(false);
    setError('');

    Promise.all([
      productService.getImages(product.id),
      productService.getVariants(product.id),
    ])
      .then(([imgRes, varRes]) => {
        setImages(imgRes.data || []);
        setVariants(varRes.data || []);
      })
      .catch((err) => setError(err.message));
  }, [product]);

  const selectedAttribute = useMemo(
    () => attributes.find((a) => String(a.id) === String(attributeId)),
    [attributes, attributeId]
  );

  const matchingVariantsCount = useMemo(() => {
    if (scope !== 'attribute' || !attributeId || !attributeValueId) return 0;
    return variants.filter((v) =>
      (v.variant_attribute_values || []).some(
        (vav) =>
          String(vav.attribute_id) === String(attributeId) &&
          String(vav.attribute_value_id) === String(attributeValueId)
      )
    ).length;
  }, [scope, attributeId, attributeValueId, variants]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('scope', scope);
      formData.append('alt_text', altText);
      formData.append('is_primary', isPrimary ? '1' : '0');

      if (scope === 'variant') {
        formData.append('variant_id', variantId);
      } else if (scope === 'attribute') {
        formData.append('attribute_id', attributeId);
        formData.append('attribute_value_id', attributeValueId);
      }

      const res = await productService.uploadImage(product.id, formData);
      setImages((prev) => [...(res.data || []), ...prev]);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (imageId) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await productService.setPrimaryImage(imageId);
      const updatedImg = res.data;
      setImages((prev) =>
        prev.map((img) => {
          if (img.id === updatedImg.id) return updatedImg;
          if (img.variant_id === updatedImg.variant_id) {
            return { ...img, is_primary: false };
          }
          return img;
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (imageId) => {
    if (saving) return;
    setSaving(true);
    try {
      await productService.deleteImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={!!product}
      onClose={onClose}
      eyebrow={product?.sku_prefix}
      title={`Imágenes — ${product?.name || ''}`}
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
            className={`admin-tab ${scope === 'product' ? 'is-active' : ''}`}
            onClick={() => setScope('product')}
          >
            Producto (General)
          </button>
          <button
            type="button"
            className={`admin-tab ${scope === 'attribute' ? 'is-active' : ''}`}
            onClick={() => setScope('attribute')}
          >
            Por Atributo Compartido
          </button>
          <button
            type="button"
            className={`admin-tab ${scope === 'variant' ? 'is-active' : ''}`}
            onClick={() => setScope('variant')}
          >
            Variante Individual
          </button>
        </div>

        {error && <div className="admin-alert">{error}</div>}

        <form className="image-upload-box" onSubmit={handleUpload}>
          {scope === 'attribute' && (
            <>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Atributo (ej. Color)</label>
                  <CustomSelect
                    value={attributeId}
                    onChange={(val) => {
                      setAttributeId(val);
                      setAttributeValueId('');
                    }}
                    placeholder="Elegir atributo..."
                    options={attributes.map((a) => ({ value: String(a.id), label: a.name }))}
                  />
                </div>
                <div className="admin-field">
                  <label>Valor compartido</label>
                  <CustomSelect
                    value={attributeValueId}
                    onChange={setAttributeValueId}
                    placeholder="Elegir valor..."
                    options={(selectedAttribute?.attribute_values || []).map((av) => ({
                      value: String(av.id),
                      label: av.value,
                    }))}
                  />
                </div>
              </div>
              {attributeId && attributeValueId && (
                <span className="admin-badge">
                  Se aplicará la misma imagen a {matchingVariantsCount} variante(s) coincidente(s)
                </span>
              )}
            </>
          )}

          {scope === 'variant' && (
            <div className="admin-field">
              <label>Variante específica</label>
              <CustomSelect
                value={variantId}
                onChange={setVariantId}
                placeholder="Seleccionar variante..."
                options={variants.map((v) => ({
                  value: String(v.id),
                  label: `${v.sku} — ${v.variant_label || 'Estándar'}`,
                }))}
              />
            </div>
          )}

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Archivo de imagen</label>
              <input
                type="file"
                accept="image/*"
                className="admin-input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <div className="admin-field">
              <label>Texto alternativo (Alt)</label>
              <input
                className="admin-input"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Descripción de la foto..."
              />
            </div>
          </div>

          <div className="admin-panel-header">
            <label className="admin-checkbox-row">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Marcar como imagen principal
            </label>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !file}>
              {saving ? 'Subiendo...' : 'Subir Imagen'}
            </button>
          </div>
        </form>

        {images.length === 0 ? (
          <p className="admin-empty">Este producto aún no tiene imágenes cargadas.</p>
        ) : (
          <div className="image-gallery-grid">
            {images.map((img) => (
              <article key={img.id} className="image-card">
                <img
                  src={img.image_url}
                  alt={img.alt_text || product?.name}
                  className="image-card-thumb"
                />
                <div className="image-card-body">
                  <div>
                    <span className="admin-badge">
                      {img.product_variant ? `${img.product_variant.sku} · ${img.product_variant.variant_label}` : 'General'}
                    </span>
                    {img.is_primary && <span className="admin-subtext">Principal</span>}
                  </div>
                  <div className="image-card-actions">
                    {!img.is_primary && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-ghost"
                        disabled={saving}
                        onClick={() => handleSetPrimary(img.id)}
                      >
                        Principal
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                      disabled={saving}
                      onClick={() => handleDelete(img.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
