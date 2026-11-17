<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class SaleReturnItem
 * 
 * @property int $id
 * @property int $sale_return_id
 * @property int $sale_item_id
 * @property int $variant_id
 * @property int $quantity
 * @property float $refund_amount
 * @property string $item_condition
 * @property bool $restocked
 * 
 * @property SaleReturn $sale_return
 * @property SaleItem $sale_item
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class SaleReturnItem extends Model
{
	protected $table = 'sale_return_items';
	public $timestamps = false;

	protected $casts = [
		'sale_return_id' => 'int',
		'sale_item_id' => 'int',
		'variant_id' => 'int',
		'quantity' => 'int',
		'refund_amount' => 'float',
		'restocked' => 'bool'
	];

	protected $fillable = [
		'sale_return_id',
		'sale_item_id',
		'variant_id',
		'quantity',
		'refund_amount',
		'item_condition',
		'restocked'
	];

	public function sale_return()
	{
		return $this->belongsTo(SaleReturn::class);
	}

	public function sale_item()
	{
		return $this->belongsTo(SaleItem::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
