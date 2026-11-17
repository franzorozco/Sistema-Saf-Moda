<?php

use App\Http\Controllers\Pos\CashRegisterController;
use App\Http\Controllers\Pos\PosController;
use App\Http\Controllers\Pos\SaleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| POS API V1 Routes (/api/v1/pos/*)
|--------------------------------------------------------------------------
*/

Route::get('/health', fn () => response()->json(['status' => 'ok', 'module' => 'pos', 'version' => 'v1']));

Route::get('/init', [PosController::class, 'init'])->name('init');

Route::prefix('cash-register')->name('cash-register.')->group(function () {
    Route::get('/current', [CashRegisterController::class, 'current'])->name('current');
    Route::post('/open', [CashRegisterController::class, 'open'])->name('open');
    Route::post('/close', [CashRegisterController::class, 'close'])->name('close');
});

Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
