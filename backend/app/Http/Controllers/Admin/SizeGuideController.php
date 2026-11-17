<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SizeGuide;
use App\Models\SizeGuideItem;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SizeGuideController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $guides = SizeGuide::with([
            'department:id,name',
            'category:id,name',
            'size_guide_items' => fn ($q) => $q->orderBy('sort_order')->orderBy('id'),
        ])
            ->orderBy('name')
            ->get();

        return $this->success($guides, 'Guías de tallas obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:120'],
            'unit' => ['required', 'in:cm,in'],
            'notes' => ['nullable', 'string'],
        ]);

        $guide = SizeGuide::create($validated);

        return $this->success($guide->load(['department:id,name', 'category:id,name', 'size_guide_items']), 'Guía de tallas creada', 201);
    }

    public function destroy(string $id): JsonResponse
    {
        SizeGuide::findOrFail($id)->delete();

        return $this->success(null, 'Guía de tallas eliminada');
    }

    public function storeItem(Request $request, string $guideId): JsonResponse
    {
        $guide = SizeGuide::findOrFail($guideId);

        $validated = $request->validate([
            'size_label' => ['required', 'string', 'max:20'],
            'measurements' => ['required', 'array'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $validated['size_guide_id'] = $guide->id;
        $validated['sort_order'] = $validated['sort_order'] ?? 0;

        $item = SizeGuideItem::create($validated);

        return $this->success($item, 'Talla agregada a la guía', 201);
    }

    public function destroyItem(string $itemId): JsonResponse
    {
        SizeGuideItem::findOrFail($itemId)->delete();

        return $this->success(null, 'Talla eliminada de la guía');
    }
}
