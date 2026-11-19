<?php

namespace App\Models;

use App\Support\StoragePath;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $supplier_id
 * @property int|null $purchase_order_id
 * @property int|null $purchase_order_item_id
 * @property int|null $variant_id
 * @property int|null $product_id
 * @property string $item_key
 * @property string $item_name
 * @property string|null $item_sku
 * @property float $unit_cost
 * @property float|null $previous_unit_cost
 * @property float|null $price_diff
 * @property float|null $price_diff_pct
 * @property int $quantity
 * @property Carbon $recorded_at
 * @property string|null $photo_url
 * @property string|null $notes
 * @property int|null $recorded_by_user_id
 * @property Carbon $created_at
 */
class PurchasePriceHistory extends Model
{
    protected $table = 'purchase_price_histories';
    public $timestamps = false;

    protected $casts = [
        'supplier_id' => 'int',
        'purchase_order_id' => 'int',
        'purchase_order_item_id' => 'int',
        'variant_id' => 'int',
        'product_id' => 'int',
        'unit_cost' => 'float',
        'previous_unit_cost' => 'float',
        'price_diff' => 'float',
        'price_diff_pct' => 'float',
        'quantity' => 'int',
        'recorded_at' => 'date:Y-m-d',
        'recorded_by_user_id' => 'int',
        'created_at' => 'datetime',
    ];

    protected $fillable = [
        'supplier_id',
        'purchase_order_id',
        'purchase_order_item_id',
        'variant_id',
        'product_id',
        'item_key',
        'item_name',
        'item_sku',
        'unit_cost',
        'previous_unit_cost',
        'price_diff',
        'price_diff_pct',
        'quantity',
        'recorded_at',
        'photo_url',
        'notes',
        'recorded_by_user_id',
    ];

    public function getPhotoUrlAttribute($value): ?string
    {
        return StoragePath::publicUrl(StoragePath::PURCHASE_ITEMS, $value);
    }

    public function getRawPhotoFilename(): ?string
    {
        return $this->attributes['photo_url'] ?? null;
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchase_order()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function purchase_order_item()
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function product_variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function recorded_by()
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }
}
