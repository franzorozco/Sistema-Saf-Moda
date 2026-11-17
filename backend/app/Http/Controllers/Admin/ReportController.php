<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    use ApiResponse;

    public function sales(): JsonResponse
    {
        return $this->success([], 'Sales report');
    }

    public function inventory(): JsonResponse
    {
        return $this->success([], 'Inventory report');
    }
}
