import BaseModal from '../../../components/BaseModal';

function formatMoney(val) {
  return `Bs. ${Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function PosReceiptModal({ isOpen, onClose, receiptData }) {
  if (!receiptData) return null;

  const isLayaway = receiptData.type === 'layaway';
  const doc = isLayaway ? receiptData.layaway : receiptData.sale;
  if (!doc) return null;

  const items = isLayaway ? doc.layaway_items || [] : doc.sale_items || [];
  const payments = isLayaway ? doc.layaway_payments || [] : doc.sale_payments || [];
  const customerLabel = isLayaway
    ? `${doc.customer?.person?.first_name || ''} ${doc.customer?.person?.last_name || ''}`.trim() ||
      doc.customer?.customer_code
    : doc.customer_name_snapshot || 'SIN NOMBRE';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={isLayaway ? 'Reserva / Apartado Confirmado' : 'Venta Registrada'}
      title={isLayaway ? `Comprobante ${doc.layaway_number}` : `Ticket ${doc.sale_number}`}
      size="wide"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={() => window.print()}>
            Imprimir
          </button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={onClose}>
            Nueva Operación
          </button>
        </>
      }
    >
      <div className="pos-receipt">
        <div className="pos-receipt-head">
          <span className="pos-eyebrow">SAF MODA · {doc.branch?.name || 'Sucursal'}</span>
          <h3>{isLayaway ? 'Comprobante de Reserva con Adelanto' : 'Comprobante de Venta'}</h3>
          <div className="admin-subtext">
            N° <strong>{isLayaway ? doc.layaway_number : doc.sale_number}</strong> ·{' '}
            {formatDateTime(isLayaway ? doc.created_at : doc.sold_at)}
          </div>
        </div>

        <div className="pos-receipt-meta">
          <div>
            <strong>Cliente:</strong> {customerLabel}
          </div>
          <div>
            <strong>Almacén:</strong> {doc.warehouse?.code} · {doc.warehouse?.name}
          </div>
          {isLayaway && (
            <>
              <div>
                <strong>Estado:</strong> Stock Reservado (Activo)
              </div>
              <div>
                <strong>Vence el:</strong> {formatDateTime(doc.expires_at)}
              </div>
            </>
          )}
        </div>

        <div className="modal-table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto / Variante</th>
                <th className="is-right">Cant.</th>
                <th className="is-right">Precio</th>
                <th className="is-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <strong>{it.product_variant?.product?.name || 'Producto'}</strong>
                    <div className="admin-subtext">
                      {it.product_variant?.sku} · {it.product_variant?.variant_label || 'Estándar'}
                    </div>
                  </td>
                  <td className="is-right">{it.quantity}</td>
                  <td className="is-right">{formatMoney(it.unit_price)}</td>
                  <td className="is-right">
                    <strong>{formatMoney(it.line_total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pos-totals-box">
          {!isLayaway && Number(doc.discount_total || 0) > 0 && (
            <div className="pos-total-line">
              <span>Descuento aplicado</span>
              <strong>-{formatMoney(doc.discount_total)}</strong>
            </div>
          )}

          <div className="pos-total-line is-grand">
            <span>Total</span>
            <strong>{formatMoney(doc.total_amount)}</strong>
          </div>

          {payments.map((p) => (
            <div key={p.id} className="pos-total-line">
              <span>
                Pago · {p.payment_method?.name || 'Método'}
                {p.reference_number ? ` (Ref: ${p.reference_number})` : ''}
              </span>
              <strong>{formatMoney(p.amount)}</strong>
            </div>
          ))}

          {isLayaway ? (
            <>
              <div className="pos-total-line is-positive">
                <span>Total Adelanto Pagado</span>
                <strong>{formatMoney(doc.paid_amount)}</strong>
              </div>
              <div className="pos-total-line is-warn">
                <span>Saldo Pendiente al Retirar</span>
                <strong>{formatMoney(doc.balance_due ?? doc.total_amount - doc.paid_amount)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="pos-total-line">
                <span>Total Recibido</span>
                <strong>{formatMoney(receiptData.amount_tendered)}</strong>
              </div>
              {Number(receiptData.change_amount || 0) > 0 && (
                <div className="pos-total-line is-positive">
                  <span>Cambio / Vuelto</span>
                  <strong>{formatMoney(receiptData.change_amount)}</strong>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
