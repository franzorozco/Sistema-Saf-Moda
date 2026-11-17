<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        return $this->success([], 'Users list');
    }

    public function store(Request $request): JsonResponse
    {
        return $this->success($request->all(), 'User created (stub)', 201);
    }

    public function show(string $id): JsonResponse
    {
        return $this->success(['id' => $id], 'User detail');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->success(['id' => $id, 'data' => $request->all()], 'User updated (stub)');
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success(['id' => $id], 'User deleted (stub)');
    }
}
