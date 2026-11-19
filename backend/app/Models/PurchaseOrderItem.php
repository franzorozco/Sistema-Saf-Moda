<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use App\Support\StoragePath;
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
		'product_id' => 'int',
		'is_catalog_linked' => 'bool',
		'stock_entered' => 'bool',
		'quantity_ordered' => 'int',
		'quantity_received' => 'int',
		'unit_cost' => 'float',
		'line_total' => 'float'
	];

	protected $fillable = [
		'purchase_order_id',
		'variant_id',
		'product_id',
		'item_name',
		'item_sku',
		'item_specs',
		'is_catalog_linked',
		'stock_entered',
		'quantity_ordered',
		'quantity_received',
		'unit_cost',
		'line_total',
		'photo_url',
		'notes'
	];

	public function getPhotoUrlAttribute($value): ?string
	{
		return StoragePath::publicUrl(StoragePath::PURCHASE_ITEMS, $value);
	}

	public function getRawPhotoFilename(): ?string
	{
		return $this->attributes['photo_url'] ?? null;
	}

	public function purchase_order()
	{
		return $this->belongsTo(PurchaseOrder::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}

	public function product()
	{
		return $this->belongsTo(Product::class);
	}

	public function attachments()
	{
		return $this->hasMany(PurchaseAttachment::class);
	}
}
