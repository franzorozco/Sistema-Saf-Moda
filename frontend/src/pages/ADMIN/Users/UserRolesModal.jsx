import { useEffect, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import CustomSelect from '../../../components/CustomSelect';
import { userService } from '../../../services/admin/userService';

export default function UserRolesModal({ user, roles, branches, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const currentRoles = (user.user_roles || []).map((ur) => ({
      role_id: String(ur.role_id),
      branch_id: ur.branch_id ? String(ur.branch_id) : '',
    }));
    setRows(currentRoles);
    setError('');
  }, [user]);

  const handleAddRow = () => {
    const defaultRoleId = roles[0]?.id ? String(roles[0].id) : '';
    setRows((prev) => [...prev, { role_id: defaultRoleId, branch_id: '' }]);
  };

  const handleUpdateRow = (index, field, val) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: val } : r)));
  };

  const handleRemoveRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = rows
        .filter((r) => Boolean(r.role_id))
        .map((r) => ({
          role_id: Number(r.role_id),
          branch_id: r.branch_id ? Number(r.branch_id) : null,
        }));
      const res = await userService.syncRoles(user.id, payload);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fullName = user?.person
    ? `${user.person.first_name} ${user.person.last_name}`
    : user?.email || '';

  return (
    <BaseModal
      isOpen={!!user}
      onClose={onClose}
      eyebrow="Control de Acceso (RBAC)"
      title={`Roles — ${fullName}`}
      size="wide"
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Guardando...' : 'Guardar Roles'}
          </button>
        </>
      }
    >
      <div className="admin-form">
        {error && <div className="admin-alert">{error}</div>}

        <div className="admin-panel-header">
          <span>Asigna uno o más roles globales o por sucursal.</span>
          <button type="button" className="admin-btn admin-btn-sm" onClick={handleAddRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Agregar rol
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="admin-empty">Sin roles asignados. Haz clic en "+ Agregar rol".</p>
        ) : (
          rows.map((row, idx) => (
            <div key={idx} className="role-row">
              <div className="admin-field">
                <label>Rol</label>
                <CustomSelect
                  value={row.role_id}
                  onChange={(val) => handleUpdateRow(idx, 'role_id', val)}
                  placeholder="Elegir rol..."
                  options={roles.map((r) => ({
                    value: String(r.id),
                    label: r.name,
                  }))}
                />
              </div>

              <div className="admin-field">
                <label>Sucursal / Alcance</label>
                <CustomSelect
                  value={row.branch_id}
                  onChange={(val) => handleUpdateRow(idx, 'branch_id', val)}
                  options={[
                    { value: '', label: 'Global (Todas las sucursales)' },
                    ...branches.map((b) => ({
                      value: String(b.id),
                      label: `${b.name} (${b.code})`,
                    })),
                  ]}
                />
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                onClick={() => handleRemoveRow(idx)}
                aria-label="Quitar rol"
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
    </BaseModal>
  );
}
