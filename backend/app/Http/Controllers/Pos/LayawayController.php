<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Layaway;
use App\Models\LayawayItem;
use App\Models\LayawayPayment;
use App\Models\PaymentMethod;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LayawayController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');
        $status = $request->query('status');

        $query = Layaway::with([
            'branch:id,code,name',
            'warehouse:id,code,name',
            'customer.person:id,first_name,last_name,phone,document_number',
            'layaway_items.product_variant.product:id,name',
            'layaway_payments.payment_method:id,code,name,method_type',
        ])->orderByDesc('id');

        if ($branchId !== null && $branchId !== '' && $branchId !== 'all') {
            $query->where('branch_id', (int) $branchId);
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        return $this->success($query->limit(80)->get(), 'Reservas obtenidas');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'seller_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'expires_at' => ['nullable', 'date'],
            'discount_total' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ], [
            'customer_id.required' => 'Debes seleccionar o crear un cliente para registrar la reserva.',
        ]);

        $warehouse = Warehouse::findOrFail((int) $validated['warehouse_id']);
        $branchId = (int) ($validated['branch_id'] ?? $warehouse->branch_id);
        $userId = $request->user()?->id;

        // Agrupar cantidades si se repite alguna variante
        $groupedItems = collect($validated['items'])
            ->groupBy('variant_id')
            ->map(function ($group, $variantId) {
                $first = $group->first();
                return [
                    'variant_id' => (int) $variantId,
                    'quantity' => (int) $group->sum('quantity'),
                    'unit_price' => $first['unit_price'] ?? null,
                ];
            })
            ->values();

        $layaway = DB::transaction(function () use ($validated, $warehouse, $branchId, $groupedItems, $userId, $request) {
            $customer = Customer::with('person:id,first_name,last_name')->lockForUpdate()->findOrFail((int) $validated['customer_id']);

            $openSession = CashRegisterSession::where('status', 'open')
                ->whereHas('cash_register', fn ($q) => $q->where('branch_id', $branchId))
                ->orderByDesc('id')
                ->first();

            $subtotal = 0.0;
            $preparedItems = [];

            foreach ($groupedItems as $row) {
                $variant = ProductVariant::findOrFail($row['variant_id']);
                $qty = $row['quantity'];

                $inv = Inventory::where('warehouse_id', $warehouse->id)
                    ->where('variant_id', $variant->id)
                    ->lockForUpdate()
                    ->first();

                $available = $inv ? max(0, (int) $inv->quantity_on_hand - (int) $inv->quantity_reserved) : 0;
                if ($available < $qty) {
                    throw ValidationException::withMessages([
                        'items' => ["Stock disponible insuficiente para reservar {$variant->sku} (disponible: {$available}, solicitado: {$qty})."],
                    ]);
                }

                $unitPrice = $row['unit_price'] !== null
                    ? round((float) $row['unit_price'], 2)
                    : round((float) $variant->base_price, 2);

                $lineTotal = round($qty * $unitPrice, 2);
                $subtotal += $lineTotal;

                $preparedItems[] = [
                    'inventory' => $inv,
                    'variant' => $variant,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            $globalDiscount = round(max(0.0, (float) ($validated['discount_total'] ?? 0)), 2);
            $totalAmount = max(0.01, round($subtotal - $globalDiscount, 2));

            $paymentMethodIds = collect($validated['payments'])->pluck('payment_method_id')->unique()->all();
            $methodsById = PaymentMethod::whereIn('id', $paymentMethodIds)->get()->keyBy('id');

            $paidAmount = 0.0;
            $storeCreditUsed = 0.0;
            $paymentsList = [];

            foreach ($validated['payments'] as $pRow) {
                $pm = $methodsById->get((int) $pRow['payment_method_id']);
                if (!$pm) {
                    throw ValidationException::withMessages(['payments' => ['Método de pago inválido.']]);
                }

                $amt = round((float) $pRow['amount'], 2);
                if ($pm->method_type === 'store_credit') {
                    $storeCreditUsed += $amt;
                }

                $paidAmount = round($paidAmount + $amt, 2);
                $paymentsList[] = [
                    'payment_method_id' => $pm->id,
                    'amount' => $amt,
                    'reference_number' => !empty($pRow['reference_number']) ? trim((string) $pRow['reference_number']) : null,
                ];
            }

            if ($paidAmount >= $totalAmount) {
                throw ValidationException::withMessages([
                    'payments' => ["El adelanto (Bs. {$paidAmount}) cubre o supera el total (Bs. {$totalAmount}). Usa el modo Venta Completa para facturar de inmediato."],
                ]);
            }

            if ($storeCreditUsed > 0) {
                if ((float) $customer->store_credit + 0.01 < $storeCreditUsed) {
                    throw ValidationException::withMessages([
                        'payments' => ["Crédito en tienda insuficiente (disponible: Bs. {$customer->store_credit})."],
                    ]);
                }
                $customer->store_credit = max(0.0, round((float) $customer->store_credit - $storeCreditUsed, 2));
                $customer->save();
            }

            $expiresAt = !empty($validated['expires_at'])
                ? Carbon::parse($validated['expires_at'])->endOfDay()
                : now()->addDays(15)->endOfDay();

            $layawayNumber = CodeGenerator::next('layaways', 'RES-', 5, 'layaway_number');

            $layaway = Layaway::create([
                'layaway_number' => $layawayNumber,
                'branch_id' => $branchId,
                'warehouse_id' => $warehouse->id,
                'customer_id' => $customer->id,
                'seller_employee_id' => !empty($validated['seller_employee_id']) ? (int) $validated['seller_employee_id'] : null,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'status' => 'active',
                'expires_at' => $expiresAt,
                'notes' => !empty($validated['notes']) ? trim($validated['notes']) : null,
            ]);

            // Crear ítems y RESERVAR stock en inventories.quantity_reserved
            foreach ($preparedItems as $item) {
                LayawayItem::create([
                    'layaway_id' => $layaway->id,
                    'variant_id' => $item['variant']->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);

                $inv = $item['inventory'];
                $oldReserved = (int) $inv->quantity_reserved;
                $inv->quantity_reserved = $oldReserved + $item['quantity'];
                $inv->updated_at = now();
                $inv->save();
            }

            foreach ($paymentsList as $p) {
                LayawayPayment::create([
                    'layaway_id' => $layaway->id,
                    'payment_method_id' => $p['payment_method_id'],
                    'cash_register_session_id' => $openSession?->id,
                    'amount' => $p['amount'],
                    'reference_number' => $p['reference_number'],
                    'received_by_user_id' => $userId,
                    'paid_at' => now(),
                ]);
            }

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => $branchId,
                'entity_table' => 'layaways',
                'entity_id' => $layaway->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => [
                    'layaway_number' => $layaway->layaway_number,
                    'customer_id' => $customer->id,
                    'total_amount' => $totalAmount,
                    'paid_amount' => $paidAmount,
                    'reserved_items' => count($preparedItems),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $layaway->fresh([
                'branch:id,code,name',
                'warehouse:id,code,name',
                'customer.person:id,first_name,last_name,phone,document_number',
                'layaway_items.product_variant.product:id,name',
                'layaway_payments.payment_method:id,code,name,method_type',
            ]);
        });

        return $this->success([
            'type' => 'layaway',
            'layaway' => $layaway,
        ], 'Reserva con adelanto registrada y stock apartado', 201);
    }

    public function addPayment(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $userId = $request->user()?->id;

        $layaway = DB::transaction(function () use ($id, $validated, $userId, $request) {
            $layaway = Layaway::with(['layaway_items.product_variant', 'customer.person'])
                ->lockForUpdate()
                ->findOrFail($id);

            if ($layaway->status !== 'active') {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden registrar abonos en reservas activas.'],
                ]);
            }

            $remaining = round((float) $layaway->total_amount - (float) $layaway->paid_amount, 2);
            $addedAmount = round(collect($validated['payments'])->sum('amount'), 2);

            if ($addedAmount - 0.01 > $remaining) {
                throw ValidationException::withMessages([
                    'payments' => ["El abono (Bs. {$addedAmount}) supera el saldo pendiente (Bs. {$remaining})."],
                ]);
            }

            $openSession = CashRegisterSession::where('status', 'open')
                ->whereHas('cash_register', fn ($q) => $q->where('branch_id', $layaway->branch_id))
                ->orderByDesc('id')
                ->first();

            foreach ($validated['payments'] as $pRow) {
                LayawayPayment::create([
                    'layaway_id' => $layaway->id,
                    'payment_method_id' => (int) $pRow['payment_method_id'],
                    'cash_register_session_id' => $openSession?->id,
                    'amount' => round((float) $pRow['amount'], 2),
                    'reference_number' => !empty($pRow['reference_number']) ? trim((string) $pRow['reference_number']) : null,
                    'received_by_user_id' => $userId,
                    'paid_at' => now(),
                ]);
            }

            $newPaid = round((float) $layaway->paid_amount + $addedAmount, 2);
            $layaway->paid_amount = min((float) $layaway->total_amount, $newPaid);

            // Si completó el pago total -> convertir a Venta, liberar quantity_reserved y descontar stock físico!
            if ($layaway->paid_amount + 0.01 >= (float) $layaway->total_amount) {
                $customerName = trim(($layaway->customer?->person?->first_name ?? '') . ' ' . ($layaway->customer?->person?->last_name ?? '')) ?: 'CLIENTE';
                $saleNumber = CodeGenerator::next('sales', 'VTA-', 5, 'sale_number');

                $sale = Sale::create([
                    'sale_number' => $saleNumber,
                    'branch_id' => $layaway->branch_id,
                    'warehouse_id' => $layaway->warehouse_id,
                    'cash_register_session_id' => $openSession?->id,
                    'customer_id' => $layaway->customer_id,
                    'customer_name_snapshot' => mb_substr($customerName, 0, 200),
                    'customer_tax_id_snapshot' => $layaway->customer?->person?->document_number,
                    'seller_employee_id' => $layaway->seller_employee_id,
                    'sale_channel' => 'pos',
                    'status' => 'completed',
                    'subtotal' => $layaway->total_amount,
                    'discount_total' => 0,
                    'tax_total' => 0,
                    'total_amount' => $layaway->total_amount,
                    'currency_code' => 'BOB',
                    'notes' => "Liquidación de reserva {$layaway->layaway_number}",
                    'sold_at' => now(),
                ]);

                foreach ($layaway->layaway_items as $li) {
                    $inv = Inventory::where('warehouse_id', $layaway->warehouse_id)
                        ->where('variant_id', $li->variant_id)
                        ->lockForUpdate()
                        ->first();

                    if ($inv) {
                        $inv->quantity_reserved = max(0, (int) $inv->quantity_reserved - (int) $li->quantity);
                        $inv->updated_at = now();
                        $inv->save();
                    }

                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'variant_id' => $li->variant_id,
                        'quantity' => $li->quantity,
                        'unit_price' => $li->unit_price,
                        'unit_cost_snapshot' => round((float) ($li->product_variant?->cost_price ?? 0), 2),
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                        'line_total' => $li->line_total,
                    ]);

                    $this->inventoryService->applyMovement(
                        warehouseId: $layaway->warehouse_id,
                        variantId: $li->variant_id,
                        movementType: 'sale_out',
                        signedQuantity: -(int) $li->quantity,
                        unitCost: (float) ($li->product_variant?->cost_price ?? 0),
                        referenceType: 'sale',
                        referenceId: $sale->id,
                        notes: mb_substr("Entrega reserva {$layaway->layaway_number} -> {$sale->sale_number}", 0, 255),
                        userId: $userId,
                        ipAddress: $request->ip(),
                        userAgent: $request->userAgent(),
                        branchId: $layaway->branch_id
                    );
                }

                // Copiar todos los pagos acumulados de la reserva a sale_payments
                $allLayawayPayments = LayawayPayment::where('layaway_id', $layaway->id)->get();
                foreach ($allLayawayPayments as $lp) {
                    SalePayment::create([
                        'sale_id' => $sale->id,
                        'payment_method_id' => $lp->payment_method_id,
                        'amount' => $lp->amount,
                        'reference_number' => $lp->reference_number,
                        'paid_at' => $lp->paid_at,
                    ]);
                }

                $layaway->sale_id = $sale->id;
                $layaway->status = 'completed';
                $layaway->completed_at = now();
            }

            $layaway->save();

            return $layaway->fresh([
                'branch:id,code,name',
                'warehouse:id,code,name',
                'customer.person:id,first_name,last_name,phone,document_number',
                'layaway_items.product_variant.product:id,name',
                'layaway_payments.payment_method:id,code,name,method_type',
            ]);
        });

        return $this->success($layaway, 'Abono registrado correctamente');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $layaway = DB::transaction(function () use ($id, $request) {
            $layaway = Layaway::with('layaway_items')->lockForUpdate()->findOrFail($id);

            if ($layaway->status !== 'active') {
                throw ValidationException::withMessages([
                    'status' => ['Solo se pueden cancelar reservas activas.'],
                ]);
            }

            foreach ($layaway->layaway_items as $li) {
                $inv = Inventory::where('warehouse_id', $layaway->warehouse_id)
                    ->where('variant_id', $li->variant_id)
                    ->lockForUpdate()
                    ->first();

                if ($inv) {
                    $inv->quantity_reserved = max(0, (int) $inv->quantity_reserved - (int) $li->quantity);
                    $inv->updated_at = now();
                    $inv->save();
                }
            }

            $layaway->status = 'cancelled';
            $layaway->cancelled_at = now();
            $layaway->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'branch_id' => $layaway->branch_id,
                'entity_table' => 'layaways',
                'entity_id' => $layaway->id,
                'action' => 'UPDATE',
                'old_values' => ['status' => 'active'],
                'new_values' => ['status' => 'cancelled'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $layaway->fresh();
        });

        return $this->success($layaway, 'Reserva cancelada y stock liberado');
    }
}
