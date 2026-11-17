<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class StockTransferItem
 * 
 * @property int $id
 * @property int $stock_transfer_id
 * @property int $variant_id
 * @property int $quantity_requested
 * @property int $quantity_shipped
 * @property int $quantity_received
 * 
 * @property StockTransfer $stock_transfer
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class StockTransferItem extends Model
{
	protected $table = 'stock_transfer_items';
	public $timestamps = false;

	protected $casts = [
		'stock_transfer_id' => 'int',
		'variant_id' => 'int',
		'quantity_requested' => 'int',
		'quantity_shipped' => 'int',
		'quantity_received' => 'int'
	];

	protected $fillable = [
		'stock_transfer_id',
		'variant_id',
		'quantity_requested',
		'quantity_shipped',
		'quantity_received'
	];

	public function stock_transfer()
	{
		return $this->belongsTo(StockTransfer::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
