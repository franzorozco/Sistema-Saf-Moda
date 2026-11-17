<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->integer('points_delta');
            $table->integer('balance_after');
            $table->string('reason', 150);
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('entity_table', 80);
            $table->unsignedBigInteger('entity_id');
            $table->string('action', 20);
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent', 300)->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_logs_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'OTHER'))");
        DB::statement('CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id, created_at DESC)');

        Schema::create('layaways', function (Blueprint $table) {
            $table->id();
            $table->string('layaway_number', 40)->unique();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->foreignId('seller_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('sale_id')->nullable()->unique()->constrained('sales')->nullOnDelete();
            $table->decimal('total_amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('status', 20)->default('active');
            $table->timestampTz('expires_at');
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE layaways ADD COLUMN balance_due NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED');
        DB::statement("ALTER TABLE layaways ADD CONSTRAINT chk_layaways_status CHECK (status IN ('active', 'completed', 'expired', 'cancelled'))");
        DB::statement('ALTER TABLE layaways ADD CONSTRAINT chk_layaways_paid CHECK (paid_amount >= 0 AND paid_amount <= total_amount)');
        DB::statement('CREATE INDEX idx_layaways_branch_status ON layaways(branch_id, status, expires_at)');

        Schema::create('layaway_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('layaway_id')->constrained('layaways')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);

            $table->unique(['layaway_id', 'variant_id'], 'uq_layaway_item');
        });

        Schema::create('layaway_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('layaway_id')->constrained('layaways')->cascadeOnDelete();
            $table->foreignId('payment_method_id')->constrained('payment_methods')->restrictOnDelete();
            $table->foreignId('cash_register_session_id')->nullable()->constrained('cash_register_sessions')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('reference_number', 100)->nullable();
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('paid_at')->useCurrent();
        });

        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_number', 40)->unique();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('expense_category_id')->constrained('expense_categories')->restrictOnDelete();
            $table->foreignId('cash_register_session_id')->nullable()->constrained('cash_register_sessions')->nullOnDelete();
            $table->foreignId('payment_method_id')->constrained('payment_methods')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('expense_date')->default(DB::raw('CURRENT_DATE'));
            $table->string('vendor_name', 150)->nullable();
            $table->string('receipt_number', 80)->nullable();
            $table->text('description');
            $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        DB::statement('CREATE INDEX idx_expenses_branch_date ON expenses(branch_id, expense_date DESC)');

        Schema::create('gift_cards', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('issued_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->decimal('initial_balance', 12, 2);
            $table->decimal('current_balance', 12, 2);
            $table->string('status', 20)->default('active');
            $table->timestampTz('expires_at')->nullable();
            $table->foreignId('issued_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE gift_cards ADD CONSTRAINT chk_gift_cards_status CHECK (status IN ('active', 'depleted', 'expired', 'cancelled'))");
        DB::statement('ALTER TABLE gift_cards ADD CONSTRAINT chk_gift_cards_balance CHECK (current_balance >= 0 AND current_balance <= initial_balance)');

        Schema::table('sale_payments', function (Blueprint $table) {
            $table->foreignId('gift_card_id')->nullable()->after('payment_method_id')->constrained('gift_cards')->restrictOnDelete();
        });

        Schema::create('gift_card_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gift_card_id')->constrained('gift_cards')->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->string('transaction_type', 20);
            $table->decimal('amount_delta', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE gift_card_transactions ADD CONSTRAINT chk_gc_tx_type CHECK (transaction_type IN ('issue', 'redeem', 'refund', 'adjustment'))");

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->unique()->constrained('sales')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('document_type', 20)->default('receipt');
            $table->string('invoice_series', 20)->nullable();
            $table->string('invoice_number', 50);
            $table->string('customer_tax_id', 50)->nullable();
            $table->string('customer_legal_name', 200)->default('SIN NOMBRE');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->string('status', 20)->default('issued');
            $table->timestampTz('issued_at')->useCurrent();
            $table->timestampTz('voided_at')->nullable();
            $table->string('external_cuf', 150)->nullable();
        });

        DB::statement('ALTER TABLE invoices ADD CONSTRAINT uq_invoices_branch_series_num UNIQUE NULLS NOT DISTINCT (branch_id, document_type, invoice_series, invoice_number)');
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT chk_invoices_doc_type CHECK (document_type IN ('receipt', 'invoice', 'credit_note'))");
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT chk_invoices_status CHECK (status IN ('issued', 'voided'))");

        Schema::create('employee_commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->decimal('commission_base', 12, 2);
            $table->decimal('commission_rate', 5, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->string('status', 20)->default('pending');
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();

            $table->unique(['employee_id', 'sale_id'], 'uq_employee_commission_sale');
        });

        DB::statement("ALTER TABLE employee_commissions ADD CONSTRAINT chk_employee_commissions_status CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))");

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
            $table->string('category', 40);
            $table->string('severity', 15)->default('info');
            $table->string('title', 150);
            $table->text('message');
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE notifications ADD CONSTRAINT chk_notifications_severity CHECK (severity IN ('info', 'warning', 'critical'))");
        DB::statement('CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)');

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
            $table->string('group_name', 60)->default('general');
            $table->string('setting_key', 100);
            $table->text('setting_value')->nullable();
            $table->string('value_type', 20)->default('string');
            $table->string('description', 255)->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement('ALTER TABLE system_settings ADD CONSTRAINT uq_system_settings_scope UNIQUE NULLS NOT DISTINCT (branch_id, setting_key)');
        DB::statement("ALTER TABLE system_settings ADD CONSTRAINT chk_system_settings_type CHECK (value_type IN ('string', 'integer', 'decimal', 'boolean', 'json'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('employee_commissions');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('gift_card_transactions');
        Schema::dropIfExists('gift_cards');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('layaway_payments');
        Schema::dropIfExists('layaway_items');
        Schema::dropIfExists('layaways');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('loyalty_transactions');
    }
};
