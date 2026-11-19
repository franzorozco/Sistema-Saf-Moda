<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Inventory;
use App\Models\InventoryCount;
use App\Models\InventoryCountItem;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryCountController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');
        $warehouseId = $request->query('warehouse_id');
        $status = $request->query('status');

        $query = InventoryCount::with([
            'warehouse.branch:id,code,name',
            'conducted_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'approved_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'inventory_count_items.product_variant:id,cost_price',
        ])->orderByDesc('id');

        if ($warehouseId !== null && $warehouseId !== '' && $warehouseId !== 'all') {
            $query->where('warehouse_id', (int) $warehouseId);
        } elseif ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $query->whereHas('warehouse', fn ($wq) => $wq->where('branch_id', (int) $branchId));
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $counts = $query->get()->map(function (InventoryCount $count) {
            $items = $count->inventory_count_items;
            $diffItems = $items->filter(fn (InventoryCountItem $i) => (int) $i->counted_quantity !== (int) $i->expected_quantity);
            $netUnits = $items->sum(fn (InventoryCountItem $i) => (int) $i->counted_quantity - (int) $i->expected_quantity);
            $diffCostValue = $items->sum(function (InventoryCountItem $i) {
                $diff = (int) $i->counted_quantity - (int) $i->expected_quantity;
                $cost = (float) ($i->product_variant?->cost_price ?? 0);
                return $diff * $cost;
            });

            return [
                'id' => $count->id,
                'count_number' => $count->count_number,
                'branch_id' => $count->warehouse?->branch_id,
                'branch_code' => $count->warehouse?->branch?->code,
                'branch_name' => $count->warehouse?->branch?->name,
                'warehouse_id' => $count->warehouse_id,
                'warehouse_code' => $count->warehouse?->code,
                'warehouse_name' => $count->warehouse?->name,
                'status' => $count->status,
                'started_at' => $count->started_at?->toISOString(),
                'completed_at' => $count->completed_at?->toISOString(),
                'notes' => $count->notes,
                'conducted_by_name' => $this->resolveUserName($count->conducted_by),
                'approved_by_name' => $this->resolveUserName($count->approved_by),
                'total_items' => $items->count(),
                'discrepancy_items' => $diffItems->count(),
                'net_diff_units' => (int) $netUnits,
                'diff_cost_value' => round((float) $diffCostValue, 2),
            ];
        })->values();

        return $this->success(['items' => $counts], 'Auditorías obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'scope' => ['required', Rule::in(['all', 'category', 'product', 'low_stock'])],
            'category_id' => ['required_if:scope,category', 'nullable', 'integer', 'exists:categories,id'],
            'product_id' => ['required_if:scope,product', 'nullable', 'integer', 'exists:products,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $warehouseId = (int) $validated['warehouse_id'];
        $scope = $validated['scope'];

        $variantQuery = ProductVariant::query()
            ->whereHas('product')
            ->orderBy('product_id')
            ->orderBy('id');

        if ($scope === 'category') {
            $variantQuery->whereHas('product', fn ($q) => $q->where('category_id', (int) $validated['category_id']));
        } elseif ($scope === 'product') {
            $variantQuery->where('product_id', (int) $validated['product_id']);
        }

        $variants = $variantQuery->get(['id', 'product_id', 'sku', 'variant_label', 'cost_price']);
        $inventories = Inventory::where('warehouse_id', $warehouseId)
            ->whereIn('variant_id', $variants->pluck('id'))
            ->get()
            ->keyBy('variant_id');

        if ($scope === 'low_stock') {
            $variants = $variants->filter(function (ProductVariant $variant) use ($inventories) {
                $inv = $inventories->get($variant->id);
                $onHand = $inv ? (int) $inv->quantity_on_hand : 0;
                $minAlert = $inv ? (int) $inv->min_stock_alert : 3;
                return $onHand <= $minAlert;
            })->values();
        }

        if ($variants->isEmpty()) {
            throw ValidationException::withMessages([
                'scope' => ['No hay variantes que coincidan con el alcance seleccionado para auditar.'],
            ]);
        }

        $count = DB::transaction(function () use ($warehouseId, $variants, $inventories, $validated, $request) {
            $countNumber = CodeGenerator::next('inventory_counts', 'AUD-', 4, 'count_number');

            $count = InventoryCount::create([
                'count_number' => $countNumber,
                'warehouse_id' => $warehouseId,
                'status' => 'in_progress',
                'conducted_by_user_id' => $request->user()?->id,
                'started_at' => now(),
                'notes' => !empty($validated['notes']) ? trim($validated['notes']) : null,
            ]);

            $rows = [];
            foreach ($variants as $variant) {
                $expected = (int) ($inventories->get($variant->id)?->quantity_on_hand ?? 0);
                $rows[] = [
                    'inventory_count_id' => $count->id,
                    'variant_id' => $variant->id,
                    'expected_quantity' => $expected,
                    'counted_quantity' => $expected,
                    'notes' => null,
                ];
            }

            InventoryCountItem::insert($rows);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $warehouseId)->value('branch_id'),
                'entity_table' => 'inventory_counts',
                'entity_id' => $count->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => [
                    'count_number' => $count->count_number,
                    'warehouse_id' => $warehouseId,
                    'items_count' => count($rows),
                    'scope' => $validated['scope'],
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $count;
        });

        return $this->success($this->formatCountDetail($count->id), 'Auditoría física iniciada', 201);
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->formatCountDetail((int) $id), 'Detalle de auditoría obtenido');
    }

    public function updateItems(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
            'mark_pending_approval' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.counted_quantity' => ['required', 'integer', 'min:0', 'max:999999'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $count = DB::transaction(function () use ($id, $validated) {
            $count = InventoryCount::lockForUpdate()->findOrFail($id);

            if (!in_array($count->status, ['in_progress', 'pending_approval'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden editar conteos en progreso o pendientes de aprobación.'],
                ]);
            }

            $itemsById = InventoryCountItem::where('inventory_count_id', $count->id)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($validated['items'] as $entry) {
                $item = $itemsById->get((int) $entry['id']);
                if (!$item) {
                    continue;
                }

                $cleanNote = isset($entry['notes']) ? trim((string) $entry['notes']) : null;
                $item->counted_quantity = (int) $entry['counted_quantity'];
                $item->notes = $cleanNote !== '' ? mb_substr($cleanNote, 0, 255) : null;
                $item->save();
            }

            if (array_key_exists('notes', $validated)) {
                $count->notes = !empty($validated['notes']) ? trim($validated['notes']) : null;
            }

            if (!empty($validated['mark_pending_approval'])) {
                $count->status = 'pending_approval';
            }

            $count->save();

            return $count;
        });

        return $this->success($this->formatCountDetail($count->id), 'Conteo guardado correctamente');
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $approvalNote = !empty($validated['notes']) ? trim($validated['notes']) : null;

        DB::transaction(function () use ($id, $approvalNote, $request) {
            $count = InventoryCount::with('inventory_count_items')->lockForUpdate()->findOrFail($id);

            if (!in_array($count->status, ['in_progress', 'pending_approval'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Esta auditoría ya fue cerrada o cancelada.'],
                ]);
            }

            $headerJustification = $approvalNote ?: trim((string) ($count->notes ?? ''));
            $hasDiscrepancies = $count->inventory_count_items->contains(
                fn (InventoryCountItem $item) => (int) $item->counted_quantity !== (int) $item->expected_quantity
            );

            if ($hasDiscrepancies) {
                $missingJustifications = $count->inventory_count_items->filter(function (InventoryCountItem $item) use ($headerJustification) {
                    $diff = (int) $item->counted_quantity - (int) $item->expected_quantity;
                    if ($diff === 0) {
                        return false;
                    }
                    $itemNote = trim((string) ($item->notes ?? ''));
                    return mb_strlen($itemNote) < 3 && mb_strlen($headerJustification) < 4;
                });

                if ($missingJustifications->isNotEmpty()) {
                    throw ValidationException::withMessages([
                        'notes' => ['Existe diferencia de conteo: ingresa una justificación general o por ítem antes de aprobar.'],
                    ]);
                }
            }

            $adjustedCount = 0;

            foreach ($count->inventory_count_items as $item) {
                $currentInv = Inventory::where('warehouse_id', $count->warehouse_id)
                    ->where('variant_id', $item->variant_id)
                    ->lockForUpdate()
                    ->first();

                $currentOnHand = $currentInv ? (int) $currentInv->quantity_on_hand : 0;
                $counted = (int) $item->counted_quantity;
                $delta = $counted - $currentOnHand;

                if ($delta === 0) {
                    continue;
                }

                $movementType = $delta > 0 ? 'adjustment_in' : 'adjustment_out';
                $reasonPart = trim((string) ($item->notes ?? '')) ?: $headerJustification;
                $movementNote = mb_substr("Auditoría {$count->count_number}: {$reasonPart}", 0, 255);

                $this->inventoryService->applyMovement(
                    warehouseId: $count->warehouse_id,
                    variantId: $item->variant_id,
                    movementType: $movementType,
                    signedQuantity: $delta,
                    unitCost: null,
                    referenceType: 'inventory_count',
                    referenceId: $count->id,
                    notes: $movementNote,
                    userId: $request->user()?->id,
                    ipAddress: $request->ip(),
                    userAgent: $request->userAgent()
                );

                $adjustedCount++;
            }

            $count->status = 'approved';
            $count->approved_by_user_id = $request->user()?->id;
            $count->completed_at = now();
            if ($approvalNote !== null) {
                $count->notes = $approvalNote;
            }
            $count->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $count->warehouse_id)->value('branch_id'),
                'entity_table' => 'inventory_counts',
                'entity_id' => $count->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => 'in_progress'],
                'new_values' => [
                    'status' => 'approved',
                    'adjusted_variants' => $adjustedCount,
                    'notes' => $count->notes,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatCountDetail((int) $id), 'Auditoría aprobada y ajustes aplicados al inventario');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($id, $validated, $request) {
            $count = InventoryCount::lockForUpdate()->findOrFail($id);

            if (!in_array($count->status, ['in_progress', 'pending_approval'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['No se puede cancelar una auditoría que ya fue aprobada o cancelada.'],
                ]);
            }

            $oldStatus = $count->status;
            $count->status = 'cancelled';
            $count->completed_at = now();
            if (!empty($validated['notes'])) {
                $count->notes = trim($validated['notes']);
            }
            $count->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $count->warehouse_id)->value('branch_id'),
                'entity_table' => 'inventory_counts',
                'entity_id' => $count->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => 'cancelled', 'notes' => $count->notes],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatCountDetail((int) $id), 'Auditoría cancelada');
    }

    private function formatCountDetail(int $countId): array
    {
        $count = InventoryCount::with([
            'warehouse.branch:id,code,name',
            'conducted_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'approved_by' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'inventory_count_items' => fn ($q) => $q->orderBy('id')->with([
                'product_variant' => fn ($vq) => $vq->withTrashed()->with([
                    'product' => fn ($pq) => $pq->withTrashed()->select(['id', 'name', 'sku_prefix']),
                    'variant_attribute_values.attribute_value:id,value',
                ]),
            ]),
        ])->findOrFail($countId);

        $variantIds = $count->inventory_count_items->pluck('variant_id')->all();
        $liveStockMap = Inventory::where('warehouse_id', $count->warehouse_id)
            ->whereIn('variant_id', $variantIds)
            ->get()
            ->keyBy('variant_id');

        $items = $count->inventory_count_items->map(function (InventoryCountItem $item) use ($liveStockMap) {
            $variant = $item->product_variant;
            $liveInv = $liveStockMap->get($item->variant_id);
            $diff = (int) $item->counted_quantity - (int) $item->expected_quantity;
            $cost = round((float) ($variant?->cost_price ?? 0), 2);
            $attrLabel = $variant?->variant_label
                ?: $variant?->variant_attribute_values->pluck('attribute_value.value')->filter()->implode(' / ')
                ?: 'Estándar';

            return [
                'id' => $item->id,
                'variant_id' => $item->variant_id,
                'sku' => $variant?->sku,
                'variant_label' => $attrLabel,
                'product_id' => $variant?->product_id,
                'product_name' => $variant?->product?->name,
                'cost_price' => $cost,
                'expected_quantity' => (int) $item->expected_quantity,
                'counted_quantity' => (int) $item->counted_quantity,
                'difference' => $diff,
                'diff_value' => round($diff * $cost, 2),
                'live_on_hand' => $liveInv ? (int) $liveInv->quantity_on_hand : 0,
                'live_reserved' => $liveInv ? (int) $liveInv->quantity_reserved : 0,
                'notes' => $item->notes,
            ];
        })->values();

        return [
            'id' => $count->id,
            'count_number' => $count->count_number,
            'branch_id' => $count->warehouse?->branch_id,
            'branch_code' => $count->warehouse?->branch?->code,
            'branch_name' => $count->warehouse?->branch?->name,
            'warehouse_id' => $count->warehouse_id,
            'warehouse_code' => $count->warehouse?->code,
            'warehouse_name' => $count->warehouse?->name,
            'status' => $count->status,
            'started_at' => $count->started_at?->toISOString(),
            'completed_at' => $count->completed_at?->toISOString(),
            'notes' => $count->notes,
            'conducted_by_name' => $this->resolveUserName($count->conducted_by),
            'approved_by_name' => $this->resolveUserName($count->approved_by),
            'items' => $items,
        ];
    }

    private function resolveUserName($user): string
    {
        if (!$user) {
            return 'Sistema';
        }
        $person = $user->person;
        if ($person) {
            return trim($person->first_name . ' ' . $person->last_name);
        }
        return $user->username ?? $user->email ?? 'Usuario';
    }
}
