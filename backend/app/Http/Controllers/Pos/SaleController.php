<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Services\Pos\SaleService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly SaleService $saleService)
    {
    }

    public function index(): JsonResponse
    {
        return $this->success([], 'POS sales list');
    }

    public function store(Request $request): JsonResponse
    {
        return $this->success(
            $this->saleService->createSale($request->all()),
            'Sale registered (stub)',
            201
        );
    }

    public function show(string $id): JsonResponse
    {
        return $this->success(['id' => $id], 'Sale detail');
    }
}
