<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->string('display_name', 120)->nullable();
            $table->string('avatar_url', 500)->nullable();
            $table->text('bio')->nullable();
            $table->string('preferred_language', 10)->default('es');
            $table->string('timezone', 60)->default('America/La_Paz');
            $table->string('ui_theme', 20)->default('system');
            $table->string('emergency_contact_name', 150)->nullable();
            $table->string('emergency_contact_phone', 30)->nullable();
            $table->jsonb('notification_prefs')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement("ALTER TABLE user_profiles ADD CONSTRAINT chk_user_profiles_theme CHECK (ui_theme IN ('light', 'dark', 'system'))");

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestampsTz();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('module', 60);
            $table->string('permission_class', 60)->default('general');
            $table->string('code', 100)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->smallInteger('sort_order')->default(0);
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
            $table->timestampTz('assigned_at')->useCurrent();
        });

        DB::statement('ALTER TABLE user_roles ADD CONSTRAINT uq_user_roles_scope UNIQUE NULLS NOT DISTINCT (user_id, role_id, branch_id)');

        Schema::create('job_positions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->decimal('base_salary_ref', 12, 2)->nullable();
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE job_positions ADD CONSTRAINT chk_job_positions_salary CHECK (base_salary_ref IS NULL OR base_salary_ref >= 0)');

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->unique()->constrained('persons')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->foreignId('job_position_id')->constrained('job_positions')->restrictOnDelete();
            $table->foreignId('primary_branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('employee_code', 30)->unique();
            $table->date('hire_date');
            $table->date('termination_date')->nullable();
            $table->string('contract_type', 30)->default('full_time');
            $table->decimal('base_salary', 12, 2)->default(0);
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->string('employment_status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('primary_branch_id', 'idx_employees_branch');
        });

        DB::statement("ALTER TABLE employees ADD CONSTRAINT chk_employees_contract CHECK (contract_type IN ('full_time', 'part_time', 'temporary', 'internship'))");
        DB::statement("ALTER TABLE employees ADD CONSTRAINT chk_employees_status CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated'))");
        DB::statement('ALTER TABLE employees ADD CONSTRAINT chk_employees_salary CHECK (base_salary >= 0)');
        DB::statement('ALTER TABLE employees ADD CONSTRAINT chk_employees_commission CHECK (commission_rate >= 0 AND commission_rate <= 100)');
        DB::statement('ALTER TABLE employees ADD CONSTRAINT chk_employees_dates CHECK (termination_date IS NULL OR termination_date >= hire_date)');

        Schema::create('employee_branches', function (Blueprint $table) {
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->date('assigned_from')->default(DB::raw('CURRENT_DATE'));
            $table->date('assigned_until')->nullable();
            $table->primary(['employee_id', 'branch_id']);
        });

        DB::statement('ALTER TABLE employee_branches ADD CONSTRAINT chk_employee_branches_dates CHECK (assigned_until IS NULL OR assigned_until >= assigned_from)');

        Schema::create('employee_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->date('shift_date');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->timestampTz('actual_check_in')->nullable();
            $table->timestampTz('actual_check_out')->nullable();
            $table->string('status', 20)->default('scheduled');
            $table->string('notes', 255)->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE employee_shifts ADD CONSTRAINT chk_employee_shifts_status CHECK (status IN ('scheduled', 'completed', 'absent', 'late', 'cancelled'))");

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->unique()->constrained('persons')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->string('customer_code', 30)->unique();
            $table->string('customer_tier', 20)->default('regular');
            $table->integer('loyalty_points')->default(0);
            $table->decimal('store_credit', 12, 2)->default(0);
            $table->boolean('accepts_marketing')->default(false);
            $table->foreignId('acquired_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('customer_tier', 'idx_customers_tier');
        });

        DB::statement("ALTER TABLE customers ADD CONSTRAINT chk_customers_tier CHECK (customer_tier IN ('regular', 'silver', 'gold', 'vip', 'wholesale'))");
        DB::statement('ALTER TABLE customers ADD CONSTRAINT chk_customers_points CHECK (loyalty_points >= 0)');
        DB::statement('ALTER TABLE customers ADD CONSTRAINT chk_customers_credit CHECK (store_credit >= 0)');

        Schema::create('customer_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('label', 60)->default('Casa');
            $table->string('recipient_name', 150);
            $table->string('phone', 30)->nullable();
            $table->string('country', 100)->default('Bolivia');
            $table->string('state_province', 100)->nullable();
            $table->string('city', 100);
            $table->string('address_line1', 255);
            $table->string('address_line2', 255)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('reference_notes', 255)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_addresses');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('employee_shifts');
        Schema::dropIfExists('employee_branches');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('job_positions');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('user_profiles');
    }
};
