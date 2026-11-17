<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $categories = Category::with('category:id,name')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success($categories, 'Categorías obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'code' => ['nullable', 'string', 'max:40', 'unique:categories,code'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('categories', 'C');
        $validated['slug'] = Str::slug($validated['name']);
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $category = Category::create($validated);

        return $this->success($category->load('category:id,name'), 'Categoría creada', 201);
    }

    public function show(string $id): JsonResponse
    {
        $category = Category::with(['category:id,name', 'categories'])->findOrFail($id);

        return $this->success($category, 'Detalle de categoría');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id', 'not_in:' . $category->id],
            'code' => ['sometimes', 'required', 'string', 'max:40', 'unique:categories,code,' . $category->id],
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $category->update($validated);

        return $this->success($category->load('category:id,name'), 'Categoría actualizada');
    }

    public function destroy(string $id): JsonResponse
    {
        $category = Category::findOrFail($id);
        $category->delete();

        return $this->success(null, 'Categoría eliminada');
    }
}
