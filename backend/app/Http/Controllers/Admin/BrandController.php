<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BrandController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $brands = Brand::orderBy('name')->get();

        return $this->success($brands, 'Marcas obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:30', 'unique:brands,code'],
            'name' => ['required', 'string', 'max:120'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('brands', 'M');
        $validated['slug'] = Str::slug($validated['name']);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $brand = Brand::create($validated);

        return $this->success($brand, 'Marca creada', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brand = Brand::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:30', 'unique:brands,code,' . $brand->id],
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $brand->update($validated);

        return $this->success($brand, 'Marca actualizada');
    }

    public function destroy(string $id): JsonResponse
    {
        Brand::findOrFail($id)->delete();

        return $this->success(null, 'Marca eliminada');
    }
}
