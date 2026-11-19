import { useEffect, useState } from 'react';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const MOVEMENT_BADGE_MAP = {
  initial_stock: { label: 'Stock inicial', tone: 'is-ok' },
  purchase_in: { label: 'Compra', tone: 'is-ok' },
  return_in: { label: 'Devolución', tone: 'is-ok' },
  adjustment_in: { label: 'Ajuste (+)', tone: 'is-ok' },
  transfer_in: { label: 'Traslado (+)', tone: 'is-ok' },
  set_assembly_in: { label: 'Armado set', tone: 'is-ok' },
  sale_out: { label: 'Venta', tone: 'is-neutral' },
  adjustment_out: { label: 'Ajuste (-)', tone: 'is-low' },
  damaged_out: { label: 'Merma / Baja', tone: 'is-out' },
  transfer_out: { label: 'Traslado (-)', tone: 'is-low' },
  set_assembly_out: { label: 'Desarmado set', tone: 'is-low' },
};

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function InventoryMovementsTab({
  warehouses = [],
  movementTypes = [],
  metaLoading = false,
  globalBranchId = 'all',
  globalWarehouseId = 'all',
  refreshKey = 0,
}) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ count: 0, entries_units: 0, exits_units: 0, net_units: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState(globalWarehouseId);
  const [movementType, setMovementType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setWarehouseId(globalWarehouseId);
  }, [globalWarehouseId, globalBranchId]);

  const loadMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getMovements({
        branch_id: globalBranchId !== 'all' ? globalBranchId : undefined,
        warehouse_id: warehouseId !== 'all' ? warehouseId : undefined,
        movement_type: movementType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      setItems(res.data?.items || []);
      if (res.data?.summary) setSummary(res.data.summary);
    } catch (err) {
      setError(err.message || 'Error al cargar el Kardex.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [globalBranchId, warehouseId, movementType, dateFrom, dateTo, refreshKey]);

  const scopedWarehouses =
    globalBranchId === 'all'
      ? warehouses
      : warehouses.filter((w) => String(w.branch_id) === String(globalBranchId));

  const warehouseOptions = [
    { value: 'all', label: globalBranchId === 'all' ? 'Todos los almacenes' : 'Todos en esta sucursal' },
    ...scopedWarehouses.map((w) => ({
      value: String(w.id),
      label: `${w.branch_code || ''} · ${w.code} ${w.name}`.trim(),
    })),
  ];

  const typeOptions = [
    { value: '', label: 'Todos los movimientos' },
    ...movementTypes.map((m) => ({ value: m.value, label: m.label })),
  ];

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadMovements();
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Kardex e Historial de Movimientos</h2>
          <p className="admin-subtext">
            Trazabilidad completa de ingresos, salidas, ajustes físicos, mermas y traslados con justificación.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-sm" onClick={loadMovements} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar Kardex'}
        </button>
      </div>

      <form className="inv-kardex-filters" onSubmit={handleFilterSubmit}>
        <div className="admin-field">
          <label>Buscar SKU, producto o justificación</label>
          <input
            type="text"
            className="admin-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: P0001-01, compra, dañada..."
          />
        </div>

        <div className="admin-field">
          <label>Almacén</label>
          <CustomSelect
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouseOptions}
            loading={metaLoading}
            loadingText="Cargando almacenes..."
          />
        </div>

        <div className="admin-field">
          <label>Tipo de movimiento</label>
          <CustomSelect
            value={movementType}
            onChange={setMovementType}
            options={typeOptions}
            loading={metaLoading}
            loadingText="Cargando tipos..."
          />
        </div>

        <div className="admin-field">
          <label>Desde</label>
          <input
            type="date"
            className="admin-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="admin-field">
          <label>Hasta</label>
          <input
            type="date"
            className="admin-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="admin-field">
          <button type="submit" className="admin-btn admin-btn-primary">
            Buscar
          </button>
        </div>
      </form>

      <div className="inv-kardex-summary">
        <span>
          Registros: <strong>{summary.count}</strong>
        </span>
        <span>
          Total entradas: <strong className="inv-delta-pos">+{summary.entries_units} u.</strong>
        </span>
        <span>
          Total salidas: <strong className="inv-delta-neg">-{summary.exits_units} u.</strong>
        </span>
        <span>
          Balance neto: <strong>{summary.net_units >= 0 ? `+${summary.net_units}` : summary.net_units} u.</strong>
        </span>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Almacén</th>
              <th>Producto / Variante</th>
              <th>Tipo</th>
              <th className="is-right">Cant.</th>
              <th className="is-right">Saldo Final</th>
              <th className="is-right">Costo Unit.</th>
              <th>Usuario</th>
              <th>Justificación / Nota</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="admin-empty">
                    No hay movimientos registrados con los filtros actuales.
                  </div>
                </td>
              </tr>
            ) : (
              items.map((mov) => {
                const badge = MOVEMENT_BADGE_MAP[mov.movement_type] || {
                  label: mov.movement_type,
                  tone: 'is-neutral',
                };
                return (
                  <tr key={mov.id}>
                    <td>{formatDateTime(mov.created_at)}</td>
                    <td>
                      <div>
                        <strong>{mov.branch_code || '-'}</strong> · {mov.warehouse_code}
                      </div>
                      <div className="admin-subtext">{mov.branch_name || mov.warehouse_name}</div>
                    </td>
                    <td>
                      <div>
                        <strong>{mov.product_name || 'Producto'}</strong>
                      </div>
                      <div className="admin-subtext">
                        {mov.sku} · {mov.variant_label}
                      </div>
                    </td>
                    <td>
                      <span className={`inv-stock-badge ${badge.tone}`}>{badge.label}</span>
                    </td>
                    <td className="is-right">
                      <span className={mov.quantity > 0 ? 'inv-delta-pos' : 'inv-delta-neg'}>
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </span>
                    </td>
                    <td className="is-right">
                      <strong>{mov.balance_after}</strong>
                    </td>
                    <td className="is-right">Bs. {Number(mov.unit_cost || 0).toFixed(2)}</td>
                    <td>{mov.performed_by_name}</td>
                    <td>{mov.notes || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
