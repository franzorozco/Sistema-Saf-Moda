import { useState } from 'react';
import CustomSelect from '../../../components/CustomSelect';
import { userService } from '../../../services/admin/userService';

const CONTRACT_OPTIONS = [
  { value: 'full_time', label: 'Tiempo completo' },
  { value: 'part_time', label: 'Medio tiempo' },
  { value: 'temporary', label: 'Temporal' },
  { value: 'internship', label: 'Pasantía' },
];

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'on_leave', label: 'Con licencia' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'terminated', label: 'Desvinculado' },
];

export default function EmployeeFormFields({
  value,
  onChange,
  jobPositions,
  branches,
  onJobPositionCreated,
}) {
  const [addingPosition, setAddingPosition] = useState(false);
  const [newPosName, setNewPosName] = useState('');
  const [newPosSalary, setNewPosSalary] = useState('');
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState('');

  const updateField = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  const toggleExtraBranch = (branchId) => {
    const id = Number(branchId);
    const current = value.branch_ids || [];
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    updateField('branch_ids', next);
  };

  const handleCreatePosition = async () => {
    if (!newPosName.trim() || posSaving) return;
    setPosSaving(true);
    setPosError('');
    try {
      const res = await userService.createJobPosition({
        name: newPosName.trim(),
        base_salary_ref: newPosSalary !== '' ? Number(newPosSalary) : null,
      });
      const created = res.data;
      onJobPositionCreated?.(created);
      updateField('job_position_id', String(created.id));
      setNewPosName('');
      setNewPosSalary('');
      setAddingPosition(false);
    } catch (err) {
      setPosError(err.message);
    } finally {
      setPosSaving(false);
    }
  };

  return (
    <div className="user-form-section">
      <div className="user-form-section-title">
        <span>Perfil Laboral (Empleado)</span>
        <button
          type="button"
          className="admin-btn admin-btn-sm admin-btn-ghost"
          onClick={() => setAddingPosition((prev) => !prev)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nuevo cargo
        </button>
      </div>

      {addingPosition && (
        <div className="user-inline-add">
          <div className="admin-field">
            <label>Nombre del cargo</label>
            <input
              className="admin-input admin-input-sm"
              placeholder="Ej. Estilista"
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
            onClick={() => setAddingPosition(false)}
          >
            Cancelar
          </button>
        </div>
      )}

      {posError && <div className="admin-alert">{posError}</div>}

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Código Empleado (Opcional)</label>
          <input
            className="admin-input"
            placeholder="Automático (ej. E0001)"
            value={value.employee_code || ''}
            onChange={(e) => updateField('employee_code', e.target.value.toUpperCase())}
          />
        </div>
        <div className="admin-field">
          <label>Cargo / Puesto</label>
          <CustomSelect
            value={value.job_position_id || ''}
            onChange={(val) => updateField('job_position_id', val)}
            placeholder="Seleccionar cargo..."
            options={jobPositions.map((jp) => ({
              value: String(jp.id),
              label: `${jp.name} (${jp.code})`,
            }))}
          />
        </div>
        <div className="admin-field">
          <label>Sucursal Principal</label>
          <CustomSelect
            value={value.primary_branch_id || ''}
            onChange={(val) => updateField('primary_branch_id', val)}
            placeholder="Seleccionar sucursal..."
            options={branches.map((b) => ({
              value: String(b.id),
              label: `${b.name} (${b.code})`,
            }))}
          />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Fecha de Ingreso</label>
          <input
            type="date"
            className="admin-input"
            value={value.hire_date || ''}
            onChange={(e) => updateField('hire_date', e.target.value)}
            required
          />
        </div>
        <div className="admin-field">
          <label>Tipo de Contrato</label>
          <CustomSelect
            value={value.contract_type || 'full_time'}
            onChange={(val) => updateField('contract_type', val)}
            options={CONTRACT_OPTIONS}
          />
        </div>
        <div className="admin-field">
          <label>Estado Laboral</label>
          <CustomSelect
            value={value.employment_status || 'active'}
            onChange={(val) => updateField('employment_status', val)}
            options={EMPLOYMENT_STATUS_OPTIONS}
          />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label>Salario Base (Bs.)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            placeholder="0.00"
            value={value.base_salary ?? ''}
            onChange={(e) => updateField('base_salary', e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label>Comisión (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="admin-input"
            placeholder="0"
            value={value.commission_rate ?? ''}
            onChange={(e) => updateField('commission_rate', e.target.value)}
          />
        </div>
      </div>

      {branches.length > 1 && (
        <div className="admin-field">
          <label>Sucursales adicionales habilitadas</label>
          <div className="axis-pills">
            {branches
              .filter((b) => String(b.id) !== String(value.primary_branch_id))
              .map((b) => {
                const selected = (value.branch_ids || []).includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`axis-pill ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleExtraBranch(b.id)}
                  >
                    {b.name}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <div className="admin-field">
        <label>Notas Laborales</label>
        <textarea
          className="admin-textarea"
          rows="2"
          placeholder="Observaciones de contrato, horario o referencias..."
          value={value.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
        />
      </div>
    </div>
  );
}
