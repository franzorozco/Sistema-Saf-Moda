<?php

use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin API V1 Routes (/api/v1/admin/*)
|--------------------------------------------------------------------------
*/

Route::get('/health', fn () => response()->json(['status' => 'ok', 'module' => 'admin', 'version' => 'v1']));

Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard.index');

Route::apiResource('products', ProductController::class);
Route::apiResource('categories', CategoryController::class);
Route::apiResource('users', UserController::class);

Route::prefix('reports')->name('reports.')->group(function () {
    Route::get('/sales', [ReportController::class, 'sales'])->name('sales');
    Route::get('/inventory', [ReportController::class, 'inventory'])->name('inventory');
});
