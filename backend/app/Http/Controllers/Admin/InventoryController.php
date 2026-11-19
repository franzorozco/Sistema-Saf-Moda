<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService
    ) {
    }

    public function meta(): JsonResponse
    {
        $warehousesCollection = Warehouse::with('branch:id,code,name,is_main,city')
            ->orderBy('branch_id')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get(['id', 'branch_id', 'code', 'name', 'warehouse_type', 'is_default', 'is_active']);

        $stockByWarehouse = Inventory::query()
            ->selectRaw('warehouse_id, COALESCE(SUM(quantity_on_hand), 0) as total_units, COALESCE(SUM(quantity_reserved), 0) as total_reserved')
            ->groupBy('warehouse_id')
            ->get()
            ->keyBy('warehouse_id');

        $warehouses = $warehousesCollection->map(function (Warehouse $w) use ($stockByWarehouse) {
            $sum = $stockByWarehouse->get($w->id);
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
                'total_units' => (int) ($sum?->total_units ?? 0),
                'total_reserved' => (int) ($sum?->total_reserved ?? 0),
            ];
        })->values();

        $branches = Branch::orderByDesc('is_main')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'branch_type', 'city', 'address_line', 'phone', 'is_main', 'is_active'])
            ->map(function (Branch $b) use ($warehousesCollection, $stockByWarehouse) {
                $branchWhs = $warehousesCollection->where('branch_id', $b->id);
                $defaultWh = $branchWhs->firstWhere('is_default', true) ?? $branchWhs->first();
                $totalUnits = $branchWhs->sum(fn ($w) => (int) ($stockByWarehouse->get($w->id)?->total_units ?? 0));
                $totalReserved = $branchWhs->sum(fn ($w) => (int) ($stockByWarehouse->get($w->id)?->total_reserved ?? 0));

                return [
                    'id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                    'branch_type' => $b->branch_type,
                    'city' => $b->city,
                    'address_line' => $b->address_line,
                    'phone' => $b->phone,
                    'is_main' => (bool) $b->is_main,
                    'is_active' => (bool) $b->is_active,
                    'warehouses_count' => $branchWhs->count(),
                    'default_warehouse_id' => $defaultWh?->id,
                    'total_units' => (int) $totalUnits,
                    'total_reserved' => (int) $totalReserved,
                    'total_available' => max(0, (int) $totalUnits - (int) $totalReserved),
                ];
            })->values();

        $catalogProducts = Product::with('brand:id,name')
            ->withCount('product_variants')
            ->orderBy('name')
            ->get(['id', 'sku_prefix', 'name', 'brand_id'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'sku_prefix' => $p->sku_prefix,
                'name' => $p->name,
                'brand_name' => $p->brand?->name,
                'variants_count' => (int) $p->product_variants_count,
            ])
            ->values();

        return $this->success([
            'branches' => $branches,
            'warehouses' => $warehouses,
            'catalog_products' => $catalogProducts,
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'brands' => Brand::orderBy('name')->get(['id', 'name']),
            'movement_types' => [
                ['value' => 'initial_stock', 'label' => 'Stock inicial', 'direction' => 'in'],
                ['value' => 'purchase_in', 'label' => 'Ingreso por compra', 'direction' => 'in'],
                ['value' => 'return_in', 'label' => 'Devolución de cliente', 'direction' => 'in'],
                ['value' => 'adjustment_in', 'label' => 'Ajuste positivo', 'direction' => 'in'],
                ['value' => 'transfer_in', 'label' => 'Recepción de traslado', 'direction' => 'in'],
                ['value' => 'set_assembly_in', 'label' => 'Armado de set', 'direction' => 'in'],
                ['value' => 'sale_out', 'label' => 'Salida por venta', 'direction' => 'out'],
                ['value' => 'adjustment_out', 'label' => 'Ajuste negativo', 'direction' => 'out'],
                ['value' => 'damaged_out', 'label' => 'Baja / Merma / Dañado', 'direction' => 'out'],
                ['value' => 'transfer_out', 'label' => 'Envío por traslado', 'direction' => 'out'],
                ['value' => 'set_assembly_out', 'label' => 'Desarmado de set', 'direction' => 'out'],
            ],
        ], 'Metadatos de inventario obtenidos');
    }

    public function productVariants(string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId, ['id', 'sku_prefix', 'name']);

        $variants = ProductVariant::where('product_id', $product->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->with([
                'variant_attribute_values.attribute:id,name',
                'variant_attribute_values.attribute_value:id,value',
                'inventories:id,warehouse_id,variant_id,quantity_on_hand,quantity_reserved,bin_location',
            ])
            ->get(['id', 'product_id', 'sku', 'variant_label', 'cost_price', 'base_price'])
            ->map(function (ProductVariant $v) {
                $attrs = $v->variant_attribute_values->map(fn ($vav) => [
                    'attribute_id' => $vav->attribute_id,
                    'attribute_name' => $vav->attribute?->name ?? 'Atributo',
                    'value' => $vav->attribute_value?->value ?? '-',
                ])->values()->all();

                return [
                    'id' => $v->id,
                    'sku' => $v->sku,
                    'variant_label' => $v->variant_label ?: collect($attrs)->pluck('value')->implode(' / ') ?: 'Estándar',
                    'cost_price' => round((float) $v->cost_price, 2),
                    'base_price' => round((float) $v->base_price, 2),
                    'warehouse_breakdown' => $v->inventories->map(fn (Inventory $inv) => [
                        'warehouse_id' => $inv->warehouse_id,
                        'quantity_on_hand' => (int) $inv->quantity_on_hand,
                        'quantity_reserved' => (int) $inv->quantity_reserved,
                        'available' => max(0, (int) $inv->quantity_on_hand - (int) $inv->quantity_reserved),
                        'bin_location' => $inv->bin_location,
                    ])->values()->all(),
                ];
            })
            ->values();

        return $this->success([
            'product' => $product,
            'variants' => $variants,
        ], 'Variantes del producto obtenidas');
    }

    public function index(Request $request): JsonResponse
    {
        $branchParam = $request->query('branch_id');
        $branchId = ($branchParam !== null && $branchParam !== '' && $branchParam !== 'all')
            ? (int) $branchParam
            : null;

        $warehouseParam = $request->query('warehouse_id');
        $warehouseId = ($warehouseParam !== null && $warehouseParam !== '' && $warehouseParam !== 'all')
            ? (int) $warehouseParam
            : null;

        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category_id');
        $brandId = $request->query('brand_id');
        $stockStatus = $request->query('stock_status', 'all');

        $allBranches = Branch::where('is_active', true)
            ->orderByDesc('is_main')
            ->orderBy('id')
            ->get(['id', 'code', 'name']);

        // Pares (warehouse_id, variant_id) que han tenido al menos 1 movimiento histórico
        $movedQuery = DB::table('inventory_movements')
            ->select('warehouse_id', 'variant_id')
            ->distinct();
        if ($warehouseId !== null) {
            $movedQuery->where('warehouse_id', $warehouseId);
        } elseif ($branchId !== null) {
            $branchWhIds = Warehouse::where('branch_id', $branchId)->pluck('id');
            $movedQuery->whereIn('warehouse_id', $branchWhIds);
        }
        $movedVariantIds = $movedQuery->pluck('variant_id')->flip()->all();

        $products = Product::with([
            'department:id,name',
            'category:id,name',
            'brand:id,name',
            'product_images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
            'product_variants' => fn ($q) => $q
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->with([
                    'variant_attribute_values.attribute:id,name,data_type',
                    'variant_attribute_values.attribute_value:id,value,meta_hex',
                    'product_images' => fn ($iq) => $iq->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
                    'inventories' => fn ($invQ) => $invQ->with('warehouse.branch:id,code,name'),
                ]),
        ])
            ->orderByDesc('id')
            ->get();

        $stats = [
            'total_products' => 0,
            'total_variants' => 0,
            'total_units' => 0,
            'total_reserved' => 0,
            'total_available' => 0,
            'low_stock_variants' => 0,
            'out_of_stock_variants' => 0,
            'total_cost_value' => 0.0,
            'total_retail_value' => 0.0,
        ];

        $formattedProducts = [];
        $likeNeedle = $search !== '' ? mb_strtolower($search) : null;

        foreach ($products as $product) {
            $productCover = $product->product_images
                ->first(fn ($img) => $img->variant_id === null)?->image_url
                ?? $product->product_images->first()?->image_url;

            $allVariantsData = [];

            foreach ($product->product_variants as $variant) {
                $allInventories = $variant->inventories;

                $warehouseBreakdown = $allInventories->map(fn (Inventory $inv) => [
                    'warehouse_id' => $inv->warehouse_id,
                    'warehouse_code' => $inv->warehouse?->code,
                    'warehouse_name' => $inv->warehouse?->name,
                    'branch_id' => $inv->warehouse?->branch_id,
                    'branch_code' => $inv->warehouse?->branch?->code,
                    'branch_name' => $inv->warehouse?->branch?->name,
                    'quantity_on_hand' => (int) $inv->quantity_on_hand,
                    'quantity_reserved' => (int) $inv->quantity_reserved,
                    'available' => max(0, (int) $inv->quantity_on_hand - (int) $inv->quantity_reserved),
                    'min_stock_alert' => (int) $inv->min_stock_alert,
                    'max_stock_limit' => $inv->max_stock_limit !== null ? (int) $inv->max_stock_limit : null,
                    'bin_location' => $inv->bin_location,
                ])->values()->all();

                $branchBreakdown = $allBranches->map(function (Branch $b) use ($allInventories) {
                    $branchInvs = $allInventories->filter(fn (Inventory $inv) => (int) $inv->warehouse?->branch_id === (int) $b->id);
                    $bOnHand = (int) $branchInvs->sum('quantity_on_hand');
                    $bReserved = (int) $branchInvs->sum('quantity_reserved');
                    return [
                        'branch_id' => $b->id,
                        'branch_code' => $b->code,
                        'branch_name' => $b->name,
                        'quantity_on_hand' => $bOnHand,
                        'quantity_reserved' => $bReserved,
                        'available' => max(0, $bOnHand - $bReserved),
                    ];
                })->values()->all();

                // Scoped inventories for the active filter (warehouse_id > branch_id > consolidated)
                if ($warehouseId !== null) {
                    $scopedInvs = $allInventories->where('warehouse_id', $warehouseId);
                } elseif ($branchId !== null) {
                    $scopedInvs = $allInventories->filter(fn (Inventory $inv) => (int) $inv->warehouse?->branch_id === $branchId);
                } else {
                    $scopedInvs = $allInventories;
                }

                if ($warehouseId !== null) {
                    $inv = $scopedInvs->first();
                    $onHand = $inv ? (int) $inv->quantity_on_hand : 0;
                    $reserved = $inv ? (int) $inv->quantity_reserved : 0;
                    $minAlert = $inv ? (int) $inv->min_stock_alert : 3;
                    $maxLimit = $inv && $inv->max_stock_limit !== null ? (int) $inv->max_stock_limit : null;
                    $binLocation = $inv?->bin_location;
                    $updatedAt = $inv?->updated_at?->toISOString();
                    $hasRecord = $inv !== null;
                } else {
                    $onHand = (int) $scopedInvs->sum('quantity_on_hand');
                    $reserved = (int) $scopedInvs->sum('quantity_reserved');
                    $minAlert = $scopedInvs->isNotEmpty()
                        ? ($scopedInvs->count() === 1 ? (int) $scopedInvs->first()->min_stock_alert : (int) $scopedInvs->sum('min_stock_alert'))
                        : 3;
                    $maxLimit = $scopedInvs->count() === 1 && $scopedInvs->first()->max_stock_limit !== null
                        ? (int) $scopedInvs->first()->max_stock_limit
                        : null;
                    $bins = $scopedInvs->pluck('bin_location')->filter()->unique()->values();
                    $binLocation = $bins->isNotEmpty() ? $bins->implode(', ') : null;
                    $latestInv = $scopedInvs->sortByDesc('updated_at')->first();
                    $updatedAt = $latestInv?->updated_at?->toISOString();
                    $hasRecord = $scopedInvs->isNotEmpty();
                }

                $available = max(0, $onHand - $reserved);
                $hasEverExisted = $onHand > 0 || isset($movedVariantIds[$variant->id]);

                // Omitir variantes con stock 0 que nunca tuvieron existencias en esta ubicación
                if (!$hasEverExisted) {
                    continue;
                }

                $scopedWarehousesList = $scopedInvs
                    ->filter(fn (Inventory $i) => (int) $i->quantity_on_hand > 0 || isset($movedVariantIds[$variant->id]))
                    ->map(fn (Inventory $i) => [
                        'warehouse_id' => $i->warehouse_id,
                        'warehouse_code' => $i->warehouse?->code,
                        'warehouse_name' => $i->warehouse?->name,
                        'branch_id' => $i->warehouse?->branch_id,
                        'branch_code' => $i->warehouse?->branch?->code,
                        'branch_name' => $i->warehouse?->branch?->name,
                        'quantity_on_hand' => (int) $i->quantity_on_hand,
                        'bin_location' => $i->bin_location,
                    ])
                    ->values()
                    ->all();

                if ($onHand <= 0) {
                    $variantStatus = 'out';
                } elseif ($warehouseId !== null || $scopedInvs->count() <= 1) {
                    if ($onHand <= $minAlert) {
                        $variantStatus = 'low';
                    } elseif ($maxLimit !== null && $onHand > $maxLimit) {
                        $variantStatus = 'overstock';
                    } else {
                        $variantStatus = 'ok';
                    }
                } else {
                    if ($scopedInvs->contains(fn ($i) => (int) $i->quantity_on_hand <= (int) $i->min_stock_alert)) {
                        $variantStatus = 'low';
                    } elseif ($scopedInvs->contains(fn ($i) => $i->max_stock_limit !== null && (int) $i->quantity_on_hand > (int) $i->max_stock_limit)) {
                        $variantStatus = 'overstock';
                    } else {
                        $variantStatus = 'ok';
                    }
                }

                $costPrice = round((float) $variant->cost_price, 2);
                $basePrice = round((float) $variant->base_price, 2);
                $costValue = round($onHand * $costPrice, 2);
                $retailValue = round($onHand * $basePrice, 2);

                $stats['total_variants']++;
                $stats['total_units'] += $onHand;
                $stats['total_reserved'] += $reserved;
                $stats['total_available'] += $available;
                $stats['total_cost_value'] = round($stats['total_cost_value'] + $costValue, 2);
                $stats['total_retail_value'] = round($stats['total_retail_value'] + $retailValue, 2);
                if ($variantStatus === 'out') {
                    $stats['out_of_stock_variants']++;
                } elseif ($variantStatus === 'low') {
                    $stats['low_stock_variants']++;
                }

                $attributes = $variant->variant_attribute_values->map(fn ($vav) => [
                    'attribute_id' => $vav->attribute_id,
                    'attribute_name' => $vav->attribute?->name ?? 'Atributo',
                    'value' => $vav->attribute_value?->value ?? '-',
                    'meta_hex' => $vav->attribute_value?->meta_hex,
                ])->values()->all();

                $variantImg = $variant->product_images->first()?->image_url ?? $productCover;

                $otherBranchesStock = $branchId !== null
                    ? array_values(array_filter($branchBreakdown, fn ($bb) => (int) $bb['branch_id'] !== $branchId && $bb['quantity_on_hand'] > 0))
                    : [];

                $allVariantsData[] = [
                    'id' => $variant->id,
                    'product_id' => $product->id,
                    'sku' => $variant->sku,
                    'barcode' => $variant->barcode,
                    'variant_label' => $variant->variant_label ?: collect($attributes)->pluck('value')->implode(' / ') ?: 'Estándar',
                    'attributes' => $attributes,
                    'cost_price' => $costPrice,
                    'base_price' => $basePrice,
                    'min_sale_price' => $variant->min_sale_price !== null ? round((float) $variant->min_sale_price, 2) : null,
                    'is_default' => (bool) $variant->is_default,
                    'is_active' => (bool) $variant->is_active,
                    'image_url' => $variantImg,
                    'quantity_on_hand' => $onHand,
                    'quantity_reserved' => $reserved,
                    'available' => $available,
                    'min_stock_alert' => $minAlert,
                    'max_stock_limit' => $maxLimit,
                    'bin_location' => $binLocation,
                    'has_record' => $hasRecord,
                    'updated_at' => $updatedAt,
                    'stock_status' => $variantStatus,
                    'cost_value' => $costValue,
                    'retail_value' => $retailValue,
                    'branch_breakdown' => $branchBreakdown,
                    'other_branches_stock' => $otherBranchesStock,
                    'scoped_locations' => $scopedWarehousesList,
                    'warehouse_breakdown' => $warehouseBreakdown,
                ];
            }

            if (empty($allVariantsData)) {
                continue;
            }

            $stats['total_products']++;

            if ($categoryId !== null && $categoryId !== '' && (int) $product->category_id !== (int) $categoryId) {
                continue;
            }

            if ($brandId !== null && $brandId !== '' && (int) $product->brand_id !== (int) $brandId) {
                continue;
            }

            $filteredVariants = $allVariantsData;

            if ($likeNeedle !== null) {
                $productMatches = str_contains(mb_strtolower($product->name), $likeNeedle)
                    || str_contains(mb_strtolower($product->sku_prefix), $likeNeedle);

                if (!$productMatches) {
                    $filteredVariants = array_values(array_filter($filteredVariants, function ($v) use ($likeNeedle) {
                        return str_contains(mb_strtolower($v['sku']), $likeNeedle)
                            || str_contains(mb_strtolower((string) ($v['barcode'] ?? '')), $likeNeedle)
                            || str_contains(mb_strtolower((string) $v['variant_label']), $likeNeedle);
                    }));
                }
            }

            if ($stockStatus !== null && $stockStatus !== '' && $stockStatus !== 'all') {
                $filteredVariants = array_values(array_filter($filteredVariants, function ($v) use ($stockStatus) {
                    return match ($stockStatus) {
                        'in_stock' => $v['quantity_on_hand'] > 0,
                        'low' => $v['stock_status'] === 'low',
                        'out' => $v['stock_status'] === 'out',
                        'alert' => in_array($v['stock_status'], ['low', 'out'], true),
                        'overstock' => $v['stock_status'] === 'overstock',
                        default => true,
                    };
                }));
            }

            if (empty($filteredVariants)) {
                continue;
            }

            $totalOnHand = array_sum(array_column($filteredVariants, 'quantity_on_hand'));
            $totalReserved = array_sum(array_column($filteredVariants, 'quantity_reserved'));
            $totalAvailable = array_sum(array_column($filteredVariants, 'available'));
            $totalCostValue = round(array_sum(array_column($filteredVariants, 'cost_value')), 2);
            $totalRetailValue = round(array_sum(array_column($filteredVariants, 'retail_value')), 2);
            $prices = array_column($filteredVariants, 'base_price');
            $outCount = count(array_filter($filteredVariants, fn ($v) => $v['stock_status'] === 'out'));
            $lowCount = count(array_filter($filteredVariants, fn ($v) => $v['stock_status'] === 'low'));

            if ($outCount === count($filteredVariants)) {
                $productStockStatus = 'out';
            } elseif ($outCount > 0 || $lowCount > 0) {
                $productStockStatus = 'low';
            } else {
                $productStockStatus = 'ok';
            }

            $productBranchBreakdown = $allBranches->map(function (Branch $b) use ($filteredVariants) {
                $units = 0;
                foreach ($filteredVariants as $fv) {
                    foreach ($fv['branch_breakdown'] as $bb) {
                        if ((int) $bb['branch_id'] === (int) $b->id) {
                            $units += (int) $bb['quantity_on_hand'];
                        }
                    }
                }
                return [
                    'branch_id' => $b->id,
                    'branch_code' => $b->code,
                    'branch_name' => $b->name,
                    'quantity_on_hand' => $units,
                ];
            })->values()->all();

            $formattedProducts[] = [
                'id' => $product->id,
                'sku_prefix' => $product->sku_prefix,
                'name' => $product->name,
                'product_type' => $product->product_type,
                'is_active' => (bool) $product->is_active,
                'department_name' => $product->department?->name,
                'category_id' => $product->category_id,
                'category_name' => $product->category?->name,
                'brand_id' => $product->brand_id,
                'brand_name' => $product->brand?->name,
                'cover_image' => $productCover,
                'variants_count' => count($filteredVariants),
                'total_variants_count' => count($allVariantsData),
                'total_on_hand' => $totalOnHand,
                'total_reserved' => $totalReserved,
                'total_available' => $totalAvailable,
                'low_count' => $lowCount,
                'out_count' => $outCount,
                'cost_value' => $totalCostValue,
                'retail_value' => $totalRetailValue,
                'min_price' => !empty($prices) ? min($prices) : 0.0,
                'max_price' => !empty($prices) ? max($prices) : 0.0,
                'stock_status' => $productStockStatus,
                'branch_breakdown' => $productBranchBreakdown,
                'variants' => array_values($filteredVariants),
            ];
        }

        return $this->success([
            'items' => $formattedProducts,
            'stats' => $stats,
            'branch_id' => $branchId,
            'warehouse_id' => $warehouseId,
            'filtered_products_count' => count($formattedProducts),
        ], 'Inventario obtenido');
    }

    public function storeMovement(Request $request): JsonResponse
    {
        $allowedTypes = ['initial_stock', 'purchase_in', 'return_in', 'adjustment_in', 'adjustment_out', 'damaged_out'];

        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'mode' => ['nullable', Rule::in(['movement', 'set_exact'])],
            'movement_type' => [
                Rule::requiredIf(fn () => $request->input('mode', 'movement') === 'movement'),
                'nullable',
                Rule::in($allowedTypes),
            ],
            'quantity' => [
                Rule::requiredIf(fn () => $request->input('mode', 'movement') === 'movement'),
                'nullable',
                'integer',
                'min:1',
                'max:999999',
            ],
            'target_quantity' => [
                Rule::requiredIf(fn () => $request->input('mode') === 'set_exact'),
                'nullable',
                'integer',
                'min:0',
                'max:999999',
            ],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'update_variant_cost' => ['nullable', 'boolean'],
            'notes' => ['required', 'string', 'min:4', 'max:255'],
        ], [
            'notes.required' => 'La justificación del movimiento es obligatoria.',
            'notes.min' => 'La justificación debe tener al menos 4 caracteres.',
        ]);

        $mode = $validated['mode'] ?? 'movement';
        $warehouseId = (int) $validated['warehouse_id'];
        $variantId = (int) $validated['variant_id'];
        $notes = trim($validated['notes']);

        $result = DB::transaction(function () use ($mode, $validated, $warehouseId, $variantId, $notes, $request) {
            if ($mode === 'set_exact') {
                $existing = Inventory::where('warehouse_id', $warehouseId)
                    ->where('variant_id', $variantId)
                    ->lockForUpdate()
                    ->first();

                $currentQty = $existing ? (int) $existing->quantity_on_hand : 0;
                $targetQty = (int) $validated['target_quantity'];
                $delta = $targetQty - $currentQty;

                if ($delta === 0) {
                    throw ValidationException::withMessages([
                        'target_quantity' => ["El stock actual ya es {$currentQty}. Ingresa una cantidad distinta para registrar ajuste."],
                    ]);
                }

                $movementType = $delta > 0 ? 'adjustment_in' : 'adjustment_out';
                $signedQty = $delta;
            } else {
                $movementType = $validated['movement_type'];
                $qty = (int) $validated['quantity'];
                $signedQty = in_array($movementType, InventoryService::IN_TYPES, true) ? $qty : -$qty;
            }

            $unitCost = isset($validated['unit_cost']) ? (float) $validated['unit_cost'] : null;

            if (!empty($validated['update_variant_cost']) && $unitCost !== null) {
                ProductVariant::where('id', $variantId)->update([
                    'cost_price' => round($unitCost, 2),
                ]);
            }

            return $this->inventoryService->applyMovement(
                warehouseId: $warehouseId,
                variantId: $variantId,
                movementType: $movementType,
                signedQuantity: $signedQty,
                unitCost: $unitCost,
                referenceType: $mode === 'set_exact' ? 'exact_adjustment' : 'manual_movement',
                referenceId: null,
                notes: $notes,
                userId: $request->user()?->id,
                ipAddress: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return $this->success($result, 'Movimiento de inventario registrado', 201);
    }

    public function storeBatchEntry(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'movement_type' => ['required', Rule::in(['initial_stock', 'purchase_in', 'return_in', 'adjustment_in'])],
            'notes' => ['required', 'string', 'min:4', 'max:255'],
            'update_variant_cost' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999999'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.bin_location' => ['nullable', 'string', 'max:50'],
        ], [
            'notes.required' => 'La justificación del ingreso es obligatoria.',
            'notes.min' => 'La justificación debe tener al menos 4 caracteres.',
            'items.min' => 'Debes ingresar cantidad mayor a cero en al menos una variante.',
        ]);

        $warehouseId = (int) $validated['warehouse_id'];
        $productId = (int) $validated['product_id'];
        $movementType = $validated['movement_type'];
        $notes = trim($validated['notes']);
        $updateCost = !empty($validated['update_variant_cost']);

        $variantIds = collect($validated['items'])->pluck('variant_id')->unique()->values();
        $validVariants = ProductVariant::where('product_id', $productId)
            ->whereIn('id', $variantIds)
            ->pluck('id')
            ->all();

        if (count($validVariants) !== $variantIds->count()) {
            throw ValidationException::withMessages([
                'items' => ['Una o más variantes no pertenecen al producto seleccionado.'],
            ]);
        }

        $processed = DB::transaction(function () use ($validated, $warehouseId, $productId, $movementType, $notes, $updateCost, $request) {
            $results = [];

            foreach ($validated['items'] as $row) {
                $variantId = (int) $row['variant_id'];
                $qty = (int) $row['quantity'];
                $unitCost = isset($row['unit_cost']) ? (float) $row['unit_cost'] : null;

                if ($updateCost && $unitCost !== null) {
                    ProductVariant::where('id', $variantId)->update([
                        'cost_price' => round($unitCost, 2),
                    ]);
                }

                $res = $this->inventoryService->applyMovement(
                    warehouseId: $warehouseId,
                    variantId: $variantId,
                    movementType: $movementType,
                    signedQuantity: $qty,
                    unitCost: $unitCost,
                    referenceType: 'product_batch_entry',
                    referenceId: $productId,
                    notes: $notes,
                    userId: $request->user()?->id,
                    ipAddress: $request->ip(),
                    userAgent: $request->userAgent()
                );

                if (!empty($row['bin_location'])) {
                    Inventory::where('warehouse_id', $warehouseId)
                        ->where('variant_id', $variantId)
                        ->update(['bin_location' => trim((string) $row['bin_location'])]);
                }

                $results[] = $res;
            }

            return $results;
        });

        return $this->success([
            'count' => count($processed),
            'results' => $processed,
        ], 'Ingreso masivo por producto registrado', 201);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'min_stock_alert' => ['required', 'integer', 'min:0', 'max:999999'],
            'max_stock_limit' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'bin_location' => ['nullable', 'string', 'max:50'],
        ]);

        if (
            isset($validated['max_stock_limit'])
            && $validated['max_stock_limit'] !== null
            && (int) $validated['max_stock_limit'] < (int) $validated['min_stock_alert']
        ) {
            throw ValidationException::withMessages([
                'max_stock_limit' => ['El límite máximo debe ser mayor o igual al stock mínimo de alerta.'],
            ]);
        }

        $warehouseId = (int) $validated['warehouse_id'];
        $variantId = (int) $validated['variant_id'];

        $inventory = DB::transaction(function () use ($warehouseId, $variantId, $validated, $request) {
            $inv = Inventory::where('warehouse_id', $warehouseId)
                ->where('variant_id', $variantId)
                ->lockForUpdate()
                ->first();

            if (!$inv) {
                $inv = Inventory::create([
                    'warehouse_id' => $warehouseId,
                    'variant_id' => $variantId,
                    'quantity_on_hand' => 0,
                    'quantity_reserved' => 0,
                    'min_stock_alert' => (int) $validated['min_stock_alert'],
                    'max_stock_limit' => $validated['max_stock_limit'] ?? null,
                    'bin_location' => !empty($validated['bin_location']) ? trim($validated['bin_location']) : null,
                    'updated_at' => now(),
                ]);
                $old = null;
                $action = 'INSERT';
            } else {
                $old = [
                    'min_stock_alert' => (int) $inv->min_stock_alert,
                    'max_stock_limit' => $inv->max_stock_limit !== null ? (int) $inv->max_stock_limit : null,
                    'bin_location' => $inv->bin_location,
                ];
                $inv->min_stock_alert = (int) $validated['min_stock_alert'];
                $inv->max_stock_limit = $validated['max_stock_limit'] ?? null;
                $inv->bin_location = !empty($validated['bin_location']) ? trim($validated['bin_location']) : null;
                $inv->updated_at = now();
                $inv->save();
                $action = 'UPDATE';
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => Warehouse::where('id', $warehouseId)->value('branch_id'),
                'entity_table' => 'inventories',
                'entity_id' => $inv->id,
                'action' => $action,
                'old_values' => $old,
                'new_values' => [
                    'min_stock_alert' => (int) $inv->min_stock_alert,
                    'max_stock_limit' => $inv->max_stock_limit,
                    'bin_location' => $inv->bin_location,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $inv->fresh();
        });

        return $this->success($inventory, 'Parámetros de stock actualizados');
    }

    public function movements(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');
        $warehouseId = $request->query('warehouse_id');
        $movementType = $request->query('movement_type');
        $variantId = $request->query('variant_id');
        $productId = $request->query('product_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $search = trim((string) $request->query('search', ''));
        $limit = min(200, max(10, (int) $request->query('limit', 80)));

        $query = InventoryMovement::with([
            'warehouse.branch:id,code,name',
            'product_variant' => fn ($q) => $q->withTrashed()->with([
                'product' => fn ($pq) => $pq->withTrashed()->select(['id', 'name', 'sku_prefix']),
            ]),
            'user' => fn ($q) => $q->withTrashed()->with('person:id,first_name,last_name'),
        ])->orderByDesc('id');

        if ($warehouseId !== null && $warehouseId !== '' && $warehouseId !== 'all') {
            $query->where('warehouse_id', (int) $warehouseId);
        } elseif ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $query->whereHas('warehouse', fn ($wq) => $wq->where('branch_id', (int) $branchId));
        }

        if ($movementType !== null && $movementType !== '') {
            $query->where('movement_type', $movementType);
        }

        if ($variantId !== null && $variantId !== '') {
            $query->where('variant_id', (int) $variantId);
        }

        if ($productId !== null && $productId !== '') {
            $query->whereHas('product_variant', fn ($vq) => $vq->withTrashed()->where('product_id', (int) $productId));
        }

        if (!empty($dateFrom)) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if (!empty($dateTo)) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('notes', 'ilike', $like)
                    ->orWhereHas('product_variant', function ($vq) use ($like) {
                        $vq->withTrashed()
                            ->where('sku', 'ilike', $like)
                            ->orWhere('variant_label', 'ilike', $like)
                            ->orWhereHas('product', fn ($pq) => $pq->withTrashed()->where('name', 'ilike', $like));
                    });
            });
        }

        $rows = $query->limit($limit)->get();

        $items = $rows->map(function (InventoryMovement $mov) {
            $person = $mov->user?->person;
            $actorName = $person
                ? trim($person->first_name . ' ' . $person->last_name)
                : ($mov->user?->username ?? 'Sistema');

            return [
                'id' => $mov->id,
                'branch_id' => $mov->warehouse?->branch_id,
                'branch_code' => $mov->warehouse?->branch?->code,
                'branch_name' => $mov->warehouse?->branch?->name,
                'warehouse_id' => $mov->warehouse_id,
                'warehouse_code' => $mov->warehouse?->code,
                'warehouse_name' => $mov->warehouse?->name,
                'variant_id' => $mov->variant_id,
                'sku' => $mov->product_variant?->sku,
                'variant_label' => $mov->product_variant?->variant_label ?: 'Estándar',
                'product_id' => $mov->product_variant?->product_id,
                'product_name' => $mov->product_variant?->product?->name,
                'movement_type' => $mov->movement_type,
                'quantity' => (int) $mov->quantity,
                'unit_cost' => round((float) $mov->unit_cost, 2),
                'balance_after' => (int) $mov->balance_after,
                'reference_type' => $mov->reference_type,
                'reference_id' => $mov->reference_id,
                'notes' => $mov->notes,
                'performed_by_name' => $actorName,
                'created_at' => $mov->created_at?->toISOString(),
            ];
        })->values();

        $entriesQty = $rows->where('quantity', '>', 0)->sum('quantity');
        $exitsQty = abs((int) $rows->where('quantity', '<', 0)->sum('quantity'));

        return $this->success([
            'items' => $items,
            'summary' => [
                'count' => $rows->count(),
                'entries_units' => (int) $entriesQty,
                'exits_units' => (int) $exitsQty,
                'net_units' => (int) ($entriesQty - $exitsQty),
            ],
        ], 'Kardex de movimientos obtenido');
    }
}
