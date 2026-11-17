<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SaleDiscount
 * 
 * @property int $id
 * @property int $sale_id
 * @property int|null $sale_item_id
 * @property int|null $discount_id
 * @property int|null $coupon_id
 * @property string $discount_name_snapshot
 * @property string $discount_type
 * @property float $discount_value
 * @property float $applied_amount
 * @property Carbon $created_at
 * 
 * @property Sale $sale
 * @property SaleItem|null $sale_item
 * @property Discount|null $discount
 * @property Coupon|null $coupon
 *
 * @package App\Models
 */
class SaleDiscount extends Model
{
	protected $table = 'sale_discounts';
	public $timestamps = false;

	protected $casts = [
		'sale_id' => 'int',
		'sale_item_id' => 'int',
		'discount_id' => 'int',
		'coupon_id' => 'int',
		'discount_value' => 'float',
		'applied_amount' => 'float'
	];

	protected $fillable = [
		'sale_id',
		'sale_item_id',
		'discount_id',
		'coupon_id',
		'discount_name_snapshot',
		'discount_type',
		'discount_value',
		'applied_amount'
	];

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function sale_item()
	{
		return $this->belongsTo(SaleItem::class);
	}

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function coupon()
	{
		return $this->belongsTo(Coupon::class);
	}
}
