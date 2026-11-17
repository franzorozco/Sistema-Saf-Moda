<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SaleItem
 * 
 * @property int $id
 * @property int $sale_id
 * @property int $variant_id
 * @property int $quantity
 * @property float $unit_price
 * @property float $unit_cost_snapshot
 * @property float $discount_amount
 * @property float $tax_amount
 * @property float $line_total
 * 
 * @property Sale $sale
 * @property ProductVariant $product_variant
 * @property Collection|SaleDiscount[] $sale_discounts
 * @property Collection|SaleReturnItem[] $sale_return_items
 *
 * @package App\Models
 */
class SaleItem extends Model
{
	protected $table = 'sale_items';
	public $timestamps = false;

	protected $casts = [
		'sale_id' => 'int',
		'variant_id' => 'int',
		'quantity' => 'int',
		'unit_price' => 'float',
		'unit_cost_snapshot' => 'float',
		'discount_amount' => 'float',
		'tax_amount' => 'float',
		'line_total' => 'float'
	];

	protected $fillable = [
		'sale_id',
		'variant_id',
		'quantity',
		'unit_price',
		'unit_cost_snapshot',
		'discount_amount',
		'tax_amount',
		'line_total'
	];

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}

	public function sale_discounts()
	{
		return $this->hasMany(SaleDiscount::class);
	}

	public function sale_return_items()
	{
		return $this->hasMany(SaleReturnItem::class);
	}
}
