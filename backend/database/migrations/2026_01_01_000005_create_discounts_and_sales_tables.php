<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->nullable()->unique();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 12, 2);
            $table->decimal('max_discount_amount', 12, 2)->nullable();
            $table->integer('buy_quantity')->nullable();
            $table->integer('get_quantity')->nullable();
            $table->string('applies_to', 30)->default('entire_order');
            $table->decimal('min_purchase_amount', 12, 2)->default(0);
            $table->decimal('max_purchase_amount', 12, 2)->nullable();
            $table->integer('min_items_quantity')->default(0);
            $table->integer('max_uses')->nullable();
            $table->integer('max_uses_per_customer')->nullable();
            $table->integer('times_used')->default(0);
            $table->boolean('requires_coupon')->default(false);
            $table->boolean('is_stackable')->default(false);
            $table->smallInteger('priority')->default(100);
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['is_active', 'starts_at', 'ends_at'], 'idx_discounts_active_window');
        });

        DB::statement("ALTER TABLE discounts ADD CONSTRAINT chk_discounts_type CHECK (discount_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'fixed_price'))");
        DB::statement("ALTER TABLE discounts ADD CONSTRAINT chk_discounts_pct_range CHECK (discount_type <> 'percentage' OR (discount_value > 0 AND discount_value <= 100))");
        DB::statement("ALTER TABLE discounts ADD CONSTRAINT chk_discounts_applies_to CHECK (applies_to IN ('entire_order', 'departments', 'categories', 'products', 'variants'))");
        DB::statement('ALTER TABLE discounts ADD CONSTRAINT chk_discounts_dates CHECK (ends_at IS NULL OR ends_at >= starts_at)');
        DB::statement('ALTER TABLE discounts ADD CONSTRAINT chk_discounts_values CHECK (discount_value >= 0 AND min_purchase_amount >= 0 AND min_items_quantity >= 0)');

        Schema::create('discount_branches', function (Blueprint $table) {
            $table->foreignId('discount_id')->constrained('discounts')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->primary(['discount_id', 'branch_id']);
        });

        Schema::create('discount_customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discount_id')->constrained('discounts')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->cascadeOnDelete();
            $table->string('customer_tier', 20)->nullable();
        });

        DB::statement('ALTER TABLE discount_customers ADD CONSTRAINT chk_discount_customers_target CHECK ((customer_id IS NOT NULL AND customer_tier IS NULL) OR (customer_id IS NULL AND customer_tier IS NOT NULL))');
        DB::statement("ALTER TABLE discount_customers ADD CONSTRAINT chk_discount_customers_tier CHECK (customer_tier IS NULL OR customer_tier IN ('regular', 'silver', 'gold', 'vip', 'wholesale'))");

        Schema::create('discount_employees', function (Blueprint $table) {
            $table->foreignId('discount_id')->constrained('discounts')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->primary(['discount_id', 'employee_id']);
        });

        Schema::create('discount_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discount_id')->constrained('discounts')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();

            $table->index('discount_id', 'idx_discount_targets_discount');
        });

        DB::statement('ALTER TABLE discount_targets ADD CONSTRAINT chk_discount_targets_single_fk CHECK ((CASE WHEN department_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN category_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN variant_id IS NOT NULL THEN 1 ELSE 0 END) = 1)');

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discount_id')->constrained('discounts')->cascadeOnDelete();
            $table->string('code', 40)->unique();
            $table->integer('usage_limit')->nullable();
            $table->integer('usage_limit_per_customer')->default(1);
            $table->integer('times_used')->default(0);
            $table->foreignId('customer_id')->nullable()->constrained('customers')->cascadeOnDelete();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE coupons ADD CONSTRAINT chk_coupons_usage CHECK (usage_limit IS NULL OR times_used <= usage_limit)');

        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 80);
            $table->string('method_type', 20);
            $table->boolean('is_active')->default(true);
        });

        DB::statement("ALTER TABLE payment_methods ADD CONSTRAINT chk_payment_methods_type CHECK (method_type IN ('cash', 'card', 'qr_transfer', 'store_credit', 'gift_card', 'other'))");

        Schema::create('cash_register_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained('cash_registers')->restrictOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->timestampTz('opened_at')->useCurrent();
            $table->timestampTz('closed_at')->nullable();
            $table->decimal('opening_amount', 12, 2)->default(0);
            $table->decimal('expected_amount', 12, 2)->nullable();
            $table->decimal('counted_amount', 12, 2)->nullable();
            $table->decimal('difference_amount', 12, 2)->nullable();
            $table->string('status', 15)->default('open');
            $table->text('closing_notes')->nullable();
        });

        DB::statement("ALTER TABLE cash_register_sessions ADD CONSTRAINT chk_cash_sessions_status CHECK (status IN ('open', 'closed'))");

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_number', 40)->unique();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('cash_register_session_id')->nullable()->constrained('cash_register_sessions')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name_snapshot', 200)->default('SIN NOMBRE');
            $table->string('customer_tax_id_snapshot', 50)->nullable();
            $table->foreignId('seller_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('sale_channel', 20)->default('pos');
            $table->string('status', 20)->default('completed');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->char('currency_code', 3)->default('BOB');
            $table->text('notes')->nullable();
            $table->timestampTz('sold_at')->useCurrent();
            $table->timestampsTz();

            $table->index('customer_id', 'idx_sales_customer');
            $table->index('seller_employee_id', 'idx_sales_seller');
        });

        DB::statement("ALTER TABLE sales ADD CONSTRAINT chk_sales_channel CHECK (sale_channel IN ('pos', 'online', 'whatsapp', 'marketplace'))");
        DB::statement("ALTER TABLE sales ADD CONSTRAINT chk_sales_status CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded', 'partial_refund'))");
        DB::statement('CREATE INDEX idx_sales_branch_date ON sales(branch_id, sold_at DESC)');

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('unit_cost_snapshot', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);

            $table->index('variant_id', 'idx_sale_items_variant');
        });

        DB::statement('ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_qty CHECK (quantity > 0)');

        Schema::create('sale_discounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('sale_item_id')->nullable()->constrained('sale_items')->cascadeOnDelete();
            $table->foreignId('discount_id')->nullable()->constrained('discounts')->nullOnDelete();
            $table->foreignId('coupon_id')->nullable()->constrained('coupons')->nullOnDelete();
            $table->string('discount_name_snapshot', 150);
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 12, 2);
            $table->decimal('applied_amount', 12, 2);
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('payment_method_id')->constrained('payment_methods')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('reference_number', 100)->nullable();
            $table->timestampTz('paid_at')->useCurrent();
        });

        DB::statement('ALTER TABLE sale_payments ADD CONSTRAINT chk_sale_payments_amt CHECK (amount > 0)');

        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained('coupons')->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->decimal('discount_amount', 12, 2);
            $table->timestampTz('redeemed_at')->useCurrent();

            $table->unique(['coupon_id', 'sale_id'], 'uq_coupon_redemption_sale');
        });

        Schema::create('sale_returns', function (Blueprint $table) {
            $table->id();
            $table->string('return_number', 40)->unique();
            $table->foreignId('sale_id')->constrained('sales')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('return_type', 20)->default('refund');
            $table->string('refund_method', 20)->default('store_credit');
            $table->decimal('total_refund_amount', 12, 2)->default(0);
            $table->text('reason')->nullable();
            $table->timestampTz('returned_at')->useCurrent();
        });

        DB::statement("ALTER TABLE sale_returns ADD CONSTRAINT chk_sale_returns_type CHECK (return_type IN ('refund', 'exchange', 'store_credit'))");
        DB::statement("ALTER TABLE sale_returns ADD CONSTRAINT chk_sale_returns_refund_method CHECK (refund_method IN ('cash', 'card', 'qr_transfer', 'store_credit'))");

        Schema::create('sale_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_return_id')->constrained('sale_returns')->cascadeOnDelete();
            $table->foreignId('sale_item_id')->constrained('sale_items')->restrictOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('refund_amount', 12, 2);
            $table->string('item_condition', 20)->default('resellable');
            $table->boolean('restocked')->default(true);
        });

        DB::statement("ALTER TABLE sale_return_items ADD CONSTRAINT chk_sale_return_condition CHECK (item_condition IN ('resellable', 'damaged', 'defective'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_return_items');
        Schema::dropIfExists('sale_returns');
        Schema::dropIfExists('coupon_redemptions');
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_discounts');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('cash_register_sessions');
        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('discount_targets');
        Schema::dropIfExists('discount_branches');
        Schema::dropIfExists('discounts');
    }
};
