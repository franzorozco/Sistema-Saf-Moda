<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Brand;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\PaymentMethod;
use App\Models\Person;
use App\Models\Product;
use App\Models\Warehouse;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PosController extends Controller
{
    use ApiResponse;

    public function init(Request $request): JsonResponse
    {
        $warehousesCollection = Warehouse::with('branch:id,code,name,city,is_main')
            ->where('is_active', true)
            ->orderBy('branch_id')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get(['id', 'branch_id', 'code', 'name', 'warehouse_type', 'is_default']);

        $branches = Branch::where('is_active', true)
            ->orderByDesc('is_main')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'city', 'is_main'])
            ->map(function (Branch $b) use ($warehousesCollection) {
                $whs = $warehousesCollection->where('branch_id', $b->id);
                $def = $whs->firstWhere('is_default', true) ?? $whs->first();
                return [
                    'id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                    'city' => $b->city,
                    'is_main' => (bool) $b->is_main,
                    'default_warehouse_id' => $def?->id,
                ];
            })
            ->values();

        $warehouses = $warehousesCollection->map(fn (Warehouse $w) => [
            'id' => $w->id,
            'branch_id' => $w->branch_id,
            'branch_code' => $w->branch?->code,
            'branch_name' => $w->branch?->name,
            'code' => $w->code,
            'name' => $w->name,
            'is_default' => (bool) $w->is_default,
        ])->values();

        $selectedWarehouseId = $request->query('warehouse_id') ? (int) $request->query('warehouse_id') : null;
        $selectedBranchId = $request->query('branch_id') ? (int) $request->query('branch_id') : null;

        if ($selectedWarehouseId) {
            $wh = $warehousesCollection->firstWhere('id', $selectedWarehouseId);
            if ($wh) {
                $selectedBranchId = $wh->branch_id;
            }
        } elseif ($selectedBranchId) {
            $wh = $warehousesCollection->where('branch_id', $selectedBranchId)->firstWhere('is_default', true)
                ?? $warehousesCollection->where('branch_id', $selectedBranchId)->first();
            $selectedWarehouseId = $wh?->id;
        } else {
            $defaultBranch = $branches->first();
            $selectedBranchId = $defaultBranch['id'] ?? null;
            $selectedWarehouseId = $defaultBranch['default_warehouse_id'] ?? $warehousesCollection->first()?->id;
        }

        // Productos activos con variantes y su stock en el almacén seleccionado
        $products = Product::with([
            'category:id,name',
            'brand:id,name',
            'product_images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
            'product_variants' => fn ($q) => $q
                ->where('is_active', true)
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->with([
                    'variant_attribute_values.attribute:id,name',
                    'variant_attribute_values.attribute_value:id,value',
                    'product_images' => fn ($iq) => $iq->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
                    'inventories' => fn ($invQ) => $selectedWarehouseId
                        ? $invQ->where('warehouse_id', $selectedWarehouseId)
                        : $invQ,
                ]),
        ])
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Product $product) {
                $cover = $product->product_images
                    ->first(fn ($img) => $img->variant_id === null)?->image_url
                    ?? $product->product_images->first()?->image_url;

                $variants = $product->product_variants->map(function ($v) use ($cover, $product) {
                    $inv = $v->inventories->first();
                    $onHand = $inv ? (int) $inv->quantity_on_hand : 0;
                    $reserved = $inv ? (int) $inv->quantity_reserved : 0;
                    $available = max(0, $onHand - $reserved);

                    $attrs = $v->variant_attribute_values->map(fn ($vav) => [
                        'name' => $vav->attribute?->name ?? 'Atributo',
                        'value' => $vav->attribute_value?->value ?? '-',
                    ])->values()->all();

                    return [
                        'id' => $v->id,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'sku' => $v->sku,
                        'barcode' => $v->barcode,
                        'variant_label' => $v->variant_label ?: collect($attrs)->pluck('value')->implode(' / ') ?: 'Estándar',
                        'attributes' => $attrs,
                        'base_price' => round((float) $v->base_price, 2),
                        'min_sale_price' => $v->min_sale_price !== null ? round((float) $v->min_sale_price, 2) : null,
                        'cost_price' => round((float) $v->cost_price, 2),
                        'image_url' => $v->product_images->first()?->image_url ?? $cover,
                        'quantity_on_hand' => $onHand,
                        'quantity_reserved' => $reserved,
                        'available' => $available,
                    ];
                })->filter(fn ($v) => $v['quantity_on_hand'] > 0)->values();

                if ($variants->isEmpty()) {
                    return null;
                }

                return [
                    'id' => $product->id,
                    'sku_prefix' => $product->sku_prefix,
                    'name' => $product->name,
                    'category_id' => $product->category_id,
                    'category_name' => $product->category?->name,
                    'brand_name' => $product->brand?->name,
                    'cover_image' => $cover,
                    'total_available' => (int) $variants->sum('available'),
                    'total_reserved' => (int) $variants->sum('quantity_reserved'),
                    'min_price' => $variants->min('base_price'),
                    'max_price' => $variants->max('base_price'),
                    'variants' => $variants->all(),
                ];
            })
            ->filter()
            ->values();

        $categories = Category::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        $paymentMethods = PaymentMethod::where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'method_type']);

        $customers = Customer::with('person:id,first_name,last_name,document_number,phone')
            ->where('is_active', true)
            ->orderByDesc('id')
            ->limit(250)
            ->get()
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'customer_code' => $c->customer_code,
                'full_name' => trim(($c->person?->first_name ?? '') . ' ' . ($c->person?->last_name ?? '')) ?: $c->customer_code,
                'document_number' => $c->person?->document_number,
                'phone' => $c->person?->phone,
                'customer_tier' => $c->customer_tier,
                'loyalty_points' => (int) $c->loyalty_points,
                'store_credit' => round((float) $c->store_credit, 2),
            ])
            ->values();

        $employees = Employee::with('person:id,first_name,last_name')
            ->where('employment_status', 'active')
            ->orderBy('id')
            ->get()
            ->map(fn (Employee $e) => [
                'id' => $e->id,
                'employee_code' => $e->employee_code,
                'branch_id' => $e->branch_id,
                'full_name' => trim(($e->person?->first_name ?? '') . ' ' . ($e->person?->last_name ?? '')) ?: $e->employee_code,
            ])
            ->values();

        $activeSession = null;
        if ($selectedBranchId) {
            $sess = CashRegisterSession::with('cash_register:id,branch_id,code,name')
                ->where('status', 'open')
                ->whereHas('cash_register', fn ($q) => $q->where('branch_id', $selectedBranchId))
                ->orderByDesc('id')
                ->first();
            if ($sess) {
                $activeSession = [
                    'id' => $sess->id,
                    'cash_register_code' => $sess->cash_register?->code,
                    'cash_register_name' => $sess->cash_register?->name,
                    'opened_at' => $sess->opened_at?->toISOString(),
                ];
            }
        }

        return $this->success([
            'selected_branch_id' => $selectedBranchId,
            'selected_warehouse_id' => $selectedWarehouseId,
            'branches' => $branches,
            'warehouses' => $warehouses,
            'categories' => $categories,
            'payment_methods' => $paymentMethods,
            'customers' => $customers,
            'employees' => $employees,
            'active_cash_session' => $activeSession,
            'products' => $products,
        ], 'Datos iniciales de POS obtenidos');
    }

    public function storeQuickCustomer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'document_number' => ['nullable', 'string', 'max:40'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $customer = DB::transaction(function () use ($validated) {
            $person = Person::create([
                'first_name' => trim($validated['first_name']),
                'last_name' => trim($validated['last_name']),
                'phone' => !empty($validated['phone']) ? trim($validated['phone']) : null,
                'document_type' => !empty($validated['document_number']) ? 'CI' : null,
                'document_number' => !empty($validated['document_number']) ? trim($validated['document_number']) : null,
            ]);

            $code = CodeGenerator::next('customers', 'CLI-', 4, 'customer_code');

            return Customer::create([
                'person_id' => $person->id,
                'customer_code' => $code,
                'customer_tier' => 'regular',
                'loyalty_points' => 0,
                'store_credit' => 0,
                'acquired_branch_id' => $validated['branch_id'] ?? null,
                'is_active' => true,
            ])->load('person:id,first_name,last_name,document_number,phone');
        });

        return $this->success([
            'id' => $customer->id,
            'customer_code' => $customer->customer_code,
            'full_name' => trim($customer->person->first_name . ' ' . $customer->person->last_name),
            'document_number' => $customer->person->document_number,
            'phone' => $customer->person->phone,
            'customer_tier' => $customer->customer_tier,
            'loyalty_points' => 0,
            'store_credit' => 0.0,
        ], 'Cliente registrado rápidamente', 201);
    }

    public function inventory(Request $request): JsonResponse
    {
        $branches = Branch::where('is_active', true)
            ->orderByDesc('is_main')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'city', 'is_main']);

        $selectedBranchId = $request->query('branch_id')
            ? (int) $request->query('branch_id')
            : ($branches->first()?->id ?? null);

        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category_id');
        $brandId = $request->query('brand_id');
        $availability = $request->query('availability', 'all');

        $products = Product::with([
            'category:id,name',
            'brand:id,name',
            'product_images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
            'product_variants' => fn ($q) => $q
                ->where('is_active', true)
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->with([
                    'variant_attribute_values.attribute:id,name',
                    'variant_attribute_values.attribute_value:id,value',
                    'product_images' => fn ($iq) => $iq->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id'),
                    'inventories' => fn ($invQ) => $invQ->with('warehouse.branch:id,code,name,city'),
                ]),
        ])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $stats = [
            'total_products' => 0,
            'total_variants' => 0,
            'available_here_variants' => 0,
            'only_other_branches_variants' => 0,
            'out_of_stock_variants' => 0,
        ];

        $likeNeedle = $search !== '' ? mb_strtolower($search) : null;
        $formattedProducts = [];

        foreach ($products as $product) {
            $cover = $product->product_images
                ->first(fn ($img) => $img->variant_id === null)?->image_url
                ?? $product->product_images->first()?->image_url;

            $allVariants = [];

            foreach ($product->product_variants as $variant) {
                $invs = $variant->inventories;

                // Stock en MI sucursal
                $myInvs = $selectedBranchId
                    ? $invs->filter(fn ($i) => (int) $i->warehouse?->branch_id === $selectedBranchId)
                    : $invs;

                $myOnHand = (int) $myInvs->sum('quantity_on_hand');
                $myReserved = (int) $myInvs->sum('quantity_reserved');
                $myAvailable = max(0, $myOnHand - $myReserved);

                $myLocations = $myInvs
                    ->filter(fn ($i) => (int) $i->quantity_on_hand > 0 || !empty($i->bin_location))
                    ->map(fn ($i) => [
                        'warehouse_code' => $i->warehouse?->code,
                        'warehouse_name' => $i->warehouse?->name,
                        'bin_location' => $i->bin_location,
                        'available' => max(0, (int) $i->quantity_on_hand - (int) $i->quantity_reserved),
                    ])
                    ->values()
                    ->all();

                // Stock en OTRAS sucursales (solo lectura para consulta del vendedor)
                $otherBranches = $branches
                    ->filter(fn (Branch $b) => $selectedBranchId === null || (int) $b->id !== $selectedBranchId)
                    ->map(function (Branch $b) use ($invs) {
                        $bInvs = $invs->filter(fn ($i) => (int) $i->warehouse?->branch_id === (int) $b->id);
                        $bOnHand = (int) $bInvs->sum('quantity_on_hand');
                        $bReserved = (int) $bInvs->sum('quantity_reserved');
                        $bAvail = max(0, $bOnHand - $bReserved);

                        if ($bAvail <= 0) {
                            return null;
                        }

                        return [
                            'branch_id' => $b->id,
                            'branch_code' => $b->code,
                            'branch_name' => $b->name,
                            'city' => $b->city,
                            'available' => $bAvail,
                            'quantity_on_hand' => $bOnHand,
                            'quantity_reserved' => $bReserved,
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();

                $otherTotalAvail = array_sum(array_column($otherBranches, 'available'));
                $totalAllAvail = $myAvailable + $otherTotalAvail;

                if ($myAvailable > 0) {
                    $availStatus = 'available_here';
                    $stats['available_here_variants']++;
                } elseif ($otherTotalAvail > 0) {
                    $availStatus = 'only_other_branches';
                    $stats['only_other_branches_variants']++;
                } else {
                    $availStatus = 'out_of_stock';
                    $stats['out_of_stock_variants']++;
                }

                $stats['total_variants']++;

                $attrs = $variant->variant_attribute_values->map(fn ($vav) => [
                    'attribute_id' => $vav->attribute_id,
                    'attribute_name' => $vav->attribute?->name ?? 'Atributo',
                    'value' => $vav->attribute_value?->value ?? '-',
                ])->values()->all();

                $allVariants[] = [
                    'id' => $variant->id,
                    'sku' => $variant->sku,
                    'barcode' => $variant->barcode,
                    'variant_label' => $variant->variant_label ?: collect($attrs)->pluck('value')->implode(' / ') ?: 'Estándar',
                    'attributes' => $attrs,
                    // Solo precios de venta (NUNCA cost_price en POS)
                    'base_price' => round((float) $variant->base_price, 2),
                    'min_sale_price' => $variant->min_sale_price !== null ? round((float) $variant->min_sale_price, 2) : null,
                    'image_url' => $variant->product_images->first()?->image_url ?? $cover,
                    'my_branch_on_hand' => $myOnHand,
                    'my_branch_reserved' => $myReserved,
                    'my_branch_available' => $myAvailable,
                    'my_branch_locations' => $myLocations,
                    'other_branches' => $otherBranches,
                    'other_branches_available' => $otherTotalAvail,
                    'total_available_all' => $totalAllAvail,
                    'availability_status' => $availStatus,
                ];
            }

            if (empty($allVariants)) {
                continue;
            }

            $stats['total_products']++;

            if ($categoryId !== null && $categoryId !== '' && (int) $product->category_id !== (int) $categoryId) {
                continue;
            }
            if ($brandId !== null && $brandId !== '' && (int) $product->brand_id !== (int) $brandId) {
                continue;
            }

            $filteredVars = $allVariants;

            if ($likeNeedle !== null) {
                $prodMatch = str_contains(mb_strtolower($product->name), $likeNeedle)
                    || str_contains(mb_strtolower($product->sku_prefix), $likeNeedle);

                if (!$prodMatch) {
                    $filteredVars = array_values(array_filter($filteredVars, function ($v) use ($likeNeedle) {
                        return str_contains(mb_strtolower($v['sku']), $likeNeedle)
                            || str_contains(mb_strtolower((string) ($v['barcode'] ?? '')), $likeNeedle)
                            || str_contains(mb_strtolower((string) $v['variant_label']), $likeNeedle);
                    }));
                }
            }

            if ($availability !== 'all') {
                $filteredVars = array_values(array_filter($filteredVars, fn ($v) => $v['availability_status'] === $availability));
            }

            if (empty($filteredVars)) {
                continue;
            }

            $prices = array_column($filteredVars, 'base_price');
            $myAvailSum = array_sum(array_column($filteredVars, 'my_branch_available'));
            $otherAvailSum = array_sum(array_column($filteredVars, 'other_branches_available'));

            $prodStatus = $myAvailSum > 0
                ? 'available_here'
                : ($otherAvailSum > 0 ? 'only_other_branches' : 'out_of_stock');

            $formattedProducts[] = [
                'id' => $product->id,
                'sku_prefix' => $product->sku_prefix,
                'name' => $product->name,
                'category_id' => $product->category_id,
                'category_name' => $product->category?->name,
                'brand_id' => $product->brand_id,
                'brand_name' => $product->brand?->name,
                'cover_image' => $cover,
                'min_price' => !empty($prices) ? min($prices) : 0.0,
                'max_price' => !empty($prices) ? max($prices) : 0.0,
                'my_branch_available' => $myAvailSum,
                'other_branches_available' => $otherAvailSum,
                'availability_status' => $prodStatus,
                'variants' => array_values($filteredVars),
            ];
        }

        return $this->success([
            'selected_branch_id' => $selectedBranchId,
            'branches' => $branches,
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'brands' => Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'stats' => $stats,
            'items' => $formattedProducts,
        ], 'Inventario de consulta POS obtenido');
    }
}
