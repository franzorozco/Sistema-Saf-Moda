<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SafModaCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $womenDeptId = DB::table('departments')->where('code', 'WOMEN')->value('id');
        $warehouseId = DB::table('warehouses')->where('code', 'ALM-01')->value('id');
        $sizeAttrId = DB::table('attributes')->where('code', 'SIZE')->value('id');
        $colorAttrId = DB::table('attributes')->where('code', 'COLOR')->value('id');

        $sizeValues = DB::table('attribute_values')
            ->where('attribute_id', $sizeAttrId)
            ->pluck('id', 'code');

        $colorValues = DB::table('attribute_values')
            ->where('attribute_id', $colorAttrId)
            ->pluck('id', 'code');

        // 1. Marcas
        DB::table('brands')->insertOrIgnore([
            ['code' => 'M0001', 'name' => 'Saf Atelier', 'slug' => 'saf-atelier', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'M0002', 'name' => 'Lino & Seda', 'slug' => 'lino-y-seda', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'M0003', 'name' => 'Brisa Urbana', 'slug' => 'brisa-urbana', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $brandSafId = DB::table('brands')->where('code', 'M0001')->value('id');
        $brandLinoId = DB::table('brands')->where('code', 'M0002')->value('id');
        $brandBrisaId = DB::table('brands')->where('code', 'M0003')->value('id');

        // 2. Colecciones / Temporadas
        DB::table('seasons')->insertOrIgnore([
            ['code' => 'T0001', 'name' => 'Colección Verano', 'year' => 2026, 'starts_at' => '2026-01-01', 'ends_at' => '2026-05-31', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'T0002', 'name' => 'Otoño Esencial', 'year' => 2026, 'starts_at' => '2026-06-01', 'ends_at' => '2026-10-31', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $seasonVeranoId = DB::table('seasons')->where('code', 'T0001')->value('id');
        $seasonOtonoId = DB::table('seasons')->where('code', 'T0002')->value('id');

        // 3. Categorías
        DB::table('categories')->insertOrIgnore([
            ['code' => 'C0001', 'name' => 'Vestidos', 'slug' => 'vestidos', 'description' => 'Vestidos casuales, midi y de noche', 'sort_order' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'C0002', 'name' => 'Blusas', 'slug' => 'blusas', 'description' => 'Blusas en seda, lino y algodón', 'sort_order' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'C0003', 'name' => 'Pantalones', 'slug' => 'pantalones', 'description' => 'Palazzo, sastre y tiro alto', 'sort_order' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'C0004', 'name' => 'Conjuntos', 'slug' => 'conjuntos', 'description' => 'Sets de dos piezas coordinadas', 'sort_order' => 4, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'C0005', 'name' => 'Abrigos y Blazers', 'slug' => 'abrigos-y-blazers', 'description' => 'Blazers estructurados y sacos', 'sort_order' => 5, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $catVestidosId = DB::table('categories')->where('code', 'C0001')->value('id');
        $catBlusasId = DB::table('categories')->where('code', 'C0002')->value('id');
        $catPantalonesId = DB::table('categories')->where('code', 'C0003')->value('id');
        $catConjuntosId = DB::table('categories')->where('code', 'C0004')->value('id');
        $catBlazersId = DB::table('categories')->where('code', 'C0005')->value('id');

        // 4. Guía de tallas
        $sizeGuideId = DB::table('size_guides')->where('name', 'Guía Mujer Estándar')->value('id');
        if (!$sizeGuideId) {
            $sizeGuideId = DB::table('size_guides')->insertGetId([
                'department_id' => $womenDeptId,
                'category_id' => $catVestidosId,
                'name' => 'Guía Mujer Estándar',
                'unit' => 'cm',
                'notes' => 'Medidas corporales aproximadas en centímetros.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('size_guide_items')->insertOrIgnore([
            ['size_guide_id' => $sizeGuideId, 'size_label' => 'S', 'measurements' => json_encode(['busto' => '86-90', 'cintura' => '66-70', 'cadera' => '92-96']), 'sort_order' => 1],
            ['size_guide_id' => $sizeGuideId, 'size_label' => 'M', 'measurements' => json_encode(['busto' => '91-95', 'cintura' => '71-75', 'cadera' => '97-101']), 'sort_order' => 2],
            ['size_guide_id' => $sizeGuideId, 'size_label' => 'L', 'measurements' => json_encode(['busto' => '96-102', 'cintura' => '76-82', 'cadera' => '102-108']), 'sort_order' => 3],
        ]);

        // 5. Productos con variantes, atributos y stock inicial
        $catalog = [
            [
                'sku_prefix' => 'P0001',
                'name' => 'Vestido Midi Lino',
                'category_id' => $catVestidosId,
                'brand_id' => $brandSafId,
                'season_id' => $seasonVeranoId,
                'product_type' => 'single',
                'set_stock_mode' => 'none',
                'short_description' => 'Vestido midi fresco de lino natural con cintura marcada.',
                'variants' => [
                    ['size' => 'S', 'color' => 'BEIGE', 'cost' => 140, 'price' => 280, 'stock' => 8],
                    ['size' => 'M', 'color' => 'BEIGE', 'cost' => 140, 'price' => 280, 'stock' => 12],
                    ['size' => 'L', 'color' => 'BEIGE', 'cost' => 145, 'price' => 295, 'stock' => 6],
                    ['size' => 'M', 'color' => 'BLACK', 'cost' => 140, 'price' => 285, 'stock' => 10],
                ],
            ],
            [
                'sku_prefix' => 'P0002',
                'name' => 'Vestido Satinado Noche',
                'category_id' => $catVestidosId,
                'brand_id' => $brandLinoId,
                'season_id' => $seasonOtonoId,
                'product_type' => 'single',
                'set_stock_mode' => 'none',
                'short_description' => 'Corte al bies en satén fluido ideal para eventos.',
                'variants' => [
                    ['size' => 'S', 'color' => 'BLACK', 'cost' => 180, 'price' => 360, 'stock' => 5],
                    ['size' => 'M', 'color' => 'BLACK', 'cost' => 180, 'price' => 360, 'stock' => 7],
                    ['size' => 'S', 'color' => 'RED', 'cost' => 185, 'price' => 375, 'stock' => 4],
                    ['size' => 'M', 'color' => 'RED', 'cost' => 185, 'price' => 375, 'stock' => 6],
                ],
            ],
            [
                'sku_prefix' => 'P0003',
                'name' => 'Blusa Seda Cuello V',
                'category_id' => $catBlusasId,
                'brand_id' => $brandLinoId,
                'season_id' => $seasonVeranoId,
                'product_type' => 'single',
                'set_stock_mode' => 'none',
                'short_description' => 'Blusa ligera con caída suave y puños abotonados.',
                'variants' => [
                    ['size' => 'XS', 'color' => 'WHITE', 'cost' => 85, 'price' => 175, 'stock' => 9],
                    ['size' => 'S', 'color' => 'WHITE', 'cost' => 85, 'price' => 175, 'stock' => 14],
                    ['size' => 'M', 'color' => 'BEIGE', 'cost' => 90, 'price' => 185, 'stock' => 11],
                ],
            ],
            [
                'sku_prefix' => 'P0004',
                'name' => 'Pantalón Palazzo Tiro Alto',
                'category_id' => $catPantalonesId,
                'brand_id' => $brandBrisaId,
                'season_id' => $seasonVeranoId,
                'product_type' => 'single',
                'set_stock_mode' => 'none',
                'short_description' => 'Pierna ancha con pinzas delanteras y caída elegante.',
                'variants' => [
                    ['size' => 'S', 'color' => 'BLACK', 'cost' => 120, 'price' => 245, 'stock' => 10],
                    ['size' => 'M', 'color' => 'BLACK', 'cost' => 120, 'price' => 245, 'stock' => 12],
                    ['size' => 'L', 'color' => 'BEIGE', 'cost' => 125, 'price' => 255, 'stock' => 8],
                ],
            ],
            [
                'sku_prefix' => 'P0005',
                'name' => 'Blazer Sastre Estructurado',
                'category_id' => $catBlazersId,
                'brand_id' => $brandSafId,
                'season_id' => $seasonOtonoId,
                'product_type' => 'single',
                'set_stock_mode' => 'none',
                'short_description' => 'Blazer forrado de solapa clásica y botones carey.',
                'variants' => [
                    ['size' => 'S', 'color' => 'BEIGE', 'cost' => 210, 'price' => 420, 'stock' => 6],
                    ['size' => 'M', 'color' => 'BEIGE', 'cost' => 210, 'price' => 420, 'stock' => 8],
                    ['size' => 'M', 'color' => 'BLACK', 'cost' => 215, 'price' => 430, 'stock' => 5],
                ],
            ],
            [
                'sku_prefix' => 'P0006',
                'name' => 'Conjunto Lino Dos Piezas',
                'category_id' => $catConjuntosId,
                'brand_id' => $brandSafId,
                'season_id' => $seasonVeranoId,
                'product_type' => 'set',
                'set_stock_mode' => 'independent',
                'short_description' => 'Set de chaleco sastre y pantalón fluido en lino.',
                'variants' => [
                    ['size' => 'S', 'color' => 'BEIGE', 'cost' => 230, 'price' => 460, 'stock' => 5],
                    ['size' => 'M', 'color' => 'BEIGE', 'cost' => 230, 'price' => 460, 'stock' => 7],
                    ['size' => 'L', 'color' => 'BEIGE', 'cost' => 240, 'price' => 480, 'stock' => 4],
                ],
            ],
        ];

        foreach ($catalog as $item) {
            DB::table('products')->insertOrIgnore([
                'department_id' => $womenDeptId,
                'category_id' => $item['category_id'],
                'brand_id' => $item['brand_id'],
                'season_id' => $item['season_id'],
                'size_guide_id' => $sizeGuideId,
                'product_type' => $item['product_type'],
                'set_stock_mode' => $item['set_stock_mode'],
                'sku_prefix' => $item['sku_prefix'],
                'name' => $item['name'],
                'slug' => Str::slug($item['name']),
                'short_description' => $item['short_description'],
                'is_taxable' => true,
                'tax_rate' => 0,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $productId = DB::table('products')->where('sku_prefix', $item['sku_prefix'])->value('id');

            DB::table('product_attributes')->insertOrIgnore([
                ['product_id' => $productId, 'attribute_id' => $sizeAttrId, 'is_required' => true, 'sort_order' => 1],
                ['product_id' => $productId, 'attribute_id' => $colorAttrId, 'is_required' => true, 'sort_order' => 2],
            ]);

            foreach ($item['variants'] as $idx => $v) {
                $sku = $item['sku_prefix'] . '-' . str_pad((string) ($idx + 1), 2, '0', STR_PAD_LEFT);

                DB::table('product_variants')->insertOrIgnore([
                    'product_id' => $productId,
                    'sku' => $sku,
                    'variant_label' => $v['size'] . ' / ' . ucfirst(strtolower($v['color'])),
                    'cost_price' => $v['cost'],
                    'base_price' => $v['price'],
                    'is_default' => $idx === 0,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $variantId = DB::table('product_variants')->where('sku', $sku)->value('id');

                DB::table('variant_attribute_values')->insertOrIgnore([
                    [
                        'variant_id' => $variantId,
                        'attribute_id' => $sizeAttrId,
                        'attribute_value_id' => $sizeValues[$v['size']],
                    ],
                    [
                        'variant_id' => $variantId,
                        'attribute_id' => $colorAttrId,
                        'attribute_value_id' => $colorValues[$v['color']],
                    ],
                ]);

                if ($warehouseId) {
                    DB::table('inventories')->insertOrIgnore([
                        'warehouse_id' => $warehouseId,
                        'variant_id' => $variantId,
                        'quantity_on_hand' => $v['stock'],
                        'quantity_reserved' => 0,
                        'min_stock_alert' => 3,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }
}
