import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { employeeService } from '../../../services/admin/employeeService';
import { userService } from '../../../services/admin/userService';

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'CI', label: 'Cédula de Identidad (CI)' },
  { value: 'DNI', label: 'DNI' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'non_binary', label: 'No binario' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

const CONTRACT_OPTIONS = [
  { value: 'full_time', label: 'Tiempo completo' },
  { value: 'part_time', label: 'Medio tiempo' },
  { value: 'temporary', label: 'Temporal' },
  { value: 'internship', label: 'Pasantía' },
];

const EMP_STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'on_leave', label: 'Con licencia' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'terminated', label: 'Desvinculado' },
];

const ACCOUNT_STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'locked', label: 'Bloqueado' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EmployeeFormModal({
  isOpen,
  editingEmployee,
  meta,
  onClose,
  onSaved,
  onJobPositionCreated,
}) {
  const [person, setPerson] = useState({});
  const [employee, setEmployee] = useState({});
  const [hasSystemAccess, setHasSystemAccess] = useState(true);
  const [account, setAccount] = useState({});
  const [systemRoleId, setSystemRoleId] = useState('');
  const [branchAssignments, setBranchAssignments] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  // Nuevo cargo inline
  const [addingPos, setAddingPos] = useState(false);
  const [newPosName, setNewPosName] = useState('');
  const [newPosSalary, setNewPosSalary] = useState('');
  const [posSaving, setPosSaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setShowPassword(false);
    setAddingPos(false);
    setError('');

    if (editingEmployee) {
      const p = editingEmployee.person || {};
      const u = editingEmployee.user;

      setPerson({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        document_type: p.document_type || '',
        document_number: p.document_number || '',
        phone: p.phone || '',
        email: p.email || '',
        birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : '',
        gender: p.gender || '',
      });

      setEmployee({
        employee_code: editingEmployee.employee_code || '',
        job_position_id: editingEmployee.job_position_id
          ? String(editingEmployee.job_position_id)
          : '',
        hire_date: editingEmployee.hire_date
          ? String(editingEmployee.hire_date).slice(0, 10)
          : todayISO(),
        termination_date: editingEmployee.termination_date
          ? String(editingEmployee.termination_date).slice(0, 10)
          : '',
        contract_type: editingEmployee.contract_type || 'full_time',
        base_salary:
          editingEmployee.base_salary !== null ? String(editingEmployee.base_salary) : '0',
        commission_rate:
          editingEmployee.commission_rate !== null
            ? String(editingEmployee.commission_rate)
            : '0',
        employment_status: editingEmployee.employment_status || 'active',
        notes: editingEmployee.notes || '',
      });

      const userActive = !!u && u.status !== 'inactive';
      setHasSystemAccess(!!u && userActive);

      setAccount({
        email: u?.email || p.email || '',
        username: u?.username || '',
        password: '',
        status: u?.status || 'active',
      });

      const sysRole = editingEmployee.system_roles?.[0];
      setSystemRoleId(sysRole?.role_id ? String(sysRole.role_id) : '');

      const branchRoleMap = new Map(
        (editingEmployee.branch_roles || []).map((br) => [String(br.branch_id), String(br.role_id)])
      );

      const ebList = editingEmployee.employee_branches || [];
      if (ebList.length > 0) {
        setBranchAssignments(
          ebList.map((eb) => ({
            branch_id: String(eb.branch_id),
            is_primary: !!eb.is_primary,
            role_id: branchRoleMap.get(String(eb.branch_id)) || '',
            assigned_from: eb.assigned_from ? String(eb.assigned_from).slice(0, 10) : todayISO(),
          }))
        );
      } else {
        setBranchAssignments([
          {
            branch_id: String(
              editingEmployee.primary_branch_id || meta?.branches?.[0]?.id || ''
            ),
            is_primary: true,
            role_id: branchRoleMap.get(String(editingEmployee.primary_branch_id)) || '',
            assigned_from: todayISO(),
          },
        ]);
      }
    } else {
      setPerson({
        first_name: '',
        last_name: '',
        document_type: 'CI',
        document_number: '',
        phone: '',
        email: '',
        birth_date: '',
        gender: '',
      });
      setEmployee({
        employee_code: '',
        job_position_id: meta?.job_positions?.[0]?.id ? String(meta.job_positions[0].id) : '',
        hire_date: todayISO(),
        termination_date: '',
        contract_type: 'full_time',
        base_salary: meta?.job_positions?.[0]?.base_salary_ref
          ? String(meta.job_positions[0].base_salary_ref)
          : '',
        commission_rate: '1',
        employment_status: 'active',
        notes: '',
      });
      setHasSystemAccess(true);
      setAccount({
        email: '',
        username: '',
        password: '',
        status: 'active',
      });
      const sellerRole = meta?.roles?.find((r) => r.code === 'seller') || meta?.roles?.[0];
      setSystemRoleId('');
      setBranchAssignments([
        {
          branch_id: meta?.branches?.[0]?.id ? String(meta.branches[0].id) : '',
          is_primary: true,
          role_id: sellerRole ? String(sellerRole.id) : '',
          assigned_from: todayISO(),
        },
      ]);
    }
  }, [isOpen, editingEmployee, meta]);

  const handleCreatePosition = async () => {
    if (!newPosName.trim() || posSaving) return;
    setPosSaving(true);
    setError('');
    try {
      const res = await userService.createJobPosition({
        name: newPosName.trim(),
        base_salary_ref: newPosSalary !== '' ? Number(newPosSalary) : null,
      });
      const created = res.data;
      onJobPositionCreated?.(created);
      setEmployee((prev) => ({
        ...prev,
        job_position_id: String(created.id),
        base_salary:
          prev.base_salary === '' && created.base_salary_ref
            ? String(created.base_salary_ref)
            : prev.base_salary,
      }));
      setNewPosName('');
      setNewPosSalary('');
      setAddingPos(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosSaving(false);
    }
  };

  const handleAddBranchRow = () => {
    const usedIds = branchAssignments.map((b) => String(b.branch_id));
    const nextBranch =
      (meta.branches || []).find((b) => !usedIds.includes(String(b.id))) || meta.branches?.[0];
    if (!nextBranch) return;
    setBranchAssignments((prev) => [
      ...prev,
      {
        branch_id: String(nextBranch.id),
        is_primary: prev.length === 0,
        role_id: '',
        assigned_from: todayISO(),
      },
    ]);
  };

  const handleUpdateBranchRow = (index, field, val) => {
    setBranchAssignments((prev) =>
      prev.map((row, idx) => {
        if (field === 'is_primary') {
          return { ...row, is_primary: idx === index };
        }
        return idx === index ? { ...row, [field]: val } : row;
      })
    );
  };

  const handleRemoveBranchRow = (index) => {
    setBranchAssignments((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      if (filtered.length > 0 && !filtered.some((r) => r.is_primary)) {
        filtered[0] = { ...filtered[0], is_primary: true };
      }
      return filtered;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      const payload = {
        person,
        employee: {
          ...employee,
          job_position_id: employee.job_position_id ? Number(employee.job_position_id) : '',
          base_salary: employee.base_salary !== '' ? Number(employee.base_salary) : 0,
          commission_rate: employee.commission_rate !== '' ? Number(employee.commission_rate) : 0,
        },
        branch_assignments: branchAssignments
          .filter((b) => Boolean(b.branch_id))
          .map((b) => ({
            branch_id: Number(b.branch_id),
            is_primary: !!b.is_primary,
            role_id: hasSystemAccess && b.role_id ? Number(b.role_id) : null,
            assigned_from: b.assigned_from || todayISO(),
          })),
        has_system_access: hasSystemAccess,
      };

      if (hasSystemAccess) {
        payload.account = account;
        payload.system_role_id = systemRoleId ? Number(systemRoleId) : null;
      }

      const res = editingEmployee
        ? await employeeService.update(editingEmployee.id, payload)
        : await employeeService.create(payload);

      onSaved(res.data, !!editingEmployee);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const rateNum = Number(employee.commission_rate || 0);
  const sampleCommission = ((1000 * rateNum) / 100).toFixed(2);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={editingEmployee ? editingEmployee.employee_code : 'Nuevo Empleado'}
      title={
        editingEmployee
          ? `${editingEmployee.person?.first_name || ''} ${editingEmployee.person?.last_name || ''}`.trim()
          : 'Registrar Empleado'
      }
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="employee-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving
              ? 'Guardando...'
              : editingEmployee
                ? 'Guardar Cambios'
                : 'Registrar Empleado'}
          </button>
        </>
      }
    >
      <form id="employee-form" className="admin-form" onSubmit={handleSubmit}>
        {error && <div className="admin-alert">{error}</div>}

        <div className="emp-form-section">
          <div className="emp-form-section-title">
            <span>1. Datos Personales</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Nombre</label>
              <input
                className="admin-input"
                placeholder="Ej. Camila"
                value={person.first_name || ''}
                onChange={(e) => setPerson({ ...person, first_name: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Apellido</label>
              <input
                className="admin-input"
                placeholder="Ej. Rojas"
                value={person.last_name || ''}
                onChange={(e) => setPerson({ ...person, last_name: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Teléfono</label>
              <input
                className="admin-input"
                placeholder="Ej. 70012345"
                value={person.phone || ''}
                onChange={(e) => setPerson({ ...person, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Tipo Documento</label>
              <CustomSelect
                value={person.document_type || ''}
                onChange={(val) => setPerson({ ...person, document_type: val })}
                options={DOC_TYPE_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Nro. Documento</label>
              <input
                className="admin-input"
                placeholder="Ej. 8452190"
                value={person.document_number || ''}
                onChange={(e) => setPerson({ ...person, document_number: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Género</label>
              <CustomSelect
                value={person.gender || ''}
                onChange={(val) => setPerson({ ...person, gender: val })}
                options={GENDER_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Fecha Nacimiento</label>
              <input
                type="date"
                className="admin-input"
                value={person.birth_date || ''}
                onChange={(e) => setPerson({ ...person, birth_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="emp-form-section">
          <div className="emp-form-section-title">
            <span>2. Datos Laborales y Comisiones</span>
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={() => setAddingPos((prev) => !prev)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Nuevo cargo
            </button>
          </div>

          {addingPos && (
            <div className="emp-inline-add">
              <div className="admin-field">
                <label>Nombre del cargo</label>
                <input
                  className="admin-input admin-input-sm"
                  placeholder="Ej. Visual Merchandiser"
                  value={newPosName}
                  onChange={(e) => setNewPosName(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>Salario ref. (Bs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-input admin-input-sm"
                  placeholder="0.00"
                  value={newPosSalary}
                  onChange={(e) => setNewPosSalary(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-primary"
                disabled={posSaving || !newPosName.trim()}
                onClick={handleCreatePosition}
              >
                {posSaving ? 'Creando...' : 'Crear'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={() => setAddingPos(false)}
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Automático (ej. E0001)"
                value={employee.employee_code || ''}
                onChange={(e) =>
                  setEmployee({ ...employee, employee_code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="admin-field">
              <label>Cargo / Puesto</label>
              <CustomSelect
                value={employee.job_position_id || ''}
                onChange={(val) => setEmployee({ ...employee, job_position_id: val })}
                placeholder="Seleccionar cargo..."
                options={(meta.job_positions || []).map((jp) => ({
                  value: String(jp.id),
                  label: `${jp.name} (${jp.code})`,
                }))}
              />
            </div>
            <div className="admin-field">
              <label>Fecha de Ingreso</label>
              <input
                type="date"
                className="admin-input"
                value={employee.hire_date || ''}
                onChange={(e) => setEmployee({ ...employee, hire_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Tipo de Contrato</label>
              <CustomSelect
                value={employee.contract_type || 'full_time'}
                onChange={(val) => setEmployee({ ...employee, contract_type: val })}
                options={CONTRACT_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Estado Laboral</label>
              <CustomSelect
                value={employee.employment_status || 'active'}
                onChange={(val) => setEmployee({ ...employee, employment_status: val })}
                options={EMP_STATUS_OPTIONS}
              />
            </div>
            <div className="admin-field">
              <label>Salario Base (Bs.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="admin-input"
                placeholder="0.00"
                value={employee.base_salary ?? ''}
                onChange={(e) => setEmployee({ ...employee, base_salary: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Comisión por Venta (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="admin-input"
                placeholder="1"
                value={employee.commission_rate ?? ''}
                onChange={(e) => setEmployee({ ...employee, commission_rate: e.target.value })}
              />
            </div>
          </div>

          <div className="emp-commission-preview">
            Por cada venta de <strong>Bs. 1.000,00</strong> recibirá{' '}
            <strong>
              Bs. {sampleCommission} ({rateNum}%)
            </strong>
            .
          </div>

          <div className="admin-field">
            <label>Notas Laborales</label>
            <textarea
              className="admin-textarea"
              rows="2"
              placeholder="Observaciones de contrato, horario base o referencias..."
              value={employee.notes || ''}
              onChange={(e) => setEmployee({ ...employee, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="emp-form-section">
          <div className="emp-form-section-title">
            <span>3. Acceso y Rol en el Sistema</span>
            <label className="emp-switch-row">
              <span className="admin-switch">
                <input
                  type="checkbox"
                  checked={hasSystemAccess}
                  onChange={(e) => setHasSystemAccess(e.target.checked)}
                />
                <span className="admin-switch-slider" />
              </span>
              Habilitar acceso al sistema
            </label>
          </div>

          {hasSystemAccess ? (
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Correo de Acceso</label>
                <input
                  className="admin-input"
                  placeholder="empleado@safmoda.com"
                  value={account.email || ''}
                  onChange={(e) => setAccount({ ...account, email: e.target.value })}
                  required
                />
              </div>
              <div className="admin-field">
                <label>Usuario (Opcional)</label>
                <input
                  className="admin-input"
                  placeholder="Ej. crojas"
                  value={account.username || ''}
                  onChange={(e) => setAccount({ ...account, username: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>
                  {editingEmployee?.user ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                </label>
                <div className="emp-pass-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="admin-input"
                    placeholder={
                      editingEmployee?.user ? 'Dejar vacío para mantener' : 'Mínimo 4 caracteres'
                    }
                    value={account.password || ''}
                    onChange={(e) => setAccount({ ...account, password: e.target.value })}
                    required={!editingEmployee?.user}
                  />
                  <button
                    type="button"
                    className="emp-pass-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div className="admin-field">
                <label>Estado de Cuenta</label>
                <CustomSelect
                  value={account.status || 'active'}
                  onChange={(val) => setAccount({ ...account, status: val })}
                  options={ACCOUNT_STATUS_OPTIONS}
                />
              </div>
              <div className="admin-field">
                <label>Rol dentro del Sistema (Global)</label>
                <CustomSelect
                  value={systemRoleId}
                  onChange={setSystemRoleId}
                  options={[
                    { value: '', label: 'Sin rol global (solo por sucursal)' },
                    ...(meta.roles || []).map((r) => ({
                      value: String(r.id),
                      label: r.name,
                    })),
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="emp-section-note">
              Este empleado se registrará sin credenciales de inicio de sesión. Puedes habilitar el acceso en cualquier momento desde Editar.
            </div>
          )}
        </div>

        <div className="emp-form-section">
          <div className="emp-form-section-title">
            <span>4. Sucursales Asignadas y Rol por Sucursal</span>
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={handleAddBranchRow}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Agregar sucursal
            </button>
          </div>

          {branchAssignments.map((row, idx) => (
            <div key={idx} className={`emp-branch-row ${row.is_primary ? 'is-primary' : ''}`}>
              <div className="admin-field">
                <label>Sucursal</label>
                <CustomSelect
                  value={row.branch_id}
                  onChange={(val) => handleUpdateBranchRow(idx, 'branch_id', val)}
                  options={(meta.branches || []).map((b) => ({
                    value: String(b.id),
                    label: `${b.name} (${b.code})`,
                  }))}
                />
              </div>

              <div className="admin-field">
                <label>Rol en esta Sucursal</label>
                <CustomSelect
                  value={hasSystemAccess ? row.role_id : ''}
                  onChange={(val) => handleUpdateBranchRow(idx, 'role_id', val)}
                  placeholder={hasSystemAccess ? 'Sin rol específico...' : 'Requiere acceso'}
                  options={[
                    { value: '', label: hasSystemAccess ? 'Sin rol específico' : 'Sin acceso al sistema' },
                    ...(hasSystemAccess
                      ? (meta.roles || []).map((r) => ({
                          value: String(r.id),
                          label: r.name,
                        }))
                      : []),
                  ]}
                />
              </div>

              <div className="admin-field">
                <label>Asignado desde</label>
                <input
                  type="date"
                  className="admin-input"
                  value={row.assigned_from || ''}
                  onChange={(e) => handleUpdateBranchRow(idx, 'assigned_from', e.target.value)}
                />
              </div>

              <button
                type="button"
                className={`admin-btn admin-btn-sm ${row.is_primary ? 'admin-btn-primary' : ''}`}
                onClick={() => handleUpdateBranchRow(idx, 'is_primary', true)}
              >
                {row.is_primary ? 'Principal' : 'Hacer principal'}
              </button>

              {branchAssignments.length > 1 && (
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                  onClick={() => handleRemoveBranchRow(idx)}
                  aria-label="Quitar sucursal"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </form>
    </BaseModal>
  );
}
