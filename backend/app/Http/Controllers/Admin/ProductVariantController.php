<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductVariantController extends Controller
{
    use ApiResponse;

    public function index(string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $variants = ProductVariant::with([
            'variant_attribute_values.attribute:id,name,code,data_type',
            'variant_attribute_values.attribute_value:id,value,code,meta_hex',
        ])
            ->where('product_id', $product->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return $this->success($variants, 'Variantes obtenidas');
    }

    public function store(Request $request, string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $validated = $request->validate([
            'sku' => ['nullable', 'string', 'max:64', 'unique:product_variants,sku'],
            'barcode' => ['nullable', 'string', 'max:64', 'unique:product_variants,barcode'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'is_default' => ['nullable', 'boolean'],
            'attributes' => ['nullable', 'array'],
            'attributes.*.attribute_id' => ['required', 'integer', 'exists:attributes,id'],
            'attributes.*.attribute_value_id' => ['required', 'integer', 'exists:attribute_values,id'],
        ]);

        $variant = DB::transaction(function () use ($product, $validated) {
            $count = ProductVariant::withTrashed()->where('product_id', $product->id)->count() + 1;
            $sku = !empty($validated['sku'])
                ? strtoupper($validated['sku'])
                : $product->sku_prefix . '-' . str_pad((string) $count, 2, '0', STR_PAD_LEFT);

            while (ProductVariant::withTrashed()->where('sku', $sku)->exists()) {
                $count++;
                $sku = $product->sku_prefix . '-' . str_pad((string) $count, 2, '0', STR_PAD_LEFT);
            }

            $attrItems = $validated['attributes'] ?? [];
            $labelParts = [];
            foreach ($attrItems as $item) {
                $val = AttributeValue::find($item['attribute_value_id']);
                if ($val) {
                    $labelParts[] = $val->value;
                }
            }

            if (!empty($validated['is_default'])) {
                ProductVariant::where('product_id', $product->id)->update(['is_default' => false]);
            }

            $variant = ProductVariant::create([
                'product_id' => $product->id,
                'sku' => $sku,
                'barcode' => $validated['barcode'] ?? null,
                'variant_label' => count($labelParts) > 0 ? implode(' / ', $labelParts) : 'Estándar',
                'cost_price' => $validated['cost_price'] ?? 0,
                'base_price' => $validated['base_price'],
                'is_default' => $validated['is_default'] ?? false,
                'is_active' => true,
            ]);

            foreach ($attrItems as $item) {
                DB::table('variant_attribute_values')->insert([
                    'variant_id' => $variant->id,
                    'attribute_id' => $item['attribute_id'],
                    'attribute_value_id' => $item['attribute_value_id'],
                ]);
            }

            return $variant;
        });

        return $this->success(
            $variant->load([
                'variant_attribute_values.attribute:id,name,code,data_type',
                'variant_attribute_values.attribute_value:id,value,code,meta_hex',
            ]),
            'Variante creada',
            201
        );
    }

    public function update(Request $request, string $variantId): JsonResponse
    {
        $variant = ProductVariant::findOrFail($variantId);

        $validated = $request->validate([
            'sku' => ['sometimes', 'required', 'string', 'max:64', 'unique:product_variants,sku,' . $variant->id],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'base_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:64', 'unique:product_variants,barcode,' . $variant->id],
            'is_active' => ['nullable', 'boolean'],
            'attributes' => ['nullable', 'array'],
            'attributes.*.attribute_id' => ['required', 'integer', 'exists:attributes,id'],
            'attributes.*.attribute_value_id' => ['required', 'integer', 'exists:attribute_values,id'],
        ]);

        DB::transaction(function () use ($variant, $validated) {
            if (array_key_exists('attributes', $validated)) {
                $attrItems = $validated['attributes'] ?? [];
                $labelParts = [];

                DB::table('variant_attribute_values')->where('variant_id', $variant->id)->delete();

                foreach ($attrItems as $item) {
                    DB::table('variant_attribute_values')->insert([
                        'variant_id' => $variant->id,
                        'attribute_id' => $item['attribute_id'],
                        'attribute_value_id' => $item['attribute_value_id'],
                    ]);
                    $val = AttributeValue::find($item['attribute_value_id']);
                    if ($val) {
                        $labelParts[] = $val->value;
                    }
                }

                $validated['variant_label'] = count($labelParts) > 0 ? implode(' / ', $labelParts) : 'Estándar';
                unset($validated['attributes']);
            }

            $variant->update($validated);
        });

        return $this->success(
            $variant->fresh()->load([
                'variant_attribute_values.attribute:id,name,code,data_type',
                'variant_attribute_values.attribute_value:id,value,code,meta_hex',
            ]),
            'Variante actualizada'
        );
    }

    public function destroy(string $variantId): JsonResponse
    {
        ProductVariant::findOrFail($variantId)->delete();

        return $this->success(null, 'Variante eliminada');
    }

    public function storeBatch(Request $request, string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $validated = $request->validate([
            'replace_existing' => ['nullable', 'boolean'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.base_price' => ['required', 'numeric', 'min:0'],
            'variants.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.stock' => ['nullable', 'integer', 'min:0'],
            'variants.*.attributes' => ['required', 'array', 'min:1'],
            'variants.*.attributes.*.attribute_id' => ['required', 'integer', 'exists:attributes,id'],
            'variants.*.attributes.*.attribute_value_id' => ['required', 'integer', 'exists:attribute_values,id'],
        ]);

        $warehouseId = DB::table('warehouses')->where('is_default', true)->value('id')
            ?? DB::table('warehouses')->value('id');

        $created = DB::transaction(function () use ($product, $validated, $warehouseId) {
            if (!empty($validated['replace_existing'])) {
                ProductVariant::where('product_id', $product->id)->delete();
            }

            $count = ProductVariant::withTrashed()->where('product_id', $product->id)->count();
            $hasDefault = ProductVariant::where('product_id', $product->id)->where('is_default', true)->exists();
            $results = [];

            foreach ($validated['variants'] as $idx => $item) {
                $count++;
                $sku = $product->sku_prefix . '-' . str_pad((string) $count, 2, '0', STR_PAD_LEFT);
                while (ProductVariant::withTrashed()->where('sku', $sku)->exists()) {
                    $count++;
                    $sku = $product->sku_prefix . '-' . str_pad((string) $count, 2, '0', STR_PAD_LEFT);
                }

                $labelParts = [];
                foreach ($item['attributes'] as $attrItem) {
                    $val = AttributeValue::find($attrItem['attribute_value_id']);
                    if ($val) {
                        $labelParts[] = $val->value;
                    }
                }

                $isDefault = !$hasDefault && $idx === 0;
                $variant = ProductVariant::create([
                    'product_id' => $product->id,
                    'sku' => $sku,
                    'variant_label' => implode(' / ', $labelParts),
                    'cost_price' => $item['cost_price'] ?? 0,
                    'base_price' => $item['base_price'],
                    'is_default' => $isDefault,
                    'is_active' => true,
                ]);

                foreach ($item['attributes'] as $attrItem) {
                    DB::table('variant_attribute_values')->insert([
                        'variant_id' => $variant->id,
                        'attribute_id' => $attrItem['attribute_id'],
                        'attribute_value_id' => $attrItem['attribute_value_id'],
                    ]);
                }

                if ($warehouseId && isset($item['stock']) && (int) $item['stock'] > 0) {
                    DB::table('inventories')->insert([
                        'warehouse_id' => $warehouseId,
                        'variant_id' => $variant->id,
                        'quantity_on_hand' => (int) $item['stock'],
                        'quantity_reserved' => 0,
                        'min_stock_alert' => 3,
                        'updated_at' => now(),
                    ]);
                }

                $results[] = $variant->load([
                    'variant_attribute_values.attribute:id,name,code,data_type',
                    'variant_attribute_values.attribute_value:id,value,code,meta_hex',
                ]);
            }

            return $results;
        });

        return $this->success($created, 'Variantes generadas correctamente', 201);
    }
}
