<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\DashboardService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly DashboardService $dashboardService)
    {
    }

    public function index(): JsonResponse
    {
        return $this->success(
            $this->dashboardService->getSummary(),
            'Admin dashboard summary'
        );
    }
}
