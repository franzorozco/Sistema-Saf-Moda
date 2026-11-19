import { useEffect, useMemo, useState } from 'react';
import CustomSelect from '../../../components/CustomSelect';
import { saleService } from '../../../services/pos/saleService';
import PosReceiptModal from './PosReceiptModal';
import QuickCustomerModal from './QuickCustomerModal';
import './posSell.css';

function formatMoney(val) {
  return `Bs. ${Number(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getInitials(name) {
  const parts = String(name || 'P').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '') || 'P').toUpperCase();
}

function defaultExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

const POS_DRAFT_STORAGE_KEY = 'safmoda_pos_draft_v1';

function loadSavedDraft() {
  try {
    const raw = window.localStorage.getItem(POS_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function createPaymentRow(defaultMethodId = '', amount = '') {
  return {
    key: Math.random().toString(36).slice(2, 9),
    payment_method_id: defaultMethodId ? String(defaultMethodId) : '',
    amount: amount !== '' ? String(amount) : '',
    reference_number: '',
  };
}

export default function PosPage({ onNavigate }) {
  const initialDraft = useMemo(() => loadSavedDraft(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    initialDraft?.selectedWarehouseId || ''
  );
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialDraft?.selectedBranchId || ''
  );
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);

  // Filtros catálogo
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  // Estado del Carrito y Checkout (persistido en localStorage)
  const [operationMode, setOperationMode] = useState(initialDraft?.operationMode || 'sale');
  const [cart, setCart] = useState(Array.isArray(initialDraft?.cart) ? initialDraft.cart : []);
  const [customerId, setCustomerId] = useState(initialDraft?.customerId || '');
  const [sellerEmployeeId, setSellerEmployeeId] = useState(initialDraft?.sellerEmployeeId || '');
  const [globalDiscount, setGlobalDiscount] = useState(initialDraft?.globalDiscount || '0');
  const [expiresAt, setExpiresAt] = useState(initialDraft?.expiresAt || defaultExpiryDate());
  const [notes, setNotes] = useState(initialDraft?.notes || '');
  const [payments, setPayments] = useState(
    Array.isArray(initialDraft?.payments) ? initialDraft.payments : []
  );

  // Modales y envío
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const loadPosData = async (whId = undefined) => {
    setLoading(true);
    setError('');
    try {
      const res = await saleService.getInitData(whId ? { warehouse_id: whId } : {});
      const d = res.data || {};
      setBranches(d.branches || []);
      setWarehouses(d.warehouses || []);
      setCategories(d.categories || []);
      setPaymentMethods(d.payment_methods || []);
      setCustomers(d.customers || []);
      setEmployees(d.employees || []);
      setProducts(d.products || []);

      if (d.selected_warehouse_id) setSelectedWarehouseId(String(d.selected_warehouse_id));
      if (d.selected_branch_id) setSelectedBranchId(String(d.selected_branch_id));

      setPayments((prev) => {
        if (prev.length > 0) return prev;
        const firstPm = (d.payment_methods || [])[0];
        return firstPm ? [createPaymentRow(firstPm.id, '')] : [];
      });
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos del Punto de Venta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosData(initialDraft?.selectedWarehouseId || undefined);
  }, []);

  // Guardar borrador del carrito automáticamente en localStorage
  useEffect(() => {
    try {
      const snapshot = {
        selectedWarehouseId,
        selectedBranchId,
        operationMode,
        cart,
        customerId,
        sellerEmployeeId,
        globalDiscount,
        expiresAt,
        notes,
        payments,
      };
      window.localStorage.setItem(POS_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }, [
    selectedWarehouseId,
    selectedBranchId,
    operationMode,
    cart,
    customerId,
    sellerEmployeeId,
    globalDiscount,
    expiresAt,
    notes,
    payments,
  ]);

  const clearCartDraft = () => {
    setCart([]);
    setGlobalDiscount('0');
    setNotes('');
    const firstPm = paymentMethods[0];
    setPayments(firstPm ? [createPaymentRow(firstPm.id, '')] : []);
    try {
      window.localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleWarehouseChange = (nextWhId) => {
    setSelectedWarehouseId(nextWhId);
    setCart([]);
    loadPosData(nextWhId);
  };

  const cartQtyMap = useMemo(() => {
    const map = {};
    cart.forEach((item) => {
      map[item.variant.id] = item.quantity;
    });
    return map;
  }, [cart]);

  const addToCart = (variant) => {
    const inCart = cartQtyMap[variant.id] || 0;
    if (inCart >= variant.available) {
      setError(`Stock máximo disponible alcanzado para ${variant.sku} (${variant.available} u.).`);
      return;
    }
    setError('');
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variant.id === variant.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { variant, quantity: 1, unit_price: Number(variant.base_price || 0) }];
    });
  };

  const changeCartQty = (variantId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variant.id !== variantId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.variant.available) return item;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const removeCartItem = (variantId) => {
    setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategoryId !== 'all' && String(p.category_id) !== String(selectedCategoryId)) {
        return false;
      }
      if (!term) return true;
      if (
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku_prefix || '').toLowerCase().includes(term)
      ) {
        return true;
      }
      return (p.variants || []).some(
        (v) =>
          (v.sku || '').toLowerCase().includes(term) ||
          (v.barcode || '').toLowerCase().includes(term) ||
          (v.variant_label || '').toLowerCase().includes(term)
      );
    });
  }, [products, search, selectedCategoryId]);

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const term = search.trim().toLowerCase();
    if (!term) return;

    // Buscar coincidencia exacta por SKU o código de barras para escáner rápido
    for (const prod of products) {
      const exactVar = (prod.variants || []).find(
        (v) =>
          (v.sku || '').toLowerCase() === term ||
          (v.barcode && v.barcode.toLowerCase() === term)
      );
      if (exactVar && exactVar.available > 0) {
        e.preventDefault();
        addToCart(exactVar);
        setSearch('');
        return;
      }
    }
  };

  // Totales financieros
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * Number(item.unit_price || 0), 0),
    [cart]
  );

  const discountVal = Math.max(0, Number(globalDiscount || 0));
  const grandTotal = Math.max(0, Math.round((subtotal - discountVal) * 100) / 100);

  const totalPaidInput = useMemo(
    () =>
      Math.round(
        payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0) * 100
      ) / 100,
    [payments]
  );

  const remainingToPay = Math.max(0, Math.round((grandTotal - totalPaidInput) * 100) / 100);
  const changeAmount = Math.max(0, Math.round((totalPaidInput - grandTotal) * 100) / 100);

  const addPaymentLine = () => {
    const usedIds = payments.map((p) => String(p.payment_method_id));
    const nextMethod =
      paymentMethods.find((pm) => !usedIds.includes(String(pm.id))) || paymentMethods[0];
    setPayments((prev) => [
      ...prev,
      createPaymentRow(nextMethod?.id || '', remainingToPay > 0 ? remainingToPay.toFixed(2) : ''),
    ]);
  };

  const updatePaymentLine = (key, field, value) => {
    setPayments((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  };

  const removePaymentLine = (key) => {
    setPayments((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  };

  const fillExactBalanceOnRow = (key) => {
    const othersSum = payments
      .filter((p) => p.key !== key)
      .reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const needed = Math.max(0, Math.round((grandTotal - othersSum) * 100) / 100);
    updatePaymentLine(key, 'amount', needed.toFixed(2));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }

    const cleanPayments = payments
      .map((p) => ({
        payment_method_id: Number(p.payment_method_id),
        amount: Number(p.amount || 0),
        reference_number: p.reference_number.trim() || null,
      }))
      .filter((p) => p.payment_method_id > 0 && p.amount > 0);

    if (cleanPayments.length === 0) {
      setError('Ingresa al menos un pago mayor a Bs. 0.00.');
      return;
    }

    if (operationMode === 'sale' && totalPaidInput + 0.01 < grandTotal) {
      setError(
        `Faltan ${formatMoney(remainingToPay)} para completar la venta. Si es un adelanto parcial, cambia al modo "Reserva / Adelanto".`
      );
      return;
    }

    if (operationMode === 'layaway') {
      if (!customerId) {
        setError('Para registrar una reserva con adelanto debes seleccionar o crear un cliente.');
        return;
      }
      if (totalPaidInput >= grandTotal) {
        setError(
          'El adelanto cubre el 100% del total. Cambia a "Venta Completa" para facturar de inmediato.'
        );
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const commonPayload = {
        branch_id: selectedBranchId ? Number(selectedBranchId) : null,
        warehouse_id: Number(selectedWarehouseId),
        customer_id: customerId ? Number(customerId) : null,
        seller_employee_id: sellerEmployeeId ? Number(sellerEmployeeId) : null,
        discount_total: discountVal,
        notes: notes.trim() || null,
        items: cart.map((i) => ({
          variant_id: i.variant.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        payments: cleanPayments,
      };

      const res =
        operationMode === 'layaway'
          ? await saleService.createLayaway({
              ...commonPayload,
              expires_at: expiresAt || null,
            })
          : await saleService.create(commonPayload);

      setReceiptData(res.data);
      clearCartDraft();
      await loadPosData(selectedWarehouseId);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la operación.');
    } finally {
      setSubmitting(false);
    }
  };

  const warehouseOptions = warehouses.map((w) => ({
    value: String(w.id),
    label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
  }));

  const customerOptions = [
    {
      value: '',
      label: operationMode === 'layaway' ? 'Seleccionar cliente (obligatorio)...' : 'Cliente General (SIN NOMBRE)',
    },
    ...customers.map((c) => ({
      value: String(c.id),
      label: `${c.full_name}${c.phone ? ` · ${c.phone}` : ''}${
        c.store_credit > 0 ? ` · Créd: Bs.${c.store_credit}` : ''
      }`,
    })),
  ];

  const paymentMethodOptions = paymentMethods.map((pm) => ({
    value: String(pm.id),
    label: pm.name,
  }));

  return (
    <section>
      <div className="pos-page-head">
        <div>
          <span className="pos-eyebrow">Punto de Venta</span>
          <h1>Terminal de Ventas y Reservas</h1>
          <p className="pos-page-sub">
            Cobra con múltiples métodos de pago o registra un adelanto para apartar stock en la base de datos.
          </p>
        </div>
        {onNavigate && (
          <button type="button" className="pos-btn" onClick={() => onNavigate('pos.main')}>
            Volver al Inicio POS
          </button>
        )}
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <div className="pos-sell-layout">
        {/* COLUMNA IZQUIERDA: CATÁLOGO Y VARIANTES */}
        <div className="pos-catalog-col">
          <div className="pos-toolbar-box">
            <input
              type="text"
              className="pos-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar producto, SKU o escanear código de barras (Enter)..."
            />

            <CustomSelect
              value={selectedWarehouseId}
              onChange={handleWarehouseChange}
              loading={loading && warehouses.length === 0}
              loadingText="Cargando almacenes..."
              options={warehouseOptions}
              placeholder="Sucursal / Almacén..."
            />

            <button
              type="button"
              className="pos-btn"
              onClick={() => loadPosData(selectedWarehouseId)}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          <div className="pos-cat-strip">
            <button
              type="button"
              className={`pos-cat-pill ${selectedCategoryId === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedCategoryId('all')}
            >
              Todas ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pos-cat-pill ${
                  String(selectedCategoryId) === String(cat.id) ? 'is-active' : ''
                }`}
                onClick={() => setSelectedCategoryId(String(cat.id))}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="pos-products-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="pos-skeleton-prod" aria-hidden="true" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="pos-panel pos-empty-module">
              <p>No hay productos con stock disponible en este almacén para los filtros actuales.</p>
            </div>
          ) : (
            <div className="pos-products-grid">
              {filteredProducts.map((prod) => (
                <article key={prod.id} className="pos-prod-card">
                  <div className="pos-prod-media">
                    {prod.cover_image ? (
                      <img src={prod.cover_image} alt={prod.name} />
                    ) : (
                      <span className="pos-prod-initials">{getInitials(prod.name)}</span>
                    )}
                    <span className="pos-prod-stock-pill">
                      Disp: {prod.total_available}
                      {prod.total_reserved > 0 ? ` · Res: ${prod.total_reserved}` : ''}
                    </span>
                  </div>

                  <div className="pos-prod-body">
                    <div className="pos-prod-name">{prod.name}</div>
                    <div className="pos-prod-meta">
                      <span>{prod.category_name || 'Catálogo'}</span>
                      <span className="pos-prod-price">
                        {prod.min_price === prod.max_price
                          ? formatMoney(prod.min_price)
                          : `${formatMoney(prod.min_price)} - ${formatMoney(prod.max_price)}`}
                      </span>
                    </div>

                    <div className="pos-variants-chips">
                      {(prod.variants || []).map((v) => {
                        const inCartQty = cartQtyMap[v.id] || 0;
                        const remainingAvail = Math.max(0, v.available - inCartQty);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={`pos-var-chip ${inCartQty > 0 ? 'is-in-cart' : ''}`}
                            disabled={remainingAvail <= 0}
                            onClick={() => addToCart(v)}
                            title={`SKU: ${v.sku} · Precio: ${formatMoney(v.base_price)}`}
                          >
                            <span>{v.variant_label}</span>
                            <span className="pos-var-qty-tag">
                              ({remainingAvail}
                              {inCartQty > 0 ? ` · +${inCartQty}` : ''})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: CARRITO, PAGOS MÚLTIPLES Y RESERVA */}
        <form className="pos-cart-panel" onSubmit={handleCheckout}>
          <div className="pos-mode-tabs" role="tablist">
            <button
              type="button"
              className={`pos-mode-tab ${operationMode === 'sale' ? 'is-active' : ''}`}
              onClick={() => setOperationMode('sale')}
            >
              Venta Completa
            </button>
            <button
              type="button"
              className={`pos-mode-tab ${operationMode === 'layaway' ? 'is-active' : ''}`}
              onClick={() => setOperationMode('layaway')}
            >
              Reserva / Adelanto
            </button>
          </div>

          {operationMode === 'layaway' && (
            <div className="pos-mode-banner">
              <strong>Modo Reserva:</strong> Todo el carrito quedará reservado en inventario (
              <code>quantity_reserved</code>) con el adelanto registrado hasta cancelar el saldo.
            </div>
          )}

          <div className="pos-customer-row">
            <div>
              <span className="pos-field-label">
                Cliente {operationMode === 'layaway' ? '*' : '(opcional)'}
              </span>
              <CustomSelect
                value={customerId}
                onChange={setCustomerId}
                loading={loading && customers.length === 0}
                loadingText="Cargando clientes..."
                options={customerOptions}
              />
            </div>
            <button
              type="button"
              className="pos-btn"
              onClick={() => setQuickCustOpen(true)}
            >
              + Cliente
            </button>
          </div>

          {employees.length > 0 && (
            <div>
              <span className="pos-field-label">Vendedor (opcional)</span>
              <CustomSelect
                value={sellerEmployeeId}
                onChange={setSellerEmployeeId}
                options={[
                  { value: '', label: 'Sin vendedor asignado' },
                  ...employees.map((e) => ({
                    value: String(e.id),
                    label: `${e.employee_code} · ${e.full_name}`,
                  })),
                ]}
              />
            </div>
          )}

          {/* LISTA DEL CARRITO */}
          {cart.length > 0 && (
            <div className="pos-payments-head">
              <span className="pos-field-label">
                Carrito ({cart.reduce((s, i) => s + i.quantity, 0)} u.)
              </span>
              <button type="button" className="pos-cat-pill" onClick={clearCartDraft}>
                Vaciar carrito
              </button>
            </div>
          )}
          <div className="pos-cart-list">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                Selecciona una variante del catálogo para agregarla al carrito.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.variant.id} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <div className="pos-cart-item-name">{item.variant.product_name}</div>
                    <div className="pos-cart-item-sub">
                      {item.variant.variant_label} · {formatMoney(item.unit_price)} c/u
                    </div>
                  </div>

                  <div className="pos-qty-stepper">
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => changeCartQty(item.variant.id, -1)}
                    >
                      −
                    </button>
                    <span className="pos-qty-val">{item.quantity}</span>
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => changeCartQty(item.variant.id, 1)}
                    >
                      +
                    </button>
                  </div>

                  <strong>{formatMoney(item.quantity * item.unit_price)}</strong>

                  <button
                    type="button"
                    className="pos-remove-x"
                    onClick={() => removeCartItem(item.variant.id)}
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* DESCUENTO Y FECHA LÍMITE (EN RESERVA) */}
          <div className="pos-discount-grid">
            <div>
              <span className="pos-field-label">Descuento (Bs.)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="pos-input pos-input-sm"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(e.target.value)}
              />
            </div>

            {operationMode === 'layaway' ? (
              <div>
                <span className="pos-field-label">Vence reserva</span>
                <input
                  type="date"
                  className="pos-input pos-input-sm"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <span className="pos-field-label">Nota / Referencia</span>
                <input
                  type="text"
                  className="pos-input pos-input-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>

          {/* PAGOS MÚLTIPLES */}
          <div className="pos-payments-box">
            <div className="pos-payments-head">
              <span className="pos-field-label">
                {operationMode === 'layaway' ? 'Pagos de Adelanto (1 o más)' : 'Métodos de Pago (1 o más)'}
              </span>
              <button type="button" className="pos-btn" onClick={addPaymentLine}>
                + Otro Pago
              </button>
            </div>

            {payments.map((pRow) => (
              <div key={pRow.key} className="pos-payment-row">
                <div className="pos-payment-row-top">
                  <CustomSelect
                    value={pRow.payment_method_id}
                    onChange={(val) => updatePaymentLine(pRow.key, 'payment_method_id', val)}
                    loading={loading && paymentMethods.length === 0}
                    loadingText="Cargando..."
                    options={paymentMethodOptions}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="pos-input pos-input-sm"
                    value={pRow.amount}
                    onChange={(e) => updatePaymentLine(pRow.key, 'amount', e.target.value)}
                    placeholder="Monto Bs."
                  />

                  {payments.length > 1 && (
                    <button
                      type="button"
                      className="pos-remove-x"
                      onClick={() => removePaymentLine(pRow.key)}
                      aria-label="Quitar pago"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="pos-payment-row-sub">
                  <input
                    type="text"
                    maxLength={100}
                    className="pos-input pos-input-sm"
                    value={pRow.reference_number}
                    onChange={(e) => updatePaymentLine(pRow.key, 'reference_number', e.target.value)}
                    placeholder="N° Comprobante QR / Tarjeta (opc.)"
                  />
                  {operationMode === 'sale' && grandTotal > 0 && (
                    <button
                      type="button"
                      className="pos-cat-pill"
                      onClick={() => fillExactBalanceOnRow(pRow.key)}
                    >
                      Exacto
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* RESUMEN TOTALES */}
          <div className="pos-totals-box">
            <div className="pos-total-line">
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} u.)</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            {discountVal > 0 && (
              <div className="pos-total-line">
                <span>Descuento</span>
                <strong>-{formatMoney(discountVal)}</strong>
              </div>
            )}
            <div className="pos-total-line is-grand">
              <span>Total</span>
              <strong>{formatMoney(grandTotal)}</strong>
            </div>

            {operationMode === 'sale' ? (
              <>
                <div className="pos-total-line">
                  <span>Recibido</span>
                  <strong>{formatMoney(totalPaidInput)}</strong>
                </div>
                {remainingToPay > 0 ? (
                  <div className="pos-total-line is-danger">
                    <span>Faltante</span>
                    <strong>{formatMoney(remainingToPay)}</strong>
                  </div>
                ) : (
                  <div className="pos-total-line is-positive">
                    <span>Cambio / Vuelto</span>
                    <strong>{formatMoney(changeAmount)}</strong>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="pos-total-line is-positive">
                  <span>Adelanto a Registrar</span>
                  <strong>{formatMoney(totalPaidInput)}</strong>
                </div>
                <div className="pos-total-line is-warn">
                  <span>Saldo Pendiente</span>
                  <strong>{formatMoney(remainingToPay)}</strong>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            className="pos-btn pos-btn-primary pos-submit-btn"
            disabled={submitting || cart.length === 0}
          >
            {submitting
              ? 'Procesando...'
              : operationMode === 'layaway'
              ? `Registrar Reserva y Apartar (${formatMoney(totalPaidInput)})`
              : `Finalizar Venta (${formatMoney(grandTotal)})`}
          </button>
        </form>
      </div>

      <QuickCustomerModal
        isOpen={quickCustOpen}
        onClose={() => setQuickCustOpen(false)}
        branchId={selectedBranchId}
        onCreated={(newCust) => {
          setCustomers((prev) => [newCust, ...prev]);
          setCustomerId(String(newCust.id));
        }}
      />

      <PosReceiptModal
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        receiptData={receiptData}
      />
    </section>
  );
}
