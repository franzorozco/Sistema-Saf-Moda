import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { employeeService } from '../../../services/admin/employeeService';

const SHIFT_STATUS_LABELS = {
  scheduled: 'Programado',
  completed: 'Completado',
  late: 'Tardanza',
  absent: 'Ausente',
  cancelled: 'Cancelado',
};

const SHIFT_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'completed', label: 'Completado' },
  { value: 'late', label: 'Tardanza' },
  { value: 'absent', label: 'Ausente' },
  { value: 'cancelled', label: 'Cancelado' },
];

const WEEKDAYS = [
  { offset: 0, label: 'Lun' },
  { offset: 1, label: 'Mar' },
  { offset: 2, label: 'Mié' },
  { offset: 3, label: 'Jue' },
  { offset: 4, label: 'Vie' },
  { offset: 5, label: 'Sáb' },
  { offset: 6, label: 'Dom' },
];

function getMondayISO() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
}

function addDaysISO(baseIso, days) {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function formatTimeShort(val) {
  return val ? String(val).slice(0, 5) : '—';
}

function formatTimeStamp(val) {
  if (!val) return '—';
  const str = String(val);
  return str.length >= 16 ? str.slice(11, 16) : str;
}

export default function EmployeeShiftsTab({
  employees,
  branches,
  initialEmployeeId,
  onClearInitialEmployee,
  onShiftMutated,
}) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filterEmpId, setFilterEmpId] = useState(initialEmployeeId || '');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal Turno Individual
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [singleForm, setSingleForm] = useState({});

  // Modal Horario Semanal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    employee_id: '',
    branch_id: '',
    week_start: getMondayISO(),
    days: [0, 1, 2, 3, 4, 5],
    starts_at: '09:00',
    ends_at: '18:00',
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (initialEmployeeId) {
      setFilterEmpId(String(initialEmployeeId));
    }
  }, [initialEmployeeId]);

  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await employeeService.getShifts({
        employee_id: filterEmpId,
        branch_id: filterBranchId,
        date_from: dateFrom,
        date_to: dateTo,
        status: filterStatus,
      });
      setShifts(res.data?.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, [filterEmpId, filterBranchId, dateFrom, dateTo, filterStatus]);

  const openSingleCreate = () => {
    const defaultEmp = filterEmpId || (employees[0]?.id ? String(employees[0].id) : '');
    const empObj = employees.find((e) => String(e.id) === String(defaultEmp));
    setEditingShift(null);
    setSingleForm({
      employee_id: defaultEmp,
      branch_id: empObj?.primary_branch_id
        ? String(empObj.primary_branch_id)
        : branches[0]?.id
          ? String(branches[0].id)
          : '',
      shift_date: new Date().toISOString().slice(0, 10),
      starts_at: '09:00',
      ends_at: '18:00',
      status: 'scheduled',
      notes: '',
    });
    setSingleModalOpen(true);
  };

  const openSingleEdit = (shift) => {
    setEditingShift(shift);
    setSingleForm({
      employee_id: String(shift.employee_id),
      branch_id: String(shift.branch_id),
      shift_date: String(shift.shift_date).slice(0, 10),
      starts_at: formatTimeShort(shift.starts_at),
      ends_at: formatTimeShort(shift.ends_at),
      status: shift.status,
      notes: shift.notes || '',
    });
    setSingleModalOpen(true);
  };

  const openBatchModal = () => {
    const defaultEmp = filterEmpId || (employees[0]?.id ? String(employees[0].id) : '');
    const empObj = employees.find((e) => String(e.id) === String(defaultEmp));
    setBatchForm({
      employee_id: defaultEmp,
      branch_id: empObj?.primary_branch_id
        ? String(empObj.primary_branch_id)
        : branches[0]?.id
          ? String(branches[0].id)
          : '',
      week_start: getMondayISO(),
      days: [0, 1, 2, 3, 4, 5],
      starts_at: '09:00',
      ends_at: '18:00',
      notes: '',
    });
    setBatchModalOpen(true);
  };

  const handleSaveSingle = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...singleForm,
        employee_id: Number(singleForm.employee_id),
        branch_id: Number(singleForm.branch_id),
      };
      if (editingShift) {
        const res = await employeeService.updateShift(editingShift.id, payload);
        setShifts((prev) => prev.map((s) => (s.id === editingShift.id ? res.data.shift : s)));
      } else {
        const res = await employeeService.createShift(payload);
        setShifts((prev) => [res.data.shift, ...prev]);
      }
      setSingleModalOpen(false);
      onShiftMutated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (saving || batchForm.days.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const dates = batchForm.days
        .slice()
        .sort((a, b) => a - b)
        .map((offset) => addDaysISO(batchForm.week_start, offset));

      const res = await employeeService.createShiftsBatch({
        employee_id: Number(batchForm.employee_id),
        branch_id: Number(batchForm.branch_id),
        dates,
        starts_at: batchForm.starts_at,
        ends_at: batchForm.ends_at,
        notes: batchForm.notes,
      });
      setShifts((prev) => [...(res.data?.items || []), ...prev]);
      setBatchModalOpen(false);
      onShiftMutated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (shift) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await employeeService.checkInShift(shift.id);
      setShifts((prev) => prev.map((s) => (s.id === shift.id ? res.data.shift : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckOut = async (shift) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await employeeService.checkOutShift(shift.id);
      setShifts((prev) => prev.map((s) => (s.id === shift.id ? res.data.shift : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      await employeeService.deleteShift(deleteTarget.id);
      setShifts((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      onShiftMutated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekday = (offset) => {
    setBatchForm((prev) => ({
      ...prev,
      days: prev.days.includes(offset)
        ? prev.days.filter((d) => d !== offset)
        : [...prev.days, offset],
    }));
  };

  const employeeOptions = employees.map((e) => ({
    value: String(e.id),
    label: `${e.person?.first_name || ''} ${e.person?.last_name || ''} (${e.employee_code})`.trim(),
  }));

  return (
    <div className="admin-form">
      <div className="emp-sub-bar">
        <div className="admin-actions-row">
          {initialEmployeeId && (
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={() => {
                setFilterEmpId('');
                onClearInitialEmployee?.();
              }}
            >
              Ver todos los empleados
            </button>
          )}
        </div>
        <div className="admin-actions-row">
          <button
            type="button"
            className="admin-btn"
            disabled={employees.length === 0}
            onClick={openSingleCreate}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Turno Individual
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={employees.length === 0}
            onClick={openBatchModal}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
            Horario Semanal
          </button>
        </div>
      </div>

      <div className="emp-toolbar-5">
        <CustomSelect
          value={filterEmpId}
          onChange={setFilterEmpId}
          options={[{ value: '', label: 'Todos los empleados' }, ...employeeOptions]}
        />
        <CustomSelect
          value={filterBranchId}
          onChange={setFilterBranchId}
          options={[
            { value: '', label: 'Todas las sucursales' },
            ...branches.map((b) => ({ value: String(b.id), label: b.name })),
          ]}
        />
        <input
          type="date"
          className="admin-input"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Desde"
        />
        <input
          type="date"
          className="admin-input"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Hasta"
        />
        <CustomSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={SHIFT_STATUS_OPTIONS}
        />
      </div>

      {error && <div className="admin-alert">{error}</div>}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Cargando horarios...</p>
          ) : shifts.length === 0 ? (
            <p className="admin-empty">
              No hay turnos registrados con estos filtros.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Sucursal</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Asistencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => {
                  const empName = s.employee?.person
                    ? `${s.employee.person.first_name} ${s.employee.person.last_name}`
                    : '—';
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{empName}</strong>
                        <span className="admin-subtext">{s.employee?.job_position?.name}</span>
                      </td>
                      <td>
                        {s.branch?.name}
                        <span className="admin-subtext">{s.branch?.code}</span>
                      </td>
                      <td>{String(s.shift_date).slice(0, 10)}</td>
                      <td className="emp-shift-time">
                        {formatTimeShort(s.starts_at)} – {formatTimeShort(s.ends_at)}
                      </td>
                      <td>
                        <span className="admin-subtext">
                          In: {formatTimeStamp(s.actual_check_in)} · Out:{' '}
                          {formatTimeStamp(s.actual_check_out)}
                        </span>
                      </td>
                      <td>
                        <span className="emp-status">
                          <span className={`emp-status-dot is-${s.status}`} />
                          {SHIFT_STATUS_LABELS[s.status] || s.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-row">
                          {!s.actual_check_in && s.status !== 'cancelled' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm admin-btn-ghost"
                              disabled={saving}
                              onClick={() => handleCheckIn(s)}
                            >
                              Entrada
                            </button>
                          )}
                          {s.actual_check_in && !s.actual_check_out && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm admin-btn-ghost"
                              disabled={saving}
                              onClick={() => handleCheckOut(s)}
                            >
                              Salida
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-ghost"
                            onClick={() => openSingleEdit(s)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                            onClick={() => setDeleteTarget(s)}
                          >
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

      <BaseModal
        isOpen={singleModalOpen}
        onClose={() => setSingleModalOpen(false)}
        eyebrow="Horarios"
        title={editingShift ? 'Editar Turno' : 'Nuevo Turno Individual'}
        size="wide"
        footer={
          <>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setSingleModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="single-shift-form"
              className="admin-btn admin-btn-primary"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Turno'}
            </button>
          </>
        }
      >
        <form id="single-shift-form" className="admin-form" onSubmit={handleSaveSingle}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Empleado</label>
              <CustomSelect
                value={singleForm.employee_id || ''}
                onChange={(val) => setSingleForm({ ...singleForm, employee_id: val })}
                options={employeeOptions}
              />
            </div>
            <div className="admin-field">
              <label>Sucursal</label>
              <CustomSelect
                value={singleForm.branch_id || ''}
                onChange={(val) => setSingleForm({ ...singleForm, branch_id: val })}
                options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Fecha</label>
              <input
                type="date"
                className="admin-input"
                value={singleForm.shift_date || ''}
                onChange={(e) => setSingleForm({ ...singleForm, shift_date: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Hora Entrada</label>
              <input
                type="time"
                className="admin-input"
                value={singleForm.starts_at || ''}
                onChange={(e) => setSingleForm({ ...singleForm, starts_at: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Hora Salida</label>
              <input
                type="time"
                className="admin-input"
                value={singleForm.ends_at || ''}
                onChange={(e) => setSingleForm({ ...singleForm, ends_at: e.target.value })}
                required
              />
            </div>
          </div>

          {editingShift && (
            <div className="admin-field">
              <label>Estado</label>
              <CustomSelect
                value={singleForm.status || 'scheduled'}
                onChange={(val) => setSingleForm({ ...singleForm, status: val })}
                options={SHIFT_STATUS_OPTIONS.filter((o) => o.value !== '')}
              />
            </div>
          )}

          <div className="admin-field">
            <label>Notas</label>
            <input
              className="admin-input"
              placeholder="Ej. Turno apertura, cobertura especial..."
              value={singleForm.notes || ''}
              onChange={(e) => setSingleForm({ ...singleForm, notes: e.target.value })}
            />
          </div>
        </form>
      </BaseModal>

      <BaseModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        eyebrow="Generador de Horarios"
        title="Programar Horario Semanal"
        size="wide"
        footer={
          <>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setBatchModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="batch-shift-form"
              className="admin-btn admin-btn-primary"
              disabled={saving || batchForm.days.length === 0}
            >
              {saving ? 'Generando...' : `Crear ${batchForm.days.length} Turno(s)`}
            </button>
          </>
        }
      >
        <form id="batch-shift-form" className="admin-form" onSubmit={handleSaveBatch}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Empleado</label>
              <CustomSelect
                value={batchForm.employee_id}
                onChange={(val) => setBatchForm({ ...batchForm, employee_id: val })}
                options={employeeOptions}
              />
            </div>
            <div className="admin-field">
              <label>Sucursal</label>
              <CustomSelect
                value={batchForm.branch_id}
                onChange={(val) => setBatchForm({ ...batchForm, branch_id: val })}
                options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Semana desde (Lunes)</label>
              <input
                type="date"
                className="admin-input"
                value={batchForm.week_start}
                onChange={(e) => setBatchForm({ ...batchForm, week_start: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Hora Entrada</label>
              <input
                type="time"
                className="admin-input"
                value={batchForm.starts_at}
                onChange={(e) => setBatchForm({ ...batchForm, starts_at: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Hora Salida</label>
              <input
                type="time"
                className="admin-input"
                value={batchForm.ends_at}
                onChange={(e) => setBatchForm({ ...batchForm, ends_at: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="admin-field">
            <label>Días laborales de la semana</label>
            <div className="emp-weekdays-row">
              {WEEKDAYS.map((wd) => {
                const isSelected = batchForm.days.includes(wd.offset);
                return (
                  <button
                    key={wd.offset}
                    type="button"
                    className={`emp-day-pill ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggleWeekday(wd.offset)}
                  >
                    {wd.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-field">
            <label>Notas (Opcional)</label>
            <input
              className="admin-input"
              placeholder="Ej. Horario regular de tienda"
              value={batchForm.notes}
              onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
            />
          </div>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Eliminar Turno"
        title="¿Eliminar este turno?"
        message={`Se eliminará el turno del ${String(deleteTarget?.shift_date || '').slice(0, 10)}.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteShift}
      />
    </div>
  );
}
