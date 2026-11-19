import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import CustomerFormFields from './CustomerFormFields';
import EmployeeFormFields from './EmployeeFormFields';
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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'locked', label: 'Bloqueado' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildEmptyEmployee(meta) {
  return {
    employee_code: '',
    job_position_id: meta?.job_positions?.[0]?.id ? String(meta.job_positions[0].id) : '',
    primary_branch_id: meta?.branches?.[0]?.id ? String(meta.branches[0].id) : '',
    hire_date: todayISO(),
    contract_type: 'full_time',
    base_salary: '',
    commission_rate: '0',
    employment_status: 'active',
    branch_ids: [],
    notes: '',
  };
}

function buildEmptyCustomer(meta) {
  return {
    customer_code: '',
    customer_tier: 'regular',
    store_credit: '0',
    accepts_marketing: false,
    acquired_branch_id: meta?.branches?.[0]?.id ? String(meta.branches[0].id) : '',
    is_active: true,
    notes: '',
    address: {
      city: '',
      address_line1: '',
      reference_notes: '',
    },
  };
}

export default function UserFormModal({
  isOpen,
  editingUser,
  meta,
  onClose,
  onSaved,
  onJobPositionCreated,
}) {
  const [userType, setUserType] = useState('employee');
  const [person, setPerson] = useState({});
  const [account, setAccount] = useState({});
  const [employee, setEmployee] = useState({});
  const [customer, setCustomer] = useState({});
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setShowPassword(false);
    setError('');

    if (editingUser) {
      const p = editingUser.person || {};
      const emp = editingUser.employee;
      const cust = editingUser.customer;

      setUserType(
        editingUser.user_type === 'system'
          ? 'employee'
          : editingUser.user_type || 'employee'
      );

      setPerson({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        document_type: p.document_type || '',
        document_number: p.document_number || '',
        phone: p.phone || '',
        birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : '',
        gender: p.gender || '',
      });

      setAccount({
        email: editingUser.email || '',
        username: editingUser.username || '',
        password: '',
        status: editingUser.status || 'active',
      });

      if (emp) {
        setEmployee({
          employee_code: emp.employee_code || '',
          job_position_id: emp.job_position_id ? String(emp.job_position_id) : '',
          primary_branch_id: emp.primary_branch_id ? String(emp.primary_branch_id) : '',
          hire_date: emp.hire_date ? String(emp.hire_date).slice(0, 10) : todayISO(),
          contract_type: emp.contract_type || 'full_time',
          base_salary: emp.base_salary !== null ? String(emp.base_salary) : '',
          commission_rate: emp.commission_rate !== null ? String(emp.commission_rate) : '0',
          employment_status: emp.employment_status || 'active',
          branch_ids: (emp.branches || [])
            .map((b) => b.id)
            .filter((id) => id !== emp.primary_branch_id),
          notes: emp.notes || '',
        });
      } else {
        setEmployee(buildEmptyEmployee(meta));
      }

      if (cust) {
        const defaultAddr = cust.customer_addresses?.[0] || {};
        setCustomer({
          customer_code: cust.customer_code || '',
          customer_tier: cust.customer_tier || 'regular',
          store_credit: cust.store_credit !== null ? String(cust.store_credit) : '0',
          accepts_marketing: !!cust.accepts_marketing,
          acquired_branch_id: cust.acquired_branch_id ? String(cust.acquired_branch_id) : '',
          is_active: cust.is_active !== false,
          notes: cust.notes || '',
          address: {
            city: defaultAddr.city || '',
            address_line1: defaultAddr.address_line1 || '',
            reference_notes: defaultAddr.reference_notes || '',
          },
        });
      } else {
        setCustomer(buildEmptyCustomer(meta));
      }

      setRoles(
        (editingUser.user_roles || []).map((ur) => ({
          role_id: String(ur.role_id),
          branch_id: ur.branch_id ? String(ur.branch_id) : '',
        }))
      );
    } else {
      setUserType('employee');
      setPerson({
        first_name: '',
        last_name: '',
        document_type: 'CI',
        document_number: '',
        phone: '',
        birth_date: '',
        gender: '',
      });
      setAccount({
        email: '',
        username: '',
        password: '',
        status: 'active',
      });
      setEmployee(buildEmptyEmployee(meta));
      setCustomer(buildEmptyCustomer(meta));

      const defaultSellerRole = meta?.roles?.find((r) => r.code === 'seller') || meta?.roles?.[0];
      setRoles(
        defaultSellerRole
          ? [{ role_id: String(defaultSellerRole.id), branch_id: '' }]
          : []
      );
    }
  }, [isOpen, editingUser, meta]);

  const handleAddRoleRow = () => {
    const firstRole = meta?.roles?.[0];
    if (!firstRole) return;
    setRoles((prev) => [...prev, { role_id: String(firstRole.id), branch_id: '' }]);
  };

  const handleUpdateRoleRow = (index, field, val) => {
    setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: val } : r)));
  };

  const handleRemoveRoleRow = (index) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      const payload = {
        user_type: userType,
        person,
        account,
        roles: roles
          .filter((r) => Boolean(r.role_id))
          .map((r) => ({
            role_id: Number(r.role_id),
            branch_id: r.branch_id ? Number(r.branch_id) : null,
          })),
      };

      if (userType === 'employee' || userType === 'both') {
        payload.employee = {
          ...employee,
          job_position_id: employee.job_position_id ? Number(employee.job_position_id) : '',
          primary_branch_id: employee.primary_branch_id ? Number(employee.primary_branch_id) : '',
          base_salary: employee.base_salary !== '' ? Number(employee.base_salary) : 0,
          commission_rate: employee.commission_rate !== '' ? Number(employee.commission_rate) : 0,
        };
      }

      if (userType === 'customer' || userType === 'both') {
        payload.customer = {
          ...customer,
          acquired_branch_id: customer.acquired_branch_id
            ? Number(customer.acquired_branch_id)
            : null,
          store_credit: customer.store_credit !== '' ? Number(customer.store_credit) : 0,
        };
      }

      const res = editingUser
        ? await userService.update(editingUser.id, payload)
        : await userService.create(payload);

      onSaved(res.data, !!editingUser);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isDualProfile = editingUser?.user_type === 'both';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow={editingUser ? 'Editar Usuario' : 'Nuevo Registro'}
      title={
        editingUser
          ? `${editingUser.person?.first_name || ''} ${editingUser.person?.last_name || ''}`.trim() ||
            editingUser.email
          : 'Registrar Usuario'
      }
      size="xl"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </>
      }
    >
      <form id="user-form" className="admin-form" onSubmit={handleSubmit}>
        {error && <div className="admin-alert">{error}</div>}

        <div className="user-form-section">
          <div className="user-form-section-title">
            <span>1. Tipo de Usuario</span>
          </div>

          <div className="user-type-picker">
            <button
              type="button"
              className={`user-type-card ${userType === 'employee' || userType === 'both' ? 'is-selected' : ''}`}
              disabled={isDualProfile}
              onClick={() => setUserType('employee')}
            >
              <span className="user-type-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                </svg>
              </span>
              <span className="user-type-card-body">
                <strong>Empleado / Equipo</strong>
                <span>Personal de tienda, caja, almacén o administración.</span>
              </span>
            </button>

            <button
              type="button"
              className={`user-type-card ${userType === 'customer' || userType === 'both' ? 'is-selected' : ''}`}
              disabled={isDualProfile}
              onClick={() => setUserType('customer')}
            >
              <span className="user-type-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="user-type-card-body">
                <strong>Cliente</strong>
                <span>Compradora de tienda/web con nivel y crédito.</span>
              </span>
            </button>
          </div>
        </div>

        <div className="user-form-section">
          <div className="user-form-section-title">
            <span>2. Datos Personales</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Nombre</label>
              <input
                className="admin-input"
                placeholder="Ej. Valeria"
                value={person.first_name || ''}
                onChange={(e) => setPerson({ ...person, first_name: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Apellido</label>
              <input
                className="admin-input"
                placeholder="Ej. Mendoza"
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

        <div className="user-form-section">
          <div className="user-form-section-title">
            <span>3. Cuenta de Acceso</span>
          </div>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Correo Electrónico</label>
              <input
                className="admin-input"
                placeholder="usuario@safmoda.com"
                value={account.email || ''}
                onChange={(e) => setAccount({ ...account, email: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>Usuario (Opcional)</label>
              <input
                className="admin-input"
                placeholder="Ej. vmendoza"
                value={account.username || ''}
                onChange={(e) => setAccount({ ...account, username: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>{editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}</label>
              <div className="user-pass-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="admin-input"
                  placeholder={editingUser ? 'Dejar vacío para mantener' : 'Mínimo 4 caracteres'}
                  value={account.password || ''}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  required={!editingUser}
                />
                <button
                  type="button"
                  className="user-pass-toggle"
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
                options={STATUS_OPTIONS}
              />
            </div>
          </div>
        </div>

        {(userType === 'employee' || userType === 'both') && (
          <EmployeeFormFields
            value={employee}
            onChange={setEmployee}
            jobPositions={meta.job_positions || []}
            branches={meta.branches || []}
            onJobPositionCreated={onJobPositionCreated}
          />
        )}

        {(userType === 'customer' || userType === 'both') && (
          <CustomerFormFields
            value={customer}
            onChange={setCustomer}
            branches={meta.branches || []}
          />
        )}

        <div className="user-form-section">
          <div className="user-form-section-title">
            <span>Roles Asignados</span>
            <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={handleAddRoleRow}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Agregar rol
            </button>
          </div>

          {roles.length === 0 ? (
            <p className="admin-subtext">
              Sin roles asignados (ideal para clientes sin acceso administrativo).
            </p>
          ) : (
            roles.map((row, idx) => (
              <div key={idx} className="role-row">
                <div className="admin-field">
                  <label>Rol</label>
                  <CustomSelect
                    value={row.role_id}
                    onChange={(val) => handleUpdateRoleRow(idx, 'role_id', val)}
                    placeholder="Elegir rol..."
                    options={(meta.roles || []).map((r) => ({
                      value: String(r.id),
                      label: r.name,
                    }))}
                  />
                </div>
                <div className="admin-field">
                  <label>Alcance / Sucursal</label>
                  <CustomSelect
                    value={row.branch_id}
                    onChange={(val) => handleUpdateRoleRow(idx, 'branch_id', val)}
                    options={[
                      { value: '', label: 'Global (Todas las sucursales)' },
                      ...(meta.branches || []).map((b) => ({
                        value: String(b.id),
                        label: `${b.name} (${b.code})`,
                      })),
                    ]}
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                  onClick={() => handleRemoveRoleRow(idx)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quitar
                </button>
              </div>
            ))
          )}
        </div>
      </form>
    </BaseModal>
  );
}
