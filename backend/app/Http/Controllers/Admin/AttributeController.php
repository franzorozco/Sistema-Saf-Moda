<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttributeController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $attributes = Attribute::with(['attribute_values' => fn ($q) => $q->orderBy('sort_order')->orderBy('value')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success($attributes, 'Atributos obtenidos');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:40', 'unique:attributes,code'],
            'name' => ['required', 'string', 'max:80'],
            'data_type' => ['required', 'in:text,color_hex,numeric'],
            'is_variant_axis' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('attributes', 'A');
        $validated['is_variant_axis'] = $validated['is_variant_axis'] ?? true;
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $attribute = Attribute::create($validated);

        return $this->success($attribute->load('attribute_values'), 'Atributo creado', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $attribute = Attribute::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:40', 'unique:attributes,code,' . $attribute->id],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'data_type' => ['sometimes', 'required', 'in:text,color_hex,numeric'],
            'is_variant_axis' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $attribute->update($validated);

        return $this->success($attribute->load('attribute_values'), 'Atributo actualizado');
    }

    public function destroy(string $id): JsonResponse
    {
        Attribute::findOrFail($id)->delete();

        return $this->success(null, 'Atributo eliminado');
    }

    public function storeValue(Request $request, string $attributeId): JsonResponse
    {
        $attribute = Attribute::findOrFail($attributeId);

        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:40'],
            'value' => ['required', 'string', 'max:100'],
            'meta_hex' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('attribute_values', 'V', 4, 'code', ['attribute_id' => $attribute->id]);
        $validated['attribute_id'] = $attribute->id;
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $value = AttributeValue::create($validated);

        return $this->success($value, 'Valor agregado', 201);
    }

    public function destroyValue(string $valueId): JsonResponse
    {
        AttributeValue::findOrFail($valueId)->delete();

        return $this->success(null, 'Valor eliminado');
    }
}
