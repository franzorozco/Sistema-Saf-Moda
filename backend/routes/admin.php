<?php

use App\Http\Controllers\Admin\AttributeController;
use App\Http\Controllers\Admin\BrandController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DepartmentController;
use App\Http\Controllers\Admin\EmployeeCommissionController;
use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\EmployeeShiftController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\InventoryCountController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProductImageController;
use App\Http\Controllers\Admin\ProductVariantController;
use App\Http\Controllers\Admin\PurchaseOrderController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SeasonController;
use App\Http\Controllers\Admin\SizeGuideController;
use App\Http\Controllers\Admin\SupplierController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\WarehouseTransferController;
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

Route::get('/users/meta', [UserController::class, 'meta'])->name('users.meta');
Route::post('/job-positions', [UserController::class, 'storeJobPosition'])->name('job-positions.store');
Route::apiResource('users', UserController::class);
Route::put('/users/{id}/roles', [UserController::class, 'syncRoles'])->name('users.roles.sync');
Route::put('/users/{id}/status', [UserController::class, 'updateStatus'])->name('users.status.update');
Route::post('/users/{id}/restore', [UserController::class, 'restore'])->name('users.restore');
Route::delete('/users/{id}/force', [UserController::class, 'forceDestroy'])->name('users.force-destroy');

Route::get('/employees/meta', [EmployeeController::class, 'meta'])->name('employees.meta');
Route::apiResource('employees', EmployeeController::class);
Route::put('/employees/{id}/commission-rate', [EmployeeController::class, 'updateCommissionRate'])->name('employees.commission-rate');
Route::post('/employees/{id}/restore', [EmployeeController::class, 'restore'])->name('employees.restore');
Route::delete('/employees/{id}/force', [EmployeeController::class, 'forceDestroy'])->name('employees.force-destroy');

Route::get('/employee-shifts', [EmployeeShiftController::class, 'index'])->name('employee-shifts.index');
Route::post('/employee-shifts', [EmployeeShiftController::class, 'store'])->name('employee-shifts.store');
Route::post('/employee-shifts/batch', [EmployeeShiftController::class, 'storeBatch'])->name('employee-shifts.batch');
Route::put('/employee-shifts/{id}', [EmployeeShiftController::class, 'update'])->name('employee-shifts.update');
Route::post('/employee-shifts/{id}/check-in', [EmployeeShiftController::class, 'checkIn'])->name('employee-shifts.check-in');
Route::post('/employee-shifts/{id}/check-out', [EmployeeShiftController::class, 'checkOut'])->name('employee-shifts.check-out');
Route::delete('/employee-shifts/{id}', [EmployeeShiftController::class, 'destroy'])->name('employee-shifts.destroy');

Route::get('/employee-commissions', [EmployeeCommissionController::class, 'index'])->name('employee-commissions.index');
Route::put('/employee-commissions/{id}/status', [EmployeeCommissionController::class, 'updateStatus'])->name('employee-commissions.status');

Route::get('/customers/meta', [CustomerController::class, 'meta'])->name('customers.meta');
Route::apiResource('customers', CustomerController::class);
Route::post('/customers/{id}/loyalty', [CustomerController::class, 'adjustLoyalty'])->name('customers.loyalty');
Route::post('/customers/{id}/store-credit', [CustomerController::class, 'adjustStoreCredit'])->name('customers.store-credit');
Route::post('/customers/{id}/addresses', [CustomerController::class, 'storeAddress'])->name('customers.addresses.store');
Route::delete('/customer-addresses/{addressId}', [CustomerController::class, 'destroyAddress'])->name('customer-addresses.destroy');
Route::post('/customers/{id}/restore', [CustomerController::class, 'restore'])->name('customers.restore');
Route::delete('/customers/{id}/force', [CustomerController::class, 'forceDestroy'])->name('customers.force-destroy');

Route::get('/inventory/meta', [InventoryController::class, 'meta'])->name('inventory.meta');
Route::get('/inventory/products/{productId}/variants', [InventoryController::class, 'productVariants'])->name('inventory.product-variants');
Route::get('/inventory', [InventoryController::class, 'index'])->name('inventory.index');
Route::post('/inventory/movement', [InventoryController::class, 'storeMovement'])->name('inventory.movement');
Route::post('/inventory/batch-entry', [InventoryController::class, 'storeBatchEntry'])->name('inventory.batch-entry');
Route::put('/inventory/settings', [InventoryController::class, 'updateSettings'])->name('inventory.settings');
Route::get('/inventory/movements', [InventoryController::class, 'movements'])->name('inventory.movements');

