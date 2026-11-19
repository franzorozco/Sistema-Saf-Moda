import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';
import { purchaseService } from '../../../services/admin/purchaseService';
import {
  ATTACHMENT_TYPES,
  formatCurrency,
  formatDate,
  PAYMENT_METHODS,
} from './purchaseHelpers';

function emptyLine(mode = 'custom') {
  return {
    key: Math.random().toString(36).slice(2, 10),
    mode, // 'catalog' | 'custom'
    product_id: '',
    variant_id: '',
    item_name: '',
    item_sku: '',
    item_specs: '',
    quantity_ordered: '1',
    unit_cost: '',
    notes: '',
    lastPriceInfo: null, // { found, record }
  };
}

export default function PurchaseOrderFormModal({
  isOpen,
  onClose,
  meta,
  metaLoading = false,
  onSaved,
  onQuickCreateSupplier,
}) {
  const [supplierId, setSupplierId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [status, setStatus] = useState('received'); // 'received' | 'ordered' | 'draft'
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('qr');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [supplierContactName, setSupplierContactName] = useState('');
  const [supplierWhatsapp, setSupplierWhatsapp] = useState('');
  const [updateCatalogCost, setUpdateCatalogCost] = useState(true);
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState([emptyLine('custom')]);
  const [variantsCache, setVariantsCache] = useState({});
  const [loadingProductIds, setLoadingProductIds] = useState({});

  // Queued R2 photos (uploaded right after PO creation)
  const [queuedPhotos, setQueuedPhotos] = useState([]);
  const [queueType, setQueueType] = useState('receipt');
  const [queueCaption, setQueueCaption] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const suppliers = meta?.suppliers || [];
  const warehouses = meta?.warehouses || [];
  const catalogProducts = meta?.catalog_products || [];
  const suggestions = meta?.unregistered_suggestions || [];

  useEffect(() => {
    if (!isOpen) return;
    const defSup = suppliers[0];
    const defWh = warehouses.find((w) => w.is_default) || warehouses[0];
    setSupplierId(defSup ? String(defSup.id) : '');
    setSupplierContactName(defSup?.contact_name || '');
    setSupplierWhatsapp(defSup?.whatsapp || '');
    setTargetWarehouseId(defWh ? String(defWh.id) : '');
    setStatus('received');
    setInvoiceNumber('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate('');
    setPaymentMethod('qr');
    setPaymentStatus('paid');
    setAmountPaid('');
    setShippingCost('0');
    setTaxAmount('0');
    setUpdateCatalogCost(true);
    setNotes('');
    setLines([emptyLine('catalog')]);
    setQueuedPhotos([]);
    setQueueType('receipt');
    setQueueCaption('');
    setError('');
  }, [isOpen]);

  // If meta finishes loading while modal is open and supplier/warehouse were empty, pick defaults
  useEffect(() => {
    if (!isOpen) return;
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(String(suppliers[0].id));
      setSupplierContactName(suppliers[0].contact_name || '');
      setSupplierWhatsapp(suppliers[0].whatsapp || '');
    }
    if (!targetWarehouseId && warehouses.length > 0) {
      const defWh = warehouses.find((w) => w.is_default) || warehouses[0];
      setTargetWarehouseId(String(defWh.id));
    }
  }, [isOpen, suppliers, warehouses, supplierId, targetWarehouseId]);

  const handleSupplierChange = (val) => {
    setSupplierId(val);
    const sup = suppliers.find((s) => String(s.id) === String(val));
    if (sup) {
      setSupplierContactName(sup.contact_name || '');
      setSupplierWhatsapp(sup.whatsapp || '');
    }
  };

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const fetchVariantsForProduct = async (productId) => {
    if (!productId || variantsCache[productId]) return variantsCache[productId] || [];
    setLoadingProductIds((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await inventoryService.getProductVariants(productId);
      const list = res.data?.variants || [];
      setVariantsCache((prev) => ({ ...prev, [productId]: list }));
      return list;
    } catch {
      return [];
    } finally {
      setLoadingProductIds((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleLineProductChange = async (lineKey, prodId) => {
    updateLine(lineKey, {
      product_id: prodId,
      variant_id: '',
      lastPriceInfo: null,
    });
    if (prodId) {
      await fetchVariantsForProduct(prodId);
    }
  };

  const handleLineVariantChange = async (lineKey, productId, variantId) => {
    const prodVariants = variantsCache[productId] || [];
    const variant = prodVariants.find((v) => String(v.id) === String(variantId));

    updateLine(lineKey, {
      variant_id: variantId,
      unit_cost: variant ? String(Number(variant.cost_price || 0).toFixed(2)) : '',
      lastPriceInfo: null,
    });

    if (variantId) {
      try {
        const res = await purchaseService.lookupLastPrice({ variant_id: variantId });
        updateLine(lineKey, { lastPriceInfo: res.data });
      } catch {
        // non-blocking
      }
    }
  };

  const lookupCustomLastPrice = async (line) => {
    if (line.mode !== 'custom' || (!line.item_name.trim() && !line.item_sku.trim())) return;
    try {
      const res = await purchaseService.lookupLastPrice({
        item_name: line.item_name.trim(),
        item_sku: line.item_sku.trim() || undefined,
      });
      updateLine(line.key, { lastPriceInfo: res.data });
    } catch {
      // ignore
    }
  };

  const applySuggestionToLine = (lineKey, sug) => {
    updateLine(lineKey, {
      mode: 'custom',
      item_name: sug.item_name,
      item_sku: sug.item_sku || '',
      unit_cost: String(Number(sug.unit_cost || 0).toFixed(2)),
      lastPriceInfo: {
        found: true,
        record: {
          unit_cost: sug.unit_cost,
          recorded_at: sug.recorded_at,
          supplier_name: sug.supplier_name,
        },
      },
    });
  };

  const handleQueuePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQueuedPhotos((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        file,
        attachment_type: queueType,
        caption: queueCaption.trim(),
      },
    ]);
    setQueueCaption('');
    e.target.value = '';
  };

  const removeQueuedPhoto = (id) => {
    setQueuedPhotos((prev) => prev.filter((q) => q.id !== id));
  };

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const q = Math.max(0, parseInt(l.quantity_ordered || '0', 10) || 0);
      const c = Math.max(0, Number(l.unit_cost || 0));
      return sum + q * c;
    }, 0);
    const tax = Math.max(0, Number(taxAmount || 0));
    const ship = Math.max(0, Number(shippingCost || 0));
    return {
      subtotal,
      tax,
      ship,
      total: subtotal + tax + ship,
    };
  }, [lines, taxAmount, shippingCost]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (!targetWarehouseId) {
      setError('Selecciona la sucursal / almacén de destino.');
      return;
    }

    const preparedItems = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseInt(l.quantity_ordered || '0', 10);
      const cost = Number(l.unit_cost);
      if (qty <= 0 || Number.isNaN(cost) || cost < 0) {
        setError(`Revisa cantidad y precio unitario en la línea #${i + 1}.`);
        return;
      }

      if (l.mode === 'catalog') {
        if (!l.variant_id) {
          setError(`Selecciona la variante del catálogo en la línea #${i + 1}.`);
          return;
        }
        preparedItems.push({
          variant_id: Number(l.variant_id),
          quantity_ordered: qty,
          unit_cost: cost,
          notes: l.notes.trim() || null,
        });
      } else {
        if (!l.item_name.trim()) {
          setError(`Ingresa el nombre de la prenda/producto nuevo en la línea #${i + 1}.`);
          return;
        }
        preparedItems.push({
          variant_id: null,
          item_name: l.item_name.trim(),
          item_sku: l.item_sku.trim() || null,
          item_specs: l.item_specs.trim() || null,
          quantity_ordered: qty,
          unit_cost: cost,
          notes: l.notes.trim() || null,
        });
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        supplier_id: Number(supplierId),
        target_warehouse_id: Number(targetWarehouseId),
        status,
        invoice_number: invoiceNumber.trim() || null,
        order_date: orderDate || null,
        expected_date: expectedDate || null,
        payment_method: paymentMethod || null,
        payment_status: paymentStatus,
        amount_paid:
          paymentStatus === 'partial' && amountPaid !== ''
            ? Number(amountPaid)
            : undefined,
        shipping_cost: Number(shippingCost || 0),
        tax_amount: Number(taxAmount || 0),
        supplier_contact_name: supplierContactName.trim() || null,
        supplier_whatsapp: supplierWhatsapp.trim() || null,
        update_catalog_cost: updateCatalogCost,
        notes: notes.trim() || null,
        items: preparedItems,
      };

      const res = await purchaseService.createOrder(payload);
      const createdId = res.data?.id;

      if (createdId && queuedPhotos.length > 0) {
        for (const qp of queuedPhotos) {
          const fd = new FormData();
          fd.append('file', qp.file);
          fd.append('attachment_type', qp.attachment_type);
          if (qp.caption) fd.append('caption', qp.caption);
          await purchaseService.uploadAttachment(createdId, fd);
        }
      }

      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar la orden de compra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Abastecimiento y Proveedores"
      title="Nueva Orden de Compra"
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="purchase-order-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving
              ? 'Guardando compra...'
              : status === 'received'
              ? 'Registrar Compra Recibida'
              : status === 'ordered'
              ? 'Confirmar Pedido'
              : 'Guardar Borrador'}
          </button>
        </>
      }
    >
      {error && <div className="admin-alert is-error">{error}</div>}

      <form id="purchase-order-form" className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <div className="admin-field">
            <div className="admin-actions-row">
              <label>Proveedor *</label>
              {onQuickCreateSupplier && (
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={onQuickCreateSupplier}
                >
                  + Nuevo Proveedor
                </button>
              )}
            </div>
            <CustomSelect
              value={supplierId}
              onChange={handleSupplierChange}
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
            <label>Sucursal / Almacén destino *</label>
            <CustomSelect
              value={targetWarehouseId}
              onChange={setTargetWarehouseId}
              loading={metaLoading}
              loadingText="Cargando almacenes..."
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
              }))}
              placeholder="Seleccionar almacén..."
            />
          </div>

          <div className="admin-field">
            <label>Tipo de registro *</label>
            <CustomSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: 'received', label: 'Compra recibida hoy (ingresa stock y precios)' },
                { value: 'ordered', label: 'Pedido en camino (registra precios, stock al recibir)' },
                { value: 'draft', label: 'Borrador / Cotización' },
              ]}
            />
          </div>

          <div className="admin-field">
            <label>Fecha de compra *</label>
            <input
              type="date"
              className="admin-input"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>

          <div className="admin-field">
            <label>N° Factura / Recibo / Nota proveedor</label>
            <input
              type="text"
              maxLength={60}
              className="admin-input"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: FAC-00182 / REC-45"
            />
          </div>

          <div className="admin-field">
            <label>Fecha estimada de entrega</label>
            <input
              type="date"
              className="admin-input"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="admin-field">
            <label>Contacto / Vendedor en esta compra</label>
            <input
              type="text"
              maxLength={150}
              className="admin-input"
              value={supplierContactName}
              onChange={(e) => setSupplierContactName(e.target.value)}
              placeholder="Nombre del vendedor que atendió"
            />
          </div>

          <div className="admin-field">
            <label>WhatsApp de seguimiento</label>
            <input
              type="text"
              maxLength={30}
              className="admin-input"
              value={supplierWhatsapp}
              onChange={(e) => setSupplierWhatsapp(e.target.value)}
              placeholder="+59170000000"
            />
          </div>

          <div className="admin-field">
            <label>Método de pago</label>
            <CustomSelect
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHODS}
            />
          </div>

          <div className="admin-field">
            <label>Estado de pago</label>
            <CustomSelect
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={[
                { value: 'paid', label: 'Pagada completamente' },
                { value: 'partial', label: 'Pago parcial / Adelanto' },
                { value: 'pending', label: 'Por pagar / A crédito' },
              ]}
            />
          </div>

          {paymentStatus === 'partial' && (
            <div className="admin-field">
              <label>Monto pagado / adelantado (Bs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="admin-input"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          <div className="admin-field">
            <label>Envío / Transporte (Bs.)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="admin-input"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
            />
          </div>

          <div className="admin-field">
            <label>Impuestos adicionales (Bs.)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="admin-input"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
          </div>
        </div>

        <label className="pur-checkbox-row">
          <input
            type="checkbox"
            checked={updateCatalogCost}
            onChange={(e) => setUpdateCatalogCost(e.target.checked)}
          />
          <span>Actualizar costo base maestro en las variantes del catálogo al recibir stock</span>
        </label>

        {/* LÍNEAS DE COMPRA */}
        <div className="inv-divider-title">
          <h3>Detalle de Productos ({lines.length} línea/s)</h3>
          <div className="admin-actions-row">
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={() => setLines((prev) => [...prev, emptyLine('catalog')])}
            >
              + Del Catálogo
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-primary"
              onClick={() => setLines((prev) => [...prev, emptyLine('custom')])}
            >
              + Producto Nuevo (Sin Catalogar)
            </button>
          </div>
        </div>

        <div className="pur-lines-stack">
          {lines.map((line, index) => {
            const lineVariants = variantsCache[line.product_id] || [];
            const isLoadingVars = Boolean(loadingProductIds[line.product_id]);
            const qty = Math.max(0, parseInt(line.quantity_ordered || '0', 10) || 0);
            const cost = Math.max(0, Number(line.unit_cost || 0));
            const lineTotal = qty * cost;

            const lastRec = line.lastPriceInfo?.found ? line.lastPriceInfo.record : null;
            const diffFromLast =
              lastRec && line.unit_cost !== '' ? cost - Number(lastRec.unit_cost) : null;

            return (
              <div key={line.key} className="pur-line-card">
                <div className="pur-line-top">
                  <div className="admin-actions-row">
                    <strong>Línea #{index + 1}</strong>
                    <div className="pur-line-mode-switch">
                      <button
                        type="button"
                        className={`pur-mode-pill-btn ${line.mode === 'catalog' ? 'is-active' : ''}`}
                        onClick={() =>
                          updateLine(line.key, { mode: 'catalog', lastPriceInfo: null })
                        }
                      >
                        Catálogo Existente
                      </button>
                      <button
                        type="button"
                        className={`pur-mode-pill-btn ${line.mode === 'custom' ? 'is-active' : ''}`}
                        onClick={() =>
                          updateLine(line.key, {
                            mode: 'custom',
                            product_id: '',
                            variant_id: '',
                            lastPriceInfo: null,
                          })
                        }
                      >
                        Producto Nuevo (Sin Catalogar)
                      </button>
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                      onClick={() =>
                        setLines((prev) => prev.filter((item) => item.key !== line.key))
                      }
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {line.mode === 'catalog' ? (
                  <div className="pur-line-grid">
                    <div className="admin-field">
                      <label>Producto *</label>
                      <CustomSelect
                        value={line.product_id}
                        onChange={(val) => handleLineProductChange(line.key, val)}
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
                        value={line.variant_id}
                        onChange={(val) =>
                          handleLineVariantChange(line.key, line.product_id, val)
                        }
                        loading={isLoadingVars}
                        loadingText="Cargando variantes..."
                        options={lineVariants.map((v) => ({
                          value: String(v.id),
                          label: `${v.sku} · ${v.variant_label}`,
                        }))}
                        placeholder={
                          line.product_id ? 'Elegir variante...' : 'Elige un producto'
                        }
                      />
                    </div>

                    <div className="admin-field">
                      <label>Cantidad *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="admin-input"
                        value={line.quantity_ordered}
                        onChange={(e) =>
                          updateLine(line.key, { quantity_ordered: e.target.value })
                        }
                      />
                    </div>

                    <div className="admin-field">
                      <label>Costo Unit. (Bs.) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-input"
                        value={line.unit_cost}
                        onChange={(e) => updateLine(line.key, { unit_cost: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="admin-field">
                      <label>Subtotal</label>
                      <div className="inv-readonly-box">{formatCurrency(lineTotal)}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pur-line-custom-grid">
                      <div className="admin-field">
                        <label>Nombre de prenda / producto nuevo *</label>
                        <input
                          type="text"
                          maxLength={200}
                          className="admin-input"
                          value={line.item_name}
                          onChange={(e) => updateLine(line.key, { item_name: e.target.value })}
                          onBlur={() => lookupCustomLastPrice(line)}
                          placeholder="Ej: Vestido Lino Verano"
                        />
                      </div>

                      <div className="admin-field">
                        <label>SKU / Código ref.</label>
                        <input
                          type="text"
                          maxLength={80}
                          className="admin-input"
                          value={line.item_sku}
                          onChange={(e) => updateLine(line.key, { item_sku: e.target.value })}
                          onBlur={() => lookupCustomLastPrice(line)}
                          placeholder="Opcional"
                        />
                      </div>

                      <div className="admin-field">
                        <label>Tallas / Colores / Detalles</label>
                        <input
                          type="text"
                          maxLength={255}
                          className="admin-input"
                          value={line.item_specs}
                          onChange={(e) => updateLine(line.key, { item_specs: e.target.value })}
                          placeholder="Ej: S-M-L Beige y Negro"
                        />
                      </div>

                      <div className="admin-field">
                        <label>Cantidad *</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="admin-input"
                          value={line.quantity_ordered}
                          onChange={(e) =>
                            updateLine(line.key, { quantity_ordered: e.target.value })
                          }
                        />
                      </div>

                      <div className="admin-field">
                        <label>Costo Unit. (Bs.) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="admin-input"
                          value={line.unit_cost}
                          onChange={(e) => updateLine(line.key, { unit_cost: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="admin-field">
                        <label>Subtotal</label>
                        <div className="inv-readonly-box">{formatCurrency(lineTotal)}</div>
                      </div>
                    </div>

                    {suggestions.length > 0 && !line.item_name && (
                      <div className="pur-suggestions-row">
                        <span className="admin-subtext">Compras previas sin catalogar:</span>
                        {suggestions.slice(0, 6).map((sug) => (
                          <button
                            key={sug.item_key}
                            type="button"
                            className="pur-suggestion-chip"
                            onClick={() => applySuggestionToLine(line.key, sug)}
                          >
                            {sug.item_name} ({formatCurrency(sug.unit_cost)})
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="pur-line-foot">
                  <div>
                    {lastRec ? (
                      <div className="pur-last-price-hint">
                        <span>
                          Compra anterior: <strong>{formatCurrency(lastRec.unit_cost)}</strong> el{' '}
                          {formatDate(lastRec.recorded_at)}
                          {lastRec.supplier_name ? ` (${lastRec.supplier_name})` : ''}
                        </span>
                        {diffFromLast !== null && diffFromLast !== 0 && (
                          <span className={diffFromLast > 0 ? 'pur-price-up' : 'pur-price-down'}>
                            {diffFromLast > 0
                              ? `+${formatCurrency(diffFromLast)}`
                              : formatCurrency(diffFromLast)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          onClick={() =>
                            updateLine(line.key, {
                              unit_cost: String(Number(lastRec.unit_cost).toFixed(2)),
                            })
                          }
                        >
                          Usar {formatCurrency(lastRec.unit_cost)}
                        </button>
                      </div>
                    ) : (
                      <span className="admin-subtext">
                        Sin registro histórico previo de compra para este ítem.
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    maxLength={255}
                    className="admin-input admin-input-sm"
                    value={line.notes}
                    onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                    placeholder="Nota de línea (opcional)"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ADJUNTOS / FOTOGRAFÍAS ANTES DE GUARDAR */}
        <div className="inv-divider-title">
          <h3>Fotografías de Respaldo / Recibo / Prendas (Cloudflare R2)</h3>
        </div>

        <div className="pur-upload-strip">
          <div className="admin-field">
            <label>Tipo de fotografía</label>
            <CustomSelect value={queueType} onChange={setQueueType} options={ATTACHMENT_TYPES} />
          </div>

          <div className="admin-field">
            <label>Descripción / Nota de foto</label>
            <input
              type="text"
              maxLength={180}
              className="admin-input"
              value={queueCaption}
              onChange={(e) => setQueueCaption(e.target.value)}
              placeholder="Ej: Factura proveedor / Foto muestra"
            />
          </div>

          <div className="admin-field">
            <label>Seleccionar imagen</label>
            <input
              type="file"
              accept="image/*"
              className="pur-file-input"
              onChange={handleQueuePhoto}
            />
          </div>

          <div className="admin-subtext">{queuedPhotos.length} foto(s) en cola</div>
        </div>

        {queuedPhotos.length > 0 && (
          <div className="pur-queued-photos">
            {queuedPhotos.map((qp) => (
              <span key={qp.id} className="pur-queued-photo-chip">
                <span>
                  {qp.file.name} ({ATTACHMENT_TYPES.find((t) => t.value === qp.attachment_type)?.label})
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                  onClick={() => removeQueuedPhoto(qp.id)}
                >
                  Quitar
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="admin-field">
          <label>Notas generales de la compra</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones de entrega, garantía, cambios..."
          />
        </div>

        <div className="pur-totals-bar">
          <div className="pur-total-cell">
            <span className="pur-total-label">Subtotal Ítems</span>
            <span className="pur-total-val">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="pur-total-cell">
            <span className="pur-total-label">Envío / Flete</span>
            <span className="pur-total-val">{formatCurrency(totals.ship)}</span>
          </div>
          <div className="pur-total-cell">
            <span className="pur-total-label">Impuestos</span>
            <span className="pur-total-val">{formatCurrency(totals.tax)}</span>
          </div>
          <div className="pur-total-cell">
            <span className="pur-total-label">Total Compra</span>
            <span className="pur-total-val">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
