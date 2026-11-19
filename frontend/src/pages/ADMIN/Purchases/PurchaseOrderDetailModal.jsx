import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';
import { purchaseService } from '../../../services/admin/purchaseService';
import {
  ATTACHMENT_TYPES,
  buildWhatsappHref,
  formatCurrency,
  formatDate,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PO_STATUS,
} from './purchaseHelpers';

export default function PurchaseOrderDetailModal({
  isOpen,
  onClose,
  orderId,
  catalogProducts = [],
  metaLoading = false,
  onMutated,
}) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Payment & Header quick edit
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('qr');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');

  // Receive quantities
  const [receiveEdits, setReceiveEdits] = useState({});
  const [updateCatalogCost, setUpdateCatalogCost] = useState(true);

  // Linking unlinked item to catalog
  const [linkingItem, setLinkingItem] = useState(null);
  const [linkProductId, setLinkProductId] = useState('');
  const [linkVariants, setLinkVariants] = useState([]);
  const [linkVariantsLoading, setLinkVariantsLoading] = useState(false);
  const [linkVariantId, setLinkVariantId] = useState('');
  const [linkEnterStock, setLinkEnterStock] = useState(true);
  const [linkUpdateCost, setLinkUpdateCost] = useState(true);

  // Upload attachment (R2)
  const [attType, setAttType] = useState('receipt');
  const [attItemId, setAttItemId] = useState('');
  const [attCaption, setAttCaption] = useState('');
  const [attFile, setAttFile] = useState(null);
  const [attUploading, setAttUploading] = useState(false);

  // Confirmation dialogs
  const [confirmState, setConfirmState] = useState(null); // 'order' | 'receive' | 'cancel' | { deleteAtt: id }

  const loadOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const res = await purchaseService.getOrderDetail(orderId);
      const d = res.data;
      setOrder(d);
      setInvoiceNumber(d.invoice_number || '');
      setPaymentMethod(d.payment_method || 'qr');
      setPaymentStatus(d.payment_status || 'pending');
      setAmountPaid(String(Number(d.amount_paid || 0)));
      setNotes(d.notes || '');

      const recMap = {};
      (d.items || []).forEach((it) => {
        recMap[it.id] = String(it.quantity_ordered);
      });
      setReceiveEdits(recMap);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la orden de compra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setLinkingItem(null);
      loadOrder();
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    if (!linkProductId) {
      setLinkVariants([]);
      setLinkVariantId('');
      return;
    }
    let cancelled = false;
    setLinkVariantsLoading(true);
    inventoryService
      .getProductVariants(linkProductId)
      .then((res) => {
        if (!cancelled) {
          setLinkVariants(res.data?.variants || []);
          setLinkVariantId('');
        }
      })
      .catch(() => {
        if (!cancelled) setLinkVariants([]);
      })
      .finally(() => {
        if (!cancelled) setLinkVariantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkProductId]);

  const handleSaveHeader = async (e) => {
    e.preventDefault();
    if (!order) return;
    setSaving(true);
    setError('');
    try {
      await purchaseService.updateOrder(order.id, {
        invoice_number: invoiceNumber.trim() || null,
        payment_method: paymentMethod || null,
        payment_status: paymentStatus,
        amount_paid: Number(amountPaid || 0),
        notes: notes.trim() || null,
      });
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la orden.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError('');
    try {
      const payloadItems = (order.items || []).map((it) => ({
        id: it.id,
        quantity_received: parseInt(receiveEdits[it.id] ?? it.quantity_ordered, 10) || 0,
      }));
      await purchaseService.receiveOrder(order.id, {
        invoice_number: invoiceNumber.trim() || null,
        update_catalog_cost: updateCatalogCost,
        items: payloadItems,
      });
      setConfirmState(null);
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setConfirmState(null);
      setError(err.message || 'No se pudo procesar la recepción.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkOrdered = async () => {
    if (!order) return;
    setSaving(true);
    setError('');
    try {
      await purchaseService.markOrdered(order.id);
      setConfirmState(null);
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setConfirmState(null);
      setError(err.message || 'No se pudo confirmar el pedido.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError('');
    try {
      await purchaseService.cancelOrder(order.id);
      setConfirmState(null);
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setConfirmState(null);
      setError(err.message || 'No se pudo anular la orden.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!linkingItem || !linkVariantId) {
      setError('Selecciona un producto y variante del catálogo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await purchaseService.linkItemToVariant(linkingItem.id, {
        variant_id: Number(linkVariantId),
        enter_stock: linkEnterStock,
        update_catalog_cost: linkUpdateCost,
      });
      setLinkingItem(null);
      setLinkProductId('');
      setLinkVariantId('');
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setError(err.message || 'No se pudo vincular el ítem al catálogo.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAttachment = async (e) => {
    e.preventDefault();
    if (!order || !attFile) {
      setError('Selecciona una fotografía para subir.');
      return;
    }
    setAttUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', attFile);
      fd.append('attachment_type', attType);
      if (attItemId) fd.append('purchase_order_item_id', attItemId);
      if (attCaption.trim()) fd.append('caption', attCaption.trim());

      await purchaseService.uploadAttachment(order.id, fd);
      setAttFile(null);
      setAttCaption('');
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setError(err.message || 'No se pudo subir la fotografía.');
    } finally {
      setAttUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId) => {
    setSaving(true);
    setError('');
    try {
      await purchaseService.deleteAttachment(attId);
      setConfirmState(null);
      await loadOrder();
      await onMutated?.();
    } catch (err) {
      setConfirmState(null);
      setError(err.message || 'No se pudo eliminar la fotografía.');
    } finally {
      setSaving(false);
    }
  };

  const canReceive = order && ['draft', 'ordered', 'partial'].includes(order.status);
  const canCancel = order && ['draft', 'ordered'].includes(order.status);
  const stBadge = order ? PO_STATUS[order.status] || PO_STATUS.draft : PO_STATUS.draft;
  const payBadge = order ? PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending : PAYMENT_STATUS.pending;
  const waHref = buildWhatsappHref(order?.supplier_whatsapp || order?.supplier?.whatsapp);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={order ? `${order.branch_code || ''} · ${order.warehouse_name || ''}` : 'Detalle'}
      title={order ? `Orden de Compra ${order.po_number}` : 'Detalle de Compra'}
      size="xl"
      footer={
        <>
          {canCancel && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost-danger"
              onClick={() => setConfirmState('cancel')}
              disabled={saving}
            >
              Anular Orden
            </button>
          )}
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
          {order?.status === 'draft' && (
            <button
              type="button"
              className="admin-btn"
              onClick={() => setConfirmState('order')}
              disabled={saving}
            >
              Confirmar Pedido
            </button>
          )}
          {canReceive && (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setConfirmState('receive')}
              disabled={saving}
            >
              Recibir Mercadería
            </button>
          )}
        </>
      }
    >
      {loading && <div className="admin-empty">Cargando orden de compra...</div>}
      {error && <div className="admin-alert is-error">{error}</div>}

      {!loading && order && (
        <>
          <div className="pur-detail-banner">
            <div>
              <div className="inv-variant-banner-title">
                {order.supplier?.business_name} ({order.supplier?.code})
              </div>
              <div className="admin-subtext">
                Contacto: <strong>{order.supplier_contact_name || '-'}</strong> · Fecha:{' '}
                {formatDate(order.order_date)} · Registró: {order.created_by_name}
              </div>
              <div className="admin-actions-row pur-section-gap">
                <span className={`pur-badge ${stBadge.tone}`}>{stBadge.label}</span>
                <span className={`pur-badge ${payBadge.tone}`}>{payBadge.label}</span>
                {waHref && (
                  <a href={waHref} target="_blank" rel="noreferrer" className="pur-whatsapp-link">
                    WhatsApp: {order.supplier_whatsapp || order.supplier?.whatsapp}
                  </a>
                )}
              </div>
            </div>

            <div className="pur-history-metrics">
              <div className="pur-metric-col">
                <span className="pur-metric-label">Total Orden</span>
                <span className="pur-metric-val">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="pur-metric-col">
                <span className="pur-metric-label">Pagado</span>
                <span className="pur-metric-val">{formatCurrency(order.amount_paid)}</span>
              </div>
              <div className="pur-metric-col">
                <span className="pur-metric-label">Saldo</span>
                <span className="pur-metric-val">
                  {formatCurrency(Math.max(0, order.total_amount - order.amount_paid))}
                </span>
              </div>
            </div>
          </div>

          <div className="inv-divider-title">
            <h3>Productos y Precios de esta Compra ({(order.items || []).length})</h3>
            {canReceive && (
              <label className="pur-checkbox-row">
                <input
                  type="checkbox"
                  checked={updateCatalogCost}
                  onChange={(e) => setUpdateCatalogCost(e.target.checked)}
                />
                <span>Actualizar costo maestro en catálogo al recibir</span>
              </label>
            )}
          </div>

          <div className="modal-table-box">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto / Prenda</th>
                  <th>Estado Catálogo</th>
                  <th className="is-right">Pedida</th>
                  <th className="is-right">Recibida</th>
                  <th className="is-right">Costo Unit.</th>
                  <th className="is-right">Vs. Anterior</th>
                  <th className="is-right">Total</th>
                  <th className="is-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div className="pur-supplier-cell">
                        {it.photo_url && (
                          <a href={it.photo_url} target="_blank" rel="noreferrer">
                            <img src={it.photo_url} alt={it.item_name} className="pur-inline-thumb" />
                          </a>
                        )}
                        <div>
                          <strong>{it.item_name}</strong>
                          <div className="admin-subtext">
                            {it.item_sku ? `SKU: ${it.item_sku}` : 'Sin SKU'}
                            {it.item_specs ? ` · ${it.item_specs}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      {it.is_catalog_linked ? (
                        <div>
                          <span className="pur-badge is-ok">Catalogado</span>
                          <div className="admin-subtext">
                            {it.stock_entered ? 'Stock ingresado' : 'Stock pendiente'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="pur-badge is-warn">Sin catalogar</span>
                          <div className="admin-subtext">No existe aún en /productos</div>
                        </div>
                      )}
                    </td>

                    <td className="is-right">{it.quantity_ordered}</td>

                    <td className="is-right">
                      {canReceive ? (
                        <input
                          type="number"
                          min={it.quantity_received}
                          max={it.quantity_ordered}
                          step="1"
                          className="admin-input admin-input-sm pur-count-input"
                          value={receiveEdits[it.id] ?? String(it.quantity_ordered)}
                          onChange={(e) =>
                            setReceiveEdits((prev) => ({ ...prev, [it.id]: e.target.value }))
                          }
                        />
                      ) : (
                        <strong>{it.quantity_received}</strong>
                      )}
                    </td>

                    <td className="is-right">
                      <strong>{formatCurrency(it.unit_cost)}</strong>
                    </td>

                    <td className="is-right">
                      {it.price_diff === null || it.price_diff === undefined ? (
                        <span className="pur-price-flat">Base</span>
                      ) : it.price_diff > 0 ? (
                        <span className="pur-price-up">
                          +{formatCurrency(it.price_diff)} ({it.price_diff_pct}%)
                        </span>
                      ) : it.price_diff < 0 ? (
                        <span className="pur-price-down">
                          {formatCurrency(it.price_diff)} ({it.price_diff_pct}%)
                        </span>
                      ) : (
                        <span className="pur-price-flat">Igual</span>
                      )}
                    </td>

                    <td className="is-right">
                      <strong>{formatCurrency(it.line_total)}</strong>
                    </td>

                    <td className="is-right">
                      {!it.is_catalog_linked && order.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          onClick={() => {
                            setLinkingItem(it);
                            setLinkProductId('');
                            setLinkVariantId('');
                          }}
                        >
                          Catalogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {linkingItem && (
            <form className="pur-link-box admin-form" onSubmit={handleLinkSubmit}>
              <div className="admin-panel-header">
                <div>
                  <strong>Vincular "{linkingItem.item_name}" al Catálogo</strong>
                  <p className="admin-subtext">
                    Asocia este ítem comprado con una variante creada en /dashboard/productos para ingresar su stock y unificar su historial.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={() => setLinkingItem(null)}
                >
                  Cerrar
                </button>
              </div>

              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Producto del catálogo *</label>
                  <CustomSelect
                    value={linkProductId}
                    onChange={setLinkProductId}
                    loading={metaLoading}
                    loadingText="Cargando productos..."
                    options={catalogProducts.map((p) => ({
                      value: String(p.id),
                      label: `${p.sku_prefix} · ${p.name}`,
                    }))}
                    placeholder="Elegir producto..."
                  />
                </div>

                <div className="admin-field">
                  <label>Variante exacta *</label>
                  <CustomSelect
                    value={linkVariantId}
                    onChange={setLinkVariantId}
                    loading={linkVariantsLoading}
                    loadingText="Cargando variantes..."
                    options={linkVariants.map((v) => ({
                      value: String(v.id),
                      label: `${v.sku} · ${v.variant_label}`,
                    }))}
                    placeholder={linkProductId ? 'Elegir variante...' : 'Elige un producto primero'}
                  />
                </div>
              </div>

              <div className="admin-actions-row">
                {['received', 'partial'].includes(order.status) && !linkingItem.stock_entered && (
                  <label className="pur-checkbox-row">
                    <input
                      type="checkbox"
                      checked={linkEnterStock}
                      onChange={(e) => setLinkEnterStock(e.target.checked)}
                    />
                    <span>
                      Ingresar ahora {linkingItem.quantity_received} u. a {order.warehouse_code}
                    </span>
                  </label>
                )}

                <label className="pur-checkbox-row">
                  <input
                    type="checkbox"
                    checked={linkUpdateCost}
                    onChange={(e) => setLinkUpdateCost(e.target.checked)}
                  />
                  <span>Actualizar costo de variante ({formatCurrency(linkingItem.unit_cost)})</span>
                </label>

                <button
                  type="submit"
                  className="admin-btn admin-btn-sm admin-btn-primary"
                  disabled={saving || !linkVariantId}
                >
                  {saving ? 'Vinculando...' : 'Confirmar Vinculación'}
                </button>
              </div>
            </form>
          )}

          {/* ACTUALIZAR PAGO Y FACTURA */}
          <div className="inv-divider-title">
            <h3>Pago, Facturación y Notas</h3>
          </div>

          <form className="admin-form" onSubmit={handleSaveHeader}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>N° Factura / Recibo</label>
                <input
                  type="text"
                  maxLength={60}
                  className="admin-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
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
                    { value: 'pending', label: 'Por pagar' },
                    { value: 'partial', label: 'Pago parcial' },
                    { value: 'paid', label: 'Pagada' },
                  ]}
                />
              </div>

              <div className="admin-field">
                <label>Monto pagado (Bs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-input"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Observaciones</label>
                <input
                  type="text"
                  className="admin-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="admin-actions-row">
                <button type="submit" className="admin-btn admin-btn-sm" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Pago / Factura'}
                </button>
              </div>
            </div>
          </form>

          {/* GALERÍA DE FOTOGRAFÍAS (CLOUDFLARE R2) */}
          <div className="inv-divider-title">
            <h3>Fotografías de Comprobantes y Prendas ({(order.attachments || []).length})</h3>
          </div>

          <form className="pur-upload-strip" onSubmit={handleUploadAttachment}>
            <div className="admin-field">
              <label>Tipo de foto *</label>
              <CustomSelect value={attType} onChange={setAttType} options={ATTACHMENT_TYPES} />
            </div>

            <div className="admin-field">
              <label>Asociar a ítem (opcional)</label>
              <CustomSelect
                value={attItemId}
                onChange={setAttItemId}
                options={[
                  { value: '', label: 'Toda la orden / recibo' },
                  ...(order.items || []).map((it) => ({
                    value: String(it.id),
                    label: it.item_name,
                  })),
                ]}
              />
            </div>

            <div className="admin-field">
              <label>Archivo de imagen *</label>
              <input
                type="file"
                accept="image/*"
                className="pur-file-input"
                onChange={(e) => setAttFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="admin-field">
              <label>Pie de foto (opcional)</label>
              <input
                type="text"
                maxLength={180}
                className="admin-input"
                value={attCaption}
                onChange={(e) => setAttCaption(e.target.value)}
                placeholder="Ej: Factura sellada"
              />
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={attUploading || !attFile}
            >
              {attUploading ? 'Subiendo...' : 'Subir Foto'}
            </button>
          </form>

          {(order.attachments || []).length > 0 && (
            <div className="pur-gallery-grid">
              {order.attachments.map((att) => (
                <article key={att.id} className="pur-photo-card">
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="pur-photo-thumb-link"
                  >
                    <img src={att.file_url} alt={att.caption || att.attachment_type} />
                  </a>
                  <div className="pur-photo-card-body">
                    <span className="pur-badge is-neutral">
                      {ATTACHMENT_TYPES.find((t) => t.value === att.attachment_type)?.label ||
                        att.attachment_type}
                    </span>
                    <div className="pur-photo-caption">{att.caption || 'Sin descripción'}</div>
                    <div className="pur-photo-card-foot">
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-btn admin-btn-sm"
                      >
                        Ver
                      </a>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                        onClick={() => setConfirmState({ deleteAtt: att.id })}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmState === 'receive'}
        onClose={() => setConfirmState(null)}
        eyebrow="Recepción en Almacén"
        title={`¿Confirmar recepción de ${order?.po_number}?`}
        message={`Los ítems catalogados ingresarán automáticamente al almacén ${order?.warehouse_code} (${order?.branch_name}) y se actualizará el historial de precios.`}
        confirmLabel={saving ? 'Procesando...' : 'Confirmar Recepción'}
        onConfirm={handleReceiveOrder}
      />

      <ConfirmModal
        isOpen={confirmState === 'order'}
        onClose={() => setConfirmState(null)}
        eyebrow="Confirmación"
        title={`¿Confirmar pedido ${order?.po_number}?`}
        message="La orden pasará de Borrador a Ordenada y registrará los costos cotizados en el historial de precios."
        confirmLabel={saving ? 'Confirmando...' : 'Confirmar Pedido'}
        onConfirm={handleMarkOrdered}
      />

      <ConfirmModal
        isOpen={confirmState === 'cancel'}
        onClose={() => setConfirmState(null)}
        eyebrow="Anulación de Compra"
        title={`¿Anular la orden ${order?.po_number}?`}
        message="La orden pasará a estado Cancelada y sus líneas no ingresarán a inventario."
        confirmLabel={saving ? 'Anulando...' : 'Sí, anular'}
        variant="danger"
        onConfirm={handleCancelOrder}
      />

      <ConfirmModal
        isOpen={Boolean(confirmState && confirmState.deleteAtt)}
        onClose={() => setConfirmState(null)}
        eyebrow="Eliminar Fotografía"
        title="¿Eliminar esta fotografía?"
        message="Se eliminará el archivo de Cloudflare R2 y del registro de esta orden de compra."
        confirmLabel={saving ? 'Eliminando...' : 'Eliminar Foto'}
        variant="danger"
        onConfirm={() => handleDeleteAttachment(confirmState.deleteAtt)}
      />
    </BaseModal>
  );
}
