<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class LayawayItem
 * 
 * @property int $id
 * @property int $layaway_id
 * @property int $variant_id
 * @property int $quantity
 * @property float $unit_price
 * @property float $line_total
 * 
 * @property Layaway $layaway
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class LayawayItem extends Model
{
	protected $table = 'layaway_items';
	public $timestamps = false;

	protected $casts = [
		'layaway_id' => 'int',
		'variant_id' => 'int',
		'quantity' => 'int',
		'unit_price' => 'float',
		'line_total' => 'float'
	];

	protected $fillable = [
		'layaway_id',
		'variant_id',
		'quantity',
		'unit_price',
		'line_total'
	];

	public function layaway()
	{
		return $this->belongsTo(Layaway::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
