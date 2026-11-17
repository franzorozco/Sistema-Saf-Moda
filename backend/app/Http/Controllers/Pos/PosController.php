<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class PosController extends Controller
{
    use ApiResponse;

    public function init(): JsonResponse
    {
        return $this->success([
            'categories' => [],
            'products' => [],
            'payment_methods' => ['cash', 'card', 'transfer'],
        ], 'POS initial data');
    }
}
