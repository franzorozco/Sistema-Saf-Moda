<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class HomeController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        return $this->success();
    }
}
