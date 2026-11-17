<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SafModaInitialSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Sucursal principal, almacén y caja
        $branchId = DB::table('branches')->insertGetId([
            'code' => 'SUC-01',
            'name' => 'SafModa Central',
            'branch_type' => 'hybrid',
            'country' => 'Bolivia',
            'city' => 'Santa Cruz',
            'address_line' => 'Dirección Principal',
            'is_main' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('warehouses')->insert([
            'branch_id' => $branchId,
            'code' => 'ALM-01',
            'name' => 'Piso de Venta Central',
            'warehouse_type' => 'sales_floor',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('cash_registers')->insert([
            'branch_id' => $branchId,
            'code' => 'CAJA-01',
            'name' => 'Caja Principal',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Departamentos (Mujer primero, listo para Hombre/Unisex)
        DB::table('departments')->insert([
            ['code' => 'WOMEN', 'name' => 'Mujer', 'slug' => 'mujer', 'sort_order' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'MEN', 'name' => 'Hombre', 'slug' => 'hombre', 'sort_order' => 2, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'UNISEX', 'name' => 'Unisex', 'slug' => 'unisex', 'sort_order' => 3, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 3. Atributos base (Talla, Color, Material)
        $sizeAttrId = DB::table('attributes')->insertGetId([
            'code' => 'SIZE',
            'name' => 'Talla',
            'data_type' => 'text',
            'is_variant_axis' => true,
            'sort_order' => 1,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $colorAttrId = DB::table('attributes')->insertGetId([
            'code' => 'COLOR',
            'name' => 'Color',
            'data_type' => 'color_hex',
            'is_variant_axis' => true,
            'sort_order' => 2,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('attributes')->insert([
            'code' => 'MATERIAL',
            'name' => 'Material',
            'data_type' => 'text',
            'is_variant_axis' => false,
            'sort_order' => 3,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('attribute_values')->insert([
            ['attribute_id' => $sizeAttrId, 'code' => 'XS', 'value' => 'XS', 'meta_hex' => null, 'sort_order' => 1, 'is_active' => true],
            ['attribute_id' => $sizeAttrId, 'code' => 'S', 'value' => 'S', 'meta_hex' => null, 'sort_order' => 2, 'is_active' => true],
            ['attribute_id' => $sizeAttrId, 'code' => 'M', 'value' => 'M', 'meta_hex' => null, 'sort_order' => 3, 'is_active' => true],
            ['attribute_id' => $sizeAttrId, 'code' => 'L', 'value' => 'L', 'meta_hex' => null, 'sort_order' => 4, 'is_active' => true],
            ['attribute_id' => $sizeAttrId, 'code' => 'XL', 'value' => 'XL', 'meta_hex' => null, 'sort_order' => 5, 'is_active' => true],
            ['attribute_id' => $colorAttrId, 'code' => 'BLACK', 'value' => 'Negro', 'meta_hex' => '#000000', 'sort_order' => 1, 'is_active' => true],
            ['attribute_id' => $colorAttrId, 'code' => 'WHITE', 'value' => 'Blanco', 'meta_hex' => '#FFFFFF', 'sort_order' => 2, 'is_active' => true],
            ['attribute_id' => $colorAttrId, 'code' => 'BEIGE', 'value' => 'Beige', 'meta_hex' => '#F5F5DC', 'sort_order' => 3, 'is_active' => true],
            ['attribute_id' => $colorAttrId, 'code' => 'RED', 'value' => 'Rojo', 'meta_hex' => '#C81E1E', 'sort_order' => 4, 'is_active' => true],
        ]);

        // 4. Roles base y Permisos granulares clasificados por módulo y clase
        DB::table('roles')->insert([
            ['code' => 'admin', 'name' => 'Administrador', 'description' => 'Acceso total al sistema', 'is_system' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'branch_manager', 'name' => 'Encargado de Sucursal', 'description' => 'Gestión operativa de sucursal', 'is_system' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'cashier', 'name' => 'Cajero', 'description' => 'POS, cobros, aperturas y cierres de caja', 'is_system' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'seller', 'name' => 'Vendedor', 'description' => 'Atención al cliente y registro de ventas', 'is_system' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'warehouse_clerk', 'name' => 'Almacenero', 'description' => 'Control de inventario, compras y traspasos', 'is_system' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $permissions = [
            ['module' => 'catalog', 'permission_class' => 'read', 'code' => 'catalog.view', 'name' => 'Ver catálogo', 'sort_order' => 1],
            ['module' => 'catalog', 'permission_class' => 'write', 'code' => 'catalog.manage', 'name' => 'Crear y editar productos/conjuntos', 'sort_order' => 2],
            ['module' => 'inventory', 'permission_class' => 'read', 'code' => 'inventory.view', 'name' => 'Ver inventario y kardex', 'sort_order' => 1],
            ['module' => 'inventory', 'permission_class' => 'write', 'code' => 'inventory.adjust', 'name' => 'Realizar ajustes y traspasos', 'sort_order' => 2],
            ['module' => 'pos', 'permission_class' => 'write', 'code' => 'pos.sell', 'name' => 'Registrar ventas en POS', 'sort_order' => 1],
            ['module' => 'pos', 'permission_class' => 'manage', 'code' => 'pos.cash_register', 'name' => 'Abrir y cerrar caja', 'sort_order' => 2],
            ['module' => 'pos', 'permission_class' => 'approve', 'code' => 'pos.returns', 'name' => 'Procesar devoluciones y cambios', 'sort_order' => 3],
            ['module' => 'discounts', 'permission_class' => 'manage', 'code' => 'discounts.manage', 'name' => 'Gestionar descuentos y cupones', 'sort_order' => 1],
            ['module' => 'hr', 'permission_class' => 'read', 'code' => 'employees.view', 'name' => 'Ver empleados y turnos', 'sort_order' => 1],
            ['module' => 'hr', 'permission_class' => 'manage', 'code' => 'employees.manage', 'name' => 'Gestionar empleados, roles y comisiones', 'sort_order' => 2],
            ['module' => 'reports', 'permission_class' => 'read', 'code' => 'reports.view', 'name' => 'Ver reportes financieros y ventas', 'sort_order' => 1],
            ['module' => 'settings', 'permission_class' => 'manage', 'code' => 'settings.manage', 'name' => 'Configurar sistema y sucursales', 'sort_order' => 1],
        ];
        DB::table('permissions')->insert($permissions);

        $adminRoleId = DB::table('roles')->where('code', 'admin')->value('id');
        $allPermissionIds = DB::table('permissions')->pluck('id');
        foreach ($allPermissionIds as $permId) {
            DB::table('role_permissions')->insert([
                'role_id' => $adminRoleId,
                'permission_id' => $permId,
            ]);
        }

        // 5. Métodos de pago (soporta pagos mixtos)
        DB::table('payment_methods')->insert([
            ['code' => 'CASH', 'name' => 'Efectivo', 'method_type' => 'cash', 'is_active' => true],
            ['code' => 'QR', 'name' => 'QR / Transferencia', 'method_type' => 'qr_transfer', 'is_active' => true],
            ['code' => 'CARD', 'name' => 'Tarjeta Débito/Crédito', 'method_type' => 'card', 'is_active' => true],
            ['code' => 'STORE_CREDIT', 'name' => 'Crédito en Tienda', 'method_type' => 'store_credit', 'is_active' => true],
            ['code' => 'GIFT_CARD', 'name' => 'Gift Card', 'method_type' => 'gift_card', 'is_active' => true],
        ]);

        // 6. Categorías de gastos
        DB::table('expense_categories')->insert([
            ['code' => 'RENT', 'name' => 'Alquiler', 'description' => 'Alquiler de local', 'is_active' => true],
            ['code' => 'UTILITIES', 'name' => 'Servicios Básicos', 'description' => 'Luz, agua, internet', 'is_active' => true],
            ['code' => 'PACKAGING', 'name' => 'Empaques y Bolsas', 'description' => 'Bolsas, etiquetas, cajas', 'is_active' => true],
            ['code' => 'DELIVERY', 'name' => 'Envíos y Transporte', 'description' => 'Mensajería y fletes', 'is_active' => true],
            ['code' => 'MISC', 'name' => 'Gastos Varios', 'description' => 'Caja chica general', 'is_active' => true],
        ]);

        // 7. Configuración inicial del sistema
        DB::table('system_settings')->insert([
            ['branch_id' => null, 'group_name' => 'general', 'setting_key' => 'store_name', 'setting_value' => 'SafModa', 'value_type' => 'string', 'description' => 'Nombre comercial de la tienda', 'is_public' => true, 'updated_at' => now()],
            ['branch_id' => null, 'group_name' => 'general', 'setting_key' => 'default_currency', 'setting_value' => 'BOB', 'value_type' => 'string', 'description' => 'Moneda por defecto', 'is_public' => true, 'updated_at' => now()],
            ['branch_id' => null, 'group_name' => 'pos', 'setting_key' => 'default_customer_name', 'setting_value' => 'SIN NOMBRE', 'value_type' => 'string', 'description' => 'Nombre por defecto para ventas en blanco', 'is_public' => false, 'updated_at' => now()],
            ['branch_id' => null, 'group_name' => 'layaway', 'setting_key' => 'default_layaway_days', 'setting_value' => '15', 'value_type' => 'integer', 'description' => 'Días de vigencia por defecto para apartados', 'is_public' => false, 'updated_at' => now()],
        ]);

        // 8. Superusuario inicial
        $personId = DB::table('persons')->insertGetId([
            'first_name' => 'Super',
            'last_name' => 'Admin',
            'email' => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = DB::table('users')->insertGetId([
            'person_id' => $personId,
            'username' => 'admin',
            'email' => 'admin',
            'password_hash' => Hash::make('admin'),
            'status' => 'active',
            'email_verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $superAdminRoleId = DB::table('roles')->where('code', 'SUPER_ADMIN')->value('id');
        if ($superAdminRoleId) {
            DB::table('user_roles')->insert([
                'user_id' => $userId,
                'role_id' => $superAdminRoleId,
                'branch_id' => null,
                'assigned_at' => now(),
            ]);
        }
    }
}
