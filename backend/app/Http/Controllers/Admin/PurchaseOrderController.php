<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseAttachment;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchasePriceHistory;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Services\Storage\ImageStorageService;
use App\Support\CodeGenerator;
use App\Support\StoragePath;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly ImageStorageService $storageService
    ) {
    }

    public function meta(): JsonResponse
    {
        $suppliers = Supplier::where('is_active', true)
            ->orderBy('business_name')
            ->get(['id', 'code', 'business_name', 'contact_name', 'phone', 'whatsapp', 'payment_terms', 'city']);

        $warehouses = Warehouse::with('branch:id,code,name')
            ->where('is_active', true)
            ->orderBy('branch_id')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get(['id', 'branch_id', 'code', 'name', 'warehouse_type', 'is_default'])
            ->map(fn (Warehouse $w) => [
                'id' => $w->id,
                'branch_id' => $w->branch_id,
                'branch_code' => $w->branch?->code,
                'branch_name' => $w->branch?->name,
                'code' => $w->code,
                'name' => $w->name,
                'warehouse_type' => $w->warehouse_type,
                'is_default' => (bool) $w->is_default,
            ])
            ->values();

        $branches = Branch::where('is_active', true)
            ->orderByDesc('is_main')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'city', 'is_main'])
            ->map(function (Branch $b) use ($warehouses) {
                $whs = $warehouses->where('branch_id', $b->id);
                $def = $whs->firstWhere('is_default', true) ?? $whs->first();
                return [
                    'id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                    'city' => $b->city,
                    'is_main' => (bool) $b->is_main,
                    'default_warehouse_id' => $def['id'] ?? null,
                ];
            })
            ->values();

        $catalogProducts = Product::with('brand:id,name')
            ->orderBy('name')
            ->get(['id', 'sku_prefix', 'name', 'brand_id'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'sku_prefix' => $p->sku_prefix,
                'name' => $p->name,
                'brand_name' => $p->brand?->name,
            ])
            ->values();

        $unregisteredSuggestions = PurchasePriceHistory::with('supplier:id,business_name')
            ->whereNull('variant_id')
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->limit(150)
            ->get()
            ->unique('item_key')
            ->take(60)
            ->map(fn (PurchasePriceHistory $h) => [
                'item_key' => $h->item_key,
                'item_name' => $h->item_name,
                'item_sku' => $h->item_sku,
                'unit_cost' => round((float) $h->unit_cost, 2),
                'recorded_at' => $h->recorded_at?->format('Y-m-d'),
                'supplier_name' => $h->supplier?->business_name,
            ])
            ->values();

        return $this->success([
            'suppliers' => $suppliers,
            'branches' => $branches,
            'warehouses' => $warehouses,
            'catalog_products' => $catalogProducts,
            'unregistered_suggestions' => $unregisteredSuggestions,
        ], 'Metadatos de compras obtenidos');
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $paymentStatus = $request->query('payment_status');
        $supplierId = $request->query('supplier_id');
        $branchId = $request->query('branch_id');
        $warehouseId = $request->query('warehouse_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $search = trim((string) $request->query('search', ''));

        $query = PurchaseOrder::with([
            'supplier' => fn ($q) => $q->withTrashed()->select(['id', 'code', 'business_name', 'contact_name', 'whatsapp', 'phone']),
            'warehouse.branch:id,code,name',
            'user' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'purchase_order_items:id,purchase_order_id,variant_id,is_catalog_linked,quantity_ordered,quantity_received',
            'attachments:id,purchase_order_id,attachment_type,file_path',
        ])->orderByDesc('id');

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($paymentStatus !== null && $paymentStatus !== '' && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }

        if ($supplierId !== null && $supplierId !== '' && $supplierId !== 'all') {
            $query->where('supplier_id', (int) $supplierId);
        }

        if ($warehouseId !== null && $warehouseId !== '' && $warehouseId !== 'all') {
            $query->where('target_warehouse_id', (int) $warehouseId);
        } elseif ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $query->whereHas('warehouse', fn ($wq) => $wq->where('branch_id', (int) $branchId));
        }

        if (!empty($dateFrom)) {
            $query->whereDate('order_date', '>=', $dateFrom);
        }

        if (!empty($dateTo)) {
            $query->whereDate('order_date', '<=', $dateTo);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('po_number', 'ilike', $like)
                    ->orWhere('invoice_number', 'ilike', $like)
                    ->orWhere('notes', 'ilike', $like)
                    ->orWhereHas('supplier', fn ($sq) => $sq->withTrashed()->where('business_name', 'ilike', $like))
                    ->orWhereHas('purchase_order_items', fn ($iq) => $iq->where('item_name', 'ilike', $like)->orWhere('item_sku', 'ilike', $like));
            });
        }

        $orders = $query->limit(150)->get()->map(function (PurchaseOrder $po) {
            $poItems = $po->purchase_order_items;
            $unlinkedCount = $poItems->where('is_catalog_linked', false)->count();
            $receiptsCount = $po->attachments->count();

            return [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'invoice_number' => $po->invoice_number,
                'supplier_id' => $po->supplier_id,
                'supplier_name' => $po->supplier?->business_name,
                'supplier_code' => $po->supplier?->code,
                'supplier_contact_name' => $po->supplier_contact_name ?: $po->supplier?->contact_name,
                'supplier_whatsapp' => $po->supplier_whatsapp ?: $po->supplier?->whatsapp,
                'target_warehouse_id' => $po->target_warehouse_id,
                'branch_id' => $po->warehouse?->branch_id,
                'branch_code' => $po->warehouse?->branch?->code,
                'branch_name' => $po->warehouse?->branch?->name,
                'warehouse_code' => $po->warehouse?->code,
                'warehouse_name' => $po->warehouse?->name,
                'status' => $po->status,
                'payment_method' => $po->payment_method,
                'payment_status' => $po->payment_status,
                'amount_paid' => round((float) $po->amount_paid, 2),
                'order_date' => $po->order_date?->format('Y-m-d'),
                'expected_date' => $po->expected_date?->format('Y-m-d'),
                'received_at' => $po->received_at?->toISOString(),
                'subtotal' => round((float) $po->subtotal, 2),
                'tax_amount' => round((float) $po->tax_amount, 2),
                'shipping_cost' => round((float) $po->shipping_cost, 2),
                'total_amount' => round((float) $po->total_amount, 2),
                'items_count' => $poItems->count(),
                'total_units' => (int) $poItems->sum('quantity_ordered'),
                'received_units' => (int) $poItems->sum('quantity_received'),
                'unlinked_count' => $unlinkedCount,
                'attachments_count' => $receiptsCount,
                'created_by_name' => $this->resolveUserName($po->user),
                'notes' => $po->notes,
            ];
        })->values();

        $monthStart = now()->startOfMonth()->toDateString();
        $activeOrdersQuery = PurchaseOrder::where('status', '!=', 'cancelled');

        $stats = [
            'total_orders' => (clone $activeOrdersQuery)->count(),
            'month_spent' => round((float) (clone $activeOrdersQuery)->whereDate('order_date', '>=', $monthStart)->sum('total_amount'), 2),
            'pending_receipt_count' => PurchaseOrder::whereIn('status', ['draft', 'ordered', 'partial'])->count(),
            'pending_payment_total' => round((float) (clone $activeOrdersQuery)
                ->where('payment_status', '!=', 'paid')
                ->selectRaw('COALESCE(SUM(GREATEST(total_amount - amount_paid, 0)), 0) as pending_total')
                ->value('pending_total'), 2),
            'unlinked_items_count' => PurchaseOrderItem::where('is_catalog_linked', false)
                ->whereHas('purchase_order', fn ($q) => $q->where('status', '!=', 'cancelled'))
                ->count(),
            'suppliers_active_count' => Supplier::where('is_active', true)->count(),
        ];

        return $this->success([
            'items' => $orders,
            'stats' => $stats,
        ], 'Órdenes de compra obtenidas');
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->formatOrderDetail((int) $id), 'Detalle de compra obtenido');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'target_warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'status' => ['nullable', Rule::in(['draft', 'ordered', 'received'])],
            'invoice_number' => ['nullable', 'string', 'max:60'],
            'order_date' => ['nullable', 'date'],
            'expected_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'payment_status' => ['nullable', Rule::in(['pending', 'partial', 'paid'])],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'supplier_contact_name' => ['nullable', 'string', 'max:150'],
            'supplier_whatsapp' => ['nullable', 'string', 'max:30'],
            'update_catalog_cost' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.item_name' => ['required_without:items.*.variant_id', 'nullable', 'string', 'max:200'],
            'items.*.item_sku' => ['nullable', 'string', 'max:80'],
            'items.*.item_specs' => ['nullable', 'string', 'max:255'],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1', 'max:999999'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        // Prevent duplicate catalog variant_id within the same PO
        $catalogVariantIds = collect($validated['items'])
            ->pluck('variant_id')
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->map(fn ($v) => (int) $v);

        if ($catalogVariantIds->count() !== $catalogVariantIds->unique()->count()) {
            throw ValidationException::withMessages([
                'items' => ['Una misma variante del catálogo no debe repetirse en la misma orden; suma su cantidad en una sola línea.'],
            ]);
        }

        $supplier = Supplier::findOrFail($validated['supplier_id']);
        $status = $validated['status'] ?? 'ordered';
        $updateCatalogCost = !empty($validated['update_catalog_cost']);
        $userId = $request->user()?->id;

        $po = DB::transaction(function () use ($validated, $supplier, $status, $updateCatalogCost, $userId, $request) {
            $poNumber = CodeGenerator::next('purchase_orders', 'CMP-', 4, 'po_number');

            $subtotal = 0.0;
            $preparedItems = [];

            foreach ($validated['items'] as $row) {
                $qty = (int) $row['quantity_ordered'];
                $unitCost = round((float) $row['unit_cost'], 2);
                $lineTotal = round($qty * $unitCost, 2);
                $subtotal += $lineTotal;

                if (!empty($row['variant_id'])) {
                    $variant = ProductVariant::with('product:id,name')->findOrFail((int) $row['variant_id']);
                    $attrPart = $variant->variant_label ?: null;
                    $resolvedName = trim(($variant->product?->name ?? 'Producto') . ($attrPart ? " · {$attrPart}" : ''));

                    $preparedItems[] = [
                        'variant_id' => $variant->id,
                        'product_id' => $variant->product_id,
                        'item_name' => $resolvedName,
                        'item_sku' => $variant->sku,
                        'item_specs' => $row['item_specs'] ?? $attrPart,
                        'is_catalog_linked' => true,
                        'stock_entered' => false,
                        'quantity_ordered' => $qty,
                        'quantity_received' => $status === 'received' ? $qty : 0,
                        'unit_cost' => $unitCost,
                        'line_total' => $lineTotal,
                        'notes' => !empty($row['notes']) ? trim((string) $row['notes']) : null,
                    ];
                } else {
                    $customName = trim((string) ($row['item_name'] ?? ''));
                    if ($customName === '') {
                        throw ValidationException::withMessages([
                            'items' => ['Cada ítem nuevo sin catalogar debe tener un nombre descriptivo.'],
                        ]);
                    }

                    $preparedItems[] = [
                        'variant_id' => null,
                        'product_id' => null,
                        'item_name' => mb_substr($customName, 0, 200),
                        'item_sku' => !empty($row['item_sku']) ? mb_substr(trim((string) $row['item_sku']), 0, 80) : null,
                        'item_specs' => !empty($row['item_specs']) ? mb_substr(trim((string) $row['item_specs']), 0, 255) : null,
                        'is_catalog_linked' => false,
                        'stock_entered' => false,
                        'quantity_ordered' => $qty,
                        'quantity_received' => $status === 'received' ? $qty : 0,
                        'unit_cost' => $unitCost,
                        'line_total' => $lineTotal,
                        'notes' => !empty($row['notes']) ? trim((string) $row['notes']) : null,
                    ];
                }
            }

            $taxAmount = round((float) ($validated['tax_amount'] ?? 0), 2);
            $shippingCost = round((float) ($validated['shipping_cost'] ?? 0), 2);
            $totalAmount = round($subtotal + $taxAmount + $shippingCost, 2);

            $paymentStatus = $validated['payment_status'] ?? 'pending';
            $amountPaid = array_key_exists('amount_paid', $validated) && $validated['amount_paid'] !== null
                ? round((float) $validated['amount_paid'], 2)
                : ($paymentStatus === 'paid' ? $totalAmount : 0.0);

            if ($amountPaid >= $totalAmount && $totalAmount > 0) {
                $paymentStatus = 'paid';
            } elseif ($amountPaid > 0 && $amountPaid < $totalAmount) {
                $paymentStatus = 'partial';
            }

            $po = PurchaseOrder::create([
                'po_number' => $poNumber,
                'invoice_number' => !empty($validated['invoice_number']) ? trim($validated['invoice_number']) : null,
                'supplier_id' => $supplier->id,
                'target_warehouse_id' => (int) $validated['target_warehouse_id'],
                'status' => $status,
                'payment_method' => $validated['payment_method'] ?? null,
                'payment_status' => $paymentStatus,
                'amount_paid' => $amountPaid,
                'order_date' => $validated['order_date'] ?? now()->toDateString(),
                'expected_date' => $validated['expected_date'] ?? null,
                'received_at' => $status === 'received' ? now() : null,
                'subtotal' => round($subtotal, 2),
                'tax_amount' => $taxAmount,
                'shipping_cost' => $shippingCost,
                'total_amount' => $totalAmount,
                'created_by_user_id' => $userId,
                'supplier_contact_name' => !empty($validated['supplier_contact_name']) ? trim($validated['supplier_contact_name']) : $supplier->contact_name,
                'supplier_whatsapp' => !empty($validated['supplier_whatsapp']) ? trim($validated['supplier_whatsapp']) : $supplier->whatsapp,
                'notes' => !empty($validated['notes']) ? trim($validated['notes']) : null,
            ]);

            foreach ($preparedItems as $itemData) {
                $item = PurchaseOrderItem::create(array_merge($itemData, [
                    'purchase_order_id' => $po->id,
                ]));

                if ($status !== 'draft') {
                    $this->recordPriceHistoryForItem($po, $item, $userId);
                }

                if ($status === 'received' && $item->is_catalog_linked && $item->variant_id) {
                    $this->inventoryService->applyMovement(
                        warehouseId: $po->target_warehouse_id,
                        variantId: $item->variant_id,
                        movementType: 'purchase_in',
                        signedQuantity: (int) $item->quantity_received,
                        unitCost: (float) $item->unit_cost,
                        referenceType: 'purchase_order',
                        referenceId: $po->id,
                        notes: mb_substr("Compra {$po->po_number} · {$supplier->business_name}", 0, 255),
                        userId: $userId,
                        ipAddress: $request->ip(),
                        userAgent: $request->userAgent()
                    );

                    $item->stock_entered = true;
                    $item->save();

                    if ($updateCatalogCost) {
                        ProductVariant::where('id', $item->variant_id)->update([
                            'cost_price' => round((float) $item->unit_cost, 2),
                        ]);
                    }
                }
            }

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => Warehouse::where('id', $po->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'purchase_orders',
                'entity_id' => $po->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => [
                    'po_number' => $po->po_number,
                    'supplier_id' => $po->supplier_id,
                    'status' => $po->status,
                    'total_amount' => $po->total_amount,
                    'items_count' => count($preparedItems),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $po;
        });

        return $this->success($this->formatOrderDetail($po->id), 'Orden de compra registrada correctamente', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $po = PurchaseOrder::lockForUpdate()->findOrFail($id);

        $validated = $request->validate([
            'invoice_number' => ['nullable', 'string', 'max:60'],
            'expected_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'payment_status' => ['nullable', Rule::in(['pending', 'partial', 'paid'])],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'supplier_contact_name' => ['nullable', 'string', 'max:150'],
            'supplier_whatsapp' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($po, $validated, $request) {
            $old = $po->toArray();

            if (array_key_exists('invoice_number', $validated)) {
                $po->invoice_number = $validated['invoice_number'] ? trim($validated['invoice_number']) : null;
            }
            if (array_key_exists('expected_date', $validated)) {
                $po->expected_date = $validated['expected_date'];
            }
            if (array_key_exists('payment_method', $validated)) {
                $po->payment_method = $validated['payment_method'];
            }
            if (array_key_exists('supplier_contact_name', $validated)) {
                $po->supplier_contact_name = $validated['supplier_contact_name'] ? trim($validated['supplier_contact_name']) : null;
            }
            if (array_key_exists('supplier_whatsapp', $validated)) {
                $po->supplier_whatsapp = $validated['supplier_whatsapp'] ? trim($validated['supplier_whatsapp']) : null;
            }
            if (array_key_exists('notes', $validated)) {
                $po->notes = $validated['notes'] ? trim($validated['notes']) : null;
            }

            if ($po->status === 'draft') {
                if (array_key_exists('shipping_cost', $validated)) {
                    $po->shipping_cost = round((float) $validated['shipping_cost'], 2);
                }
                if (array_key_exists('tax_amount', $validated)) {
                    $po->tax_amount = round((float) $validated['tax_amount'], 2);
                }
                $po->total_amount = round((float) $po->subtotal + (float) $po->tax_amount + (float) $po->shipping_cost, 2);
            }

            if (array_key_exists('payment_status', $validated) && $validated['payment_status']) {
                $po->payment_status = $validated['payment_status'];
                if ($po->payment_status === 'paid' && !array_key_exists('amount_paid', $validated)) {
                    $po->amount_paid = (float) $po->total_amount;
                }
            }
            if (array_key_exists('amount_paid', $validated) && $validated['amount_paid'] !== null) {
                $po->amount_paid = round((float) $validated['amount_paid'], 2);
                if ($po->amount_paid >= (float) $po->total_amount && $po->total_amount > 0) {
                    $po->payment_status = 'paid';
                } elseif ($po->amount_paid > 0) {
                    $po->payment_status = 'partial';
                } else {
                    $po->payment_status = 'pending';
                }
            }

            $po->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $po->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'purchase_orders',
                'entity_id' => $po->id,
                'action' => 'UPDATE',
                'old_values' => $old,
                'new_values' => $po->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatOrderDetail($po->id), 'Orden de compra actualizada');
    }

    public function markOrdered(Request $request, string $id): JsonResponse
    {
        $userId = $request->user()?->id;

        DB::transaction(function () use ($id, $userId, $request) {
            $po = PurchaseOrder::with('purchase_order_items')->lockForUpdate()->findOrFail($id);

            if ($po->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => ['Solo órdenes en estado Borrador pueden confirmarse como Ordenadas.'],
                ]);
            }

            $po->status = 'ordered';
            $po->save();

            foreach ($po->purchase_order_items as $item) {
                $this->recordPriceHistoryForItem($po, $item, $userId);
            }

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => Warehouse::where('id', $po->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'purchase_orders',
                'entity_id' => $po->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => 'draft'],
                'new_values' => ['status' => 'ordered'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatOrderDetail((int) $id), 'Orden confirmada ante proveedor');
    }

    public function receive(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'invoice_number' => ['nullable', 'string', 'max:60'],
            'update_catalog_cost' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['nullable', 'array'],
            'items.*.id' => ['required_with:items', 'integer'],
            'items.*.quantity_received' => ['required_with:items', 'integer', 'min:0'],
        ]);

        $userId = $request->user()?->id;
        $updateCatalogCost = !empty($validated['update_catalog_cost']);

        DB::transaction(function () use ($id, $validated, $updateCatalogCost, $userId, $request) {
            $po = PurchaseOrder::with(['purchase_order_items', 'supplier'])
                ->lockForUpdate()
                ->findOrFail($id);

            if (!in_array($po->status, ['draft', 'ordered', 'partial'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Esta orden ya fue recibida por completo o está cancelada.'],
                ]);
            }

            $oldStatus = $po->status;
            $overrides = collect($validated['items'] ?? [])->keyBy('id');
            $allCompleted = true;
            $anyReceived = false;

            foreach ($po->purchase_order_items as $item) {
                $ordered = (int) $item->quantity_ordered;
                $alreadyReceived = (int) $item->quantity_received;
                $targetTotal = $overrides->has($item->id)
                    ? (int) $overrides->get($item->id)['quantity_received']
                    : $ordered;

                if ($targetTotal < $alreadyReceived || $targetTotal > $ordered) {
                    throw ValidationException::withMessages([
                        'items' => ["Cantidad recibida inválida para '{$item->item_name}'. Debe estar entre {$alreadyReceived} y {$ordered}."],
                    ]);
                }

                $delta = $targetTotal - $alreadyReceived;

                if ($targetTotal > 0) {
                    $anyReceived = true;
                }
                if ($targetTotal < $ordered) {
                    $allCompleted = false;
                }

                if ($delta > 0) {
                    $item->quantity_received = $targetTotal;

                    if ($item->is_catalog_linked && $item->variant_id) {
                        $supplierName = $po->supplier?->business_name ?? 'Proveedor';
                        $this->inventoryService->applyMovement(
                            warehouseId: $po->target_warehouse_id,
                            variantId: $item->variant_id,
                            movementType: 'purchase_in',
                            signedQuantity: $delta,
                            unitCost: (float) $item->unit_cost,
                            referenceType: 'purchase_order',
                            referenceId: $po->id,
                            notes: mb_substr("Recepción compra {$po->po_number} · {$supplierName}", 0, 255),
                            userId: $userId,
                            ipAddress: $request->ip(),
                            userAgent: $request->userAgent()
                        );
                        $item->stock_entered = true;

                        if ($updateCatalogCost) {
                            ProductVariant::where('id', $item->variant_id)->update([
                                'cost_price' => round((float) $item->unit_cost, 2),
                            ]);
                        }
                    }

                    $item->save();
                }

                $this->recordPriceHistoryForItem($po, $item, $userId);
            }

            if (!$anyReceived) {
                throw ValidationException::withMessages([
                    'items' => ['Debes recibir al menos una unidad para procesar la recepción.'],
                ]);
            }

            $po->status = $allCompleted ? 'received' : 'partial';
            $po->received_at = now();
            if (!empty($validated['invoice_number'])) {
                $po->invoice_number = trim($validated['invoice_number']);
            }
            if (!empty($validated['notes'])) {
                $po->notes = trim(($po->notes ? $po->notes . ' | ' : '') . $validated['notes']);
            }
            $po->save();

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => Warehouse::where('id', $po->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'purchase_orders',
                'entity_id' => $po->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => $po->status],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatOrderDetail((int) $id), 'Recepción de mercadería procesada');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $userId = $request->user()?->id;

        DB::transaction(function () use ($id, $userId, $request) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);

            if (!in_array($po->status, ['draft', 'ordered'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden cancelar órdenes en estado Borrador u Ordenada sin recepciones.'],
                ]);
            }

            $oldStatus = $po->status;
            PurchasePriceHistory::where('purchase_order_id', $po->id)->delete();

            $po->status = 'cancelled';
            $po->save();

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => Warehouse::where('id', $po->target_warehouse_id)->value('branch_id'),
                'entity_table' => 'purchase_orders',
                'entity_id' => $po->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => 'cancelled'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);
        });

        return $this->success($this->formatOrderDetail((int) $id), 'Orden de compra cancelada');
    }

    public function linkItemToVariant(Request $request, string $itemId): JsonResponse
    {
        $validated = $request->validate([
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'enter_stock' => ['nullable', 'boolean'],
            'update_catalog_cost' => ['nullable', 'boolean'],
        ]);

        $variant = ProductVariant::with('product:id,name')->findOrFail((int) $validated['variant_id']);
        $enterStock = array_key_exists('enter_stock', $validated) ? (bool) $validated['enter_stock'] : true;
        $updateCatalogCost = !empty($validated['update_catalog_cost']);
        $userId = $request->user()?->id;

        $poId = DB::transaction(function () use ($itemId, $variant, $enterStock, $updateCatalogCost, $userId, $request) {
            $item = PurchaseOrderItem::lockForUpdate()->findOrFail($itemId);
            $po = PurchaseOrder::with('supplier')->lockForUpdate()->findOrFail($item->purchase_order_id);

            // Check partial unique index collision on (purchase_order_id, variant_id)
            $duplicate = PurchaseOrderItem::where('purchase_order_id', $po->id)
                ->where('variant_id', $variant->id)
                ->where('id', '!=', $item->id)
                ->exists();

            if ($duplicate) {
                throw ValidationException::withMessages([
                    'variant_id' => ['Esta variante del catálogo ya está vinculada en otra línea de esta misma orden.'],
                ]);
            }

            $item->variant_id = $variant->id;
            $item->product_id = $variant->product_id;
            $item->is_catalog_linked = true;
            if (empty($item->item_sku)) {
                $item->item_sku = $variant->sku;
            }
            $item->save();

            // Update associated price history row to use canonical variant key
            $newKey = $this->buildItemKey($variant->id, $variant->sku, $item->item_name);
            $hist = PurchasePriceHistory::where('purchase_order_item_id', $item->id)->first();
            if ($hist) {
                $prev = PurchasePriceHistory::where('item_key', $newKey)
                    ->where('id', '!=', $hist->id)
                    ->orderByDesc('recorded_at')
                    ->orderByDesc('id')
                    ->first();

                $prevCost = $prev ? round((float) $prev->unit_cost, 2) : null;
                $unitCost = round((float) $hist->unit_cost, 2);
                $diff = $prevCost !== null ? round($unitCost - $prevCost, 2) : null;
                $diffPct = ($prevCost !== null && $prevCost > 0) ? round(($diff / $prevCost) * 100, 2) : null;

                $hist->variant_id = $variant->id;
                $hist->product_id = $variant->product_id;
                $hist->item_key = $newKey;
                $hist->item_sku = $variant->sku;
                $hist->previous_unit_cost = $prevCost;
                $hist->price_diff = $diff;
                $hist->price_diff_pct = $diffPct;
                $hist->save();
            }

            if (
                $enterStock
                && in_array($po->status, ['received', 'partial'], true)
                && !$item->stock_entered
                && (int) $item->quantity_received > 0
            ) {
                $supplierName = $po->supplier?->business_name ?? 'Proveedor';
                $this->inventoryService->applyMovement(
                    warehouseId: $po->target_warehouse_id,
                    variantId: $variant->id,
                    movementType: 'purchase_in',
                    signedQuantity: (int) $item->quantity_received,
                    unitCost: (float) $item->unit_cost,
                    referenceType: 'purchase_order',
                    referenceId: $po->id,
                    notes: mb_substr("Ingreso compra {$po->po_number} (vinculado) · {$supplierName}", 0, 255),
                    userId: $userId,
                    ipAddress: $request->ip(),
                    userAgent: $request->userAgent()
                );

                $item->stock_entered = true;
                $item->save();
            }

            if ($updateCatalogCost) {
                ProductVariant::where('id', $variant->id)->update([
                    'cost_price' => round((float) $item->unit_cost, 2),
                ]);
            }

            return $po->id;
        });

        return $this->success($this->formatOrderDetail($poId), 'Ítem vinculado al catálogo correctamente');
    }

    public function uploadAttachment(Request $request, string $id): JsonResponse
    {
        $po = PurchaseOrder::findOrFail($id);

        $validated = $request->validate([
            'file' => ['required', 'image', 'max:8192'],
            'attachment_type' => ['required', Rule::in(['receipt', 'product_photo', 'delivery_note', 'other'])],
            'purchase_order_item_id' => ['nullable', 'integer', 'exists:purchase_order_items,id'],
            'caption' => ['nullable', 'string', 'max:180'],
        ]);

        $type = $validated['attachment_type'];
        $itemId = !empty($validated['purchase_order_item_id']) ? (int) $validated['purchase_order_item_id'] : null;

        if ($itemId !== null) {
            $belongs = PurchaseOrderItem::where('id', $itemId)
                ->where('purchase_order_id', $po->id)
                ->exists();
            if (!$belongs) {
                throw ValidationException::withMessages([
                    'purchase_order_item_id' => ['El ítem seleccionado no pertenece a esta orden de compra.'],
                ]);
            }
        }

        $storageKey = $type === 'product_photo' ? StoragePath::PURCHASE_ITEMS : StoragePath::PURCHASE_RECEIPTS;
        $directory = StoragePath::directory($storageKey);

        $filename = $this->storageService->uploadFile($request->file('file'), $directory);

        $attachment = DB::transaction(function () use ($po, $itemId, $type, $filename, $validated, $request) {
            $attachment = PurchaseAttachment::create([
                'purchase_order_id' => $po->id,
                'purchase_order_item_id' => $itemId,
                'attachment_type' => $type,
                'file_path' => $filename,
                'caption' => !empty($validated['caption']) ? trim($validated['caption']) : null,
                'uploaded_by_user_id' => $request->user()?->id,
            ]);

            if ($itemId !== null && $type === 'product_photo') {
                PurchaseOrderItem::where('id', $itemId)->update(['photo_url' => $filename]);
                PurchasePriceHistory::where('purchase_order_item_id', $itemId)->update(['photo_url' => $filename]);
            }

            return $attachment->fresh();
        });

        return $this->success($attachment, 'Fotografía adjuntada correctamente', 201);
    }

    public function deleteAttachment(string $attachmentId): JsonResponse
    {
        $attachment = PurchaseAttachment::findOrFail($attachmentId);
        $rawFilename = $attachment->getRawFilename();
        $storageKey = $attachment->storageKey();

        DB::transaction(function () use ($attachment, $rawFilename) {
            if ($attachment->purchase_order_item_id && $attachment->attachment_type === 'product_photo') {
                PurchaseOrderItem::where('id', $attachment->purchase_order_item_id)
                    ->where('photo_url', $rawFilename)
                    ->update(['photo_url' => null]);

                PurchasePriceHistory::where('purchase_order_item_id', $attachment->purchase_order_item_id)
                    ->where('photo_url', $rawFilename)
                    ->update(['photo_url' => null]);
            }

            $attachment->delete();
        });

        if ($rawFilename) {
            $this->storageService->deleteFile(StoragePath::directory($storageKey), $rawFilename);
        }

        return $this->success(null, 'Fotografía eliminada');
    }

    public function priceHistory(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $supplierId = $request->query('supplier_id');
        $variantId = $request->query('variant_id');
        $onlyUnlinked = filter_var($request->query('only_unlinked', false), FILTER_VALIDATE_BOOLEAN);
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = PurchasePriceHistory::with([
            'supplier' => fn ($q) => $q->withTrashed()->select(['id', 'code', 'business_name', 'whatsapp']),
            'purchase_order:id,po_number,invoice_number,status',
            'product_variant' => fn ($q) => $q->withTrashed()->select(['id', 'sku', 'variant_label', 'cost_price', 'base_price']),
        ])->orderByDesc('recorded_at')->orderByDesc('id');

        if ($supplierId !== null && $supplierId !== '' && $supplierId !== 'all') {
            $query->where('supplier_id', (int) $supplierId);
        }

        if ($variantId !== null && $variantId !== '') {
            $query->where('variant_id', (int) $variantId);
        }

        if ($onlyUnlinked) {
            $query->whereNull('variant_id');
        }

        if (!empty($dateFrom)) {
            $query->whereDate('recorded_at', '>=', $dateFrom);
        }

        if (!empty($dateTo)) {
            $query->whereDate('recorded_at', '<=', $dateTo);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('item_name', 'ilike', $like)
                    ->orWhere('item_sku', 'ilike', $like)
                    ->orWhere('notes', 'ilike', $like)
                    ->orWhereHas('supplier', fn ($sq) => $sq->withTrashed()->where('business_name', 'ilike', $like));
            });
        }

        $rows = $query->limit(250)->get();

        $flatItems = $rows->map(fn (PurchasePriceHistory $h) => [
            'id' => $h->id,
            'item_key' => $h->item_key,
            'item_name' => $h->item_name,
            'item_sku' => $h->item_sku,
            'variant_id' => $h->variant_id,
            'product_id' => $h->product_id,
            'is_catalog_linked' => $h->variant_id !== null,
            'supplier_id' => $h->supplier_id,
            'supplier_name' => $h->supplier?->business_name,
            'supplier_whatsapp' => $h->supplier?->whatsapp,
                'purchase_order_id' => $h->purchase_order_id,
                'po_number' => $h->purchase_order?->po_number,
                'invoice_number' => $h->purchase_order?->invoice_number,
                'unit_cost' => round((float) $h->unit_cost, 2),
                'previous_unit_cost' => $h->previous_unit_cost !== null ? round((float) $h->previous_unit_cost, 2) : null,
                'price_diff' => $h->price_diff !== null ? round((float) $h->price_diff, 2) : null,
                'price_diff_pct' => $h->price_diff_pct !== null ? round((float) $h->price_diff_pct, 2) : null,
                'quantity' => (int) $h->quantity,
                'recorded_at' => $h->recorded_at?->format('Y-m-d'),
                'photo_url' => $h->photo_url,
                'notes' => $h->notes,
        ])->values();

        $grouped = $flatItems
            ->groupBy('item_key')
            ->map(function ($group, $key) {
                $sorted = $group->values();
                $latest = $sorted->first();
                $costs = $sorted->pluck('unit_cost');
                $second = $sorted->get(1);
                $latestCost = (float) $latest['unit_cost'];
                $prevCost = $latest['previous_unit_cost'] ?? ($second ? (float) $second['unit_cost'] : null);
                $diff = $prevCost !== null ? round($latestCost - $prevCost, 2) : null;
                $diffPct = ($prevCost !== null && $prevCost > 0) ? round(($diff / $prevCost) * 100, 2) : null;
                $photo = $sorted->pluck('photo_url')->filter()->first();

                return [
                    'item_key' => $key,
                    'item_name' => $latest['item_name'],
                    'item_sku' => $latest['item_sku'],
                    'variant_id' => $latest['variant_id'],
                    'product_id' => $latest['product_id'],
                    'is_catalog_linked' => $latest['is_catalog_linked'],
                    'latest_cost' => $latestCost,
                    'previous_cost' => $prevCost,
                    'price_diff' => $diff,
                    'price_diff_pct' => $diffPct,
                    'min_cost' => round((float) $costs->min(), 2),
                    'max_cost' => round((float) $costs->max(), 2),
                    'avg_cost' => round((float) $costs->avg(), 2),
                    'records_count' => $sorted->count(),
                    'latest_date' => $latest['recorded_at'],
                    'latest_supplier_name' => $latest['supplier_name'],
                    'photo_url' => $photo,
                    'history' => $sorted->all(),
                ];
            })
            ->values();

        return $this->success([
            'items' => $flatItems,
            'grouped' => $grouped,
        ], 'Historial de precios obtenido');
    }

    public function lookupLastPrice(Request $request): JsonResponse
    {
        $variantId = $request->query('variant_id') ? (int) $request->query('variant_id') : null;
        $itemSku = $request->query('item_sku');
        $itemName = (string) $request->query('item_name', '');

        if (!$variantId && trim($itemName) === '' && trim((string) $itemSku) === '') {
            return $this->success(['found' => false, 'record' => null]);
        }

        $key = $this->buildItemKey($variantId, $itemSku, $itemName);

        $latest = PurchasePriceHistory::with([
            'supplier' => fn ($q) => $q->withTrashed()->select(['id', 'business_name']),
            'purchase_order:id,po_number',
        ])
            ->where('item_key', $key)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->first();

        if (!$latest) {
            return $this->success(['found' => false, 'item_key' => $key, 'record' => null]);
        }

        return $this->success([
            'found' => true,
            'item_key' => $key,
            'record' => [
                'id' => $latest->id,
                'unit_cost' => round((float) $latest->unit_cost, 2),
                'previous_unit_cost' => $latest->previous_unit_cost !== null ? round((float) $latest->previous_unit_cost, 2) : null,
                'recorded_at' => $latest->recorded_at?->format('Y-m-d'),
                'supplier_id' => $latest->supplier_id,
                'supplier_name' => $latest->supplier?->business_name,
                'po_number' => $latest->purchase_order?->po_number,
                'quantity' => (int) $latest->quantity,
            ],
        ]);
    }

    public function storeManualPriceRecord(Request $request): JsonResponse
    {
        $data = $request->all();
        foreach (['variant_id', 'item_name', 'item_sku', 'notes'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] === '') {
                $data[$field] = null;
            }
        }
        $request->replace($data);

        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'item_name' => ['required_without:variant_id', 'nullable', 'string', 'max:200'],
            'item_sku' => ['nullable', 'string', 'max:80'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'recorded_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $variant = !empty($validated['variant_id'])
            ? ProductVariant::with('product:id,name')->findOrFail((int) $validated['variant_id'])
            : null;

        $itemName = $variant
            ? trim(($variant->product?->name ?? 'Producto') . ($variant->variant_label ? " · {$variant->variant_label}" : ''))
            : trim((string) $validated['item_name']);

        $itemSku = $variant ? $variant->sku : ($validated['item_sku'] ?? null);
        $itemKey = $this->buildItemKey($variant?->id, $itemSku, $itemName);
        $recordedAt = $validated['recorded_at'] ?? now()->toDateString();
        $unitCost = round((float) $validated['unit_cost'], 2);

        $photoFilename = null;
        if ($request->hasFile('photo')) {
            $photoFilename = $this->storageService->uploadFile(
                $request->file('photo'),
                StoragePath::directory(StoragePath::PURCHASE_ITEMS)
            );
        }

        $record = DB::transaction(function () use ($validated, $variant, $itemKey, $itemName, $itemSku, $recordedAt, $unitCost, $photoFilename, $request) {
            $prev = PurchasePriceHistory::where('item_key', $itemKey)
                ->orderByDesc('recorded_at')
                ->orderByDesc('id')
                ->first();

            $prevCost = $prev ? round((float) $prev->unit_cost, 2) : null;
            $diff = $prevCost !== null ? round($unitCost - $prevCost, 2) : null;
            $diffPct = ($prevCost !== null && $prevCost > 0) ? round(($diff / $prevCost) * 100, 2) : null;

            return PurchasePriceHistory::create([
                'supplier_id' => (int) $validated['supplier_id'],
                'purchase_order_id' => null,
                'purchase_order_item_id' => null,
                'variant_id' => $variant?->id,
                'product_id' => $variant?->product_id,
                'item_key' => $itemKey,
                'item_name' => mb_substr($itemName, 0, 200),
                'item_sku' => $itemSku ? mb_substr(trim($itemSku), 0, 80) : null,
                'unit_cost' => $unitCost,
                'previous_unit_cost' => $prevCost,
                'price_diff' => $diff,
                'price_diff_pct' => $diffPct,
                'quantity' => (int) ($validated['quantity'] ?? 1),
                'recorded_at' => $recordedAt,
                'photo_url' => $photoFilename,
                'notes' => !empty($validated['notes']) ? trim($validated['notes']) : null,
                'recorded_by_user_id' => $request->user()?->id,
            ]);
        });

        return $this->success($record->load('supplier:id,business_name'), 'Registro de precio guardado', 201);
    }

    private function buildItemKey(?int $variantId, ?string $sku, string $name): string
    {
        if ($variantId !== null && $variantId > 0) {
            return "variant:{$variantId}";
        }

        $cleanSku = trim((string) ($sku ?? ''));
        if ($cleanSku !== '') {
            return 'sku:' . mb_strtolower($cleanSku);
        }

        $normalizedName = mb_strtolower(trim((string) preg_replace('/\s+/', ' ', $name)));
        return 'name:' . mb_substr($normalizedName, 0, 210);
    }

    private function recordPriceHistoryForItem(PurchaseOrder $po, PurchaseOrderItem $item, ?int $userId): PurchasePriceHistory
    {
        $itemKey = $this->buildItemKey($item->variant_id, $item->item_sku, $item->item_name);
        $recordedAt = $po->order_date?->format('Y-m-d') ?? now()->toDateString();
        $unitCost = round((float) $item->unit_cost, 2);

        $existing = PurchasePriceHistory::where('purchase_order_item_id', $item->id)->first();

        $prevQuery = PurchasePriceHistory::where('item_key', $itemKey)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id');

        if ($existing) {
            $prevQuery->where('id', '!=', $existing->id);
        } else {
            $prevQuery->where(function ($q) use ($item) {
                $q->whereNull('purchase_order_item_id')
                    ->orWhere('purchase_order_item_id', '!=', $item->id);
            });
        }

        $prev = $prevQuery->first();
        $prevCost = $prev ? round((float) $prev->unit_cost, 2) : null;
        $diff = $prevCost !== null ? round($unitCost - $prevCost, 2) : null;
        $diffPct = ($prevCost !== null && $prevCost > 0) ? round(($diff / $prevCost) * 100, 2) : null;

        return PurchasePriceHistory::updateOrCreate(
            ['purchase_order_item_id' => $item->id],
            [
                'supplier_id' => $po->supplier_id,
                'purchase_order_id' => $po->id,
                'variant_id' => $item->variant_id,
                'product_id' => $item->product_id,
                'item_key' => $itemKey,
                'item_name' => mb_substr($item->item_name, 0, 200),
                'item_sku' => $item->item_sku,
                'unit_cost' => $unitCost,
                'previous_unit_cost' => $prevCost,
                'price_diff' => $diff,
                'price_diff_pct' => $diffPct,
                'quantity' => max(1, (int) $item->quantity_ordered),
                'recorded_at' => $recordedAt,
                'photo_url' => $item->getRawPhotoFilename(),
                'notes' => $item->notes ?: $po->notes,
                'recorded_by_user_id' => $userId,
            ]
        );
    }

    private function formatOrderDetail(int $poId): array
    {
        $po = PurchaseOrder::with([
            'supplier' => fn ($q) => $q->withTrashed(),
            'warehouse.branch:id,code,name',
            'user' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
            'purchase_order_items' => fn ($q) => $q->orderBy('id')->with([
                'product_variant' => fn ($vq) => $vq->withTrashed()->select(['id', 'product_id', 'sku', 'variant_label', 'cost_price', 'base_price']),
            ]),
            'attachments' => fn ($q) => $q->orderByDesc('id'),
        ])->findOrFail($poId);

        $histByItem = PurchasePriceHistory::where('purchase_order_id', $po->id)
            ->get()
            ->keyBy('purchase_order_item_id');

        $items = $po->purchase_order_items->map(function (PurchaseOrderItem $item) use ($histByItem) {
            $hist = $histByItem->get($item->id);
            return [
                'id' => $item->id,
                'variant_id' => $item->variant_id,
                'product_id' => $item->product_id,
                'item_name' => $item->item_name ?: ($item->product_variant?->variant_label ?? 'Ítem'),
                'item_sku' => $item->item_sku ?: $item->product_variant?->sku,
                'item_specs' => $item->item_specs,
                'is_catalog_linked' => (bool) $item->is_catalog_linked,
                'stock_entered' => (bool) $item->stock_entered,
                'quantity_ordered' => (int) $item->quantity_ordered,
                'quantity_received' => (int) $item->quantity_received,
                'unit_cost' => round((float) $item->unit_cost, 2),
                'line_total' => round((float) $item->line_total, 2),
                'previous_unit_cost' => $hist?->previous_unit_cost !== null ? round((float) $hist->previous_unit_cost, 2) : null,
                'price_diff' => $hist?->price_diff !== null ? round((float) $hist->price_diff, 2) : null,
                'price_diff_pct' => $hist?->price_diff_pct !== null ? round((float) $hist->price_diff_pct, 2) : null,
                'photo_url' => $item->photo_url,
                'notes' => $item->notes,
                'catalog_cost_price' => $item->product_variant ? round((float) $item->product_variant->cost_price, 2) : null,
                'catalog_base_price' => $item->product_variant ? round((float) $item->product_variant->base_price, 2) : null,
            ];
        })->values();

        return [
            'id' => $po->id,
            'po_number' => $po->po_number,
            'invoice_number' => $po->invoice_number,
            'supplier_id' => $po->supplier_id,
            'supplier' => $po->supplier ? [
                'id' => $po->supplier->id,
                'code' => $po->supplier->code,
                'business_name' => $po->supplier->business_name,
                'contact_name' => $po->supplier->contact_name,
                'phone' => $po->supplier->phone,
                'whatsapp' => $po->supplier->whatsapp,
                'tax_id' => $po->supplier->tax_id,
                'payment_terms' => $po->supplier->payment_terms,
                'photo_url' => $po->supplier->photo_url,
            ] : null,
            'supplier_contact_name' => $po->supplier_contact_name ?: $po->supplier?->contact_name,
            'supplier_whatsapp' => $po->supplier_whatsapp ?: $po->supplier?->whatsapp,
            'target_warehouse_id' => $po->target_warehouse_id,
            'branch_id' => $po->warehouse?->branch_id,
            'branch_code' => $po->warehouse?->branch?->code,
            'branch_name' => $po->warehouse?->branch?->name,
            'warehouse_code' => $po->warehouse?->code,
            'warehouse_name' => $po->warehouse?->name,
            'status' => $po->status,
            'payment_method' => $po->payment_method,
            'payment_status' => $po->payment_status,
            'amount_paid' => round((float) $po->amount_paid, 2),
            'order_date' => $po->order_date?->format('Y-m-d'),
            'expected_date' => $po->expected_date?->format('Y-m-d'),
            'received_at' => $po->received_at?->toISOString(),
            'subtotal' => round((float) $po->subtotal, 2),
            'tax_amount' => round((float) $po->tax_amount, 2),
            'shipping_cost' => round((float) $po->shipping_cost, 2),
            'total_amount' => round((float) $po->total_amount, 2),
            'created_by_name' => $this->resolveUserName($po->user),
            'notes' => $po->notes,
            'items' => $items,
            'attachments' => $po->attachments->values(),
        ];
    }

    private function resolveUserName($user): string
    {
        if (!$user) {
            return 'Sistema';
        }
        if ($user->person) {
            return trim($user->person->first_name . ' ' . $user->person->last_name);
        }
        return $user->username ?? $user->email ?? 'Usuario';
    }
}
