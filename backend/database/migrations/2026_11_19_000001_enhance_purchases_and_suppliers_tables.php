<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('whatsapp', 30)->nullable()->after('phone');
            $table->string('secondary_phone', 30)->nullable()->after('whatsapp');
            $table->string('photo_url', 255)->nullable()->after('payment_terms');
            $table->text('notes')->nullable()->after('photo_url');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('invoice_number', 60)->nullable()->after('po_number');
            $table->string('payment_method', 30)->nullable()->after('status');
            $table->string('payment_status', 20)->default('pending')->after('payment_method');
            $table->decimal('amount_paid', 12, 2)->default(0)->after('payment_status');
            $table->string('supplier_contact_name', 150)->nullable()->after('created_by_user_id');
            $table->string('supplier_whatsapp', 30)->nullable()->after('supplier_contact_name');
        });

        DB::statement("ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_payment_status CHECK (payment_status IN ('pending', 'partial', 'paid'))");
        DB::statement('ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_amount_paid CHECK (amount_paid >= 0)');

        DB::statement('ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS uq_purchase_order_item');
        DB::statement('ALTER TABLE purchase_order_items ALTER COLUMN variant_id DROP NOT NULL');
        DB::statement('CREATE UNIQUE INDEX uq_poi_po_variant ON purchase_order_items (purchase_order_id, variant_id) WHERE variant_id IS NOT NULL');

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('variant_id')->constrained('products')->nullOnDelete();
            $table->string('item_name', 200)->default('')->after('product_id');
            $table->string('item_sku', 80)->nullable()->after('item_name');
            $table->string('item_specs', 255)->nullable()->after('item_sku');
            $table->boolean('is_catalog_linked')->default(false)->after('item_specs');
            $table->boolean('stock_entered')->default(false)->after('is_catalog_linked');
            $table->string('photo_url', 255)->nullable()->after('line_total');
            $table->string('notes', 255)->nullable()->after('photo_url');
        });

        Schema::create('purchase_price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained('purchase_order_items')->nullOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('item_key', 220);
            $table->string('item_name', 200);
            $table->string('item_sku', 80)->nullable();
            $table->decimal('unit_cost', 12, 2);
            $table->decimal('previous_unit_cost', 12, 2)->nullable();
            $table->decimal('price_diff', 12, 2)->nullable();
            $table->decimal('price_diff_pct', 8, 2)->nullable();
            $table->integer('quantity')->default(1);
            $table->date('recorded_at');
            $table->string('photo_url', 255)->nullable();
            $table->string('notes', 255)->nullable();
            $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement('ALTER TABLE purchase_price_histories ADD CONSTRAINT chk_pph_unit_cost CHECK (unit_cost >= 0)');
        DB::statement('ALTER TABLE purchase_price_histories ADD CONSTRAINT chk_pph_quantity CHECK (quantity > 0)');
        DB::statement('CREATE INDEX idx_pph_item_key_date ON purchase_price_histories (item_key, recorded_at DESC)');
        DB::statement('CREATE INDEX idx_pph_supplier_date ON purchase_price_histories (supplier_id, recorded_at DESC)');
        DB::statement('CREATE INDEX idx_pph_variant_date ON purchase_price_histories (variant_id, recorded_at DESC)');

        Schema::create('purchase_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')->nullable()->constrained('purchase_order_items')->nullOnDelete();
            $table->string('attachment_type', 30)->default('receipt');
            $table->string('file_path', 255);
            $table->string('caption', 180)->nullable();
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE purchase_attachments ADD CONSTRAINT chk_pa_type CHECK (attachment_type IN ('receipt', 'product_photo', 'delivery_note', 'other'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_attachments');
        Schema::dropIfExists('purchase_price_histories');

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
            $table->dropColumn([
                'item_name',
                'item_sku',
                'item_specs',
                'is_catalog_linked',
                'stock_entered',
                'photo_url',
                'notes',
            ]);
        });

        DB::statement('DROP INDEX IF EXISTS uq_poi_po_variant');
        DB::statement('DELETE FROM purchase_order_items WHERE variant_id IS NULL');
        DB::statement('ALTER TABLE purchase_order_items ALTER COLUMN variant_id SET NOT NULL');
        DB::statement('ALTER TABLE purchase_order_items ADD CONSTRAINT uq_purchase_order_item UNIQUE (purchase_order_id, variant_id)');

        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS chk_po_amount_paid');
        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS chk_po_payment_status');

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_number',
                'payment_method',
                'payment_status',
                'amount_paid',
                'supplier_contact_name',
                'supplier_whatsapp',
            ]);
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn([
                'whatsapp',
                'secondary_phone',
                'photo_url',
                'notes',
            ]);
        });
    }
};
