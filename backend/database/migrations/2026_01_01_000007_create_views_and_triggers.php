<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP VIEW IF EXISTS v_branch_stock_summary;');
        DB::unprepared('DROP VIEW IF EXISTS v_variant_full_catalog;');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_set_updated_at();');
    }
};
