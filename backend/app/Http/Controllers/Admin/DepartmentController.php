<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DepartmentController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $departments = Department::orderBy('sort_order')->orderBy('name')->get();

        return $this->success($departments, 'Departamentos obtenidos');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:30', 'unique:departments,code'],
            'name' => ['required', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('departments', 'D');
        $validated['slug'] = Str::slug($validated['name']);
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $department = Department::create($validated);

        return $this->success($department, 'Departamento creado', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:30', 'unique:departments,code,' . $department->id],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $department->update($validated);

        return $this->success($department, 'Departamento actualizado');
    }

    public function destroy(string $id): JsonResponse
    {
        Department::findOrFail($id)->delete();

        return $this->success(null, 'Departamento eliminado');
    }
}
