<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Services\Storage\ImageStorageService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductImageController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ImageStorageService $storageService)
    {
    }

    public function index(string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $images = ProductImage::with('product_variant:id,sku,variant_label')
            ->where('product_id', $product->id)
            ->orderByDesc('is_primary')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get();

        return $this->success($images, 'Imágenes obtenidas');
    }

    public function store(Request $request, string $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $validated = $request->validate([
            'image' => ['required', 'image', 'max:5120'],
            'scope' => ['required', 'in:product,variant,attribute'],
            'variant_id' => ['required_if:scope,variant', 'nullable', 'integer', 'exists:product_variants,id'],
            'attribute_id' => ['required_if:scope,attribute', 'nullable', 'integer', 'exists:attributes,id'],
            'attribute_value_id' => ['required_if:scope,attribute', 'nullable', 'integer', 'exists:attribute_values,id'],
            'alt_text' => ['nullable', 'string', 'max:180'],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        $imageUrl = $this->storageService->upload(
            $request->file('image'),
            'products/' . $product->sku_prefix
        );

        $isPrimary = filter_var($validated['is_primary'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $altText = $validated['alt_text'] ?? $product->name;

        $created = DB::transaction(function () use ($product, $validated, $imageUrl, $isPrimary, $altText) {
            if ($validated['scope'] === 'product') {
                if ($isPrimary) {
                    ProductImage::where('product_id', $product->id)
                        ->whereNull('variant_id')
                        ->update(['is_primary' => false]);
                }

                $img = ProductImage::create([
                    'product_id' => $product->id,
                    'variant_id' => null,
                    'image_url' => $imageUrl,
                    'alt_text' => $altText,
                    'is_primary' => $isPrimary,
                    'sort_order' => 0,
                ]);

                return [$img->load('product_variant:id,sku,variant_label')];
            }

            if ($validated['scope'] === 'variant') {
                $variantId = (int) $validated['variant_id'];
                if ($isPrimary) {
                    ProductImage::where('product_id', $product->id)
                        ->where('variant_id', $variantId)
                        ->update(['is_primary' => false]);
                }

                $img = ProductImage::create([
                    'product_id' => $product->id,
                    'variant_id' => $variantId,
                    'image_url' => $imageUrl,
                    'alt_text' => $altText,
                    'is_primary' => $isPrimary,
                    'sort_order' => 0,
                ]);

                return [$img->load('product_variant:id,sku,variant_label')];
            }

            // scope === 'attribute': asignar la misma URL a todas las variantes del producto con ese atributo/valor
            $matchingVariantIds = ProductVariant::where('product_id', $product->id)
                ->whereHas('variant_attribute_values', function ($q) use ($validated) {
                    $q->where('attribute_id', $validated['attribute_id'])
                        ->where('attribute_value_id', $validated['attribute_value_id']);
                })
                ->pluck('id');

            $records = [];
            foreach ($matchingVariantIds as $vId) {
                if ($isPrimary) {
                    ProductImage::where('product_id', $product->id)
                        ->where('variant_id', $vId)
                        ->update(['is_primary' => false]);
                }

                $img = ProductImage::create([
                    'product_id' => $product->id,
                    'variant_id' => $vId,
                    'image_url' => $imageUrl,
                    'alt_text' => $altText,
                    'is_primary' => $isPrimary,
                    'sort_order' => 0,
                ]);
                $records[] = $img->load('product_variant:id,sku,variant_label');
            }

            return $records;
        });

        if (count($created) === 0) {
            $this->storageService->deleteByUrl($imageUrl);
            return $this->error('Ninguna variante de este producto coincide con el atributo seleccionado.', 422);
        }

        return $this->success($created, 'Imagen subida correctamente', 201);
    }

    public function setPrimary(string $imageId): JsonResponse
    {
        $image = ProductImage::findOrFail($imageId);

        DB::transaction(function () use ($image) {
            $query = ProductImage::where('product_id', $image->product_id);
            if ($image->variant_id) {
                $query->where('variant_id', $image->variant_id);
            } else {
                $query->whereNull('variant_id');
            }
            $query->update(['is_primary' => false]);

            $image->update(['is_primary' => true]);
        });

        return $this->success($image->fresh('product_variant:id,sku,variant_label'), 'Imagen principal actualizada');
    }

    public function destroy(string $imageId): JsonResponse
    {
        $image = ProductImage::findOrFail($imageId);
        $url = $image->image_url;
        $image->delete();

        $stillReferenced = ProductImage::where('image_url', $url)->exists();
        if (!$stillReferenced) {
            $this->storageService->deleteByUrl($url);
        }

        return $this->success(null, 'Imagen eliminada');
    }
}
