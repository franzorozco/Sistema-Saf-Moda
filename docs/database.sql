-- ============================================================================
-- SISTEMA DE GESTIÓN COMERCIAL Y MULTI-SUCURSAL: SAFMODA
-- Motor: PostgreSQL (15+)
-- Archivo: /docs/database.sql
--
-- Principios de diseño:
--   1. Normalización estricta (3FN) sin redundancia de datos personales ni de catálogo.
--   2. Multi-sucursal (branches -> warehouses).
--   3. Catálogo unificado adaptable a Mujer, Hombre, Unisex, Niños (departments).
--   4. Arquitectura unificada Producto > Variante > Atributos y Conjunto > Variante > Atributos.
--   5. Kardex inmutable de inventario, compras, ventas POS/online, descuentos y auditoría.
-- ============================================================================

BEGIN;

-- ============================================================================
-- UTILIDADES GLOBALES (FUNCIONES DE TRIGGER)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- MÓDULO 1: SUCURSALES, ALMACENES Y CAJAS
-- Permite gestionar múltiples sucursales físicas, bodegas y puntos de venta.
-- ============================================================================

CREATE TABLE branches (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    branch_type     VARCHAR(20) NOT NULL DEFAULT 'retail',
    country         VARCHAR(100) NOT NULL DEFAULT 'Bolivia',
    state_province  VARCHAR(100),
    city            VARCHAR(100) NOT NULL,
    address_line    VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    email           VARCHAR(150),
    is_main         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    opened_at       DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_branches_type CHECK (branch_type IN ('retail', 'warehouse', 'hybrid', 'online_hub'))
);

CREATE TABLE warehouses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    warehouse_type  VARCHAR(20) NOT NULL DEFAULT 'sales_floor',
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouses_branch_code UNIQUE (branch_id, code),
    CONSTRAINT chk_warehouses_type CHECK (warehouse_type IN ('sales_floor', 'backroom', 'central_storage', 'transit'))
);

CREATE TABLE cash_registers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cash_registers_branch_code UNIQUE (branch_id, code)
);


-- ============================================================================
-- MÓDULO 2: IDENTIDAD, USUARIOS, PERFILES, EMPLEADOS, CLIENTES Y RBAC
-- Sin redundancia:
--   - persons: identidad física única (evita duplicar nombre/CI/teléfono si un empleado también compra).
--   - users: credenciales de acceso al sistema.
--   - user_profiles: configuración y datos de perfil 1:1 de la cuenta de usuario.
--   - employees: relación laboral con tienda/sucursal (referencia a persons y opcionalmente users).
--   - customers: relación comercial/fidelización (referencia a persons y opcionalmente users).
-- ============================================================================

CREATE TABLE persons (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    document_type   VARCHAR(20),
    document_number VARCHAR(50),
    phone           VARCHAR(30),
    email           VARCHAR(150),
    birth_date      DATE,
    gender          VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_persons_document UNIQUE (document_type, document_number),
    CONSTRAINT chk_persons_document_type CHECK (document_type IS NULL OR document_type IN ('CI', 'DNI', 'NIT', 'PASSPORT', 'OTHER')),
    CONSTRAINT chk_persons_gender CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'))
);

CREATE TABLE users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id           BIGINT NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
    username            VARCHAR(80) UNIQUE,
    email               VARCHAR(150) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    email_verified_at   TIMESTAMPTZ,
    remember_token      VARCHAR(100),
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'suspended', 'locked'))
);

CREATE TABLE user_profiles (
    user_id                 BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name            VARCHAR(120),
    avatar_url              VARCHAR(500),
    bio                     TEXT,
    preferred_language      VARCHAR(10) NOT NULL DEFAULT 'es',
    timezone                VARCHAR(60) NOT NULL DEFAULT 'America/La_Paz',
    ui_theme                VARCHAR(20) NOT NULL DEFAULT 'system',
    emergency_contact_name  VARCHAR(150),
    emergency_contact_phone VARCHAR(30),
    notification_prefs      JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_profiles_theme CHECK (ui_theme IN ('light', 'dark', 'system'))
);

