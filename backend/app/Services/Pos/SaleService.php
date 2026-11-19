<?php

namespace App\Services\Pos;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeeCommission;
use App\Models\Inventory;
use App\Models\LoyaltyTransaction;
use App\Models\PaymentMethod;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\Warehouse;
use App\Services\Admin\InventoryService;
use App\Support\CodeGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleService
{
    public function __construct(
        private readonly InventoryService $inventoryService
    ) {
    }

    public function createSale(
        array $payload,
        ?int $userId = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): array {
        $warehouse = Warehouse::findOrFail((int) $payload['warehouse_id']);
        $branchId = (int) ($payload['branch_id'] ?? $warehouse->branch_id);

        $customer = !empty($payload['customer_id'])
            ? Customer::with('person:id,first_name,last_name,document_number')->findOrFail((int) $payload['customer_id'])
            : null;

        $customerName = !empty($payload['customer_name_snapshot'])
            ? trim((string) $payload['customer_name_snapshot'])
            : ($customer
                ? trim(($customer->person?->first_name ?? '') . ' ' . ($customer->person?->last_name ?? ''))
                : 'SIN NOMBRE');

        $customerTaxId = !empty($payload['customer_tax_id_snapshot'])
            ? trim((string) $payload['customer_tax_id_snapshot'])
            : ($customer?->person?->document_number ?: null);

        $sellerEmployeeId = !empty($payload['seller_employee_id']) ? (int) $payload['seller_employee_id'] : null;

        return DB::transaction(function () use (
            $payload,
            $warehouse,
            $branchId,
            $customer,
            $customerName,
            $customerTaxId,
            $sellerEmployeeId,
            $userId,
            $ipAddress,
            $userAgent
        ) {
            $openSession = CashRegisterSession::where('status', 'open')
                ->whereHas('cash_register', fn ($q) => $q->where('branch_id', $branchId))
                ->orderByDesc('id')
                ->first();

            $subtotal = 0.0;
            $itemDiscountSum = 0.0;
            $preparedLines = [];

            foreach ($payload['items'] as $row) {
                $variantId = (int) $row['variant_id'];
                $qty = (int) $row['quantity'];
                $variant = ProductVariant::with('product:id,name')->findOrFail($variantId);

                $inv = Inventory::where('warehouse_id', $warehouse->id)
                    ->where('variant_id', $variantId)
                    ->lockForUpdate()
                    ->first();

                $available = $inv ? max(0, (int) $inv->quantity_on_hand - (int) $inv->quantity_reserved) : 0;
                if ($available < $qty) {
                    throw ValidationException::withMessages([
                        'items' => ["Stock disponible insuficiente para {$variant->sku} (disponible: {$available}, solicitado: {$qty})."],
                    ]);
                }

                $unitPrice = array_key_exists('unit_price', $row) && $row['unit_price'] !== null
                    ? round((float) $row['unit_price'], 2)
                    : round((float) $variant->base_price, 2);

                $lineDisc = round(max(0.0, (float) ($row['discount_amount'] ?? 0)), 2);
                $lineSubtotal = round($qty * $unitPrice, 2);
                $lineTotal = max(0.0, round($lineSubtotal - $lineDisc, 2));

                $subtotal += $lineSubtotal;
                $itemDiscountSum += $lineDisc;

                $preparedLines[] = [
                    'variant' => $variant,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'unit_cost_snapshot' => round((float) $variant->cost_price, 2),
                    'discount_amount' => $lineDisc,
                    'tax_amount' => 0.0,
                    'line_total' => $lineTotal,
                ];
            }

            $globalDiscount = round(max(0.0, (float) ($payload['discount_total'] ?? 0)), 2);
            $totalDiscount = round($itemDiscountSum + $globalDiscount, 2);
            $totalAmount = max(0.0, round($subtotal - $totalDiscount, 2));

            $paymentMethodIds = collect($payload['payments'])->pluck('payment_method_id')->unique()->all();
            $methodsById = PaymentMethod::whereIn('id', $paymentMethodIds)->get()->keyBy('id');

            $tenderedTotal = 0.0;
            $storeCreditUsed = 0.0;
            $paymentsList = [];

            foreach ($payload['payments'] as $pRow) {
                $pmId = (int) $pRow['payment_method_id'];
                $pm = $methodsById->get($pmId);
                if (!$pm) {
                    throw ValidationException::withMessages([
                        'payments' => ['Método de pago inválido.'],
                    ]);
                }

                $amt = round((float) $pRow['amount'], 2);
                if ($amt <= 0) {
                    throw ValidationException::withMessages([
                        'payments' => ['Cada monto de pago debe ser mayor a cero.'],
                    ]);
                }

                if ($pm->method_type === 'store_credit') {
                    if (!$customer) {
                        throw ValidationException::withMessages([
                            'payments' => ['Selecciona un cliente para pagar con Crédito en Tienda.'],
                        ]);
                    }
                    $storeCreditUsed += $amt;
                }

                $tenderedTotal = round($tenderedTotal + $amt, 2);
                $paymentsList[] = [
                    'payment_method_id' => $pmId,
                    'method_type' => $pm->method_type,
                    'method_name' => $pm->name,
                    'amount' => $amt,
                    'reference_number' => !empty($pRow['reference_number']) ? trim((string) $pRow['reference_number']) : null,
                ];
            }

            if ($tenderedTotal + 0.01 < $totalAmount) {
                $missing = round($totalAmount - $tenderedTotal, 2);
                throw ValidationException::withMessages([
                    'payments' => ["El monto total pagado (Bs. {$tenderedTotal}) es menor al total de la venta (Bs. {$totalAmount}). Faltan Bs. {$missing}. Si es un adelanto, usa el modo Reserva / Adelanto."],
                ]);
            }

            if ($storeCreditUsed > 0 && $customer) {
                $lockedCustomer = Customer::lockForUpdate()->findOrFail($customer->id);
                if ((float) $lockedCustomer->store_credit + 0.01 < $storeCreditUsed) {
                    throw ValidationException::withMessages([
                        'payments' => ["Crédito en tienda insuficiente (disponible: Bs. {$lockedCustomer->store_credit})."],
                    ]);
                }
                $lockedCustomer->store_credit = max(0.0, round((float) $lockedCustomer->store_credit - $storeCreditUsed, 2));
                $lockedCustomer->save();
            }

            $changeAmount = max(0.0, round($tenderedTotal - $totalAmount, 2));

            // Si hubo cambio en efectivo, descontamos el cambio del pago en efectivo para que la suma de sale_payments cuadre exactamente con total_amount
            $remainingChange = $changeAmount;
            if ($remainingChange > 0) {
                for ($i = count($paymentsList) - 1; $i >= 0 && $remainingChange > 0; $i--) {
                    if ($paymentsList[$i]['method_type'] === 'cash' && $paymentsList[$i]['amount'] > $remainingChange) {
                        $paymentsList[$i]['amount'] = round($paymentsList[$i]['amount'] - $remainingChange, 2);
                        $remainingChange = 0;
                    }
                }
            }

            $saleNumber = CodeGenerator::next('sales', 'VTA-', 5, 'sale_number');

            $sale = Sale::create([
                'sale_number' => $saleNumber,
                'branch_id' => $branchId,
                'warehouse_id' => $warehouse->id,
                'cash_register_session_id' => $openSession?->id,
                'customer_id' => $customer?->id,
                'customer_name_snapshot' => mb_substr($customerName, 0, 200),
                'customer_tax_id_snapshot' => $customerTaxId ? mb_substr($customerTaxId, 0, 50) : null,
                'seller_employee_id' => $sellerEmployeeId,
                'sale_channel' => 'pos',
                'status' => 'completed',
                'subtotal' => round($subtotal, 2),
                'discount_total' => $totalDiscount,
                'tax_total' => 0.0,
                'total_amount' => $totalAmount,
                'currency_code' => 'BOB',
                'notes' => !empty($payload['notes']) ? trim((string) $payload['notes']) : null,
                'sold_at' => now(),
            ]);

            foreach ($preparedLines as $line) {
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'variant_id' => $line['variant']->id,
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'unit_cost_snapshot' => $line['unit_cost_snapshot'],
                    'discount_amount' => $line['discount_amount'],
                    'tax_amount' => $line['tax_amount'],
                    'line_total' => $line['line_total'],
                ]);

                $this->inventoryService->applyMovement(
                    warehouseId: $warehouse->id,
                    variantId: $line['variant']->id,
                    movementType: 'sale_out',
                    signedQuantity: -$line['quantity'],
                    unitCost: $line['unit_cost_snapshot'],
                    referenceType: 'sale',
                    referenceId: $sale->id,
                    notes: mb_substr("Venta POS {$sale->sale_number} · {$customerName}", 0, 255),
                    userId: $userId,
                    ipAddress: $ipAddress,
                    userAgent: $userAgent,
                    branchId: $branchId
                );
            }

            foreach ($paymentsList as $p) {
                SalePayment::create([
                    'sale_id' => $sale->id,
                    'payment_method_id' => $p['payment_method_id'],
                    'amount' => $p['amount'],
                    'reference_number' => $p['reference_number'],
                    'paid_at' => now(),
                ]);
            }

            // Puntos de fidelidad (1 punto por cada Bs. 10)
            if ($customer && $totalAmount >= 10) {
                $earnedPoints = (int) floor($totalAmount / 10);
                if ($earnedPoints > 0) {
                    $lockedCust = Customer::lockForUpdate()->findOrFail($customer->id);
                    $lockedCust->loyalty_points = (int) $lockedCust->loyalty_points + $earnedPoints;
                    $lockedCust->save();

                    LoyaltyTransaction::create([
                        'customer_id' => $lockedCust->id,
                        'sale_id' => $sale->id,
                        'points_delta' => $earnedPoints,
                        'balance_after' => $lockedCust->loyalty_points,
                        'reason' => "Compra POS {$sale->sale_number}",
                    ]);
                }
            }

            // Comisión del vendedor si aplica
            if ($sellerEmployeeId && $totalAmount > 0) {
                $emp = Employee::find($sellerEmployeeId);
                if ($emp && (float) $emp->commission_rate > 0) {
                    $commAmt = round($totalAmount * ((float) $emp->commission_rate / 100), 2);
                    if ($commAmt > 0) {
                        EmployeeCommission::create([
                            'employee_id' => $emp->id,
                            'sale_id' => $sale->id,
                            'base_amount' => $totalAmount,
                            'commission_rate' => $emp->commission_rate,
                            'commission_amount' => $commAmt,
                            'status' => 'pending',
                        ]);
                    }
                }
            }

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => $branchId,
                'entity_table' => 'sales',
                'entity_id' => $sale->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => [
                    'sale_number' => $sale->sale_number,
                    'total_amount' => $sale->total_amount,
                    'payments_count' => count($paymentsList),
                ],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent ? substr($userAgent, 0, 300) : null,
            ]);

            $sale->load([
                'branch:id,code,name',
                'warehouse:id,code,name',
                'sale_items.product_variant.product:id,name',
                'sale_payments.payment_method:id,code,name,method_type',
            ]);

            return [
                'type' => 'sale',
                'sale' => $sale,
                'amount_tendered' => $tenderedTotal,
                'change_amount' => $changeAmount,
            ];
        });
    }
}
