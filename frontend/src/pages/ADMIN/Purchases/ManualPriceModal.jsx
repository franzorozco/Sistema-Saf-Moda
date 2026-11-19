import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';
import { purchaseService } from '../../../services/admin/purchaseService';

export default function ManualPriceModal({
  isOpen,
  onClose,
  suppliers = [],
  catalogProducts = [],
  metaLoading = false,
  onSaved,
}) {
  const [supplierId, setSupplierId] = useState('');
  const [mode, setMode] = useState('custom'); // 'catalog' | 'custom'
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [recordedAt, setRecordedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSupplierId(suppliers[0] ? String(suppliers[0].id) : '');
    setMode('custom');
    setProductId('');
    setVariantId('');
    setVariants([]);
    setItemName('');
    setItemSku('');
    setUnitCost('');
    setQuantity('1');
    setRecordedAt(new Date().toISOString().slice(0, 10));
    setNotes('');
    setPhotoFile(null);
    setError('');
  }, [isOpen, suppliers]);

  useEffect(() => {
    if (!isOpen || mode !== 'catalog' || !productId) {
      setVariants([]);
      setVariantId('');
      return;
    }
    let cancelled = false;
    setVariantsLoading(true);
    inventoryService
      .getProductVariants(productId)
      .then((res) => {
        if (!cancelled) {
          setVariants(res.data?.variants || []);
          setVariantId('');
        }
      })
      .catch(() => {
        if (!cancelled) setVariants([]);
      })
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Selecciona el proveedor.');
      return;
    }
    if (mode === 'catalog' && !variantId) {
      setError('Selecciona una variante del catálogo.');
      return;
    }
    if (mode === 'custom' && !itemName.trim()) {
      setError('Ingresa el nombre del producto o prenda.');
      return;
    }
    if (unitCost === '' || Number(unitCost) < 0) {
      setError('Ingresa un precio de compra válido.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('supplier_id', supplierId);
      if (mode === 'catalog') {
        fd.append('variant_id', variantId);
      } else {
        fd.append('item_name', itemName.trim());
        if (itemSku.trim()) fd.append('item_sku', itemSku.trim());
      }
      fd.append('unit_cost', String(Number(unitCost)));
      fd.append('quantity', String(Math.max(1, parseInt(quantity || '1', 10) || 1)));
      if (recordedAt) fd.append('recorded_at', recordedAt);
      if (notes.trim()) fd.append('notes', notes.trim());
      if (photoFile) fd.append('photo', photoFile);

      await purchaseService.createManualPriceRecord(fd);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el registro de precio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Historial de Costos"
      title="Registrar Precio o Cotización de Proveedor"
      size="wide"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="manual-price-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar en Historial'}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="manual-price-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="pur-line-mode-switch">
          <button
            type="button"
            className={`pur-mode-pill-btn ${mode === 'custom' ? 'is-active' : ''}`}
            onClick={() => setMode('custom')}
          >
            Producto Nuevo / Sin Catalogar
          </button>
          <button
            type="button"
            className={`pur-mode-pill-btn ${mode === 'catalog' ? 'is-active' : ''}`}
            onClick={() => setMode('catalog')}
          >
            Producto del Catálogo
          </button>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Proveedor *</label>
            <CustomSelect
              value={supplierId}
              onChange={setSupplierId}
              loading={metaLoading}
              loadingText="Cargando proveedores..."
              options={suppliers.map((s) => ({
                value: String(s.id),
                label: `${s.code} · ${s.business_name}`,
              }))}
              placeholder="Seleccionar proveedor..."
            />
          </div>

          <div className="admin-field">
            <label>Fecha del precio / cotización *</label>
            <input
              type="date"
              className="admin-input"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              required
            />
          </div>
        </div>

        {mode === 'catalog' ? (
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Producto *</label>
              <CustomSelect
                value={productId}
                onChange={setProductId}
                loading={metaLoading}
                loadingText="Cargando catálogo..."
                options={catalogProducts.map((p) => ({
                  value: String(p.id),
                  label: `${p.sku_prefix} · ${p.name}`,
                }))}
                placeholder="Elegir producto..."
              />
            </div>

            <div className="admin-field">
              <label>Variante *</label>
              <CustomSelect
                value={variantId}
                onChange={setVariantId}
                loading={variantsLoading}
                loadingText="Cargando variantes..."
                options={variants.map((v) => ({
                  value: String(v.id),
                  label: `${v.sku} · ${v.variant_label} (Costo act: Bs. ${Number(v.cost_price).toFixed(2)})`,
                }))}
                placeholder={productId ? 'Elegir variante...' : 'Elige un producto primero'}
              />
            </div>
          </div>
        ) : (
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Nombre del producto o prenda *</label>
              <input
                type="text"
                maxLength={200}
                className="admin-input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ej: Vestido Lino Verano / Tela Denim"
                required
              />
            </div>

            <div className="admin-field">
              <label>Código / Ref. del proveedor (opcional)</label>
              <input
                type="text"
                maxLength={80}
                className="admin-input"
                value={itemSku}
                onChange={(e) => setItemSku(e.target.value)}
                placeholder="Ej: MOD-2026-A"
              />
            </div>
          </div>
        )}

        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Precio Unitario (Bs.) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="admin-input"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Ej: 50.00"
              required
            />
          </div>

          <div className="admin-field">
            <label>Cantidad referencial</label>
            <input
              type="number"
              min="1"
              step="1"
              className="admin-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-field">
          <label>Fotografía de referencia (opcional, Cloudflare R2)</label>
          <input
            type="file"
            accept="image/*"
            className="pur-file-input"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="admin-field">
          <label>Notas / Detalle del cambio de precio</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Precio mes pasado antes de subida por temporada..."
          />
        </div>
      </form>
    </BaseModal>
  );
}
