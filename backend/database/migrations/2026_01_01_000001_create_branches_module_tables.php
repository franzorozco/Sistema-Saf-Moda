<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 150);
            $table->string('branch_type', 20)->default('retail');
            $table->string('country', 100)->default('Bolivia');
            $table->string('state_province', 100)->nullable();
            $table->string('city', 100);
            $table->string('address_line', 255);
            $table->string('phone', 30)->nullable();
            $table->string('email', 150)->nullable();
            $table->boolean('is_main')->default(false);
            $table->boolean('is_active')->default(true);
            $table->date('opened_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        DB::statement("ALTER TABLE branches ADD CONSTRAINT chk_branches_type CHECK (branch_type IN ('retail', 'warehouse', 'hybrid', 'online_hub'))");

        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('code', 30);
            $table->string('name', 120);
            $table->string('warehouse_type', 20)->default('sales_floor');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['branch_id', 'code'], 'uq_warehouses_branch_code');
            $table->index('branch_id', 'idx_warehouses_branch_id');
        });

        DB::statement("ALTER TABLE warehouses ADD CONSTRAINT chk_warehouses_type CHECK (warehouse_type IN ('sales_floor', 'backroom', 'central_storage', 'transit'))");

        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('code', 30);
            $table->string('name', 100);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['branch_id', 'code'], 'uq_cash_registers_branch_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('branches');
    }
};
