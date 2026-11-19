<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public const IN_TYPES = [
        'initial_stock',
        'purchase_in',
        'return_in',
        'adjustment_in',
        'transfer_in',
        'set_assembly_in',
    ];

    public const OUT_TYPES = [
        'sale_out',
        'adjustment_out',
        'transfer_out',
        'set_assembly_out',
        'damaged_out',
    ];

    public const ALL_TYPES = [
        'initial_stock',
        'purchase_in',
        'return_in',
        'adjustment_in',
        'transfer_in',
        'set_assembly_in',
        'sale_out',
        'adjustment_out',
        'transfer_out',
        'set_assembly_out',
        'damaged_out',
    ];

    public function applyMovement(
        int $warehouseId,
        int $variantId,
        string $movementType,
        int $signedQuantity,
        ?float $unitCost = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $notes = null,
        ?int $userId = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?int $branchId = null
    ): array {
        if (!in_array($movementType, self::ALL_TYPES, true)) {
            throw ValidationException::withMessages([
                'movement_type' => ["Tipo de movimiento inválido: {$movementType}."],
            ]);
        }

        if ($signedQuantity === 0) {
            throw ValidationException::withMessages([
                'quantity' => ['La cantidad del movimiento debe ser distinta de cero.'],
            ]);
        }

        if (in_array($movementType, self::IN_TYPES, true) && $signedQuantity < 0) {
            throw ValidationException::withMessages([
                'quantity' => ["El movimiento {$movementType} requiere una cantidad positiva."],
            ]);
        }

        if (in_array($movementType, self::OUT_TYPES, true) && $signedQuantity > 0) {
            throw ValidationException::withMessages([
                'quantity' => ["El movimiento {$movementType} requiere una cantidad negativa."],
            ]);
        }

        return DB::transaction(function () use (
            $warehouseId,
            $variantId,
            $movementType,
            $signedQuantity,
            $unitCost,
            $referenceType,
            $referenceId,
            $notes,
            $userId,
            $ipAddress,
            $userAgent,
            $branchId
        ) {
            $inventory = Inventory::where('warehouse_id', $warehouseId)
                ->where('variant_id', $variantId)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                DB::table('inventories')->insertOrIgnore([
                    'warehouse_id' => $warehouseId,
                    'variant_id' => $variantId,
                    'quantity_on_hand' => 0,
                    'quantity_reserved' => 0,
                    'min_stock_alert' => 3,
                    'updated_at' => now(),
                ]);

                $inventory = Inventory::where('warehouse_id', $warehouseId)
                    ->where('variant_id', $variantId)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            $oldOnHand = (int) $inventory->quantity_on_hand;
            $reserved = (int) $inventory->quantity_reserved;
            $newOnHand = $oldOnHand + $signedQuantity;

            if ($newOnHand < 0) {
                throw ValidationException::withMessages([
                    'quantity' => ["Stock insuficiente en almacén (actual: {$oldOnHand}, salida solicitada: " . abs($signedQuantity) . ")."],
                ]);
            }

            if ($newOnHand < $reserved) {
                throw ValidationException::withMessages([
                    'quantity' => ["El stock resultante ({$newOnHand}) no puede ser menor al stock reservado ({$reserved})."],
                ]);
            }

            $variant = ProductVariant::withTrashed()->findOrFail($variantId);
            $resolvedCost = $unitCost !== null
                ? max(0.0, round((float) $unitCost, 2))
                : max(0.0, round((float) $variant->cost_price, 2));

            $inventory->quantity_on_hand = $newOnHand;
            $inventory->updated_at = now();
            $inventory->save();

            $cleanNotes = $notes !== null ? mb_substr(trim($notes), 0, 255) : null;
            if ($cleanNotes === '') {
                $cleanNotes = null;
            }

            $movement = InventoryMovement::create([
                'warehouse_id' => $warehouseId,
                'variant_id' => $variantId,
                'movement_type' => $movementType,
                'quantity' => $signedQuantity,
                'unit_cost' => $resolvedCost,
                'balance_after' => $newOnHand,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'notes' => $cleanNotes,
                'performed_by_user_id' => $userId,
            ]);

            $resolvedBranchId = $branchId ?? Warehouse::where('id', $warehouseId)->value('branch_id');

            AuditLog::create([
                'user_id' => $userId,
                'branch_id' => $resolvedBranchId,
                'entity_table' => 'inventories',
                'entity_id' => $inventory->id,
                'action' => 'UPDATE',
                'old_values' => [
                    'warehouse_id' => $warehouseId,
                    'variant_id' => $variantId,
                    'quantity_on_hand' => $oldOnHand,
                ],
                'new_values' => [
                    'warehouse_id' => $warehouseId,
                    'variant_id' => $variantId,
                    'quantity_on_hand' => $newOnHand,
                    'movement_id' => $movement->id,
                    'movement_type' => $movementType,
                    'quantity' => $signedQuantity,
                    'notes' => $cleanNotes,
                ],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent ? substr($userAgent, 0, 300) : null,
            ]);

            return [
                'inventory' => $inventory->fresh(),
                'movement' => $movement->fresh(),
            ];
        });
    }
}
