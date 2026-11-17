<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity_on_hand')->default(0);
            $table->integer('quantity_reserved')->default(0);
            $table->integer('min_stock_alert')->default(3);
            $table->integer('max_stock_limit')->nullable();
            $table->string('bin_location', 50)->nullable();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['warehouse_id', 'variant_id'], 'uq_inventories_wh_variant');
            $table->index('variant_id', 'idx_inventories_variant');
        });

        DB::statement('ALTER TABLE inventories ADD CONSTRAINT chk_inventories_on_hand CHECK (quantity_on_hand >= 0)');
        DB::statement('ALTER TABLE inventories ADD CONSTRAINT chk_inventories_reserved CHECK (quantity_reserved >= 0 AND quantity_reserved <= quantity_on_hand)');
        DB::statement('ALTER TABLE inventories ADD CONSTRAINT chk_inventories_min_alert CHECK (min_stock_alert >= 0)');
        DB::statement('ALTER TABLE inventories ADD CONSTRAINT chk_inventories_max_limit CHECK (max_stock_limit IS NULL OR max_stock_limit >= min_stock_alert)');

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->string('movement_type', 25);
            $table->integer('quantity');
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->integer('balance_after');
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('notes', 255)->nullable();
            $table->foreignId('performed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE inventory_movements ADD CONSTRAINT chk_inventory_movements_type CHECK (movement_type IN ('initial_stock', 'purchase_in', 'sale_out', 'return_in', 'adjustment_in', 'adjustment_out', 'transfer_out', 'transfer_in', 'set_assembly_in', 'set_assembly_out', 'damaged_out'))");
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT chk_inv_mov_qty CHECK (quantity <> 0)');
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT chk_inv_mov_cost CHECK (unit_cost >= 0)');
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT chk_inv_mov_bal CHECK (balance_after >= 0)');
        DB::statement('CREATE INDEX idx_inv_movements_wh_var_date ON inventory_movements(warehouse_id, variant_id, created_at DESC)');

        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_number', 40)->unique();
            $table->foreignId('source_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('target_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->string('status', 20)->default('draft');
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('shipped_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('shipped_at')->nullable();
            $table->timestampTz('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE stock_transfers ADD CONSTRAINT chk_stock_transfers_diff_wh CHECK (source_warehouse_id <> target_warehouse_id)');
        DB::statement("ALTER TABLE stock_transfers ADD CONSTRAINT chk_stock_transfers_status CHECK (status IN ('draft', 'in_transit', 'partial', 'received', 'cancelled'))");

        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity_requested');
            $table->integer('quantity_shipped')->default(0);
            $table->integer('quantity_received')->default(0);

            $table->unique(['stock_transfer_id', 'variant_id'], 'uq_stock_transfer_item');
        });

        DB::statement('ALTER TABLE stock_transfer_items ADD CONSTRAINT chk_sti_req CHECK (quantity_requested > 0)');
        DB::statement('ALTER TABLE stock_transfer_items ADD CONSTRAINT chk_sti_ship CHECK (quantity_shipped >= 0)');
        DB::statement('ALTER TABLE stock_transfer_items ADD CONSTRAINT chk_sti_recv CHECK (quantity_received >= 0)');

        Schema::create('inventory_counts', function (Blueprint $table) {
            $table->id();
            $table->string('count_number', 40)->unique();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->string('status', 20)->default('in_progress');
            $table->foreignId('conducted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('started_at')->useCurrent();
            $table->timestampTz('completed_at')->nullable();
            $table->text('notes')->nullable();
        });

        DB::statement("ALTER TABLE inventory_counts ADD CONSTRAINT chk_inventory_counts_status CHECK (status IN ('in_progress', 'pending_approval', 'approved', 'cancelled'))");

        Schema::create('inventory_count_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_count_id')->constrained('inventory_counts')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('expected_quantity');
            $table->integer('counted_quantity');
            $table->string('notes', 255)->nullable();

            $table->unique(['inventory_count_id', 'variant_id'], 'uq_inventory_count_item');
        });

        DB::statement('ALTER TABLE inventory_count_items ADD CONSTRAINT chk_ici_exp CHECK (expected_quantity >= 0)');
        DB::statement('ALTER TABLE inventory_count_items ADD CONSTRAINT chk_ici_cnt CHECK (counted_quantity >= 0)');

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('business_name', 180);
            $table->string('contact_name', 150)->nullable();
            $table->string('tax_id', 50)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 100)->default('Bolivia');
            $table->string('payment_terms', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 40)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->foreignId('target_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->string('status', 20)->default('draft');
            $table->date('order_date')->default(DB::raw('CURRENT_DATE'));
            $table->date('expected_date')->nullable();
            $table->timestampTz('received_at')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE purchase_orders ADD CONSTRAINT chk_purchase_orders_status CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled'))");
        DB::statement('ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_amounts CHECK (subtotal >= 0 AND tax_amount >= 0 AND shipping_cost >= 0 AND total_amount >= 0)');

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity_ordered');
            $table->integer('quantity_received')->default(0);
            $table->decimal('unit_cost', 12, 2);
            $table->decimal('line_total', 12, 2);

            $table->unique(['purchase_order_id', 'variant_id'], 'uq_purchase_order_item');
        });

        DB::statement('ALTER TABLE purchase_order_items ADD CONSTRAINT chk_poi_qty_ord CHECK (quantity_ordered > 0)');
        DB::statement('ALTER TABLE purchase_order_items ADD CONSTRAINT chk_poi_qty_rec CHECK (quantity_received >= 0)');
        DB::statement('ALTER TABLE purchase_order_items ADD CONSTRAINT chk_poi_costs CHECK (unit_cost >= 0 AND line_total >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('inventory_count_items');
        Schema::dropIfExists('inventory_counts');
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventories');
    }
};
