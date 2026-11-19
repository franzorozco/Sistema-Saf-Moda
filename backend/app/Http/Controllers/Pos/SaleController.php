<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\Sale;
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

    public function index(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');

        $query = Sale::with([
            'branch:id,code,name',
            'warehouse:id,code,name',
            'sale_payments.payment_method:id,code,name',
        ])
            ->withCount('sale_items')
            ->orderByDesc('id');

        if ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $query->where('branch_id', (int) $branchId);
        }

        $sales = $query->limit(60)->get();

        return $this->success($sales, 'Ventas recientes obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer_name_snapshot' => ['nullable', 'string', 'max:200'],
            'customer_tax_id_snapshot' => ['nullable', 'string', 'max:50'],
            'seller_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'discount_total' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $result = $this->saleService->createSale(
            payload: $validated,
            userId: $request->user()?->id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        return $this->success($result, 'Venta registrada correctamente', 201);
    }

    public function show(string $id): JsonResponse
    {
        $sale = Sale::with([
            'branch:id,code,name',
            'warehouse:id,code,name',
            'customer.person:id,first_name,last_name,phone,document_number',
            'sale_items.product_variant.product:id,name',
            'sale_payments.payment_method:id,code,name,method_type',
        ])->findOrFail($id);

        return $this->success($sale, 'Detalle de venta obtenido');
    }
}