CREATE TABLE roles (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module              VARCHAR(60) NOT NULL,
    permission_class    VARCHAR(60) NOT NULL DEFAULT 'general',
    code                VARCHAR(100) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    description         TEXT,
    sort_order          SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE role_permissions (
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Asignación de roles por usuario con alcance opcional a una sucursal específica
CREATE TABLE user_roles (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_scope UNIQUE NULLS NOT DISTINCT (user_id, role_id, branch_id)
);

CREATE TABLE job_positions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    base_salary_ref NUMERIC(12, 2) CHECK (base_salary_ref IS NULL OR base_salary_ref >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE employees (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id           BIGINT NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
    user_id             BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    job_position_id     BIGINT NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
    primary_branch_id   BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_code       VARCHAR(30) NOT NULL UNIQUE,
    hire_date           DATE NOT NULL,
    termination_date    DATE,
    contract_type       VARCHAR(30) NOT NULL DEFAULT 'full_time',
    base_salary         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    commission_rate     NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
    employment_status   VARCHAR(20) NOT NULL DEFAULT 'active',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_employees_contract CHECK (contract_type IN ('full_time', 'part_time', 'temporary', 'internship')),
    CONSTRAINT chk_employees_status CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated')),
    CONSTRAINT chk_employees_dates CHECK (termination_date IS NULL OR termination_date >= hire_date)
);

-- Relación N:M para empleados que cubren turnos o trabajan en múltiples sucursales
CREATE TABLE employee_branches (
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_from   DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_until  DATE,
    PRIMARY KEY (employee_id, branch_id),
    CONSTRAINT chk_employee_branches_dates CHECK (assigned_until IS NULL OR assigned_until >= assigned_from)
);

CREATE TABLE employee_shifts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_date      DATE NOT NULL,
    starts_at       TIME NOT NULL,
    ends_at         TIME NOT NULL,
    actual_check_in TIMESTAMPTZ,
    actual_check_out TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    notes           VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_employee_shifts_status CHECK (status IN ('scheduled', 'completed', 'absent', 'late', 'cancelled'))
);

CREATE TABLE customers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id           BIGINT NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
    user_id             BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    customer_code       VARCHAR(30) NOT NULL UNIQUE,
    customer_tier       VARCHAR(20) NOT NULL DEFAULT 'regular',
    loyalty_points      INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
    store_credit        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (store_credit >= 0),
    accepts_marketing   BOOLEAN NOT NULL DEFAULT FALSE,
    acquired_branch_id  BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    notes               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_customers_tier CHECK (customer_tier IN ('regular', 'silver', 'gold', 'vip', 'wholesale'))
);

CREATE TABLE customer_addresses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label           VARCHAR(60) NOT NULL DEFAULT 'Casa',
    recipient_name  VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    country         VARCHAR(100) NOT NULL DEFAULT 'Bolivia',
    state_province  VARCHAR(100),
    city            VARCHAR(100) NOT NULL,
    address_line1   VARCHAR(255) NOT NULL,
    address_line2   VARCHAR(255),
    postal_code     VARCHAR(20),
    reference_notes VARCHAR(255),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- MÓDULO 3: CATÁLOGO DE MODA (PRODUCTO > VARIANTE > ATRIBUTOS Y CONJUNTO > VARIANTE > ATRIBUTOS)
-- Adaptable a Mujer (actual), Hombre, Unisex y Niños mediante departments.
-- Productos individuales y Conjuntos comparten exactamente las mismas tablas
-- base (products -> product_variants -> variant_attribute_values), diferenciándose
-- en su manejo mediante product_type, set_stock_mode y set_variant_components.
-- ============================================================================

-- Segmento/Público objetivo: Mujer, Hombre, Unisex, Niñas, Niños
CREATE TABLE departments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(80) NOT NULL,
    slug            VARCHAR(80) NOT NULL UNIQUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brands (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    logo_url        VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE seasons (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    year            SMALLINT NOT NULL,
    starts_at       DATE,
    ends_at         DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id       BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    description     TEXT,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE size_guides (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id   BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    category_id     BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(120) NOT NULL,
    unit            VARCHAR(10) NOT NULL DEFAULT 'cm',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_size_guides_unit CHECK (unit IN ('cm', 'in'))
);

CREATE TABLE size_guide_items (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    size_guide_id   BIGINT NOT NULL REFERENCES size_guides(id) ON DELETE CASCADE,
    size_label      VARCHAR(20) NOT NULL,
    measurements    JSONB NOT NULL DEFAULT '{}'::JSONB,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_size_guide_label UNIQUE (size_guide_id, size_label)
);

-- Definición de atributos dinámicos (ej: Talla, Color, Material, Corte, Largo, Estampado)
CREATE TABLE attributes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(80) NOT NULL,
    data_type       VARCHAR(20) NOT NULL DEFAULT 'text',
    is_variant_axis BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_attributes_data_type CHECK (data_type IN ('text', 'color_hex', 'numeric'))
);

-- Valores normalizados de cada atributo (ej: Talla -> XS, S, M, L; Color -> Negro #000000)
CREATE TABLE attribute_values (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attribute_id    BIGINT NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    code            VARCHAR(40) NOT NULL,
    value           VARCHAR(100) NOT NULL,
    meta_hex        CHAR(7),
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_attribute_values_code UNIQUE (attribute_id, code),
    CONSTRAINT uq_attribute_values_val UNIQUE (attribute_id, value),
    CONSTRAINT chk_attribute_values_hex CHECK (meta_hex IS NULL OR meta_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- Entidad principal unificada para Producto Individual y Conjunto
CREATE TABLE products (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id       BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    category_id         BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id            BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    season_id           BIGINT REFERENCES seasons(id) ON DELETE SET NULL,
    size_guide_id       BIGINT REFERENCES size_guides(id) ON DELETE SET NULL,
    product_type        VARCHAR(15) NOT NULL DEFAULT 'single',
    set_stock_mode      VARCHAR(20) NOT NULL DEFAULT 'none',
    sku_prefix          VARCHAR(40) NOT NULL UNIQUE,
    name                VARCHAR(180) NOT NULL,
    slug                VARCHAR(180) NOT NULL UNIQUE,
    short_description   VARCHAR(300),
    description         TEXT,
    care_instructions   TEXT,
    is_taxable          BOOLEAN NOT NULL DEFAULT TRUE,
    tax_rate            NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_products_type CHECK (product_type IN ('single', 'set')),
    CONSTRAINT chk_products_set_stock_mode CHECK (
        (product_type = 'single' AND set_stock_mode = 'none')
        OR (product_type = 'set' AND set_stock_mode IN ('independent', 'by_components'))
    )
);

-- Atributos habilitados por producto/conjunto (ej. este producto varía por Talla y Color)
CREATE TABLE product_attributes (
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id    BIGINT NOT NULL REFERENCES attributes(id) ON DELETE RESTRICT,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, attribute_id)
);

-- Nivel "Variable / Variante": representa cada SKU vendible de un Producto o de un Conjunto
CREATE TABLE product_variants (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku             VARCHAR(64) NOT NULL UNIQUE,
    barcode         VARCHAR(64) UNIQUE,
    variant_label   VARCHAR(150),
    cost_price      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    base_price      NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    min_sale_price  NUMERIC(12, 2) CHECK (min_sale_price IS NULL OR min_sale_price >= 0),
    weight_grams    INTEGER CHECK (weight_grams IS NULL OR weight_grams >= 0),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Nivel "Atributos" de cada variante (ej. Variante X -> Talla: M, Color: Vino, Material: Lino)
CREATE TABLE variant_attribute_values (
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_id        BIGINT NOT NULL REFERENCES attributes(id) ON DELETE RESTRICT,
    attribute_value_id  BIGINT NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
    PRIMARY KEY (variant_id, attribute_id)
);

-- Composición de un Conjunto: vincula cada variante de Conjunto con las variantes de prendas que lo integran
CREATE TABLE set_variant_components (
    set_variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    component_variant_id    BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity                INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    is_optional             BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (set_variant_id, component_variant_id),
    CONSTRAINT chk_set_no_self_component CHECK (set_variant_id <> component_variant_id)
);

CREATE TABLE product_images (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id      BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url       VARCHAR(500) NOT NULL,
    alt_text        VARCHAR(180),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Precios diferenciados por sucursal (opcional, sobreescribe base_price en esa sucursal)
CREATE TABLE branch_variant_prices (
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    variant_id      BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    sale_price      NUMERIC(12, 2) NOT NULL CHECK (sale_price >= 0),
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (branch_id, variant_id)
);


-- ============================================================================
-- MÓDULO 4: INVENTARIO MULTI-SUCURSAL, KARDEX, TRASPASOS Y CONTEOS FÍSICOS
-- ============================================================================

CREATE TABLE inventories (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id        BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity_on_hand    INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    min_stock_alert     INTEGER NOT NULL DEFAULT 3 CHECK (min_stock_alert >= 0),
    max_stock_limit     INTEGER CHECK (max_stock_limit IS NULL OR max_stock_limit >= min_stock_alert),
    bin_location        VARCHAR(50),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventories_wh_variant UNIQUE (warehouse_id, variant_id),
    CONSTRAINT chk_inventories_reserved CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE TABLE inventory_movements (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id            BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    variant_id              BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    movement_type           VARCHAR(25) NOT NULL,
    quantity                INTEGER NOT NULL CHECK (quantity <> 0),
    unit_cost               NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    balance_after           INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_type          VARCHAR(50),
    reference_id            BIGINT,
    notes                   VARCHAR(255),
    performed_by_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_inventory_movements_type CHECK (
        movement_type IN (
            'initial_stock', 'purchase_in', 'sale_out', 'return_in',
            'adjustment_in', 'adjustment_out', 'transfer_out', 'transfer_in',
            'set_assembly_in', 'set_assembly_out', 'damaged_out'
        )
    )
);

CREATE TABLE stock_transfers (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transfer_number         VARCHAR(40) NOT NULL UNIQUE,
    source_warehouse_id     BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_warehouse_id     BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    requested_by_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    shipped_by_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    received_by_user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    shipped_at              TIMESTAMPTZ,
    received_at             TIMESTAMPTZ,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stock_transfers_diff_wh CHECK (source_warehouse_id <> target_warehouse_id),
    CONSTRAINT chk_stock_transfers_status CHECK (status IN ('draft', 'in_transit', 'partial', 'received', 'cancelled'))
);

CREATE TABLE stock_transfer_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_transfer_id   BIGINT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity_requested  INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_shipped    INTEGER NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
    quantity_received   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    CONSTRAINT uq_stock_transfer_item UNIQUE (stock_transfer_id, variant_id)
);

CREATE TABLE inventory_counts (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    count_number            VARCHAR(40) NOT NULL UNIQUE,
    warehouse_id            BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    conducted_by_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    notes                   TEXT,
    CONSTRAINT chk_inventory_counts_status CHECK (status IN ('in_progress', 'pending_approval', 'approved', 'cancelled'))
);

CREATE TABLE inventory_count_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inventory_count_id  BIGINT NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    expected_quantity   INTEGER NOT NULL CHECK (expected_quantity >= 0),
    counted_quantity    INTEGER NOT NULL CHECK (counted_quantity >= 0),
    notes               VARCHAR(255),
    CONSTRAINT uq_inventory_count_item UNIQUE (inventory_count_id, variant_id)
);


-- ============================================================================
-- MÓDULO 5: PROVEEDORES Y COMPRAS (ABASTECIMIENTO)
-- ============================================================================

CREATE TABLE suppliers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    business_name   VARCHAR(180) NOT NULL,
    contact_name    VARCHAR(150),
    tax_id          VARCHAR(50),
    phone           VARCHAR(30),
    email           VARCHAR(150),
    address         VARCHAR(255),
    city            VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'Bolivia',
    payment_terms   VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE purchase_orders (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number               VARCHAR(40) NOT NULL UNIQUE,
    supplier_id             BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    target_warehouse_id     BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date           DATE,
    received_at             TIMESTAMPTZ,
    subtotal                NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount              NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_cost           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    total_amount            NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_by_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_purchase_orders_status CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled'))
);

CREATE TABLE purchase_order_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id   BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity_ordered    INTEGER NOT NULL CHECK (quantity_ordered > 0),
    quantity_received   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost           NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    line_total          NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT uq_purchase_order_item UNIQUE (purchase_order_id, variant_id)
);


-- ============================================================================
-- MÓDULO 6: DESCUENTOS, PROMOCIONES Y CUPONES
-- Soporta descuentos porcentuales, monto fijo, 2x1 / compra X lleva Y,
-- y precio promocional por paquete/conjunto, aplicables por tienda/sucursal,
-- departamento, categoría, producto o variante.
-- ============================================================================

CREATE TABLE discounts (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                    VARCHAR(40) UNIQUE,
    name                    VARCHAR(150) NOT NULL,
    description             TEXT,
    discount_type           VARCHAR(20) NOT NULL,
    discount_value          NUMERIC(12, 2) NOT NULL CHECK (discount_value >= 0),
    max_discount_amount     NUMERIC(12, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
    buy_quantity            INTEGER CHECK (buy_quantity IS NULL OR buy_quantity > 0),
    get_quantity            INTEGER CHECK (get_quantity IS NULL OR get_quantity > 0),
    applies_to              VARCHAR(30) NOT NULL DEFAULT 'entire_order',
    min_purchase_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_purchase_amount >= 0),
    max_purchase_amount     NUMERIC(12, 2) CHECK (max_purchase_amount IS NULL OR max_purchase_amount >= min_purchase_amount),
    min_items_quantity      INTEGER NOT NULL DEFAULT 0 CHECK (min_items_quantity >= 0),
    max_uses                INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
    max_uses_per_customer   INTEGER CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer > 0),
    times_used              INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
    requires_coupon         BOOLEAN NOT NULL DEFAULT FALSE,
    is_stackable            BOOLEAN NOT NULL DEFAULT FALSE,
    priority                SMALLINT NOT NULL DEFAULT 100,
    starts_at               TIMESTAMPTZ NOT NULL,
    ends_at                 TIMESTAMPTZ,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT chk_discounts_type CHECK (discount_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'fixed_price')),
    CONSTRAINT chk_discounts_pct_range CHECK (discount_type <> 'percentage' OR (discount_value > 0 AND discount_value <= 100)),
    CONSTRAINT chk_discounts_applies_to CHECK (
        applies_to IN ('entire_order', 'departments', 'categories', 'products', 'variants')
    ),
    CONSTRAINT chk_discounts_dates CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Clientes específicos o niveles (tier) a los que aplica el descuento
CREATE TABLE discount_customers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    discount_id     BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    customer_id     BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    customer_tier   VARCHAR(20),
    CONSTRAINT chk_discount_customers_target CHECK (
        (customer_id IS NOT NULL AND customer_tier IS NULL) OR
        (customer_id IS NULL AND customer_tier IS NOT NULL)
    ),
    CONSTRAINT chk_discount_customers_tier CHECK (customer_tier IS NULL OR customer_tier IN ('regular', 'silver', 'gold', 'vip', 'wholesale'))
);

-- Empleados específicos a los que aplica un descuento de personal
CREATE TABLE discount_employees (
    discount_id     BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_id, employee_id)
);

-- Sucursales donde aplica el descuento (si no hay registros, aplica a todas las de la tienda)
CREATE TABLE discount_branches (
    discount_id     BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    branch_id       BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_id, branch_id)
);

