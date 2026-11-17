<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Class ProductVariant
 * 
 * @property int $id
 * @property int $product_id
 * @property string $sku
 * @property string|null $barcode
 * @property string|null $variant_label
 * @property float $cost_price
 * @property float $base_price
 * @property float|null $min_sale_price
 * @property int|null $weight_grams
 * @property bool $is_default
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Product $product
 * @property Collection|VariantAttributeValue[] $variant_attribute_values
 * @property Collection|InventoryMovement[] $inventory_movements
 * @property Collection|SetVariantComponent[] $set_variant_components
 * @property Collection|ProductImage[] $product_images
 * @property Collection|BranchVariantPrice[] $branch_variant_prices
 * @property Collection|Inventory[] $inventories
 * @property Collection|StockTransferItem[] $stock_transfer_items
 * @property Collection|InventoryCountItem[] $inventory_count_items
 * @property Collection|PurchaseOrderItem[] $purchase_order_items
 * @property Collection|DiscountTarget[] $discount_targets
 * @property Collection|SaleItem[] $sale_items
 * @property Collection|SaleReturnItem[] $sale_return_items
 * @property Collection|LayawayItem[] $layaway_items
 *
 * @package App\Models
 */
class ProductVariant extends Model
{
	use SoftDeletes;
	protected $table = 'product_variants';

	protected $casts = [
		'product_id' => 'int',
		'cost_price' => 'float',
		'base_price' => 'float',
		'min_sale_price' => 'float',
		'weight_grams' => 'int',
		'is_default' => 'bool',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'product_id',
		'sku',
		'barcode',
		'variant_label',
		'cost_price',
		'base_price',
		'min_sale_price',
		'weight_grams',
		'is_default',
		'is_active'
	];

	public function product()
	{
		return $this->belongsTo(Product::class);
	}

	public function variant_attribute_values()
	{
		return $this->hasMany(VariantAttributeValue::class, 'variant_id');
	}

	public function inventory_movements()
	{
		return $this->hasMany(InventoryMovement::class, 'variant_id');
	}

	public function set_variant_components()
	{
		return $this->hasMany(SetVariantComponent::class, 'component_variant_id');
	}

	public function product_images()
	{
		return $this->hasMany(ProductImage::class, 'variant_id');
	}

	public function branch_variant_prices()
	{
		return $this->hasMany(BranchVariantPrice::class, 'variant_id');
	}

	public function inventories()
	{
		return $this->hasMany(Inventory::class, 'variant_id');
	}

	public function stock_transfer_items()
	{
		return $this->hasMany(StockTransferItem::class, 'variant_id');
	}

	public function inventory_count_items()
	{
		return $this->hasMany(InventoryCountItem::class, 'variant_id');
	}

	public function purchase_order_items()
	{
		return $this->hasMany(PurchaseOrderItem::class, 'variant_id');
	}

	public function discount_targets()
	{
		return $this->hasMany(DiscountTarget::class, 'variant_id');
	}

	public function sale_items()
	{
		return $this->hasMany(SaleItem::class, 'variant_id');
	}

	public function sale_return_items()
	{
		return $this->hasMany(SaleReturnItem::class, 'variant_id');
	}

	public function layaway_items()
	{
		return $this->hasMany(LayawayItem::class, 'variant_id');
	}
}
