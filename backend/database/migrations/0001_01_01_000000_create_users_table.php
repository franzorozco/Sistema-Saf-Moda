<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('persons', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('document_type', 20)->nullable();
            $table->string('document_number', 50)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 150)->nullable();
            $table->date('birth_date')->nullable();
            $table->string('gender', 20)->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['document_type', 'document_number'], 'uq_persons_document');
            $table->index('document_number', 'idx_persons_document');
            $table->index(['last_name', 'first_name'], 'idx_persons_name');
        });

        DB::statement("ALTER TABLE persons ADD CONSTRAINT chk_persons_document_type CHECK (document_type IS NULL OR document_type IN ('CI', 'DNI', 'NIT', 'PASSPORT', 'OTHER'))");
        DB::statement("ALTER TABLE persons ADD CONSTRAINT chk_persons_gender CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'))");

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->unique()->constrained('persons')->restrictOnDelete();
            $table->string('username', 80)->nullable()->unique();
            $table->string('email', 150)->unique();
            $table->string('password_hash', 255);
            $table->string('status', 20)->default('active');
            $table->timestampTz('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        DB::statement("ALTER TABLE users ADD CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'suspended', 'locked'))");

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('persons');
    }
};
