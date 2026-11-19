import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { customerService } from '../../../services/admin/customerService';
import CustomerDetailModal from './CustomerDetailModal';
import CustomerFormModal from './CustomerFormModal';
import './customers.css';

const TIER_LABELS = {
  regular: 'Regular',
  silver: 'Silver',
  gold: 'Gold',
  vip: 'VIP',
  wholesale: 'Mayorista',
};

function getInitials(cust) {
  const first = cust.person?.first_name?.[0] || '';
  const last = cust.person?.last_name?.[0] || '';
  return (first + last || cust.customer_code?.[0] || 'C').toUpperCase();
}

export default function CustomersPage() {
  const [scopeTab, setScopeTab] = useState('active'); // 'active' | 'trashed'
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    total_active: 0,
    vip_or_gold_count: 0,
    total_loyalty_points: 0,
    total_store_credit: 0,
    trashed_count: 0,
  });
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Modales
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [detailState, setDetailState] = useState({ id: null, tab: 'overview' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceTarget, setForceTarget] = useState(null);

  const loadMeta = async () => {
    try {
      const res = await customerService.getMeta();
      setBranches(res.data?.branches || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadCustomers = async (scope = scopeTab) => {
    setLoading(true);
    setError('');
    try {
      const res = await customerService.getAll({ scope });
      setCustomers(res.data?.items || []);
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadCustomers(scopeTab);
  }, [scopeTab]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      const fullName = `${c.person?.first_name || ''} ${c.person?.last_name || ''}`.toLowerCase();
      const doc = (c.person?.document_number || '').toLowerCase();
      const phone = (c.person?.phone || '').toLowerCase();
      const email = (c.person?.email || c.user?.email || '').toLowerCase();

      const matchSearch =
        !term ||
        fullName.includes(term) ||
        (c.customer_code || '').toLowerCase().includes(term) ||
        doc.includes(term) ||
        phone.includes(term) ||
        email.includes(term);

      const matchTier = !filterTier || c.customer_tier === filterTier;
      const matchBranch =
        !filterBranchId || String(c.acquired_branch_id) === String(filterBranchId);
      const matchActive =
        filterActive === '' ||
        (filterActive === 'true' && c.is_active) ||
        (filterActive === 'false' && !c.is_active);

      return matchSearch && matchTier && matchBranch && matchActive;
    });
  }, [customers, search, filterTier, filterBranchId, filterActive]);

  const handleSavedCustomer = (data, isEdit) => {
    if (!data?.customer) return;
    if (data.stats) setStats(data.stats);
    if (isEdit) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === data.customer.id ? data.customer : c))
      );
    } else if (scopeTab === 'active') {
      setCustomers((prev) => [data.customer, ...prev]);
    }
  };

  const handleCustomerMutatedFromDetail = (updatedCustomer, nextStats) => {
    if (updatedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
      );
    }
    if (nextStats) setStats(nextStats);
  };

  const handleSoftDelete = async (cust) => {
    if (!cust || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await customerService.softDelete(cust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (cust) => {
    if (!cust || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await customerService.restore(cust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleForceDelete = async (cust) => {
    if (!cust || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await customerService.forceDelete(cust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Clientes y Fidelidad</h1>
          <p>Expedientes de clientas, historial de compras, puntos y actividad en el sistema.</p>
        </div>
        <div className="admin-actions-row">
          <button
            type="button"
            className="admin-btn"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" strokeLinejoin="round" />
            </svg>
            Filtros
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => {
              setEditingCustomer(null);
              setFormOpen(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nuevo Cliente
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Clientes Activos</span>
          <strong className="admin-kpi-value">{stats.total_active}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Nivel VIP / Gold</span>
          <strong className="admin-kpi-value">{stats.vip_or_gold_count}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Puntos Acumulados</span>
          <strong className="admin-kpi-value">{stats.total_loyalty_points} pts</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Crédito en Tienda</span>
          <strong className="admin-kpi-value">
            Bs. {Number(stats.total_store_credit).toFixed(2)}
          </strong>
        </article>
      </section>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${scopeTab === 'active' ? 'is-active' : ''}`}
          onClick={() => setScopeTab('active')}
        >
          Activos
        </button>
        <button
          type="button"
          className={`admin-tab ${scopeTab === 'trashed' ? 'is-active' : ''}`}
          onClick={() => setScopeTab('trashed')}
        >
          Papelera ({stats.trashed_count})
        </button>
      </div>

      {error && <div className="admin-alert">{error}</div>}

      {filtersOpen && (
        <div className="cust-toolbar-4">
          <input
            className="admin-input"
            placeholder="Buscar por nombre, código (CL0001), teléfono o CI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CustomSelect
            value={filterTier}
            onChange={setFilterTier}
            options={[
              { value: '', label: 'Todos los niveles' },
              { value: 'regular', label: 'Regular' },
              { value: 'silver', label: 'Silver' },
              { value: 'gold', label: 'Gold' },
              { value: 'vip', label: 'VIP' },
              { value: 'wholesale', label: 'Mayorista' },
            ]}
          />
          <CustomSelect
            value={filterBranchId}
            onChange={setFilterBranchId}
            options={[
              { value: '', label: 'Todas las sucursales' },
              ...branches.map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
          <CustomSelect
            value={filterActive}
            onChange={setFilterActive}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'true', label: 'Activos' },
              { value: 'false', label: 'Inactivos' },
            ]}
          />
        </div>
      )}

      {scopeTab === 'trashed' && (
        <div className="cust-section-note">
          Clientes en papelera lógica. Conservan sus compras, puntos y auditoría; puedes restaurarlos o eliminarlos definitivamente.
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Cargando clientes...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="admin-empty">
              {scopeTab === 'trashed'
                ? 'La papelera está vacía.'
                : 'No hay clientes registrados. Haz clic en "+ Nuevo Cliente".'}
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Nivel / Sucursal</th>
                  <th>Compras</th>
                  <th>Fidelidad y Crédito</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const fullName = c.person
                    ? `${c.person.first_name} ${c.person.last_name}`
                    : c.customer_code;
                  const totalSpent = Number(c.sales_sum_total_amount ?? 0);

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cust-cell">
                          <span className="cust-avatar">{getInitials(c)}</span>
                          <div className="cust-cell-meta">
                            <span className="cust-cell-name">{fullName}</span>
                            <span className="cust-cell-sub">
                              {c.customer_code}
                              {c.person?.phone ? ` · ${c.person.phone}` : ''}
                              {c.person?.email ? ` · ${c.person.email}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className={`cust-tier-badge is-${c.customer_tier}`}>
                            {TIER_LABELS[c.customer_tier] || c.customer_tier}
                          </span>
                          <span className="admin-subtext">
                            {c.branch?.name || 'General'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong className="admin-price-cell">
                          Bs. {totalSpent.toFixed(2)}
                        </strong>
                        <span className="admin-subtext">
                          {c.sales_count ?? 0} compra(s) · {c.layaways_count ?? 0} apartado(s)
                        </span>
                      </td>
                      <td>
                        <strong>{c.loyalty_points} pts</strong>
                        <span className="admin-subtext">
                          Crédito: Bs. {Number(c.store_credit ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="cust-status">
                          <span
                            className={`cust-status-dot ${c.is_active ? 'is-active' : 'is-inactive'}`}
                          />
                          {c.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-row">
                          {scopeTab === 'active' ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => setDetailState({ id: c.id, tab: 'overview' })}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                Detalle
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => setDetailState({ id: c.id, tab: 'activity' })}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                                </svg>
                                Historial
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => {
                                  setEditingCustomer(c);
                                  setFormOpen(true);
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Editar
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                disabled={saving}
                                onClick={() => setDeleteTarget(c)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Eliminar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => setDetailState({ id: c.id, tab: 'overview' })}
                              >
                                Detalle
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                disabled={saving}
                                onClick={() => handleRestore(c)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Restaurar
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                disabled={saving}
                                onClick={() => setForceTarget(c)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Eliminar Definitivo
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <CustomerFormModal
        isOpen={formOpen}
        editingCustomer={editingCustomer}
        branches={branches}
        onClose={() => setFormOpen(false)}
        onSaved={handleSavedCustomer}
      />

      <CustomerDetailModal
        customerId={detailState.id}
        initialTab={detailState.tab}
        onClose={() => setDetailState({ id: null, tab: 'overview' })}
        onCustomerMutated={handleCustomerMutatedFromDetail}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar Cliente"
        title={`¿Qué deseas hacer con "${deleteTarget?.person ? `${deleteTarget.person.first_name} ${deleteTarget.person.last_name}` : deleteTarget?.customer_code}"?`}
        message="Mover a Papelera realiza una eliminación lógica reversible conservando compras y puntos. Eliminar Definitivo borra el registro permanentemente."
        confirmLabel="Mover a Papelera"
        rejectLabel="Eliminar Definitivo"
        onConfirm={() => handleSoftDelete(deleteTarget)}
        onReject={() => setForceTarget(deleteTarget)}
      />

      <ConfirmModal
        isOpen={!!forceTarget}
        onClose={() => setForceTarget(null)}
        eyebrow="Acción Irreversible"
        title={`¿Eliminar definitivamente a "${forceTarget?.person ? `${forceTarget.person.first_name} ${forceTarget.person.last_name}` : forceTarget?.customer_code}"?`}
        message="Esta acción eliminará el registro y sus direcciones permanentemente. Si tiene ventas o apartados históricos asociados, el sistema impedirá borrarlo."
        confirmLabel="Sí, Eliminar Definitivo"
        variant="danger"
        onConfirm={() => handleForceDelete(forceTarget)}
      />
    </>
  );
}
