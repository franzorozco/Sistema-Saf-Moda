<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        return $this->success([], 'Categories list');
    }

    public function store(Request $request): JsonResponse
    {
        return $this->success($request->all(), 'Category created (stub)', 201);
    }

    public function show(string $id): JsonResponse
    {
        return $this->success(['id' => $id], 'Category detail');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->success(['id' => $id, 'data' => $request->all()], 'Category updated (stub)');
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success(['id' => $id], 'Category deleted (stub)');
    }
}
