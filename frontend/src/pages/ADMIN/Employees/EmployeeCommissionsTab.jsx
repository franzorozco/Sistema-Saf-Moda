import { useEffect, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { employeeService } from '../../../services/admin/employeeService';

const COMM_STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
  cancelled: 'Anulada',
};

const COMM_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'paid', label: 'Pagada' },
  { value: 'cancelled', label: 'Anulada' },
];

export default function EmployeeCommissionsTab({ employees, onEmployeeUpdated }) {
  const [rateDrafts, setRateDrafts] = useState({});
  const [commissions, setCommissions] = useState([]);
  const [stats, setStats] = useState({
    pending_total: 0,
    approved_total: 0,
    paid_total: 0,
    pending_count: 0,
  });
  const [filterEmpId, setFilterEmpId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusAction, setStatusAction] = useState(null);

  useEffect(() => {
    const map = {};
    employees.forEach((e) => {
      map[e.id] = String(e.commission_rate ?? 0);
    });
    setRateDrafts(map);
  }, [employees]);

  const loadCommissions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await employeeService.getCommissions({
        employee_id: filterEmpId,
        status: filterStatus,
      });
      setCommissions(res.data?.items || []);
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
  }, [filterEmpId, filterStatus]);

  const handleSaveRate = async (emp) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await employeeService.updateCommissionRate(emp.id, rateDrafts[emp.id] ?? 0);
      if (res.data?.employee) {
        onEmployeeUpdated?.(res.data.employee, res.data.stats);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusAction || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await employeeService.updateCommissionStatus(
        statusAction.commission.id,
        statusAction.nextStatus
      );
      if (res.data?.commission) {
        setCommissions((prev) =>
          prev.map((c) => (c.id === statusAction.commission.id ? res.data.commission : c))
        );
      }
      if (res.data?.stats) setStats(res.data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const employeeOptions = employees.map((e) => ({
    value: String(e.id),
    label: `${e.person?.first_name || ''} ${e.person?.last_name || ''} (${e.employee_code})`.trim(),
  }));

  return (
    <div className="admin-form">
      {error && <div className="admin-alert">{error}</div>}

      <div className="emp-form-section">
        <div className="emp-form-section-title">
          <span>Reglas de Comisión por Venta (%)</span>
        </div>

        {employees.length === 0 ? (
          <p className="admin-empty">No hay empleados activos registrados.</p>
        ) : (
          <div className="emp-rates-grid">
            {employees.map((emp) => {
              const draftVal = rateDrafts[emp.id] ?? String(emp.commission_rate ?? 0);
              const changed = Number(draftVal) !== Number(emp.commission_rate ?? 0);
              const sampleGain = ((1000 * Number(draftVal || 0)) / 100).toFixed(2);
              return (
                <article key={emp.id} className="emp-rate-card">
                  <div className="emp-rate-header">
                    <div>
                      <strong>
                        {emp.person?.first_name} {emp.person?.last_name}
                      </strong>
                      <span className="admin-subtext">
                        {emp.employee_code} · {emp.job_position?.name}
                      </span>
                    </div>
                    <span className="admin-badge">{emp.branch?.code}</span>
                  </div>

                  <div className="emp-rate-input-row">
                    <div className="admin-field">
                      <label>Comisión (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="admin-input admin-input-sm"
                        value={draftVal}
                        onChange={(e) =>
                          setRateDrafts((prev) => ({ ...prev, [emp.id]: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className={`admin-btn admin-btn-sm ${changed ? 'admin-btn-primary' : ''}`}
                      disabled={saving || !changed}
                      onClick={() => handleSaveRate(emp)}
                    >
                      {saving && changed ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>

                  <span className="admin-subtext">
                    Por venta de Bs. 1.000 → <strong>Bs. {sampleGain}</strong>
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="emp-form-section">
        <div className="emp-form-section-title">
          <span>Historial de Comisiones Generadas</span>
        </div>

        <div className="emp-comm-summary-grid">
          <div className="admin-kpi-card">
            <span className="admin-kpi-label">Por Aprobar ({stats.pending_count})</span>
            <strong className="admin-kpi-value">Bs. {Number(stats.pending_total).toFixed(2)}</strong>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-label">Aprobadas</span>
            <strong className="admin-kpi-value">Bs. {Number(stats.approved_total).toFixed(2)}</strong>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-label">Pagadas</span>
            <strong className="admin-kpi-value">Bs. {Number(stats.paid_total).toFixed(2)}</strong>
          </div>
        </div>

        <div className="admin-toolbar">
          <CustomSelect
            value={filterEmpId}
            onChange={setFilterEmpId}
            options={[{ value: '', label: 'Todos los empleados' }, ...employeeOptions]}
          />
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={COMM_STATUS_OPTIONS}
          />
        </div>

        <section className="admin-panel">
          <div className="admin-table-wrap">
            {loading ? (
              <p className="admin-empty">Cargando comisiones...</p>
            ) : commissions.length === 0 ? (
              <p className="admin-empty">
                Aún no se registran comisiones por ventas. Se generan al cerrar ventas con vendedor asignado en el POS.
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Venta</th>
                    <th>Empleado</th>
                    <th>Base Venta</th>
                    <th>Tasa</th>
                    <th>Comisión</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => {
                    const empName = c.employee?.person
                      ? `${c.employee.person.first_name} ${c.employee.person.last_name}`
                      : '—';
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="admin-code-tag">
                            {c.sale?.sale_number || `#${c.sale_id}`}
                          </span>
                        </td>
                        <td>
                          <strong>{empName}</strong>
                          <span className="admin-subtext">{c.employee?.branch?.name}</span>
                        </td>
                        <td className="admin-price-cell">
                          Bs. {Number(c.commission_base).toFixed(2)}
                        </td>
                        <td>{Number(c.commission_rate).toFixed(2)}%</td>
                        <td className="admin-price-cell">
                          Bs. {Number(c.commission_amount).toFixed(2)}
                        </td>
                        <td>
                          <span className="emp-status">
                            <span className={`emp-status-dot is-${c.status}`} />
                            {COMM_STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td>
                          <div className="admin-actions-row">
                            {c.status === 'pending' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() =>
                                  setStatusAction({
                                    commission: c,
                                    nextStatus: 'approved',
                                    title: '¿Aprobar comisión?',
                                    label: 'Aprobar',
                                    variant: 'primary',
                                  })
                                }
                              >
                                Aprobar
                              </button>
                            )}
                            {(c.status === 'pending' || c.status === 'approved') && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                                onClick={() =>
                                  setStatusAction({
                                    commission: c,
                                    nextStatus: 'paid',
                                    title: '¿Marcar comisión como pagada?',
                                    label: 'Marcar Pagada',
                                    variant: 'primary',
                                  })
                                }
                              >
                                Pagar
                              </button>
                            )}
                            {c.status !== 'cancelled' && c.status !== 'paid' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                                onClick={() =>
                                  setStatusAction({
                                    commission: c,
                                    nextStatus: 'cancelled',
                                    title: '¿Anular esta comisión?',
                                    label: 'Anular',
                                    variant: 'danger',
                                  })
                                }
                              >
                                Anular
                              </button>
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
      </div>

      <ConfirmModal
        isOpen={!!statusAction}
        onClose={() => setStatusAction(null)}
        eyebrow="Comisión por Venta"
        title={statusAction?.title || ''}
        message={`Monto: Bs. ${Number(statusAction?.commission?.commission_amount || 0).toFixed(2)}`}
        confirmLabel={statusAction?.label || 'Confirmar'}
        variant={statusAction?.variant || 'primary'}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  );
}