-- Objetivos del descuento con exclusividad mutua por fila (sin redundancia)
CREATE TABLE discount_targets (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    discount_id     BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    department_id   BIGINT REFERENCES departments(id) ON DELETE CASCADE,
    category_id     BIGINT REFERENCES categories(id) ON DELETE CASCADE,
    product_id      BIGINT REFERENCES products(id) ON DELETE CASCADE,
    variant_id      BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    CONSTRAINT chk_discount_targets_single_fk CHECK (
        (CASE WHEN department_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN category_id   IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN product_id    IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN variant_id    IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE TABLE coupons (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    discount_id                 BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    code                        VARCHAR(40) NOT NULL UNIQUE,
    usage_limit                 INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    usage_limit_per_customer    INTEGER NOT NULL DEFAULT 1 CHECK (usage_limit_per_customer > 0),
    times_used                  INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
    customer_id                 BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    starts_at                   TIMESTAMPTZ,
    ends_at                     TIMESTAMPTZ,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coupons_usage CHECK (usage_limit IS NULL OR times_used <= usage_limit)
);


-- ============================================================================
-- MÓDULO 7: CAJA, VENTAS (POS / ONLINE), PAGOS MIXTOS Y DEVOLUCIONES
-- ============================================================================

CREATE TABLE payment_methods (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(80) NOT NULL,
    method_type     VARCHAR(20) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_payment_methods_type CHECK (method_type IN ('cash', 'card', 'qr_transfer', 'store_credit', 'gift_card', 'other'))
);

CREATE TABLE cash_register_sessions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cash_register_id    BIGINT NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    employee_id         BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    opening_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
    expected_amount     NUMERIC(12, 2) CHECK (expected_amount IS NULL OR expected_amount >= 0),
    counted_amount      NUMERIC(12, 2) CHECK (counted_amount IS NULL OR counted_amount >= 0),
    difference_amount   NUMERIC(12, 2),
    status              VARCHAR(15) NOT NULL DEFAULT 'open',
    closing_notes       TEXT,
    CONSTRAINT chk_cash_sessions_status CHECK (status IN ('open', 'closed'))
);

CREATE TABLE sales (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_number                 VARCHAR(40) NOT NULL UNIQUE,
    branch_id                   BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id                BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    cash_register_session_id    BIGINT REFERENCES cash_register_sessions(id) ON DELETE SET NULL,
    customer_id                 BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name_snapshot      VARCHAR(200) NOT NULL DEFAULT 'SIN NOMBRE',
    customer_tax_id_snapshot    VARCHAR(50),
    seller_employee_id          BIGINT REFERENCES employees(id) ON DELETE SET NULL,
    sale_channel                VARCHAR(20) NOT NULL DEFAULT 'pos',
    status                      VARCHAR(20) NOT NULL DEFAULT 'completed',
    subtotal                    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_total              NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    tax_total                   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
    total_amount                NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    currency_code               CHAR(3) NOT NULL DEFAULT 'BOB',
    notes                       TEXT,
    sold_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sales_channel CHECK (sale_channel IN ('pos', 'online', 'whatsapp', 'marketplace')),
    CONSTRAINT chk_sales_status CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded', 'partial_refund'))
);

CREATE TABLE sale_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id             BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost_snapshot  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
    discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    line_total          NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

-- Registro histórico (snapshot) de qué descuentos se aplicaron a la venta o a una línea
-- Inmutable para reportes: aunque el descuento se desactive o elimine después, el cálculo histórico no cambia.
CREATE TABLE sale_discounts (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id                 BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sale_item_id            BIGINT REFERENCES sale_items(id) ON DELETE CASCADE,
    discount_id             BIGINT REFERENCES discounts(id) ON DELETE SET NULL,
    coupon_id               BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
    discount_name_snapshot  VARCHAR(150) NOT NULL,
    discount_type           VARCHAR(20) NOT NULL,
    discount_value          NUMERIC(12, 2) NOT NULL,
    applied_amount          NUMERIC(12, 2) NOT NULL CHECK (applied_amount >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sale_payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id             BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method_id   BIGINT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    gift_card_id        BIGINT REFERENCES gift_cards(id) ON DELETE RESTRICT,
    amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reference_number    VARCHAR(100),
    paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coupon_redemptions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coupon_id       BIGINT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    sale_id         BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    discount_amount NUMERIC(12, 2) NOT NULL CHECK (discount_amount >= 0),
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coupon_redemption_sale UNIQUE (coupon_id, sale_id)
);

-- Cambios de talla y devoluciones (crítico en tiendas de ropa)
CREATE TABLE sale_returns (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    return_number           VARCHAR(40) NOT NULL UNIQUE,
    sale_id                 BIGINT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    branch_id               BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id            BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    processed_by_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    return_type             VARCHAR(20) NOT NULL DEFAULT 'refund',
    refund_method           VARCHAR(20) NOT NULL DEFAULT 'store_credit',
    total_refund_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_refund_amount >= 0),
    reason                  TEXT,
    returned_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sale_returns_type CHECK (return_type IN ('refund', 'exchange', 'store_credit')),
    CONSTRAINT chk_sale_returns_refund_method CHECK (refund_method IN ('cash', 'card', 'qr_transfer', 'store_credit'))
);

CREATE TABLE sale_return_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_return_id      BIGINT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id        BIGINT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    variant_id          BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    refund_amount       NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
    item_condition      VARCHAR(20) NOT NULL DEFAULT 'resellable',
    restocked           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_sale_return_condition CHECK (item_condition IN ('resellable', 'damaged', 'defective'))
);


-- ============================================================================
-- MÓDULO 8: FIDELIZACIÓN Y AUDITORÍA DEL SISTEMA
-- ============================================================================

CREATE TABLE loyalty_transactions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id         BIGINT REFERENCES sales(id) ON DELETE SET NULL,
    points_delta    INTEGER NOT NULL CHECK (points_delta <> 0),
    balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
    reason          VARCHAR(150) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    entity_table    VARCHAR(80) NOT NULL,
    entity_id       BIGINT NOT NULL,
    action          VARCHAR(20) NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      VARCHAR(300),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_logs_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'OTHER'))
);


