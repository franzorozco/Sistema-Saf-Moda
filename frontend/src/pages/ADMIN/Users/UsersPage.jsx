import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { userService } from '../../../services/admin/userService';
import UserFormModal from './UserFormModal';
import UserRolesModal from './UserRolesModal';
import './users.css';

const STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  locked: 'Bloqueado',
};

const TYPE_LABELS = {
  employee: 'Empleado',
  customer: 'Cliente',
  both: 'Empleado / Cliente',
  system: 'Sistema',
};

function getInitials(user) {
  const first = user.person?.first_name?.[0] || '';
  const last = user.person?.last_name?.[0] || '';
  return (first + last || user.email?.[0] || 'U').toUpperCase();
}

export default function UsersPage() {
  const [scopeTab, setScopeTab] = useState('active'); // 'active' | 'trashed'
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total_active: 0,
    employees_count: 0,
    customers_count: 0,
    inactive_count: 0,
    trashed_count: 0,
  });
  const [meta, setMeta] = useState({ roles: [], branches: [], job_positions: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('');

  // Modales
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [rolesUser, setRolesUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceConfirmTarget, setForceConfirmTarget] = useState(null);

  const loadMeta = async () => {
    try {
      const res = await userService.getMeta();
      setMeta(res.data || { roles: [], branches: [], job_positions: [] });
    } catch (err) {
      setError(err.message);
    }
  };

  const loadUsers = async (currentScope = scopeTab) => {
    setLoading(true);
    setError('');
    try {
      const res = await userService.getAll({ scope: currentScope });
      setUsers(res.data?.items || []);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
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
    loadUsers(scopeTab);
  }, [scopeTab]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const fullName = `${u.person?.first_name || ''} ${u.person?.last_name || ''}`.toLowerCase();
      const doc = (u.person?.document_number || '').toLowerCase();
      const empCode = (u.employee?.employee_code || '').toLowerCase();
      const custCode = (u.customer?.customer_code || '').toLowerCase();
      const matchSearch =
        !term ||
        fullName.includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term) ||
        doc.includes(term) ||
        empCode.includes(term) ||
        custCode.includes(term);

      const matchType =
        !filterType ||
        u.user_type === filterType ||
        (u.user_type === 'both' && (filterType === 'employee' || filterType === 'customer'));

      const matchStatus = !filterStatus || u.status === filterStatus;

      const matchRole =
        !filterRoleId ||
        (u.user_roles || []).some((ur) => String(ur.role_id) === String(filterRoleId));

      return matchSearch && matchType && matchStatus && matchRole;
    });
  }, [users, search, filterType, filterStatus, filterRoleId]);

  const handleSavedUser = (data, isEdit) => {
    if (!data?.user) return;
    if (data.stats) setStats(data.stats);
    if (isEdit) {
      setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
    } else if (scopeTab === 'active') {
      setUsers((prev) => [data.user, ...prev]);
    }
  };

  const handleSavedRoles = (data) => {
    if (!data?.user) return;
    if (data.stats) setStats(data.stats);
    setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
  };

  const handleJobPositionCreated = (newPos) => {
    setMeta((prev) => ({
      ...prev,
      job_positions: [...(prev.job_positions || []), newPos],
    }));
  };

  const handleSoftDelete = async (user) => {
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await userService.softDelete(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (user) => {
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await userService.restore(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleForceDelete = async (user) => {
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await userService.forceDelete(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
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
          <h1>Usuarios y Roles</h1>
          <p>Administra empleados, clientes, perfiles de acceso y papelera.</p>
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
              setEditingUser(null);
              setFormOpen(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Nuevo Usuario
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Usuarios Activos</span>
          <strong className="admin-kpi-value">{stats.total_active}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Empleados</span>
          <strong className="admin-kpi-value">{stats.employees_count}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Clientes</span>
          <strong className="admin-kpi-value">{stats.customers_count}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">En Papelera</span>
          <strong className="admin-kpi-value">{stats.trashed_count}</strong>
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
        <div className="user-toolbar-4">
          <input
            className="admin-input"
            placeholder="Buscar por nombre, correo, CI o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CustomSelect
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: '', label: 'Todos los tipos' },
              { value: 'employee', label: 'Empleados' },
              { value: 'customer', label: 'Clientes' },
              { value: 'system', label: 'Sistema' },
            ]}
          />
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'active', label: 'Activo' },
              { value: 'inactive', label: 'Inactivo' },
              { value: 'suspended', label: 'Suspendido' },
              { value: 'locked', label: 'Bloqueado' },
            ]}
          />
          <CustomSelect
            value={filterRoleId}
            onChange={setFilterRoleId}
            options={[
              { value: '', label: 'Todos los roles' },
              ...(meta.roles || []).map((r) => ({
                value: String(r.id),
                label: r.name,
              })),
            ]}
          />
        </div>
      )}

      {scopeTab === 'trashed' && (
        <div className="user-trash-banner">
          Los usuarios en papelera conservan su historial (eliminación lógica). Puedes restaurarlos o eliminarlos definitivamente de la base de datos.
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Cargando usuarios...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="admin-empty">
              {scopeTab === 'trashed'
                ? 'La papelera está vacía.'
                : 'No se encontraron usuarios.'}
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tipo / Perfil</th>
                  <th>Roles</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const fullName = u.person
                    ? `${u.person.first_name} ${u.person.last_name}`
                    : u.email;
                  const profileCode =
                    u.employee?.employee_code || u.customer?.customer_code || '';
                  const profileSub =
                    u.employee?.job_position?.name ||
                    (u.customer ? `Nivel ${u.customer.customer_tier}` : 'Cuenta raíz');

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-avatar">{getInitials(u)}</span>
                          <div className="user-cell-meta">
                            <span className="user-cell-name">{fullName}</span>
                            <span className="user-cell-sub">
                              {u.email}
                              {u.username ? ` · @${u.username}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className="admin-badge">
                            {TYPE_LABELS[u.user_type] || 'Sistema'}
                          </span>
                          <span className="admin-subtext">
                            {profileCode ? `${profileCode} · ` : ''}
                            {profileSub}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="user-roles-wrap">
                          {(u.user_roles || []).length === 0 ? (
                            <span className="admin-subtext">Sin roles</span>
                          ) : (
                            u.user_roles.map((ur) => (
                              <span key={ur.id} className="user-role-pill">
                                <span>{ur.role?.name}</span>
                                <span className="user-role-scope">
                                  · {ur.branch ? ur.branch.code : 'Global'}
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="user-status">
                          <span className={`user-status-dot is-${u.status || 'inactive'}`} />
                          {STATUS_LABELS[u.status] || u.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-row">
                          {scopeTab === 'active' ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => setRolesUser(u)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                                </svg>
                                Roles
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => {
                                  setEditingUser(u);
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
                                onClick={() => setDeleteTarget(u)}
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
                                disabled={saving}
                                onClick={() => handleRestore(u)}
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
                                onClick={() => setForceConfirmTarget(u)}
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

      <UserFormModal
        isOpen={formOpen}
        editingUser={editingUser}
        meta={meta}
        onClose={() => setFormOpen(false)}
        onSaved={handleSavedUser}
        onJobPositionCreated={handleJobPositionCreated}
      />

      <UserRolesModal
        user={rolesUser}
        roles={meta.roles || []}
        branches={meta.branches || []}
        onClose={() => setRolesUser(null)}
        onSaved={handleSavedRoles}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar Usuario"
        title={`¿Qué deseas hacer con "${deleteTarget?.person ? `${deleteTarget.person.first_name} ${deleteTarget.person.last_name}` : deleteTarget?.email}"?`}
        message="Mover a Papelera realiza una eliminación lógica reversible conservando el historial. Eliminar Definitivo borra el registro de la base de datos."
        confirmLabel="Mover a Papelera"
        rejectLabel="Eliminar Definitivo"
        onConfirm={() => handleSoftDelete(deleteTarget)}
        onReject={() => setForceConfirmTarget(deleteTarget)}
      />

      <ConfirmModal
        isOpen={!!forceConfirmTarget}
        onClose={() => setForceConfirmTarget(null)}
        eyebrow="Acción Irreversible"
        title={`¿Eliminar definitivamente a "${forceConfirmTarget?.person ? `${forceConfirmTarget.person.first_name} ${forceConfirmTarget.person.last_name}` : forceConfirmTarget?.email}"?`}
        message="Esta acción realizará una eliminación física permanente. Si el usuario tiene ventas, cajas o auditoría asociada, el sistema impedirá borrarlo para proteger la integridad."
        confirmLabel="Sí, Eliminar Definitivo"
        variant="danger"
        onConfirm={() => handleForceDelete(forceConfirmTarget)}
      />
    </>
  );
}
