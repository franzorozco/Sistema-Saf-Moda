import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import { purchaseService } from '../../../services/admin/purchaseService';
import {
  buildWhatsappHref,
  formatCurrency,
  formatDate,
  getInitials,
  PO_STATUS,
} from './purchaseHelpers';

export default function SupplierDetailModal({
  isOpen,
  onClose,
  supplierId,
  onEditSupplier,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !supplierId) return;
    setLoading(true);
    setError('');
    purchaseService
      .getSupplierDetail(supplierId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message || 'No se pudo cargar el detalle del proveedor.'))
      .finally(() => setLoading(false));
  }, [isOpen, supplierId]);

  const supplier = data?.supplier;
  const waHref = buildWhatsappHref(supplier?.whatsapp || supplier?.phone);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={supplier ? `Proveedor · ${supplier.code}` : 'Proveedor'}
      title={supplier?.business_name || 'Detalle de Proveedor'}
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose}>
            Cerrar
          </button>
          {supplier && onEditSupplier && (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => {
                onClose();
                onEditSupplier(supplier);
              }}
            >
              Editar Proveedor
            </button>
          )}
        </>
      }
    >
      {loading && (
        <div className="admin-empty">Cargando ficha completa del proveedor...</div>
      )}
      {error && <div className="admin-alert is-error">{error}</div>}

      {!loading && supplier && (
        <>
          <div className="pur-detail-banner">
            <div className="pur-supplier-cell">
              <div className="pur-avatar-lg">
                {supplier.photo_url ? (
                  <img src={supplier.photo_url} alt={supplier.business_name} />
                ) : (
                  <span>{getInitials(supplier.business_name)}</span>
                )}
              </div>
              <div>
                <div className="inv-variant-banner-title">{supplier.business_name}</div>
                <div className="admin-subtext">
                  Contacto: <strong>{supplier.contact_name || '-'}</strong> · NIT/CI:{' '}
                  {supplier.tax_id || '-'}
                </div>
                <div className="admin-subtext">
                  {supplier.city || '-'} {supplier.address ? `· ${supplier.address}` : ''}
                </div>
                <div className="admin-actions-row pur-section-gap">
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="pur-whatsapp-link"
                    >
                      WhatsApp: {supplier.whatsapp || supplier.phone}
                    </a>
                  )}
                  {supplier.phone && (
                    <span className="pur-badge is-neutral">Tel: {supplier.phone}</span>
                  )}
                  {supplier.secondary_phone && (
                    <span className="pur-badge is-neutral">Alt: {supplier.secondary_phone}</span>
                  )}
                  {supplier.payment_terms && (
                    <span className="pur-badge is-info">{supplier.payment_terms}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pur-history-metrics">
              <div className="pur-metric-col">
                <span className="pur-metric-label">Órdenes</span>
                <span className="pur-metric-val">{data.summary?.orders_count ?? 0}</span>
              </div>
              <div className="pur-metric-col">
                <span className="pur-metric-label">Total Comprado</span>
                <span className="pur-metric-val">
                  {formatCurrency(data.summary?.total_purchased)}
                </span>
              </div>
              <div className="pur-metric-col">
                <span className="pur-metric-label">Saldo Pendiente</span>
                <span className="pur-metric-val">
                  {formatCurrency(data.summary?.pending_balance)}
                </span>
              </div>
            </div>
          </div>

          {supplier.notes && (
            <div className="admin-field">
              <label>Notas</label>
              <div className="inv-readonly-box">{supplier.notes}</div>
            </div>
          )}

          <div className="inv-divider-title">
            <h3>Historial de Órdenes de Compra ({(data.orders || []).length})</h3>
          </div>

          <div className="modal-table-box">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Fecha</th>
                  <th>Destino</th>
                  <th>Estado</th>
                  <th className="is-right">Ítems</th>
                  <th className="is-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data.orders || []).length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">Sin compras registradas todavía.</div>
                    </td>
                  </tr>
                ) : (
                  data.orders.map((ord) => {
                    const st = PO_STATUS[ord.status] || { label: ord.status, tone: 'is-muted' };
                    return (
                      <tr key={ord.id}>
                        <td>
                          <span className="admin-code-tag">{ord.po_number}</span>
                          {ord.invoice_number && (
                            <div className="admin-subtext">Fac: {ord.invoice_number}</div>
                          )}
                        </td>
                        <td>{formatDate(ord.order_date)}</td>
                        <td>
                          {ord.branch_name} · {ord.warehouse_name}
                        </td>
                        <td>
                          <span className={`pur-badge ${st.tone}`}>{st.label}</span>
                        </td>
                        <td className="is-right">{ord.items_count}</td>
                        <td className="is-right">
                          <strong>{formatCurrency(ord.total_amount)}</strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="inv-divider-title">
            <h3>Historial de Precios con este Proveedor ({(data.price_histories || []).length})</h3>
          </div>

          <div className="modal-table-box">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto / Prenda</th>
                  <th>Foto</th>
                  <th className="is-right">Cant.</th>
                  <th className="is-right">Costo Unit.</th>
                  <th className="is-right">Variación</th>
                  <th>Orden / Nota</th>
                </tr>
              </thead>
              <tbody>
                {(data.price_histories || []).length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="admin-empty">Sin historial de precios registrado.</div>
                    </td>
                  </tr>
                ) : (
                  data.price_histories.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDate(h.recorded_at)}</td>
                      <td>
                        <strong>{h.item_name}</strong>
                        {h.item_sku && <div className="admin-subtext">SKU: {h.item_sku}</div>}
                      </td>
                      <td>
                        {h.photo_url ? (
                          <a href={h.photo_url} target="_blank" rel="noreferrer">
                            <img src={h.photo_url} alt={h.item_name} className="pur-inline-thumb" />
                          </a>
                        ) : (
                          <span className="admin-subtext">-</span>
                        )}
                      </td>
                      <td className="is-right">{h.quantity}</td>
                      <td className="is-right">
                        <strong>{formatCurrency(h.unit_cost)}</strong>
                      </td>
                      <td className="is-right">
                        {h.price_diff === null ? (
                          <span className="pur-price-flat">Base</span>
                        ) : h.price_diff > 0 ? (
                          <span className="pur-price-up">
                            +{formatCurrency(h.price_diff)} ({h.price_diff_pct}%)
                          </span>
                        ) : h.price_diff < 0 ? (
                          <span className="pur-price-down">
                            {formatCurrency(h.price_diff)} ({h.price_diff_pct}%)
                          </span>
                        ) : (
                          <span className="pur-price-flat">Sin cambio</span>
                        )}
                      </td>
                      <td>
                        {h.po_number && <span className="admin-code-tag">{h.po_number}</span>}
                        {h.notes && <div className="admin-subtext">{h.notes}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </BaseModal>
  );
}