Route::get('/inventory-counts', [InventoryCountController::class, 'index'])->name('inventory-counts.index');
Route::post('/inventory-counts', [InventoryCountController::class, 'store'])->name('inventory-counts.store');
Route::get('/inventory-counts/{id}', [InventoryCountController::class, 'show'])->name('inventory-counts.show');
Route::put('/inventory-counts/{id}/items', [InventoryCountController::class, 'updateItems'])->name('inventory-counts.items.update');
Route::post('/inventory-counts/{id}/approve', [InventoryCountController::class, 'approve'])->name('inventory-counts.approve');
Route::post('/inventory-counts/{id}/cancel', [InventoryCountController::class, 'cancel'])->name('inventory-counts.cancel');

Route::post('/branches', [WarehouseTransferController::class, 'storeBranch'])->name('branches.store');
Route::put('/branches/{id}', [WarehouseTransferController::class, 'updateBranch'])->name('branches.update');

Route::get('/warehouses', [WarehouseTransferController::class, 'indexWarehouses'])->name('warehouses.index');
Route::post('/warehouses', [WarehouseTransferController::class, 'storeWarehouse'])->name('warehouses.store');
Route::put('/warehouses/{id}', [WarehouseTransferController::class, 'updateWarehouse'])->name('warehouses.update');

Route::get('/stock-transfers', [WarehouseTransferController::class, 'indexTransfers'])->name('stock-transfers.index');
Route::post('/stock-transfers', [WarehouseTransferController::class, 'storeTransfer'])->name('stock-transfers.store');
Route::post('/stock-transfers/{id}/ship', [WarehouseTransferController::class, 'shipTransfer'])->name('stock-transfers.ship');
Route::post('/stock-transfers/{id}/receive', [WarehouseTransferController::class, 'receiveTransfer'])->name('stock-transfers.receive');
Route::post('/stock-transfers/{id}/cancel', [WarehouseTransferController::class, 'cancelTransfer'])->name('stock-transfers.cancel');

Route::apiResource('suppliers', SupplierController::class);
Route::post('/suppliers/{id}', [SupplierController::class, 'update'])->name('suppliers.update.post');
Route::post('/suppliers/{id}/restore', [SupplierController::class, 'restore'])->name('suppliers.restore');
Route::delete('/suppliers/{id}/force', [SupplierController::class, 'forceDestroy'])->name('suppliers.force-destroy');

Route::get('/purchases/meta', [PurchaseOrderController::class, 'meta'])->name('purchases.meta');
Route::get('/purchases/price-history', [PurchaseOrderController::class, 'priceHistory'])->name('purchases.price-history');
Route::post('/purchases/price-history', [PurchaseOrderController::class, 'storeManualPriceRecord'])->name('purchases.price-history.store');
Route::get('/purchases/last-price', [PurchaseOrderController::class, 'lookupLastPrice'])->name('purchases.last-price');
Route::apiResource('purchases', PurchaseOrderController::class)->except(['destroy']);
Route::post('/purchases/{id}/order', [PurchaseOrderController::class, 'markOrdered'])->name('purchases.order');
Route::post('/purchases/{id}/receive', [PurchaseOrderController::class, 'receive'])->name('purchases.receive');
Route::post('/purchases/{id}/cancel', [PurchaseOrderController::class, 'cancel'])->name('purchases.cancel');
Route::post('/purchases/{id}/attachments', [PurchaseOrderController::class, 'uploadAttachment'])->name('purchases.attachments.store');
Route::delete('/purchase-attachments/{attachmentId}', [PurchaseOrderController::class, 'deleteAttachment'])->name('purchase-attachments.destroy');
Route::post('/purchase-items/{itemId}/link-variant', [PurchaseOrderController::class, 'linkItemToVariant'])->name('purchase-items.link-variant');

Route::prefix('reports')->name('reports.')->group(function () {
    Route::get('/sales', [ReportController::class, 'sales'])->name('sales');
    Route::get('/inventory', [ReportController::class, 'inventory'])->name('inventory');
});