-- ============================================================================
-- MÓDULO 9: APARTADOS / RESERVAS CON SEÑA (LAYAWAYS)
-- Reserva stock real en inventories.quantity_reserved y registra adelantos.
-- ============================================================================

CREATE TABLE layaways (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layaway_number      VARCHAR(40) NOT NULL UNIQUE,
    branch_id           BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id        BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    customer_id         BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    seller_employee_id  BIGINT REFERENCES employees(id) ON DELETE SET NULL,
    sale_id             BIGINT UNIQUE REFERENCES sales(id) ON DELETE SET NULL,
    total_amount        NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    paid_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance_due         NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_layaways_status CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
    CONSTRAINT chk_layaways_paid CHECK (paid_amount <= total_amount)
);

CREATE TABLE layaway_items (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layaway_id      BIGINT NOT NULL REFERENCES layaways(id) ON DELETE CASCADE,
    variant_id      BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT uq_layaway_item UNIQUE (layaway_id, variant_id)
);

CREATE TABLE layaway_payments (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layaway_id                  BIGINT NOT NULL REFERENCES layaways(id) ON DELETE CASCADE,
    payment_method_id           BIGINT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    cash_register_session_id    BIGINT REFERENCES cash_register_sessions(id) ON DELETE SET NULL,
    amount                      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reference_number            VARCHAR(100),
    received_by_user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    paid_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- MÓDULO 10: GASTOS OPERATIVOS Y CAJA CHICA
-- ============================================================================

CREATE TABLE expense_categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE expenses (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_number              VARCHAR(40) NOT NULL UNIQUE,
    branch_id                   BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    expense_category_id         BIGINT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    cash_register_session_id    BIGINT REFERENCES cash_register_sessions(id) ON DELETE SET NULL,
    payment_method_id           BIGINT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount                      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_name                 VARCHAR(150),
    receipt_number              VARCHAR(80),
    description                 TEXT NOT NULL,
    recorded_by_user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- MÓDULO 11: GIFT CARDS, FACTURACIÓN Y COMISIONES DE EMPLEADOS
-- ============================================================================

CREATE TABLE gift_cards (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                VARCHAR(40) NOT NULL UNIQUE,
    customer_id         BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    issued_branch_id    BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    initial_balance     NUMERIC(12, 2) NOT NULL CHECK (initial_balance > 0),
    current_balance     NUMERIC(12, 2) NOT NULL CHECK (current_balance >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at          TIMESTAMPTZ,
    issued_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gift_cards_status CHECK (status IN ('active', 'depleted', 'expired', 'cancelled')),
    CONSTRAINT chk_gift_cards_balance CHECK (current_balance <= initial_balance)
);

CREATE TABLE gift_card_transactions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gift_card_id        BIGINT NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    sale_id             BIGINT REFERENCES sales(id) ON DELETE SET NULL,
    transaction_type    VARCHAR(20) NOT NULL,
    amount_delta        NUMERIC(12, 2) NOT NULL CHECK (amount_delta <> 0),
    balance_after       NUMERIC(12, 2) NOT NULL CHECK (balance_after >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gc_tx_type CHECK (transaction_type IN ('issue', 'redeem', 'refund', 'adjustment'))
);

CREATE TABLE invoices (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id             BIGINT NOT NULL UNIQUE REFERENCES sales(id) ON DELETE RESTRICT,
    branch_id           BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    document_type       VARCHAR(20) NOT NULL DEFAULT 'receipt',
    invoice_series      VARCHAR(20),
    invoice_number      VARCHAR(50) NOT NULL,
    customer_tax_id     VARCHAR(50),
    customer_legal_name VARCHAR(200) NOT NULL,
    subtotal            NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'issued',
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at           TIMESTAMPTZ,
    external_cuf        VARCHAR(150),
    CONSTRAINT uq_invoices_branch_series_num UNIQUE NULLS NOT DISTINCT (branch_id, document_type, invoice_series, invoice_number),
    CONSTRAINT chk_invoices_doc_type CHECK (document_type IN ('receipt', 'invoice', 'credit_note')),
    CONSTRAINT chk_invoices_status CHECK (status IN ('issued', 'voided'))
);

CREATE TABLE employee_commissions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id         BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    sale_id             BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    commission_base     NUMERIC(12, 2) NOT NULL CHECK (commission_base >= 0),
    commission_rate     NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    commission_amount   NUMERIC(12, 2) NOT NULL CHECK (commission_amount >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_commission_sale UNIQUE (employee_id, sale_id),
    CONSTRAINT chk_employee_commissions_status CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))
);


-- ============================================================================
-- MÓDULO 12: NOTIFICACIONES Y CONFIGURACIÓN DEL SISTEMA (SETTINGS)
-- ============================================================================

CREATE TABLE notifications (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    category        VARCHAR(40) NOT NULL,
    severity        VARCHAR(15) NOT NULL DEFAULT 'info',
    title           VARCHAR(150) NOT NULL,
    message         TEXT NOT NULL,
    reference_type  VARCHAR(50),
    reference_id    BIGINT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notifications_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE TABLE system_settings (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    group_name      VARCHAR(60) NOT NULL DEFAULT 'general',
    setting_key     VARCHAR(100) NOT NULL,
    setting_value   TEXT,
    value_type      VARCHAR(20) NOT NULL DEFAULT 'string',
    description     VARCHAR(255),
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_system_settings_scope UNIQUE NULLS NOT DISTINCT (branch_id, setting_key),
    CONSTRAINT chk_system_settings_type CHECK (value_type IN ('string', 'integer', 'decimal', 'boolean', 'json'))
);


-- ============================================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================================

CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);
CREATE INDEX idx_persons_document ON persons(document_number);
CREATE INDEX idx_persons_name ON persons(last_name, first_name);
CREATE INDEX idx_employees_branch ON employees(primary_branch_id);
CREATE INDEX idx_customers_tier ON customers(customer_tier);

CREATE INDEX idx_products_dept_cat ON products(department_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_type ON products(product_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_product ON product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_attr_val_lookup ON variant_attribute_values(attribute_id, attribute_value_id);

CREATE INDEX idx_inventories_variant ON inventories(variant_id);
CREATE INDEX idx_inv_movements_wh_var_date ON inventory_movements(warehouse_id, variant_id, created_at DESC);
CREATE INDEX idx_discounts_active_window ON discounts(is_active, starts_at, ends_at);
CREATE INDEX idx_discount_targets_discount ON discount_targets(discount_id);

CREATE INDEX idx_sales_branch_date ON sales(branch_id, sold_at DESC);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_seller ON sales(seller_employee_id);
CREATE INDEX idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id, created_at DESC);
CREATE INDEX idx_layaways_branch_status ON layaways(branch_id, status, expires_at);
CREATE INDEX idx_expenses_branch_date ON expenses(branch_id, expense_date DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);


-- ============================================================================
-- TRIGGERS PARA UPDATED_AT AUTOMÁTICO
-- ============================================================================

CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_cash_registers_updated_at BEFORE UPDATE ON cash_registers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_persons_updated_at BEFORE UPDATE ON persons FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_job_positions_updated_at BEFORE UPDATE ON job_positions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_employee_shifts_updated_at BEFORE UPDATE ON employee_shifts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_size_guides_updated_at BEFORE UPDATE ON size_guides FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_attributes_updated_at BEFORE UPDATE ON attributes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_branch_variant_prices_updated_at BEFORE UPDATE ON branch_variant_prices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventories_updated_at BEFORE UPDATE ON inventories FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_discounts_updated_at BEFORE UPDATE ON discounts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_layaways_updated_at BEFORE UPDATE ON layaways FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_gift_cards_updated_at BEFORE UPDATE ON gift_cards FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_employee_commissions_updated_at BEFORE UPDATE ON employee_commissions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================================
-- VISTAS ÚTILES DE CONSULTA
-- ============================================================================

-- Vista del catálogo completo: Producto/Conjunto -> Variante -> Atributos concatenados
CREATE OR REPLACE VIEW v_variant_full_catalog AS
SELECT
    pv.id                                       AS variant_id,
    p.id                                        AS product_id,
    p.product_type,
    p.set_stock_mode,
    d.name                                      AS department_name,
    c.name                                      AS category_name,
    b.name                                      AS brand_name,
    p.name                                      AS product_name,
    pv.sku,
    pv.barcode,
    pv.base_price,
    pv.cost_price,
    pv.is_active                                AS variant_active,
    STRING_AGG(a.name || ': ' || av.value, ' | ' ORDER BY a.sort_order, av.sort_order) AS attributes_summary
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
JOIN departments d ON d.id = p.department_id
JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN variant_attribute_values vav ON vav.variant_id = pv.id
LEFT JOIN attributes a ON a.id = vav.attribute_id
LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
WHERE p.deleted_at IS NULL
  AND pv.deleted_at IS NULL
GROUP BY
    pv.id, p.id, p.product_type, p.set_stock_mode,
    d.name, c.name, b.name, p.name,
    pv.sku, pv.barcode, pv.base_price, pv.cost_price, pv.is_active;

-- Vista de stock disponible por sucursal, almacén y variante
CREATE OR REPLACE VIEW v_branch_stock_summary AS
SELECT
    br.id                                       AS branch_id,
    br.name                                     AS branch_name,
    w.id                                        AS warehouse_id,
    w.name                                      AS warehouse_name,
    vfc.product_id,
    vfc.product_type,
    vfc.department_name,
    vfc.product_name,
    vfc.variant_id,
    vfc.sku,
    vfc.attributes_summary,
    i.quantity_on_hand,
    i.quantity_reserved,
    (i.quantity_on_hand - i.quantity_reserved)  AS quantity_available,
    i.min_stock_alert,
    (i.quantity_on_hand - i.quantity_reserved) <= i.min_stock_alert AS is_low_stock
FROM inventories i
JOIN warehouses w ON w.id = i.warehouse_id
JOIN branches br ON br.id = w.branch_id
JOIN v_variant_full_catalog vfc ON vfc.variant_id = i.variant_id
WHERE br.deleted_at IS NULL;

COMMIT;
