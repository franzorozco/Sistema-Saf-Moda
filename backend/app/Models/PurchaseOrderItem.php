<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class PurchaseOrderItem
 * 
 * @property int $id
 * @property int $purchase_order_id
 * @property int $variant_id
 * @property int $quantity_ordered
 * @property int $quantity_received
 * @property float $unit_cost
 * @property float $line_total
 * 
 * @property PurchaseOrder $purchase_order
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class PurchaseOrderItem extends Model
{
	protected $table = 'purchase_order_items';
	public $timestamps = false;

	protected $casts = [
		'purchase_order_id' => 'int',
		'variant_id' => 'int',
		'quantity_ordered' => 'int',
		'quantity_received' => 'int',
		'unit_cost' => 'float',
		'line_total' => 'float'
	];

	protected $fillable = [
		'purchase_order_id',
		'variant_id',
		'quantity_ordered',
		'quantity_received',
		'unit_cost',
		'line_total'
	];

	public function purchase_order()
	{
		return $this->belongsTo(PurchaseOrder::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
