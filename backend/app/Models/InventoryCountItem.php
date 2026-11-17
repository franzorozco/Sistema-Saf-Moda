<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class InventoryCountItem
 * 
 * @property int $id
 * @property int $inventory_count_id
 * @property int $variant_id
 * @property int $expected_quantity
 * @property int $counted_quantity
 * @property string|null $notes
 * 
 * @property InventoryCount $inventory_count
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class InventoryCountItem extends Model
{
	protected $table = 'inventory_count_items';
	public $timestamps = false;

	protected $casts = [
		'inventory_count_id' => 'int',
		'variant_id' => 'int',
		'expected_quantity' => 'int',
		'counted_quantity' => 'int'
	];

	protected $fillable = [
		'inventory_count_id',
		'variant_id',
		'expected_quantity',
		'counted_quantity',
		'notes'
	];

	public function inventory_count()
	{
		return $this->belongsTo(InventoryCount::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
