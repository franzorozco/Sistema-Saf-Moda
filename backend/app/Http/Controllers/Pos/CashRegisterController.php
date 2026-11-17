<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Services\Pos\CashRegisterService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CashRegisterService $cashRegisterService)
    {
    }

    public function current(): JsonResponse
    {
        return $this->success(
            $this->cashRegisterService->getCurrentSession(),
            'Current cash register session'
        );
    }

    public function open(Request $request): JsonResponse
    {
        return $this->success($request->all(), 'Cash register opened (stub)', 201);
    }

    public function close(Request $request): JsonResponse
    {
        return $this->success($request->all(), 'Cash register closed (stub)');
    }
}
