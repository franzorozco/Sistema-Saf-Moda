import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { employeeService } from '../../../services/admin/employeeService';
import EmployeeCommissionsTab from './EmployeeCommissionsTab';
import EmployeeFormModal from './EmployeeFormModal';
import EmployeeShiftsTab from './EmployeeShiftsTab';
import './employees.css';

const EMP_STATUS_LABELS = {
  active: 'Activo',
  on_leave: 'Con licencia',
  suspended: 'Suspendido',
  terminated: 'Desvinculado',
};

const CONTRACT_LABELS = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  temporary: 'Temporal',
  internship: 'Pasantía',
};

function getInitials(emp) {
  const first = emp.person?.first_name?.[0] || '';
  const last = emp.person?.last_name?.[0] || '';
  return (first + last || emp.employee_code?.[0] || 'E').toUpperCase();
}

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState('team'); // 'team' | 'shifts' | 'commissions' | 'trashed'
  const [employees, setEmployees] = useState([]);
  const [trashedEmployees, setTrashedEmployees] = useState([]);
  const [stats, setStats] = useState({
    total_active: 0,
    shifts_today: 0,
    avg_commission_rate: 0,
    pending_commissions_total: 0,
    trashed_count: 0,
  });
  const [meta, setMeta] = useState({ branches: [], job_positions: [], roles: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filtros de Equipo
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterPositionId, setFilterPositionId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Acceso rápido a Horarios de un empleado específico
  const [shiftFocusEmpId, setShiftFocusEmpId] = useState('');

  // Modales
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceTarget, setForceTarget] = useState(null);

  const loadMeta = async () => {
    try {
      const res = await employeeService.getMeta();
      setMeta(res.data || { branches: [], job_positions: [], roles: [] });
    } catch (err) {
      setError(err.message);
    }
  };

  const loadEmployees = async (scope = 'active') => {
    setLoading(true);
    setError('');
    try {
      const res = await employeeService.getAll({ scope });
      if (scope === 'trashed') {
        setTrashedEmployees(res.data?.items || []);
      } else {
        setEmployees(res.data?.items || []);
      }
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadEmployees('active');
  }, []);

  useEffect(() => {
    if (activeTab === 'trashed') {
      loadEmployees('trashed');
    }
  }, [activeTab]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const fullName =
        `${emp.person?.first_name || ''} ${emp.person?.last_name || ''}`.toLowerCase();
      const doc = (emp.person?.document_number || '').toLowerCase();
      const email = (emp.user?.email || emp.person?.email || '').toLowerCase();
      const matchSearch =
        !term ||
        fullName.includes(term) ||
        (emp.employee_code || '').toLowerCase().includes(term) ||
        doc.includes(term) ||
        email.includes(term);

      const matchBranch =
        !filterBranchId ||
        String(emp.primary_branch_id) === String(filterBranchId) ||
        (emp.employee_branches || []).some(
          (eb) => String(eb.branch_id) === String(filterBranchId)
        );

      const matchPos =
        !filterPositionId || String(emp.job_position_id) === String(filterPositionId);

      const matchStatus = !filterStatus || emp.employment_status === filterStatus;

      return matchSearch && matchBranch && matchPos && matchStatus;
    });
  }, [employees, search, filterBranchId, filterPositionId, filterStatus]);

  const handleSavedEmployee = (data, isEdit) => {
    if (!data?.employee) return;
    if (data.stats) setStats(data.stats);
    if (isEdit) {
      setEmployees((prev) =>
        prev.map((e) => (e.id === data.employee.id ? data.employee : e))
      );
    } else {
      setEmployees((prev) => [data.employee, ...prev]);
    }
  };

  const handleEmployeeUpdated = (updatedEmp, nextStats) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    if (nextStats) setStats(nextStats);
  };

  const handleJobPositionCreated = (newPos) => {
    setMeta((prev) => ({
      ...prev,
      job_positions: [...(prev.job_positions || []), newPos],
    }));
  };

  const handleSoftDelete = async (emp) => {
    if (!emp || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await employeeService.softDelete(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (emp) => {
    if (!emp || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await employeeService.restore(emp.id);
      setTrashedEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      if (res.data?.employee) {
        setEmployees((prev) => [res.data.employee, ...prev]);
      }
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleForceDelete = async (emp) => {
    if (!emp || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await employeeService.forceDelete(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      setTrashedEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderBranchAndRoles = (emp) => {
    const branchRolesMap = new Map(
      (emp.branch_roles || []).map((br) => [br.branch_id, br.role?.name])
    );
    const list = emp.employee_branches || [];

    if (list.length === 0 && emp.branch) {
      const roleName = branchRolesMap.get(emp.branch.id);
      return (
        <div className="emp-pills-col">
          <span className="emp-role-pill is-primary">
            <span>{emp.branch.name}</span>
            {roleName && <span className="emp-role-muted">· {roleName}</span>}
          </span>
        </div>
      );
    }

    return (
      <div className="emp-pills-col">
        {list.map((eb) => {
          const roleName = branchRolesMap.get(eb.branch_id);
          return (
            <span
              key={eb.branch_id}
              className={`emp-role-pill ${eb.is_primary ? 'is-primary' : ''}`}
            >
              <span>{eb.branch?.name || eb.branch_id}</span>
              {roleName && <span className="emp-role-muted">· {roleName}</span>}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Empleados y Turnos</h1>
          <p>Equipo de tienda, sucursales, roles, horarios y comisiones por venta.</p>
        </div>
        <div className="admin-actions-row">
          {activeTab === 'team' && (
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
          )}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => {
              setEditingEmployee(null);
              setFormOpen(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nuevo Empleado
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Empleados Activos</span>
          <strong className="admin-kpi-value">{stats.total_active}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Turnos Hoy</span>
          <strong className="admin-kpi-value">{stats.shifts_today}</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Comisión Promedio</span>
          <strong className="admin-kpi-value">{Number(stats.avg_commission_rate).toFixed(2)}%</strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Comisiones Pendientes</span>
          <strong className="admin-kpi-value">
            Bs. {Number(stats.pending_commissions_total).toFixed(2)}
          </strong>
        </article>
      </section>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'team' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          Equipo ({employees.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'shifts' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          Horarios y Turnos
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'commissions' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('commissions')}
        >
          Comisiones por Venta
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'trashed' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('trashed')}
        >
          Papelera ({stats.trashed_count})
        </button>
      </div>

      {error && <div className="admin-alert">{error}</div>}

      {activeTab === 'team' && (
        <>
          {filtersOpen && (
            <div className="emp-toolbar-4">
              <input
                className="admin-input"
                placeholder="Buscar por nombre, código (E0001) o CI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <CustomSelect
                value={filterBranchId}
                onChange={setFilterBranchId}
                options={[
                  { value: '', label: 'Todas las sucursales' },
                  ...(meta.branches || []).map((b) => ({
                    value: String(b.id),
                    label: b.name,
                  })),
                ]}
              />
              <CustomSelect
                value={filterPositionId}
                onChange={setFilterPositionId}
                options={[
                  { value: '', label: 'Todos los cargos' },
                  ...(meta.job_positions || []).map((jp) => ({
                    value: String(jp.id),
                    label: jp.name,
                  })),
                ]}
              />
              <CustomSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'active', label: 'Activo' },
                  { value: 'on_leave', label: 'Con licencia' },
                  { value: 'suspended', label: 'Suspendido' },
                  { value: 'terminated', label: 'Desvinculado' },
                ]}
              />
            </div>
          )}

          <section className="admin-panel">
            <div className="admin-table-wrap">
              {loading ? (
                <p className="admin-empty">Cargando empleados...</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="admin-empty">
                  No hay empleados registrados. Haz clic en "+ Nuevo Empleado" para agregar el primero.
                </p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Sucursales y Rol en Sucursal</th>
                      <th>Rol en el Sistema</th>
                      <th>Comisión / Salario</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const fullName = emp.person
                        ? `${emp.person.first_name} ${emp.person.last_name}`
                        : emp.employee_code;
                      const sysRoles = emp.system_roles || [];

                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="emp-cell">
                              <span className="emp-avatar">{getInitials(emp)}</span>
                              <div className="emp-cell-meta">
                                <span className="emp-cell-name">{fullName}</span>
                                <span className="emp-cell-sub">
                                  {emp.employee_code} · {emp.job_position?.name}
                                  {' · '}
                                  {CONTRACT_LABELS[emp.contract_type] || emp.contract_type}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{renderBranchAndRoles(emp)}</td>
                          <td>
                            {!emp.user ? (
                              <span className="admin-subtext">Sin acceso al sistema</span>
                            ) : sysRoles.length === 0 ? (
                              <span className="admin-subtext">Solo rol por sucursal</span>
                            ) : (
                              <div className="emp-pills-col">
                                {sysRoles.map((sr) => (
                                  <span key={sr.id} className="emp-role-pill">
                                    {sr.role?.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            <strong className="admin-price-cell">
                              {Number(emp.commission_rate ?? 0).toFixed(2)}%
                            </strong>
                            <span className="admin-subtext">
                              Base: Bs. {Number(emp.base_salary ?? 0).toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <span className="emp-status">
                              <span className={`emp-status-dot is-${emp.employment_status}`} />
                              {EMP_STATUS_LABELS[emp.employment_status] || emp.employment_status}
                            </span>
                          </td>
                          <td>
                            <div className="admin-actions-row">
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => {
                                  setShiftFocusEmpId(String(emp.id));
                                  setActiveTab('shifts');
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                                </svg>
                                Horarios
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() => {
                                  setEditingEmployee(emp);
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
                                onClick={() => setDeleteTarget(emp)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Eliminar
                              </button>
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
        </>
      )}

      {activeTab === 'shifts' && (
        <EmployeeShiftsTab
          employees={employees}
          branches={meta.branches || []}
          initialEmployeeId={shiftFocusEmpId}
          onClearInitialEmployee={() => setShiftFocusEmpId('')}
          onShiftMutated={() => loadEmployees('active')}
        />
      )}

      {activeTab === 'commissions' && (
        <EmployeeCommissionsTab
          employees={employees}
          onEmployeeUpdated={handleEmployeeUpdated}
        />
      )}

      {activeTab === 'trashed' && (
        <>
          <div className="emp-section-note">
            Empleados dados de baja lógica. Conservan su historial de ventas, turnos y comisiones; puedes restaurarlos o eliminarlos definitivamente.
          </div>

          <section className="admin-panel">
            <div className="admin-table-wrap">
              {loading ? (
                <p className="admin-empty">Cargando papelera...</p>
              ) : trashedEmployees.length === 0 ? (
                <p className="admin-empty">La papelera está vacía.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Sucursal</th>
                      <th>Comisión</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashedEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <strong>
                            {emp.person?.first_name} {emp.person?.last_name}
                          </strong>
                          <span className="admin-subtext">
                            {emp.employee_code} · {emp.job_position?.name}
                          </span>
                        </td>
                        <td>{emp.branch?.name || '—'}</td>
                        <td>{Number(emp.commission_rate ?? 0).toFixed(2)}%</td>
                        <td>
                          <div className="admin-actions-row">
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm admin-btn-ghost"
                              disabled={saving}
                              onClick={() => handleRestore(emp)}
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
                              onClick={() => setForceTarget(emp)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Eliminar Definitivo
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      <EmployeeFormModal
        isOpen={formOpen}
        editingEmployee={editingEmployee}
        meta={meta}
        onClose={() => setFormOpen(false)}
        onSaved={handleSavedEmployee}
        onJobPositionCreated={handleJobPositionCreated}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar Empleado"
        title={`¿Qué deseas hacer con "${deleteTarget?.person ? `${deleteTarget.person.first_name} ${deleteTarget.person.last_name}` : deleteTarget?.employee_code}"?`}
        message="Mover a Papelera desactiva al empleado de forma reversible conservando su historial. Eliminar Definitivo borra el registro de la base de datos."
        confirmLabel="Mover a Papelera"
        rejectLabel="Eliminar Definitivo"
        onConfirm={() => handleSoftDelete(deleteTarget)}
        onReject={() => setForceTarget(deleteTarget)}
      />

      <ConfirmModal
        isOpen={!!forceTarget}
        onClose={() => setForceTarget(null)}
        eyebrow="Acción Irreversible"
        title={`¿Eliminar definitivamente a "${forceTarget?.person ? `${forceTarget.person.first_name} ${forceTarget.person.last_name}` : forceTarget?.employee_code}"?`}
        message="Esta acción eliminará el registro laboral y sus turnos permanentemente. Si tiene ventas, cajas o comisiones históricas asociadas, el sistema impedirá borrarlo."
        confirmLabel="Sí, Eliminar Definitivo"
        variant="danger"
        onConfirm={() => handleForceDelete(forceTarget)}
      />
    </>
  );
}
