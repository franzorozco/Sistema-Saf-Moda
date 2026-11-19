<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Inventory;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WarehouseTransferController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService
    ) {
    }

    public function storeBranch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:30', 'unique:branches,code'],
            'name' => ['required', 'string', 'max:150'],
            'branch_type' => ['required', Rule::in(['retail', 'warehouse', 'hybrid', 'online_hub'])],
            'city' => ['required', 'string', 'max:100'],
            'address_line' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_main' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'create_default_warehouse' => ['nullable', 'boolean'],
        ]);

        $code = !empty($validated['code'])
            ? strtoupper(trim($validated['code']))
            : CodeGenerator::next('branches', 'SUC-', 2, 'code');

        $isMain = !empty($validated['is_main']);
        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;
        $createWh = array_key_exists('create_default_warehouse', $validated) ? (bool) $validated['create_default_warehouse'] : true;

        $branch = DB::transaction(function () use ($validated, $code, $isMain, $isActive, $createWh, $request) {
            if ($isMain) {
                Branch::query()->update(['is_main' => false]);
            }

            $branch = Branch::create([
                'code' => $code,
                'name' => trim($validated['name']),
                'branch_type' => $validated['branch_type'],
                'country' => 'Bolivia',
                'city' => trim($validated['city']),
                'address_line' => trim($validated['address_line']),
                'phone' => !empty($validated['phone']) ? trim($validated['phone']) : null,
                'is_main' => $isMain,
                'is_active' => $isActive,
            ]);

            if ($createWh) {
                Warehouse::create([
                    'branch_id' => $branch->id,
                    'code' => 'ALM-01',
                    'name' => 'Piso de Venta ' . trim($validated['name']),
                    'warehouse_type' => $validated['branch_type'] === 'warehouse' ? 'central_storage' : 'sales_floor',
                    'is_default' => true,
                    'is_active' => true,
                ]);
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => $branch->id,
                'entity_table' => 'branches',
                'entity_id' => $branch->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => $branch->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $branch;
        });

        return $this->success($branch->load('warehouses'), 'Sucursal creada correctamente', 201);
    }

    public function updateBranch(Request $request, string $id): JsonResponse
    {
        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('branches', 'code')->ignore($branch->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'branch_type' => ['sometimes', 'required', Rule::in(['retail', 'warehouse', 'hybrid', 'online_hub'])],
            'city' => ['sometimes', 'required', 'string', 'max:100'],
            'address_line' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_main' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $updated = DB::transaction(function () use ($branch, $validated, $request) {
            $old = $branch->toArray();

            if (!empty($validated['is_main'])) {
                Branch::where('id', '!=', $branch->id)->update(['is_main' => false]);
            }

            $branch->fill([
                'code' => isset($validated['code']) ? strtoupper(trim($validated['code'])) : $branch->code,
                'name' => isset($validated['name']) ? trim($validated['name']) : $branch->name,
                'branch_type' => $validated['branch_type'] ?? $branch->branch_type,
                'city' => isset($validated['city']) ? trim($validated['city']) : $branch->city,
                'address_line' => isset($validated['address_line']) ? trim($validated['address_line']) : $branch->address_line,
                'phone' => array_key_exists('phone', $validated) ? ($validated['phone'] ? trim($validated['phone']) : null) : $branch->phone,
                'is_main' => array_key_exists('is_main', $validated) ? (bool) $validated['is_main'] : $branch->is_main,
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $branch->is_active,
            ]);
            $branch->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => $branch->id,
                'entity_table' => 'branches',
                'entity_id' => $branch->id,
                'action' => 'UPDATE',
                'old_values' => $old,
                'new_values' => $branch->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $branch;
        });

        return $this->success($updated, 'Sucursal actualizada');
    }

    public function indexWarehouses(): JsonResponse
    {
        $stockSummary = Inventory::query()
            ->selectRaw('warehouse_id, COUNT(*) as variant_rows, COALESCE(SUM(quantity_on_hand), 0) as total_units')
            ->groupBy('warehouse_id')
            ->get()
            ->keyBy('warehouse_id');

        $warehouses = Warehouse::with('branch:id,code,name,is_main')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get()
            ->map(function (Warehouse $w) use ($stockSummary) {
                $sum = $stockSummary->get($w->id);
                return [
                    'id' => $w->id,
                    'branch_id' => $w->branch_id,
                    'branch_name' => $w->branch?->name,
                    'branch_code' => $w->branch?->code,
                    'code' => $w->code,
                    'name' => $w->name,
                    'warehouse_type' => $w->warehouse_type,
                    'is_default' => (bool) $w->is_default,
                    'is_active' => (bool) $w->is_active,
                    'variant_rows' => (int) ($sum?->variant_rows ?? 0),
                    'total_units' => (int) ($sum?->total_units ?? 0),
                ];
            })->values();

        return $this->success(['items' => $warehouses], 'Almacenes obtenidos');
    }

    public function storeWarehouse(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'code' => ['nullable', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:100'],
            'warehouse_type' => ['required', Rule::in(['sales_floor', 'backroom', 'central_storage', 'transit'])],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $branchId = (int) $validated['branch_id'];
        $code = !empty($validated['code'])
            ? strtoupper(trim($validated['code']))
            : CodeGenerator::next('warehouses', 'ALM-', 2, 'code', ['branch_id' => $branchId]);

        $exists = Warehouse::where('branch_id', $branchId)->where('code', $code)->exists();
        if ($exists) {
            throw ValidationException::withMessages([
                'code' => ["Ya existe un almacén con el código {$code} en esta sucursal."],
            ]);
        }

        $isDefault = !empty($validated['is_default']);
        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;

        $warehouse = DB::transaction(function () use ($validated, $branchId, $code, $isDefault, $isActive, $request) {
            if ($isDefault) {
                Warehouse::where('branch_id', $branchId)->update(['is_default' => false]);
            }

            $warehouse = Warehouse::create([
                'branch_id' => $branchId,
                'code' => $code,
                'name' => trim($validated['name']),
                'warehouse_type' => $validated['warehouse_type'],
                'is_default' => $isDefault,
                'is_active' => $isActive,
            ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => $branchId,
                'entity_table' => 'warehouses',
                'entity_id' => $warehouse->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => $warehouse->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $warehouse;
        });

        return $this->success($warehouse->load('branch:id,code,name'), 'Almacén creado', 201);
    }

    public function updateWarehouse(Request $request, string $id): JsonResponse
    {
        $warehouse = Warehouse::findOrFail($id);

        $validated = $request->validate([
            'branch_id' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'code' => ['sometimes', 'required', 'string', 'max:30'],
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'warehouse_type' => ['sometimes', 'required', Rule::in(['sales_floor', 'backroom', 'central_storage', 'transit'])],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $branchId = isset($validated['branch_id']) ? (int) $validated['branch_id'] : (int) $warehouse->branch_id;
        $code = isset($validated['code']) ? strtoupper(trim($validated['code'])) : $warehouse->code;

        $duplicate = Warehouse::where('branch_id', $branchId)
            ->where('code', $code)
            ->where('id', '!=', $warehouse->id)
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'code' => ["Ya existe otro almacén con el código {$code} en esta sucursal."],
            ]);
        }

        $updated = DB::transaction(function () use ($warehouse, $validated, $branchId, $code, $request) {
            $old = $warehouse->toArray();

            if (!empty($validated['is_default'])) {
                Warehouse::where('branch_id', $branchId)
                    ->where('id', '!=', $warehouse->id)
                    ->update(['is_default' => false]);
            }

            $warehouse->fill([
                'branch_id' => $branchId,
                'code' => $code,
                'name' => isset($validated['name']) ? trim($validated['name']) : $warehouse->name,
                'warehouse_type' => $validated['warehouse_type'] ?? $warehouse->warehouse_type,
                'is_default' => array_key_exists('is_default', $validated) ? (bool) $validated['is_default'] : $warehouse->is_default,
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $warehouse->is_active,
            ]);
            $warehouse->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => $branchId,
                'entity_table' => 'warehouses',
                'entity_id' => $warehouse->id,
                'action' => 'UPDATE',
                'old_values' => $old,
                'new_values' => $warehouse->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $warehouse;
        });

        return $this->success($updated->load('branch:id,code,name'), 'Almacén actualizado');
    }

    public function indexTransfers(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $branchId = $request->query('branch_id');

        $query = StockTransfer::with([
            'source_warehouse.branch:id,code,name',
            'target_warehouse.branch:id,code,name',
            'requested_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'shipped_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'received_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'stock_transfer_items.product_variant' => fn ($vq) => $vq->withTrashed()->with([
                'product' => fn ($pq) => $pq->withTrashed()->select(['id', 'name', 'sku_prefix']),
            ]),
        ])->orderByDesc('id');

        if ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $bId = (int) $branchId;
            $query->where(function ($q) use ($bId) {
                $q->whereHas('source_warehouse', fn ($wq) => $wq->where('branch_id', $bId))
                    ->orWhereHas('target_warehouse', fn ($wq) => $wq->where('branch_id', $bId));
            });
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $items = $query->get()->map(fn (StockTransfer $t) => $this->formatTransfer($t))->values();

        return $this->success(['items' => $items], 'Traslados obtenidos');
    }

    public function storeTransfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'target_warehouse_id' => ['required', 'integer', 'exists:warehouses,id', 'different:source_warehouse_id'],
            'notes' => ['required', 'string', 'min:4', 'max:1000'],
            'ship_immediately' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity_requested' => ['required', 'integer', 'min:1', 'max:999999'],
        ], [
            'target_warehouse_id.different' => 'El almacén destino debe ser diferente al almacén origen.',
            'notes.required' => 'La justificación o motivo del traslado es obligatorio.',
        ]);

        $groupedItems = collect($validated['items'])
            ->groupBy('variant_id')
            ->map(fn ($group, $variantId) => [
                'variant_id' => (int) $variantId,
                'quantity_requested' => (int) $group->sum('quantity_requested'),
            ])
            ->values();

        $transfer = DB::transaction(function () use ($validated, $groupedItems, $request) {
            $transferNumber = CodeGenerator::next('stock_transfers', 'TRF-', 4, 'transfer_number');

            $transfer = StockTransfer::create([
                'transfer_number' => $transferNumber,
                'source_warehouse_id' => (int) $validated['source_warehouse_id'],
                'target_warehouse_id' => (int) $validated['target_warehouse_id'],
                'status' => 'draft',
                'requested_by_user_id' => $request->user()?->id,
                'notes' => trim($validated['notes']),
            ]);

            foreach ($groupedItems as $item) {
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'variant_id' => $item['variant_id'],
                    'quantity_requested' => $item['quantity_requested'],
                    'quantity_shipped' => 0,
                    'quantity_received' => 0,
                ]);
            }

            if (!empty($validated['ship_immediately'])) {
                $this->executeShip($transfer->fresh(['stock_transfer_items', 'target_warehouse']), $request);
            }

            return $transfer->fresh();
        });

        return $this->success($this->loadFormattedTransfer($transfer->id), 'Orden de traslado creada', 201);
    }

    public function shipTransfer(Request $request, string $id): JsonResponse
    {
        $transfer = DB::transaction(function () use ($id, $request) {
            $transfer = StockTransfer::with(['stock_transfer_items', 'target_warehouse'])
                ->lockForUpdate()
                ->findOrFail($id);

            $this->executeShip($transfer, $request);

            return $transfer->fresh();
        });

        return $this->success($this->loadFormattedTransfer($transfer->id), 'Traslado despachado en tránsito');
    }

    public function receiveTransfer(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['nullable', 'array'],
            'items.*.id' => ['required_with:items', 'integer'],
            'items.*.quantity_received' => ['required_with:items', 'integer', 'min:0'],
        ]);

        $transfer = DB::transaction(function () use ($id, $validated, $request) {
            $transfer = StockTransfer::with(['stock_transfer_items', 'source_warehouse'])
                ->lockForUpdate()
                ->findOrFail($id);

            if (!in_array($transfer->status, ['in_transit', 'partial'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden recibir traslados en tránsito o recepción parcial.'],
                ]);
            }

            $overrides = collect($validated['items'] ?? [])->keyBy('id');
            $allCompleted = true;

            foreach ($transfer->stock_transfer_items as $item) {
                $shipped = (int) $item->quantity_shipped;
                $alreadyReceived = (int) $item->quantity_received;
                $targetTotalReceived = $overrides->has($item->id)
                    ? (int) $overrides->get($item->id)['quantity_received']
                    : $shipped;

                if ($targetTotalReceived < $alreadyReceived || $targetTotalReceived > $shipped) {
                    throw ValidationException::withMessages([
                        'items' => ["Cantidad recibida inválida para variante #{$item->variant_id}. Debe estar entre {$alreadyReceived} y {$shipped}."],
                    ]);
                }

                $delta = $targetTotalReceived - $alreadyReceived;
                if ($delta > 0) {
                    $sourceCode = $transfer->source_warehouse?->code ?? $transfer->source_warehouse_id;
                    $this->inventoryService->applyMovement(
                        warehouseId: $transfer->target_warehouse_id,
                        variantId: $item->variant_id,
                        movementType: 'transfer_in',
                        signedQuantity: $delta,
                        unitCost: null,
                        referenceType: 'stock_transfer',
                        referenceId: $transfer->id,
                        notes: mb_substr("Recepción {$transfer->transfer_number} desde {$sourceCode}", 0, 255),
                        userId: $request->user()?->id,
                        ipAddress: $request->ip(),
                        userAgent: $request->userAgent()
                    );

                    $item->quantity_received = $targetTotalReceived;
                    $item->save();
                }

                if ((int) $item->quantity_received < $shipped) {
                    $allCompleted = false;
                }
            }

            $transfer->status = $allCompleted ? 'received' : 'partial';
            $transfer->received_by_user_id = $request->user()?->id;
            $transfer->received_at = now();
            if (!empty($validated['notes'])) {
                $transfer->notes = trim(($transfer->notes ? $transfer->notes . ' | ' : '') . $validated['notes']);
            }
            $transfer->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $transfer->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'stock_transfers',
                'entity_id' => $transfer->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => 'in_transit'],
                'new_values' => ['status' => $transfer->status],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $transfer->fresh();
        });

        return $this->success($this->loadFormattedTransfer($transfer->id), 'Traslado recibido en almacén destino');
    }

    public function cancelTransfer(Request $request, string $id): JsonResponse
    {
        $transfer = DB::transaction(function () use ($id, $request) {
            $transfer = StockTransfer::with('stock_transfer_items')->lockForUpdate()->findOrFail($id);

            if (!in_array($transfer->status, ['draft', 'in_transit'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden cancelar traslados en borrador o en tránsito (sin recepciones).'],
                ]);
            }

            $oldStatus = $transfer->status;

            if ($oldStatus === 'in_transit') {
                foreach ($transfer->stock_transfer_items as $item) {
                    $shipped = (int) $item->quantity_shipped;
                    if ($shipped > 0) {
                        $this->inventoryService->applyMovement(
                            warehouseId: $transfer->source_warehouse_id,
                            variantId: $item->variant_id,
                            movementType: 'transfer_in',
                            signedQuantity: $shipped,
                            unitCost: null,
                            referenceType: 'stock_transfer_cancel',
                            referenceId: $transfer->id,
                            notes: mb_substr("Reversión por cancelación {$transfer->transfer_number}", 0, 255),
                            userId: $request->user()?->id,
                            ipAddress: $request->ip(),
                            userAgent: $request->userAgent()
                        );
                    }
                }
            }

            $transfer->status = 'cancelled';
            $transfer->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $transfer->source_warehouse_id)->value('branch_id'),
                'entity_table' => 'stock_transfers',
                'entity_id' => $transfer->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => 'cancelled'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $transfer->fresh();
        });

        return $this->success($this->loadFormattedTransfer($transfer->id), 'Traslado cancelado');
    }

    private function executeShip(StockTransfer $transfer, Request $request): void
    {
        if ($transfer->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => ['Solo los traslados en estado borrador pueden despacharse.'],
            ]);
        }

        $targetCode = $transfer->target_warehouse?->code ?? $transfer->target_warehouse_id;

        foreach ($transfer->stock_transfer_items as $item) {
            $qty = (int) $item->quantity_requested;

            $this->inventoryService->applyMovement(
                warehouseId: $transfer->source_warehouse_id,
                variantId: $item->variant_id,
                movementType: 'transfer_out',
                signedQuantity: -$qty,
                unitCost: null,
                referenceType: 'stock_transfer',
                referenceId: $transfer->id,
                notes: mb_substr("Envío {$transfer->transfer_number} hacia {$targetCode}", 0, 255),
                userId: $request->user()?->id,
                ipAddress: $request->ip(),
                userAgent: $request->userAgent()
            );

            $item->quantity_shipped = $qty;
            $item->save();
        }

        $transfer->status = 'in_transit';
        $transfer->shipped_by_user_id = $request->user()?->id;
        $transfer->shipped_at = now();
        $transfer->save();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'branch_id' => Warehouse::where('id', $transfer->source_warehouse_id)->value('branch_id'),
            'entity_table' => 'stock_transfers',
            'entity_id' => $transfer->id,
            'action' => 'UPDATE',
            'old_values' => ['status' => 'draft'],
            'new_values' => ['status' => 'in_transit'],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
        ]);
    }

    private function loadFormattedTransfer(int $id): array
    {
        $transfer = StockTransfer::with([
            'source_warehouse.branch:id,code,name',
            'target_warehouse.branch:id,code,name',
            'requested_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'shipped_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'received_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'stock_transfer_items.product_variant' => fn ($vq) => $vq->withTrashed()->with([
                'product' => fn ($pq) => $pq->withTrashed()->select(['id', 'name', 'sku_prefix']),
            ]),
        ])->findOrFail($id);

        return $this->formatTransfer($transfer);
    }

    private function formatTransfer(StockTransfer $t): array
    {
        $resolveName = function ($user) {
            if (!$user) {
                return null;
            }
            return $user->person
                ? trim($user->person->first_name . ' ' . $user->person->last_name)
                : ($user->username ?? $user->email);
        };

        $items = $t->stock_transfer_items->map(fn (StockTransferItem $item) => [
            'id' => $item->id,
            'variant_id' => $item->variant_id,
            'sku' => $item->product_variant?->sku,
            'variant_label' => $item->product_variant?->variant_label ?: 'Estándar',
            'product_name' => $item->product_variant?->product?->name,
            'quantity_requested' => (int) $item->quantity_requested,
            'quantity_shipped' => (int) $item->quantity_shipped,
            'quantity_received' => (int) $item->quantity_received,
        ])->values();

        return [
            'id' => $t->id,
            'transfer_number' => $t->transfer_number,
            'source_branch_id' => $t->source_warehouse?->branch_id,
            'source_branch_code' => $t->source_warehouse?->branch?->code,
            'source_branch_name' => $t->source_warehouse?->branch?->name,
            'source_warehouse_id' => $t->source_warehouse_id,
            'source_warehouse_code' => $t->source_warehouse?->code,
            'source_warehouse_name' => $t->source_warehouse?->name,
            'target_branch_id' => $t->target_warehouse?->branch_id,
            'target_branch_code' => $t->target_warehouse?->branch?->code,
            'target_branch_name' => $t->target_warehouse?->branch?->name,
            'target_warehouse_id' => $t->target_warehouse_id,
            'target_warehouse_code' => $t->target_warehouse?->code,
            'target_warehouse_name' => $t->target_warehouse?->name,
            'status' => $t->status,
            'requested_by_name' => $resolveName($t->requested_by),
            'shipped_by_name' => $resolveName($t->shipped_by),
            'received_by_name' => $resolveName($t->received_by),
            'shipped_at' => $t->shipped_at?->toISOString(),
            'received_at' => $t->received_at?->toISOString(),
            'created_at' => $t->created_at?->toISOString(),
            'notes' => $t->notes,
            'total_requested_units' => (int) $items->sum('quantity_requested'),
            'items' => $items,
        ];
    }
}
