<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Season;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SeasonController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $seasons = Season::orderByDesc('year')->orderBy('name')->get();

        return $this->success($seasons, 'Colecciones obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:30', 'unique:seasons,code'],
            'name' => ['required', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['code'] = !empty($validated['code'])
            ? strtoupper($validated['code'])
            : CodeGenerator::next('seasons', 'T');
        $validated['is_active'] = $validated['is_active'] ?? true;
        $season = Season::create($validated);

        return $this->success($season, 'Colección creada', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $season = Season::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:30', 'unique:seasons,code,' . $season->id],
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'year' => ['sometimes', 'required', 'integer', 'min:2000', 'max:2100'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $season->update($validated);

        return $this->success($season, 'Colección actualizada');
    }

    public function destroy(string $id): JsonResponse
    {
        Season::findOrFail($id)->delete();

        return $this->success(null, 'Colección eliminada');
    }
}
