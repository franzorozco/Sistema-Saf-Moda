import { useEffect, useMemo, useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import ConfirmModal from '../../../components/ConfirmModal';
import CustomSelect from '../../../components/CustomSelect';
import { inventoryService } from '../../../services/admin/inventoryService';

const BRANCH_TYPE_LABELS = {
  retail: 'Tienda / Sucursal',
  warehouse: 'Depósito / Almacén',
  hybrid: 'Tienda + Depósito',
  online_hub: 'Centro Online',
};

const WAREHOUSE_TYPE_LABELS = {
  sales_floor: 'Piso de Venta',
  backroom: 'Trastienda / Depósito',
  central_storage: 'Almacén Central',
  transit: 'En Tránsito',
};

const TRANSFER_STATUS = {
  draft: { label: 'Borrador', tone: 'is-neutral' },
  in_transit: { label: 'En tránsito', tone: 'is-low' },
  partial: { label: 'Parcial', tone: 'is-overstock' },
  received: { label: 'Recibido', tone: 'is-ok' },
  cancelled: { label: 'Cancelado', tone: 'is-out' },
};

function formatDate(iso) {
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

export default function WarehousesTransfersTab({
  branches = [],
  productsList = [],
  metaLoading = false,
  globalBranchId = 'all',
  onInventoryChanged,
  openNewTransferTrigger = 0,
  openNewBranchTrigger = 0,
}) {
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Branch modal
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [brCode, setBrCode] = useState('');
  const [brName, setBrName] = useState('');
  const [brType, setBrType] = useState('retail');
  const [brCity, setBrCity] = useState('Santa Cruz');
  const [brAddress, setBrAddress] = useState('');
  const [brPhone, setBrPhone] = useState('');
  const [brIsMain, setBrIsMain] = useState(false);
  const [brIsActive, setBrIsActive] = useState(true);
  const [brCreateWh, setBrCreateWh] = useState(true);
  const [brSaving, setBrSaving] = useState(false);
  const [brError, setBrError] = useState('');

  // Warehouse modal
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [whBranchId, setWhBranchId] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState('backroom');
  const [whDefault, setWhDefault] = useState(false);
  const [whActive, setWhActive] = useState(true);
  const [whSaving, setWhSaving] = useState(false);
  const [whError, setWhError] = useState('');

  // Transfer modal
  const [trfModalOpen, setTrfModalOpen] = useState(false);
  const [sourceWhId, setSourceWhId] = useState('');
  const [targetWhId, setTargetWhId] = useState('');
  const [trfNotes, setTrfNotes] = useState('');
  const [shipImmediately, setShipImmediately] = useState(true);
  const [trfItems, setTrfItems] = useState([{ variant_id: '', quantity_requested: '1' }]);
  const [trfSaving, setTrfSaving] = useState(false);
  const [trfError, setTrfError] = useState('');

  // Action ConfirmModal state
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [whRes, trfRes] = await Promise.all([
        inventoryService.getWarehouses(),
        inventoryService.getTransfers({
          branch_id: globalBranchId !== 'all' ? globalBranchId : undefined,
        }),
      ]);
      setWarehouses(whRes.data?.items || []);
      setTransfers(trfRes.data?.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar sucursales, almacenes y traslados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [globalBranchId]);

  useEffect(() => {
    if (openNewTransferTrigger > 0) {
      openTransferModal();
    }
  }, [openNewTransferTrigger]);

  useEffect(() => {
    if (openNewBranchTrigger > 0) {
      openBranchModal(null);
    }
  }, [openNewBranchTrigger]);

  const activeWarehouses = useMemo(() => warehouses.filter((w) => w.is_active), [warehouses]);

  const displayedWarehouses = useMemo(() => {
    if (globalBranchId === 'all') return warehouses;
    return warehouses.filter((w) => String(w.branch_id) === String(globalBranchId));
  }, [warehouses, globalBranchId]);

  const allVariantOptions = useMemo(() => {
    const opts = [];
    productsList.forEach((p) => {
      (p.variants || []).forEach((v) => {
        const srcStock = (v.warehouse_breakdown || []).find(
          (b) => String(b.warehouse_id) === String(sourceWhId)
        );
        const avail = srcStock ? srcStock.available : 0;
        opts.push({
          value: String(v.id),
          label: `${v.sku} · ${p.name} (${v.variant_label}) · Disp. origen: ${avail}`,
        });
      });
    });
    return opts;
  }, [productsList, sourceWhId]);

  const openBranchModal = (br = null) => {
    setEditingBranch(br);
    setBrCode(br ? br.code : '');
    setBrName(br ? br.name : '');
    setBrType(br ? br.branch_type : 'retail');
    setBrCity(br ? br.city : 'Santa Cruz');
    setBrAddress(br ? br.address_line : '');
    setBrPhone(br ? br.phone || '' : '');
    setBrIsMain(br ? Boolean(br.is_main) : false);
    setBrIsActive(br ? Boolean(br.is_active) : true);
    setBrCreateWh(true);
    setBrError('');
    setBranchModalOpen(true);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!brName.trim() || !brCity.trim() || !brAddress.trim()) {
      setBrError('Nombre, ciudad y dirección son obligatorios.');
      return;
    }

    setBrSaving(true);
    setBrError('');
    try {
      const payload = {
        code: brCode.trim() || null,
        name: brName.trim(),
        branch_type: brType,
        city: brCity.trim(),
        address_line: brAddress.trim(),
        phone: brPhone.trim() || null,
        is_main: brIsMain,
        is_active: brIsActive,
        create_default_warehouse: brCreateWh,
      };
      if (editingBranch) {
        await inventoryService.updateBranch(editingBranch.id, payload);
      } else {
        await inventoryService.createBranch(payload);
      }
      setBranchModalOpen(false);
      await loadData();
      await onInventoryChanged?.();
    } catch (err) {
      setBrError(err.message || 'No se pudo guardar la sucursal.');
    } finally {
      setBrSaving(false);
    }
  };

  const openWarehouseModal = (wh = null) => {
    setEditingWh(wh);
    const defaultBr =
      globalBranchId !== 'all' ? String(globalBranchId) : String(branches[0]?.id || '');
    setWhBranchId(wh ? String(wh.branch_id) : defaultBr);
    setWhCode(wh ? wh.code : '');
    setWhName(wh ? wh.name : '');
    setWhType(wh ? wh.warehouse_type : 'backroom');
    setWhDefault(wh ? Boolean(wh.is_default) : false);
    setWhActive(wh ? Boolean(wh.is_active) : true);
    setWhError('');
    setWhModalOpen(true);
  };

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    if (!whBranchId || !whName.trim()) {
      setWhError('Sucursal y nombre del almacén son obligatorios.');
      return;
    }

    setWhSaving(true);
    setWhError('');
    try {
      const payload = {
        branch_id: Number(whBranchId),
        code: whCode.trim() || null,
        name: whName.trim(),
        warehouse_type: whType,
        is_default: whDefault,
        is_active: whActive,
      };
      if (editingWh) {
        await inventoryService.updateWarehouse(editingWh.id, payload);
      } else {
        await inventoryService.createWarehouse(payload);
      }
      setWhModalOpen(false);
      await loadData();
      await onInventoryChanged?.();
    } catch (err) {
      setWhError(err.message || 'No se pudo guardar el almacén.');
    } finally {
      setWhSaving(false);
    }
  };

  const openTransferModal = () => {
    const preferredSrc =
      globalBranchId !== 'all'
        ? activeWarehouses.find((w) => String(w.branch_id) === String(globalBranchId)) || activeWarehouses[0]
        : activeWarehouses[0];
    const preferredTgt = activeWarehouses.find((w) => w.id !== preferredSrc?.id) || null;

    setSourceWhId(preferredSrc ? String(preferredSrc.id) : '');
    setTargetWhId(preferredTgt ? String(preferredTgt.id) : '');
    setTrfNotes('');
    setShipImmediately(true);
    setTrfItems([{ variant_id: '', quantity_requested: '1' }]);
    setTrfError('');
    setTrfModalOpen(true);
  };

  const addTransferRow = () => {
    setTrfItems((prev) => [...prev, { variant_id: '', quantity_requested: '1' }]);
  };

  const removeTransferRow = (idx) => {
    setTrfItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTransferRow = (idx, field, value) => {
    setTrfItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!sourceWhId || !targetWhId || sourceWhId === targetWhId) {
      setTrfError('Debes seleccionar un almacén/sucursal de origen y otro de destino distintos.');
      return;
    }

    const cleanItems = trfItems
      .filter((r) => r.variant_id && parseInt(r.quantity_requested || '0', 10) > 0)
      .map((r) => ({
        variant_id: Number(r.variant_id),
        quantity_requested: parseInt(r.quantity_requested, 10),
      }));

    if (cleanItems.length === 0) {
      setTrfError('Agrega al menos una variante con cantidad mayor a cero.');
      return;
    }

    if (trfNotes.trim().length < 4) {
      setTrfError('La justificación del traslado es obligatoria (mínimo 4 caracteres).');
      return;
    }

    setTrfSaving(true);
    setTrfError('');
    try {
      await inventoryService.createTransfer({
        source_warehouse_id: Number(sourceWhId),
        target_warehouse_id: Number(targetWhId),
        notes: trfNotes.trim(),
        ship_immediately: shipImmediately,
        items: cleanItems,
      });
      setTrfModalOpen(false);
      await loadData();
      await onInventoryChanged?.();
    } catch (err) {
      setTrfError(err.message || 'No se pudo registrar el traslado.');
    } finally {
      setTrfSaving(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setActionSaving(true);
    setError('');
    try {
      const { type, transfer } = confirmAction;
      if (type === 'ship') {
        await inventoryService.shipTransfer(transfer.id);
      } else if (type === 'receive') {
        await inventoryService.receiveTransfer(transfer.id, {});
      } else if (type === 'cancel') {
        await inventoryService.cancelTransfer(transfer.id);
      }
      setConfirmAction(null);
      await loadData();
      await onInventoryChanged?.();
    } catch (err) {
      setConfirmAction(null);
      setError(err.message || 'No se pudo ejecutar la acción sobre el traslado.');
    } finally {
      setActionSaving(false);
    }
  };

  const confirmDialogConfig = useMemo(() => {
    if (!confirmAction) return {};
    const { type, transfer } = confirmAction;
    if (type === 'ship') {
      return {
        eyebrow: 'Despacho de Traslado',
        title: `¿Despachar ${transfer.transfer_number}?`,
        message: `Se descontará el stock desde ${transfer.source_branch_name} (${transfer.source_warehouse_code}) y quedará en tránsito hacia ${transfer.target_branch_name} (${transfer.target_warehouse_code}).`,
        confirmLabel: actionSaving ? 'Despachando...' : 'Despachar Ahora',
        variant: 'primary',
      };
    }
    if (type === 'receive') {
      return {
        eyebrow: 'Recepción en Destino',
        title: `¿Confirmar recepción de ${transfer.transfer_number}?`,
        message: `Se ingresarán todas las unidades despachadas en ${transfer.target_branch_name} (${transfer.target_warehouse_code}).`,
        confirmLabel: actionSaving ? 'Recibiendo...' : 'Recibir Todo',
        variant: 'primary',
      };
    }
    return {
      eyebrow: 'Cancelación de Traslado',
      title: `¿Cancelar ${transfer.transfer_number}?`,
      message:
        transfer.status === 'in_transit'
          ? `Las unidades enviadas se reintegrarán automáticamente a ${transfer.source_branch_name} (${transfer.source_warehouse_code}).`
          : 'El borrador pasará a estado Cancelado sin afectar existencias.',
      confirmLabel: actionSaving ? 'Cancelando...' : 'Sí, cancelar',
      variant: 'danger',
    };
  }, [confirmAction, actionSaving]);

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Sucursales, Almacenes y Traslados</h2>
          <p className="admin-subtext">
            Cada sucursal administra su propio stock; el catálogo es global de la marca y las existencias se mueven mediante traslados auditados.
          </p>
        </div>

        <div className="admin-actions-row">
          <button type="button" className="admin-btn" onClick={() => openBranchModal(null)}>
            + Nueva Sucursal
          </button>
          <button type="button" className="admin-btn" onClick={() => openWarehouseModal(null)}>
            + Nuevo Almacén
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={openTransferModal}
            disabled={activeWarehouses.length < 2}
          >
            + Nuevo Traslado
          </button>
        </div>
      </div>

      {error && <div className="admin-alert is-error">{error}</div>}

      {activeWarehouses.length < 2 && (
        <div className="admin-alert is-warn">
          Actualmente tienes {activeWarehouses.length} ubicación de stock activa. Registra tus otras sucursales (con <strong>+ Nueva Sucursal</strong>) o un almacén adicional para habilitar traslados de mercadería entre sucursales.
        </div>
      )}

      <div className="inv-divider-title">
        <h3>Sucursales Registradas ({branches.length})</h3>
      </div>

      <div className="inv-wh-grid">
        {branches.map((br) => (
          <article key={br.id} className="inv-wh-card">
            <div className="inv-wh-card-top">
              <div>
                <div className="inv-wh-card-name">
                  <span className="admin-code-tag">{br.code}</span> {br.name}
                </div>
                <div className="inv-wh-card-meta">
                  {br.city} · {BRANCH_TYPE_LABELS[br.branch_type] || br.branch_type}
                </div>
                {br.address_line && <div className="inv-wh-card-meta">{br.address_line}</div>}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={() => openBranchModal(br)}
              >
                Editar
              </button>
            </div>

            <div className="inv-attr-chips">
              {br.is_main && <span className="inv-stock-badge is-ok">Casa Matriz</span>}
              <span className={`inv-stock-badge ${br.is_active ? 'is-neutral' : 'is-out'}`}>
                {br.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>

            <div className="inv-wh-card-stats">
              <span>{br.warehouses_count} almacén(es)</span>
              <strong>{br.total_units} unidades en stock</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="inv-divider-title">
        <h3>
          Almacenes {globalBranchId === 'all' ? '(Todas las sucursales)' : '(Sucursal seleccionada)'}
        </h3>
      </div>

      <div className="inv-wh-grid">
        {displayedWarehouses.map((wh) => (
          <article key={wh.id} className="inv-wh-card">
            <div className="inv-wh-card-top">
              <div>
                <div className="inv-wh-card-name">
                  <span className="admin-code-tag">{wh.code}</span> {wh.name}
                </div>
                <div className="inv-wh-card-meta">
                  {wh.branch_code} · {wh.branch_name} · {WAREHOUSE_TYPE_LABELS[wh.warehouse_type] || wh.warehouse_type}
                </div>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={() => openWarehouseModal(wh)}
              >
                Editar
              </button>
            </div>

            <div className="inv-attr-chips">
              {wh.is_default && <span className="inv-stock-badge is-ok">Principal</span>}
              <span className={`inv-stock-badge ${wh.is_active ? 'is-neutral' : 'is-out'}`}>
                {wh.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="inv-wh-card-stats">
              <span>{wh.variant_rows} variantes registradas</span>
              <strong>{wh.total_units} unidades</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="inv-divider-title">
        <h3>Historial de Traslados entre Sucursales y Almacenes</h3>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>N° Traslado</th>
              <th>Origen → Destino</th>
              <th>Estado</th>
              <th>Detalle de Variantes</th>
              <th>Responsable / Fecha</th>
              <th>Justificación</th>
              <th className="is-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!loading && transfers.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="admin-empty">
                    No existen traslados registrados para esta vista.
                  </div>
                </td>
              </tr>
            ) : (
              transfers.map((trf) => {
                const badge = TRANSFER_STATUS[trf.status] || {
                  label: trf.status,
                  tone: 'is-neutral',
                };
                return (
                  <tr key={trf.id}>
                    <td>
                      <span className="admin-code-tag">{trf.transfer_number}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{trf.source_branch_name || trf.source_warehouse_code}</strong> →{' '}
                        <strong>{trf.target_branch_name || trf.target_warehouse_code}</strong>
                      </div>
                      <div className="admin-subtext">
                        {trf.source_branch_code} ({trf.source_warehouse_code}) → {trf.target_branch_code} ({trf.target_warehouse_code})
                      </div>
                    </td>
                    <td>
                      <span className={`inv-stock-badge ${badge.tone}`}>{badge.label}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{trf.total_requested_units} u.</strong> ({(trf.items || []).length} SKUs)
                      </div>
                      <div className="admin-subtext">
                        {(trf.items || [])
                          .slice(0, 2)
                          .map((i) => `${i.sku} (${i.quantity_requested})`)
                          .join(', ')}
                        {(trf.items || []).length > 2 ? '…' : ''}
                      </div>
                    </td>
                    <td>
                      <div>{trf.requested_by_name || 'Sistema'}</div>
                      <div className="admin-subtext">{formatDate(trf.created_at)}</div>
                    </td>
                    <td>{trf.notes || '-'}</td>
                    <td className="is-right">
                      <div className="inv-row-actions">
                        {trf.status === 'draft' && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-primary"
                            onClick={() => setConfirmAction({ type: 'ship', transfer: trf })}
                          >
                            Despachar
                          </button>
                        )}
                        {['in_transit', 'partial'].includes(trf.status) && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-primary"
                            onClick={() => setConfirmAction({ type: 'receive', transfer: trf })}
                          >
                            Recibir
                          </button>
                        )}
                        {['draft', 'in_transit'].includes(trf.status) && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                            onClick={() => setConfirmAction({ type: 'cancel', transfer: trf })}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Sucursal */}
      <BaseModal
        isOpen={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        eyebrow="Ubicaciones de la Marca"
        title={editingBranch ? `Editar Sucursal · ${editingBranch.code}` : 'Nueva Sucursal'}
        size="wide"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setBranchModalOpen(false)} disabled={brSaving}>
              Cancelar
            </button>
            <button
              type="submit"
              form="branch-form"
              className="admin-btn admin-btn-primary"
              disabled={brSaving}
            >
              {brSaving ? 'Guardando...' : 'Guardar Sucursal'}
            </button>
          </>
        }
      >
        {brError && <div className="admin-alert is-error">{brError}</div>}

        <form id="branch-form" className="admin-form" onSubmit={handleSaveBranch}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Código (opcional si es nueva)</label>
              <input
                type="text"
                maxLength={30}
                className="admin-input"
                value={brCode}
                onChange={(e) => setBrCode(e.target.value)}
                placeholder="Automático (SUC-02)"
              />
            </div>

            <div className="admin-field">
              <label>Nombre de la sucursal *</label>
              <input
                type="text"
                maxLength={150}
                className="admin-input"
                value={brName}
                onChange={(e) => setBrName(e.target.value)}
                placeholder="Ej: SafModa Equipetrol / Sucursal Norte"
                required
              />
            </div>

            <div className="admin-field">
              <label>Tipo de sucursal *</label>
              <CustomSelect
                value={brType}
                onChange={setBrType}
                options={[
                  { value: 'retail', label: 'Tienda / Sucursal' },
                  { value: 'hybrid', label: 'Tienda + Depósito' },
                  { value: 'warehouse', label: 'Solo Depósito / Almacén' },
                  { value: 'online_hub', label: 'Centro de Despacho Online' },
                ]}
              />
            </div>

            <div className="admin-field">
              <label>Ciudad *</label>
              <input
                type="text"
                maxLength={100}
                className="admin-input"
                value={brCity}
                onChange={(e) => setBrCity(e.target.value)}
                required
              />
            </div>

            <div className="admin-field">
              <label>Dirección *</label>
              <input
                type="text"
                maxLength={255}
                className="admin-input"
                value={brAddress}
                onChange={(e) => setBrAddress(e.target.value)}
                placeholder="Av. San Martín #123..."
                required
              />
            </div>

            <div className="admin-field">
              <label>Teléfono (opcional)</label>
              <input
                type="text"
                maxLength={30}
                className="admin-input"
                value={brPhone}
                onChange={(e) => setBrPhone(e.target.value)}
                placeholder="+591 70000000"
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={brIsMain}
                onChange={(e) => setBrIsMain(e.target.checked)}
              />
              <span>Casa matriz principal</span>
            </label>

            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={brIsActive}
                onChange={(e) => setBrIsActive(e.target.checked)}
              />
              <span>Sucursal activa</span>
            </label>
          </div>

          {!editingBranch && (
            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={brCreateWh}
                onChange={(e) => setBrCreateWh(e.target.checked)}
              />
              <span>Crear automáticamente su almacén principal (ALM-01) para gestionar stock de inmediato</span>
            </label>
          )}
        </form>
      </BaseModal>

      {/* Modal Almacén */}
      <BaseModal
        isOpen={whModalOpen}
        onClose={() => setWhModalOpen(false)}
        eyebrow="Infraestructura de Stock"
        title={editingWh ? `Editar Almacén · ${editingWh.code}` : 'Nuevo Almacén'}
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setWhModalOpen(false)} disabled={whSaving}>
              Cancelar
            </button>
            <button
              type="submit"
              form="wh-form"
              className="admin-btn admin-btn-primary"
              disabled={whSaving}
            >
              {whSaving ? 'Guardando...' : 'Guardar Almacén'}
            </button>
          </>
        }
      >
        {whError && <div className="admin-alert is-error">{whError}</div>}

        <form id="wh-form" className="admin-form" onSubmit={handleSaveWarehouse}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Sucursal *</label>
              <CustomSelect
                value={whBranchId}
                onChange={setWhBranchId}
                loading={metaLoading}
                loadingText="Cargando sucursales..."
                options={branches.map((b) => ({ value: String(b.id), label: `${b.code} · ${b.name}` }))}
              />
            </div>

            <div className="admin-field">
              <label>Código (opcional si es nuevo)</label>
              <input
                type="text"
                maxLength={30}
                className="admin-input"
                value={whCode}
                onChange={(e) => setWhCode(e.target.value)}
                placeholder="Automático (ALM-02)"
              />
            </div>

            <div className="admin-field">
              <label>Nombre del almacén *</label>
              <input
                type="text"
                maxLength={100}
                className="admin-input"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Ej: Depósito Central / Trastienda"
                required
              />
            </div>

            <div className="admin-field">
              <label>Tipo de almacén *</label>
              <CustomSelect
                value={whType}
                onChange={setWhType}
                options={[
                  { value: 'sales_floor', label: 'Piso de Venta' },
                  { value: 'backroom', label: 'Trastienda / Depósito' },
                  { value: 'central_storage', label: 'Almacén Central' },
                  { value: 'transit', label: 'En Tránsito' },
                ]}
              />
            </div>
          </div>

          <div className="admin-form-grid">
            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={whDefault}
                onChange={(e) => setWhDefault(e.target.checked)}
              />
              <span>Establecer como almacén principal de esta sucursal</span>
            </label>

            <label className="inv-checkbox-row">
              <input
                type="checkbox"
                checked={whActive}
                onChange={(e) => setWhActive(e.target.checked)}
              />
              <span>Almacén activo para operaciones</span>
            </label>
          </div>
        </form>
      </BaseModal>

      {/* Modal Nuevo Traslado */}
      <BaseModal
        isOpen={trfModalOpen}
        onClose={() => setTrfModalOpen(false)}
        eyebrow="Traslado entre Sucursales / Almacenes"
        title="Crear Orden de Traslado"
        size="wide"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setTrfModalOpen(false)} disabled={trfSaving}>
              Cancelar
            </button>
            <button
              type="submit"
              form="trf-form"
              className="admin-btn admin-btn-primary"
              disabled={trfSaving}
            >
              {trfSaving ? 'Procesando...' : shipImmediately ? 'Crear y Despachar' : 'Guardar Borrador'}
            </button>
          </>
        }
      >
        {trfError && <div className="admin-alert is-error">{trfError}</div>}

        <form id="trf-form" className="admin-form" onSubmit={handleCreateTransfer}>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Sucursal / Almacén origen *</label>
              <CustomSelect
                value={sourceWhId}
                onChange={setSourceWhId}
                loading={loading || metaLoading}
                loadingText="Cargando almacenes..."
                options={activeWarehouses.map((w) => ({
                  value: String(w.id),
                  label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
                }))}
              />
            </div>

            <div className="admin-field">
              <label>Sucursal / Almacén destino *</label>
              <CustomSelect
                value={targetWhId}
                onChange={setTargetWhId}
                loading={loading || metaLoading}
                loadingText="Cargando almacenes..."
                options={activeWarehouses
                  .filter((w) => String(w.id) !== String(sourceWhId))
                  .map((w) => ({
                    value: String(w.id),
                    label: `${w.branch_code || ''} ${w.branch_name || ''} · ${w.code} ${w.name}`.trim(),
                  }))}
                placeholder="Seleccionar destino..."
              />
            </div>
          </div>

          <div className="admin-field">
            <div className="admin-actions-row">
              <label>Variantes y cantidades *</label>
              <button type="button" className="admin-btn admin-btn-sm" onClick={addTransferRow}>
                + Agregar línea
              </button>
            </div>
            <div className="inv-transfer-items-list">
              {trfItems.map((row, idx) => (
                <div key={idx} className="inv-transfer-item-row">
                  <CustomSelect
                    value={row.variant_id}
                    onChange={(val) => updateTransferRow(idx, 'variant_id', val)}
                    options={allVariantOptions}
                    loading={metaLoading}
                    loadingText="Cargando variantes..."
                    placeholder="Seleccionar variante..."
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="admin-input"
                    value={row.quantity_requested}
                    onChange={(e) => updateTransferRow(idx, 'quantity_requested', e.target.value)}
                  />
                  {trfItems.length > 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost-danger"
                      onClick={() => removeTransferRow(idx)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-field">
            <label>Justificación / Motivo del traslado *</label>
            <textarea
              className="admin-textarea"
              rows={2}
              value={trfNotes}
              onChange={(e) => setTrfNotes(e.target.value)}
              placeholder="Ej: Envío de reposición de tallas S y M hacia Sucursal 2..."
              required
            />
          </div>

          <label className="inv-checkbox-row">
            <input
              type="checkbox"
              checked={shipImmediately}
              onChange={(e) => setShipImmediately(e.target.checked)}
            />
            <span>Despachar inmediatamente (descuenta de origen ahora y pasa a En tránsito)</span>
          </label>
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        eyebrow={confirmDialogConfig.eyebrow}
        title={confirmDialogConfig.title}
        message={confirmDialogConfig.message}
        confirmLabel={confirmDialogConfig.confirmLabel}
        variant={confirmDialogConfig.variant || 'primary'}
        onConfirm={executeConfirmAction}
      />
    </section>
  );
}
