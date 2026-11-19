<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Inventory
 * 
 * @property int $id
 * @property int $warehouse_id
 * @property int $variant_id
 * @property int $quantity_on_hand
 * @property int $quantity_reserved
 * @property int $min_stock_alert
 * @property int|null $max_stock_limit
 * @property string|null $bin_location
 * @property Carbon $updated_at
 * 
 * @property Warehouse $warehouse
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class Inventory extends Model
{
	protected $table = 'inventories';
	public $timestamps = false;

	protected $casts = [
		'warehouse_id' => 'int',
		'variant_id' => 'int',
		'quantity_on_hand' => 'int',
		'quantity_reserved' => 'int',
		'min_stock_alert' => 'int',
		'max_stock_limit' => 'int',
		'updated_at' => 'datetime'
	];

	protected $fillable = [
		'warehouse_id',
		'variant_id',
		'quantity_on_hand',
		'quantity_reserved',
		'min_stock_alert',
		'max_stock_limit',
		'bin_location',
		'updated_at'
	];

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
