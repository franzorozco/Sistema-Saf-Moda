<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class ShopController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        return $this->success();
    }
}
