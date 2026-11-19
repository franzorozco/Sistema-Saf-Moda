import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { customerService } from '../../../services/admin/customerService';

const TIER_LABELS = {
  regular: 'Regular',
  silver: 'Silver',
  gold: 'Gold',
  vip: 'VIP',
  wholesale: 'Mayorista',
};

const ACTION_LABELS = {
  INSERT: 'Registro creado',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación / Baja',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  OTHER: 'Actividad',
};

const SALE_STATUS_LABELS = {
  completed: 'Completada',
  voided: 'Anulada',
  refunded: 'Devuelta',
  partial_refund: 'Dev. Parcial',
};

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDiffEntries(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([k, v]) => `${k}: ${String(v)}`);
}

export default function CustomerDetailModal({
  customerId,
  initialTab = 'overview',
  onClose,
  onCustomerMutated,
}) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form Nueva Dirección
  const [addingAddress, setAddingAddress] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'Casa',
    city: '',
    address_line1: '',
    reference_notes: '',
    is_default: true,
  });

  // Ajustes de Puntos y Crédito
  const [pointsOp, setPointsOp] = useState('add');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');

  const [creditOp, setCreditOp] = useState('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const loadDetail = async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await customerService.getDetail(id);
      setDetail(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!customerId) return;
    setTab(initialTab || 'overview');
    setAddingAddress(false);
    setPointsAmount('');
    setPointsReason('');
    setCreditAmount('');
    setCreditReason('');
    loadDetail(customerId);
  }, [customerId, initialTab]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!customerId || saving) return;
    setSaving(true);
    setError('');
    try {
      await customerService.createAddress(customerId, addrForm);
      setAddrForm({ label: 'Casa', city: '', address_line1: '', reference_notes: '', is_default: false });
      setAddingAddress(false);
      await loadDetail(customerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await customerService.deleteAddress(addressId);
      await loadDetail(customerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    if (!customerId || saving || !pointsAmount || !pointsReason.trim()) return;
    setSaving(true);
    setError('');
    try {
      const delta = pointsOp === 'add' ? Number(pointsAmount) : -Math.abs(Number(pointsAmount));
      const res = await customerService.adjustLoyalty(customerId, {
        points_delta: delta,
        reason: pointsReason.trim(),
      });
      setPointsAmount('');
      setPointsReason('');
      onCustomerMutated?.(res.data?.customer, res.data?.stats);
      await loadDetail(customerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustCredit = async (e) => {
    e.preventDefault();
    if (!customerId || saving || !creditAmount || !creditReason.trim()) return;
    setSaving(true);
    setError('');
    try {
      const delta = creditOp === 'add' ? Number(creditAmount) : -Math.abs(Number(creditAmount));
      const res = await customerService.adjustStoreCredit(customerId, {
        amount_delta: delta,
        reason: creditReason.trim(),
      });
      setCreditAmount('');
      setCreditReason('');
      onCustomerMutated?.(res.data?.customer, res.data?.stats);
      await loadDetail(customerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const c = detail?.customer;
  const summary = detail?.summary;
  const fullName = c?.person
    ? `${c.person.first_name} ${c.person.last_name}`.trim()
    : c?.customer_code || 'Cliente';
  const initials = c?.person
    ? `${c.person.first_name?.[0] || ''}${c.person.last_name?.[0] || ''}`.toUpperCase()
    : 'CL';

  return (
    <BaseModal
      isOpen={!!customerId}
      onClose={onClose}
      eyebrow={c?.customer_code || 'Expediente de Cliente'}
      title={fullName}
      size="xl"
      footer={
        <button type="button" className="admin-btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="admin-form">
        {error && <div className="admin-alert">{error}</div>}

        {loading && !detail ? (
          <p className="admin-empty">Cargando expediente del cliente...</p>
        ) : (
          detail && (
            <>
              <div className="cust-detail-banner">
                <div className="cust-detail-identity">
                  <span className="cust-detail-avatar">{initials}</span>
                  <div className="cust-cell-meta">
                    <span className="cust-cell-name">{fullName}</span>
                    <span className="cust-cell-sub">
                      {c.customer_code}
                      {c.person?.document_number ? ` · ${c.person.document_type || 'DOC'} ${c.person.document_number}` : ''}
                      {c.person?.phone ? ` · ${c.person.phone}` : ''}
                      {c.person?.email ? ` · ${c.person.email}` : ''}
                    </span>
                  </div>
                </div>
                <div className="admin-actions-row">
                  <span className={`cust-tier-badge is-${c.customer_tier}`}>
                    {TIER_LABELS[c.customer_tier] || c.customer_tier}
                  </span>
                  <span className="cust-status">
                    <span className={`cust-status-dot ${c.is_active ? 'is-active' : 'is-inactive'}`} />
                    {c.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              <div className="cust-detail-kpis">
                <div className="cust-detail-kpi">
                  <span>Total Comprado</span>
                  <strong>Bs. {Number(summary?.total_spent ?? 0).toFixed(2)}</strong>
                </div>
                <div className="cust-detail-kpi">
                  <span>Compras Realizadas</span>
                  <strong>{summary?.total_purchases_count ?? 0}</strong>
                </div>
                <div className="cust-detail-kpi">
                  <span>Puntos Fidelidad</span>
                  <strong>{summary?.loyalty_points ?? 0} pts</strong>
                </div>
                <div className="cust-detail-kpi">
                  <span>Crédito en Tienda</span>
                  <strong>Bs. {Number(summary?.store_credit ?? 0).toFixed(2)}</strong>
                </div>
              </div>

              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab ${tab === 'overview' ? 'is-active' : ''}`}
                  onClick={() => setTab('overview')}
                >
                  Resumen y Direcciones
                </button>
                <button
                  type="button"
                  className={`admin-tab ${tab === 'purchases' ? 'is-active' : ''}`}
                  onClick={() => setTab('purchases')}
                >
                  Compras y Apartados ({detail.sales?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`admin-tab ${tab === 'loyalty' ? 'is-active' : ''}`}
                  onClick={() => setTab('loyalty')}
                >
                  Fidelidad y Crédito
                </button>
                <button
                  type="button"
                  className={`admin-tab ${tab === 'activity' ? 'is-active' : ''}`}
                  onClick={() => setTab('activity')}
                >
                  Historial de Acciones ({detail.activity_logs?.length ?? 0})
                </button>
              </div>

              {tab === 'overview' && (
                <div className="admin-form">
                  <div className="cust-info-grid">
                    <div className="cust-info-item">
                      <span>Sucursal de Registro</span>
                      <strong>{c.branch?.name || 'General'}</strong>
                    </div>
                    <div className="cust-info-item">
                      <span>Ticket Promedio</span>
                      <strong>Bs. {Number(summary?.average_ticket ?? 0).toFixed(2)}</strong>
                    </div>
                    <div className="cust-info-item">
                      <span>Última Compra</span>
                      <strong>{formatDateTime(summary?.last_purchase_at)}</strong>
                    </div>
                    <div className="cust-info-item">
                      <span>Acceso Tienda Web</span>
                      <strong>{c.user ? c.user.email : 'Sin cuenta web'}</strong>
                    </div>
                    <div className="cust-info-item">
                      <span>Marketing</span>
                      <strong>{c.accepts_marketing ? 'Acepta promociones' : 'No suscrita'}</strong>
                    </div>
                    <div className="cust-info-item">
                      <span>Apartados Activos</span>
                      <strong>{summary?.active_layaways_count ?? 0}</strong>
                    </div>
                  </div>

                  {c.notes && (
                    <div className="cust-section-note">
                      <strong>Notas:</strong> {c.notes}
                    </div>
                  )}

                  <div className="cust-form-section-title">
                    <span>Direcciones Registradas ({c.customer_addresses?.length ?? 0})</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost"
                      onClick={() => setAddingAddress((prev) => !prev)}
                    >
                      + Agregar dirección
                    </button>
                  </div>

                  {addingAddress && (
                    <form className="cust-adjust-card" onSubmit={handleAddAddress}>
                      <div className="admin-form-grid">
                        <div className="admin-field">
                          <label>Etiqueta</label>
                          <input
                            className="admin-input admin-input-sm"
                            value={addrForm.label}
                            onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Ciudad</label>
                          <input
                            className="admin-input admin-input-sm"
                            value={addrForm.city}
                            onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                            required
                          />
                        </div>
                        <div className="admin-field">
                          <label>Dirección</label>
                          <input
                            className="admin-input admin-input-sm"
                            value={addrForm.address_line1}
                            onChange={(e) =>
                              setAddrForm({ ...addrForm, address_line1: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="admin-field">
                          <label>Referencia</label>
                          <input
                            className="admin-input admin-input-sm"
                            value={addrForm.reference_notes}
                            onChange={(e) =>
                              setAddrForm({ ...addrForm, reference_notes: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="admin-actions-row">
                        <button
                          type="submit"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          disabled={saving}
                        >
                          {saving ? 'Guardando...' : 'Guardar Dirección'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          onClick={() => setAddingAddress(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {(c.customer_addresses || []).length === 0 ? (
                    <p className="admin-empty">Sin direcciones registradas.</p>
                  ) : (
                    <div className="cust-address-grid">
                      {c.customer_addresses.map((addr) => (
                        <article key={addr.id} className="cust-address-card">
                          <div className="cust-address-head">
                            <strong>
                              {addr.label} {addr.is_default ? '· Principal' : ''}
                            </strong>
                            <button
                              type="button"
                              className="admin-chip-remove"
                              disabled={saving}
                              onClick={() => handleDeleteAddress(addr.id)}
                              aria-label="Eliminar dirección"
                            >
                              ×
                            </button>
                          </div>
                          <span>{addr.address_line1}</span>
                          <span className="admin-subtext">
                            {addr.city}
                            {addr.reference_notes ? ` · ${addr.reference_notes}` : ''}
                          </span>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'purchases' && (
                <div className="admin-form">
                  <div className="modal-table-box">
                    <div className="admin-table-wrap">
                      {(detail.sales || []).length === 0 ? (
                        <p className="admin-empty">Este cliente aún no registra compras.</p>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Nro. Venta</th>
                              <th>Fecha</th>
                              <th>Sucursal / Vendedor</th>
                              <th>Prendas</th>
                              <th>Total</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.sales.map((sale) => (
                              <tr key={sale.id}>
                                <td>
                                  <span className="admin-code-tag">{sale.sale_number}</span>
                                  <span className="admin-subtext">{sale.sale_channel}</span>
                                </td>
                                <td>{formatDateTime(sale.sold_at)}</td>
                                <td>
                                  {sale.branch?.name || '—'}
                                  <span className="admin-subtext">
                                    {sale.employee?.person
                                      ? `${sale.employee.person.first_name} ${sale.employee.person.last_name}`
                                      : 'Sin vendedor'}
                                  </span>
                                </td>
                                <td>
                                  <div className="cust-sale-items-list">
                                    {(sale.sale_items || []).map((si) => (
                                      <span key={si.id}>
                                        {si.quantity}× {si.product_variant?.product?.name || si.product_variant?.sku}
                                        {si.product_variant?.variant_label ? ` (${si.product_variant.variant_label})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="admin-price-cell">
                                  Bs. {Number(sale.total_amount).toFixed(2)}
                                </td>
                                <td>
                                  <span className="admin-badge">
                                    {SALE_STATUS_LABELS[sale.status] || sale.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {(detail.layaways || []).length > 0 && (
                    <>
                      <div className="cust-form-section-title">
                        <span>Apartados ({detail.layaways.length})</span>
                      </div>
                      <div className="modal-table-box">
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Sucursal</th>
                                <th>Total</th>
                                <th>Pagado</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.layaways.map((l) => (
                                <tr key={l.id}>
                                  <td>
                                    <span className="admin-code-tag">{l.layaway_number}</span>
                                  </td>
                                  <td>{l.branch?.name}</td>
                                  <td>Bs. {Number(l.total_amount).toFixed(2)}</td>
                                  <td>Bs. {Number(l.paid_amount).toFixed(2)}</td>
                                  <td className="admin-price-cell">
                                    Bs. {Number(l.balance_due ?? 0).toFixed(2)}
                                  </td>
                                  <td>
                                    <span className="admin-badge">{l.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === 'loyalty' && (
                <div className="admin-form">
                  <div className="cust-adjust-grid">
                    <form className="cust-adjust-card" onSubmit={handleAdjustPoints}>
                      <strong>Ajustar Puntos de Fidelidad</strong>
                      <div className="admin-form-grid">
                        <div className="admin-field">
                          <label>Operación</label>
                          <CustomSelect
                            value={pointsOp}
                            onChange={setPointsOp}
                            options={[
                              { value: 'add', label: 'Sumar puntos (+)' },
                              { value: 'sub', label: 'Canjear / Restar (-)' },
                            ]}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            className="admin-input admin-input-sm"
                            placeholder="Ej. 50"
                            value={pointsAmount}
                            onChange={(e) => setPointsAmount(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="admin-field">
                        <label>Motivo</label>
                        <input
                          className="admin-input admin-input-sm"
                          placeholder="Ej. Bono cumpleaños, canje en tienda..."
                          value={pointsReason}
                          onChange={(e) => setPointsReason(e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Aplicando...' : 'Aplicar Puntos'}
                      </button>
                    </form>

                    <form className="cust-adjust-card" onSubmit={handleAdjustCredit}>
                      <strong>Ajustar Crédito en Tienda</strong>
                      <div className="admin-form-grid">
                        <div className="admin-field">
                          <label>Operación</label>
                          <CustomSelect
                            value={creditOp}
                            onChange={setCreditOp}
                            options={[
                              { value: 'add', label: 'Abonar crédito (+)' },
                              { value: 'sub', label: 'Descontar crédito (-)' },
                            ]}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Monto (Bs.)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="admin-input admin-input-sm"
                            placeholder="Ej. 100.00"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="admin-field">
                        <label>Motivo</label>
                        <input
                          className="admin-input admin-input-sm"
                          placeholder="Ej. Devolución a favor, saldo usado..."
                          value={creditReason}
                          onChange={(e) => setCreditReason(e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Aplicando...' : 'Aplicar Crédito'}
                      </button>
                    </form>
                  </div>

                  <div className="modal-table-box">
                    <div className="admin-table-wrap">
                      {(detail.loyalty_transactions || []).length === 0 ? (
                        <p className="admin-empty">Sin movimientos de puntos registrados.</p>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Motivo</th>
                              <th>Venta</th>
                              <th>Variación</th>
                              <th>Saldo Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.loyalty_transactions.map((lt) => (
                              <tr key={lt.id}>
                                <td>{formatDateTime(lt.created_at)}</td>
                                <td>{lt.reason}</td>
                                <td>
                                  {lt.sale ? (
                                    <span className="admin-code-tag">{lt.sale.sale_number}</span>
                                  ) : (
                                    'Manual'
                                  )}
                                </td>
                                <td>
                                  <strong>
                                    {lt.points_delta > 0 ? `+${lt.points_delta}` : lt.points_delta}
                                  </strong>
                                </td>
                                <td>{lt.balance_after} pts</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'activity' && (
                <div className="admin-form">
                  {(detail.activity_logs || []).length === 0 ? (
                    <p className="admin-empty">
                      No hay acciones registradas en auditoría para este cliente.
                    </p>
                  ) : (
                    <div className="cust-timeline">
                      {detail.activity_logs.map((log) => {
                        const actorName = log.user?.person
                          ? `${log.user.person.first_name} ${log.user.person.last_name}`
                          : 'Sistema';
                        const newEntries = formatDiffEntries(log.new_values);
                        const oldEntries = formatDiffEntries(log.old_values);

                        return (
                          <article key={log.id} className="cust-timeline-item">
                            <span className="cust-timeline-dot" />
                            <div className="cust-timeline-head">
                              <span className="admin-badge">
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                              <span className="cust-timeline-meta">
                                {formatDateTime(log.created_at)} · Por {actorName}
                                {log.branch ? ` · ${log.branch.name}` : ''}
                                {log.ip_address ? ` · IP ${log.ip_address}` : ''}
                              </span>
                            </div>

                            {newEntries.length > 0 && (
                              <div className="cust-timeline-diff">
                                {newEntries.map((entry) => (
                                  <span key={entry} className="cust-diff-chip">
                                    {entry}
                                  </span>
                                ))}
                              </div>
                            )}

                            {oldEntries.length > 0 && (
                              <div className="cust-timeline-meta">
                                Anterior: {oldEntries.join(' · ')}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
    </BaseModal>
  );
}
