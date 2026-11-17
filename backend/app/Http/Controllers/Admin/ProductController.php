<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $products = Product::with([
            'department:id,name',
            'category:id,name',
            'brand:id,name',
            'season:id,name,year',
            'size_guide:id,name',
            'product_variants' => fn ($q) => $q->orderByDesc('is_default')->orderBy('id'),
        ])
            ->orderByDesc('id')
            ->get();

        $stats = [
            'total' => $products->count(),
            'active' => $products->where('is_active', true)->count(),
            'inactive' => $products->where('is_active', false)->count(),
            'sets' => $products->where('product_type', 'set')->count(),
        ];

        return $this->success([
            'items' => $products,
            'stats' => $stats,
        ], 'Productos obtenidos');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'season_id' => ['nullable', 'integer', 'exists:seasons,id'],
            'size_guide_id' => ['nullable', 'integer', 'exists:size_guides,id'],
            'product_type' => ['required', 'in:single,set'],
            'set_stock_mode' => ['nullable', 'in:none,independent,by_components'],
            'sku_prefix' => ['nullable', 'string', 'max:40', 'unique:products,sku_prefix'],
            'name' => ['required', 'string', 'max:180'],
            'short_description' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string'],
            'care_instructions' => ['nullable', 'string'],
            'is_taxable' => ['nullable', 'boolean'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $skuPrefix = !empty($validated['sku_prefix'])
            ? strtoupper($validated['sku_prefix'])
            : CodeGenerator::next('products', 'P', 4, 'sku_prefix');

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        if (Product::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . strtolower($skuPrefix);
        }

        $setStockMode = $validated['product_type'] === 'single'
            ? 'none'
            : ($validated['set_stock_mode'] && $validated['set_stock_mode'] !== 'none'
                ? $validated['set_stock_mode']
                : 'independent');

        $product = DB::transaction(function () use ($validated, $skuPrefix, $slug, $setStockMode) {
            $product = Product::create([
                'department_id' => $validated['department_id'],
                'category_id' => $validated['category_id'],
                'brand_id' => $validated['brand_id'] ?? null,
                'season_id' => $validated['season_id'] ?? null,
                'size_guide_id' => $validated['size_guide_id'] ?? null,
                'product_type' => $validated['product_type'],
                'set_stock_mode' => $setStockMode,
                'sku_prefix' => $skuPrefix,
                'name' => $validated['name'],
                'slug' => $slug,
                'short_description' => $validated['short_description'] ?? null,
                'description' => $validated['description'] ?? null,
                'care_instructions' => $validated['care_instructions'] ?? null,
                'is_taxable' => $validated['is_taxable'] ?? true,
                'tax_rate' => $validated['tax_rate'] ?? 0,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            ProductVariant::create([
                'product_id' => $product->id,
                'sku' => $skuPrefix . '-01',
                'variant_label' => 'Estándar',
                'cost_price' => $validated['cost_price'] ?? 0,
                'base_price' => $validated['base_price'],
                'is_default' => true,
                'is_active' => true,
            ]);

            return $product;
        });

        return $this->success(
            $product->load(['department:id,name', 'category:id,name', 'brand:id,name', 'season:id,name,year', 'product_variants']),
            'Producto creado',
            201
        );
    }

    public function show(string $id): JsonResponse
    {
        $product = Product::with([
            'department:id,name',
            'category:id,name',
            'brand:id,name',
            'season:id,name,year',
            'size_guide:id,name',
            'product_variants',
        ])->findOrFail($id);

        return $this->success($product, 'Detalle de producto');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'department_id' => ['sometimes', 'required', 'integer', 'exists:departments,id'],
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'season_id' => ['nullable', 'integer', 'exists:seasons,id'],
            'size_guide_id' => ['nullable', 'integer', 'exists:size_guides,id'],
            'product_type' => ['sometimes', 'required', 'in:single,set'],
            'set_stock_mode' => ['nullable', 'in:none,independent,by_components'],
            'name' => ['sometimes', 'required', 'string', 'max:180'],
            'short_description' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string'],
            'care_instructions' => ['nullable', 'string'],
            'is_taxable' => ['nullable', 'boolean'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (isset($validated['product_type'])) {
            $validated['set_stock_mode'] = $validated['product_type'] === 'single'
                ? 'none'
                : (($validated['set_stock_mode'] ?? 'independent') !== 'none'
                    ? ($validated['set_stock_mode'] ?? 'independent')
                    : 'independent');
        }

        DB::transaction(function () use ($product, $validated) {
            $product->update($validated);

            if (isset($validated['base_price']) || isset($validated['cost_price'])) {
                $defaultVariant = $product->product_variants()->orderByDesc('is_default')->first();
                if ($defaultVariant) {
                    $defaultVariant->update([
                        'base_price' => $validated['base_price'] ?? $defaultVariant->base_price,
                        'cost_price' => $validated['cost_price'] ?? $defaultVariant->cost_price,
                    ]);
                }
            }
        });

        return $this->success(
            $product->load(['department:id,name', 'category:id,name', 'brand:id,name', 'season:id,name,year', 'product_variants']),
            'Producto actualizado'
        );
    }

    public function destroy(string $id): JsonResponse
    {
        Product::findOrFail($id)->delete();

        return $this->success(null, 'Producto eliminado');
    }
}
