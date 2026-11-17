<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 80);
            $table->string('slug', 80)->unique();
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->string('logo_url', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('seasons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->smallInteger('year');
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('code', 40)->unique();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE categories ADD CONSTRAINT chk_categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)');

        Schema::create('size_guides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('name', 120);
            $table->string('unit', 10)->default('cm');
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE size_guides ADD CONSTRAINT chk_size_guides_unit CHECK (unit IN ('cm', 'in'))");

        Schema::create('size_guide_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('size_guide_id')->constrained('size_guides')->cascadeOnDelete();
            $table->string('size_label', 20);
            $table->jsonb('measurements')->default(DB::raw("'{}'::jsonb"));
            $table->smallInteger('sort_order')->default(0);

            $table->unique(['size_guide_id', 'size_label'], 'uq_size_guide_label');
        });

        Schema::create('attributes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 80);
            $table->string('data_type', 20)->default('text');
            $table->boolean('is_variant_axis')->default(true);
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE attributes ADD CONSTRAINT chk_attributes_data_type CHECK (data_type IN ('text', 'color_hex', 'numeric'))");

        Schema::create('attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attribute_id')->constrained('attributes')->cascadeOnDelete();
            $table->string('code', 40);
            $table->string('value', 100);
            $table->char('meta_hex', 7)->nullable();
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['attribute_id', 'code'], 'uq_attribute_values_code');
            $table->unique(['attribute_id', 'value'], 'uq_attribute_values_val');
        });

        DB::statement("ALTER TABLE attribute_values ADD CONSTRAINT chk_attribute_values_hex CHECK (meta_hex IS NULL OR meta_hex ~ '^#[0-9A-Fa-f]{6}$')");

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->constrained('seasons')->nullOnDelete();
            $table->foreignId('size_guide_id')->nullable()->constrained('size_guides')->nullOnDelete();
            $table->string('product_type', 15)->default('single');
            $table->string('set_stock_mode', 20)->default('none');
            $table->string('sku_prefix', 40)->unique();
            $table->string('name', 180);
            $table->string('slug', 180)->unique();
            $table->string('short_description', 300)->nullable();
            $table->text('description')->nullable();
            $table->text('care_instructions')->nullable();
            $table->boolean('is_taxable')->default(true);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        DB::statement("ALTER TABLE products ADD CONSTRAINT chk_products_type CHECK (product_type IN ('single', 'set'))");
        DB::statement("ALTER TABLE products ADD CONSTRAINT chk_products_set_stock_mode CHECK ((product_type = 'single' AND set_stock_mode = 'none') OR (product_type = 'set' AND set_stock_mode IN ('independent', 'by_components')))");
        DB::statement('ALTER TABLE products ADD CONSTRAINT chk_products_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100)');
        DB::statement('CREATE INDEX idx_products_dept_cat ON products(department_id, category_id) WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_products_type ON products(product_type) WHERE deleted_at IS NULL');

        Schema::create('product_attributes', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained('attributes')->restrictOnDelete();
            $table->boolean('is_required')->default(true);
            $table->smallInteger('sort_order')->default(0);
            $table->primary(['product_id', 'attribute_id']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('sku', 64)->unique();
            $table->string('barcode', 64)->nullable()->unique();
            $table->string('variant_label', 150)->nullable();
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('base_price', 12, 2);
            $table->decimal('min_sale_price', 12, 2)->nullable();
            $table->integer('weight_grams')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT chk_pv_cost CHECK (cost_price >= 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT chk_pv_base CHECK (base_price >= 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT chk_pv_min CHECK (min_sale_price IS NULL OR min_sale_price >= 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT chk_pv_weight CHECK (weight_grams IS NULL OR weight_grams >= 0)');
        DB::statement('CREATE INDEX idx_product_variants_product ON product_variants(product_id) WHERE deleted_at IS NULL');

        Schema::create('variant_attribute_values', function (Blueprint $table) {
            $table->foreignId('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained('attributes')->restrictOnDelete();
            $table->foreignId('attribute_value_id')->constrained('attribute_values')->restrictOnDelete();
            $table->primary(['variant_id', 'attribute_id']);
            $table->index(['attribute_id', 'attribute_value_id'], 'idx_variant_attr_val_lookup');
        });

        Schema::create('set_variant_components', function (Blueprint $table) {
            $table->foreignId('set_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('component_variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity')->default(1);
            $table->boolean('is_optional')->default(false);
            $table->primary(['set_variant_id', 'component_variant_id']);
        });

        DB::statement('ALTER TABLE set_variant_components ADD CONSTRAINT chk_set_qty CHECK (quantity > 0)');
        DB::statement('ALTER TABLE set_variant_components ADD CONSTRAINT chk_set_no_self_component CHECK (set_variant_id <> component_variant_id)');

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->string('image_url', 500);
            $table->string('alt_text', 180)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->smallInteger('sort_order')->default(0);
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('branch_variant_prices', function (Blueprint $table) {
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->decimal('sale_price', 12, 2);
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('updated_at')->useCurrent();
            $table->primary(['branch_id', 'variant_id']);
        });

        DB::statement('ALTER TABLE branch_variant_prices ADD CONSTRAINT chk_bvp_price CHECK (sale_price >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_variant_prices');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('set_variant_components');
        Schema::dropIfExists('variant_attribute_values');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_attributes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('attribute_values');
        Schema::dropIfExists('attributes');
        Schema::dropIfExists('size_guide_items');
        Schema::dropIfExists('size_guides');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('seasons');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('departments');
    }
};
