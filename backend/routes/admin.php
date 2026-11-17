<?php

use App\Http\Controllers\Admin\AttributeController;
use App\Http\Controllers\Admin\BrandController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DepartmentController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProductImageController;
use App\Http\Controllers\Admin\ProductVariantController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SeasonController;
use App\Http\Controllers\Admin\SizeGuideController;
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
Route::get('/products/{productId}/variants', [ProductVariantController::class, 'index'])->name('products.variants.index');
Route::post('/products/{productId}/variants', [ProductVariantController::class, 'store'])->name('products.variants.store');
Route::post('/products/{productId}/variants/batch', [ProductVariantController::class, 'storeBatch'])->name('products.variants.batch');
Route::put('/product-variants/{variantId}', [ProductVariantController::class, 'update'])->name('product-variants.update');
Route::delete('/product-variants/{variantId}', [ProductVariantController::class, 'destroy'])->name('product-variants.destroy');

Route::get('/products/{productId}/images', [ProductImageController::class, 'index'])->name('products.images.index');
Route::post('/products/{productId}/images', [ProductImageController::class, 'store'])->name('products.images.store');
Route::put('/product-images/{imageId}/primary', [ProductImageController::class, 'setPrimary'])->name('product-images.primary');
Route::delete('/product-images/{imageId}', [ProductImageController::class, 'destroy'])->name('product-images.destroy');
Route::apiResource('categories', CategoryController::class);
Route::apiResource('departments', DepartmentController::class)->except(['show']);
Route::apiResource('brands', BrandController::class)->except(['show']);
Route::apiResource('seasons', SeasonController::class)->except(['show']);

Route::apiResource('attributes', AttributeController::class)->except(['show']);
Route::post('/attributes/{attributeId}/values', [AttributeController::class, 'storeValue'])->name('attributes.values.store');
Route::delete('/attribute-values/{valueId}', [AttributeController::class, 'destroyValue'])->name('attributes.values.destroy');

Route::apiResource('size-guides', SizeGuideController::class)->only(['index', 'store', 'destroy']);
Route::post('/size-guides/{guideId}/items', [SizeGuideController::class, 'storeItem'])->name('size-guides.items.store');
Route::delete('/size-guide-items/{itemId}', [SizeGuideController::class, 'destroyItem'])->name('size-guides.items.destroy');

Route::apiResource('users', UserController::class);

Route::prefix('reports')->name('reports.')->group(function () {
    Route::get('/sales', [ReportController::class, 'sales'])->name('sales');
    Route::get('/inventory', [ReportController::class, 'inventory'])->name('inventory');
});
