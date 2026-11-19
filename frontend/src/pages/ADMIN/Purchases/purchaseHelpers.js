export const PO_STATUS = {
  draft: { label: 'Borrador', tone: 'is-muted' },
  ordered: { label: 'Ordenada', tone: 'is-info' },
  partial: { label: 'Recibida Parcial', tone: 'is-warn' },
  received: { label: 'Recibida', tone: 'is-ok' },
  cancelled: { label: 'Cancelada', tone: 'is-danger' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Por pagar', tone: 'is-danger' },
  partial: { label: 'Pago parcial', tone: 'is-warn' },
  paid: { label: 'Pagada', tone: 'is-ok' },
};

export const ATTACHMENT_TYPES = [
  { value: 'receipt', label: 'Recibo / Factura' },
  { value: 'product_photo', label: 'Fotografía de Prenda / Producto' },
  { value: 'delivery_note', label: 'Nota de Entrega / Guía' },
  { value: 'other', label: 'Otro Comprobante' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'qr', label: 'QR / Transferencia bancaria' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Crédito proveedor' },
];

export function formatCurrency(val) {
  return `Bs. ${Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const normalized = String(dateStr).length === 10 ? `${dateStr}T12:00:00` : dateStr;
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
    }).format(new Date(normalized));
  } catch {
    return dateStr;
  }
}

export function buildWhatsappHref(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return null;
  const full = digits.length === 8 ? `591${digits}` : digits;
  return `https://wa.me/${full}`;
}

export function getInitials(name, fallback = 'P') {
  const parts = String(name || fallback).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '') || fallback).toUpperCase();
}
