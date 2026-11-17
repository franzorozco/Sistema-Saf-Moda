# Sistema de Gestión Comercial — SafModa

Sistema integral de administración para tienda de ropa (**SafModa**), diseñado inicialmente para moda femenina y preparado para escalar a ropa masculina, unisex e infantil. Soporta múltiples sucursales, almacenes, inventario por variantes y conjuntos, POS con pagos mixtos, apartados con reserva de stock, descuentos avanzados, empleados, clientes y reportes históricos inmutables.

---

## Stack Tecnológico

- **Backend:** Laravel (PHP 8.2+, Composer) — carpeta `backend/`
- **Frontend:** React + Vite + ESLint — carpeta `frontend/`
- **Base de Datos:** PostgreSQL 15+ — esquema completo en `docs/database.sql` y migraciones en `backend/database/migrations/`

---

## Estructura del Repositorio

```text
Sistema de SafModa/
├── backend/                  # API y lógica de negocio en Laravel
│   ├── database/
│   │   ├── migrations/       # Migraciones completas por módulo
│   │   └── seeders/          # Seeder inicial (SafModaInitialSeeder)
│   └── .env                  # Configuración local (ignorado en Git)
├── frontend/                 # Interfaz de usuario en React + Vite
├── docs/
│   └── database.sql          # Esquema SQL completo en PostgreSQL (3FN)
├── .gitignore
└── README.md
```

---

## Arquitectura y Módulos del Sistema

### 1. Sucursales, Almacenes y Cajas (`branches`, `warehouses`, `cash_registers`)
- Gestión de múltiples sucursales físicas, bodegas y puntos de venta.
- Almacenes internos por sucursal (piso de venta, trastienda, bodega central).
- Cajas registradoras por sucursal con sesiones de apertura y cierre.

### 2. Identidad, Usuarios, Empleados, Clientes y RBAC
- **Cero redundancia (`persons`)**: Centraliza datos personales (nombre, documento, teléfono, email, género) para que un empleado que también compra no duplique información.
- **`users` y `user_profiles`**: Credenciales de acceso separadas de la configuración/perfil 1:1 del usuario.
- **Empleados (`employees`, `job_positions`, `employee_branches`, `employee_shifts`, `employee_commissions`)**: Cargos, salarios, comisiones por venta, asignación a múltiples sucursales y control de turnos.
- **Clientes (`customers`, `customer_addresses`, `loyalty_transactions`)**: Niveles (`regular`, `silver`, `gold`, `vip`, `wholesale`), puntos de fidelidad, crédito en tienda y direcciones.
- **Roles y Permisos granulares (`roles`, `permissions`, `role_permissions`, `user_roles`)**: Permisos clasificados por `module` y `permission_class` (`read`, `write`, `manage`, `approve`), asignables por rol y con alcance opcional por sucursal.

### 3. Catálogo de Moda Unificado (`Producto > Variante > Atributos` y `Conjunto > Variante > Atributos`)
- **Adaptable por departamento (`departments`)**: `Mujer`, `Hombre`, `Unisex`, etc.
- **Jerarquía unificada**: Tanto un producto individual (`product_type = 'single'`) como un conjunto (`product_type = 'set'`) comparten la misma estructura:
  - `products` → `product_variants` (SKU, código de barras, costo, precio base) → `variant_attribute_values` (Talla, Color con código hex, Material, Corte, etc.).
- **Conjuntos (`set_variant_components`)**: Define qué variantes de prendas individuales componen cada variante del conjunto, con modo de stock propio (`independent`) o derivado de sus prendas (`by_components`).
- **Precios por sucursal (`branch_variant_prices`)**, **guías de tallas (`size_guides`)** e **imágenes (`product_images`)**.

### 4. Inventario Multi-sucursal, Kardex y Compras
- **`inventories`**: Stock físico (`quantity_on_hand`), stock reservado (`quantity_reserved`) y alertas de stock mínimo/máximo por almacén.
- **`inventory_movements`**: Kardex inmutable de cada entrada, salida, venta, devolución, ajuste, traspaso, armado de conjunto o merma.
- **`stock_transfers`** y **`inventory_counts`**: Traspasos entre almacenes/sucursales y auditorías de conteo físico.
- **`suppliers`** y **`purchase_orders`**: Proveedores y órdenes de compra.

### 5. Descuentos, Promociones y Cupones
- Tipos soportados: **porcentual** (`percentage`), **monto fijo** (`fixed_amount`), **2x1 / compra X lleva Y** (`buy_x_get_y`) y **precio fijo** (`fixed_price`).
- Segmentación por sucursal (`discount_branches`), departamento/categoría/producto/variante (`discount_targets`), cliente o nivel (`discount_customers`) y empleados (`discount_employees`).
- Límites de compra mínima/máxima, tope de descuento y límite de usos globales o por cliente (`coupons`, `coupon_redemptions`).
- **Inmutabilidad histórica (`sale_discounts`)**: Guarda un *snapshot* del descuento aplicado; desactivar o eliminar un descuento en el futuro no altera los reportes ni cálculos mensuales pasados.

### 6. Ventas (POS / Online), Pagos Mixtos, Apartados y Devoluciones
- **Ventas en blanco o con cuenta**: `sales.customer_id` es opcional; soporta ventas a `SIN NOMBRE` (`customer_name_snapshot`, `customer_tax_id_snapshot`), registro rápido de datos para recibo/factura o vinculación a cuenta de cliente.
- **Pagos mixtos (`sale_payments`, `payment_methods`)**: Una misma venta puede pagarse combinando métodos (ej. 60 en Efectivo + 40 por QR, o con **Gift Card**).
- **Apartados / Reservas (`layaways`, `layaway_items`, `layaway_payments`)**: Reserva stock real en `inventories.quantity_reserved` y registra adelantos/abonos hasta completar el pago.
- **Cambios de talla y devoluciones (`sale_returns`, `sale_return_items`)**, **facturación (`invoices`)**, **Gift Cards (`gift_cards`)**, **gastos (`expenses`)**, **notificaciones (`notifications`)**, **auditoría (`audit_logs`)** y **configuración (`system_settings`)**.
- **Eliminación lógica**: Tablas principales con `is_active`, `created_at`, `updated_at` y `deleted_at`.

---

## Instalación y Puesta en Marcha

### 1. Base de Datos (PostgreSQL)
1. Crea una base de datos llamada `safmoda` en PostgreSQL.
2. Configura tu contraseña en `backend/.env`:
   ```env
   DB_CONNECTION=pgsql
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_DATABASE=safmoda
   DB_USERNAME=postgres
   DB_PASSWORD=tu_password
   ```

### 2. Backend (Laravel)
```powershell
cd backend
composer install
php artisan migrate --seed
php artisan serve
```

### 3. Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
```

---

## Ramas del Repositorio
- `main` / `master`: Código estable y documentación base.
- `develop`: Rama principal de desarrollo.
