<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Coupon
 * 
 * @property int $id
 * @property int $discount_id
 * @property string $code
 * @property int|null $usage_limit
 * @property int $usage_limit_per_customer
 * @property int $times_used
 * @property int|null $customer_id
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Discount $discount
 * @property Customer|null $customer
 * @property Collection|SaleDiscount[] $sale_discounts
 * @property Collection|CouponRedemption[] $coupon_redemptions
 *
 * @package App\Models
 */
class Coupon extends Model
{
	protected $table = 'coupons';

	protected $casts = [
		'discount_id' => 'int',
		'usage_limit' => 'int',
		'usage_limit_per_customer' => 'int',
		'times_used' => 'int',
		'customer_id' => 'int',
		'starts_at' => 'datetime',
		'ends_at' => 'datetime',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'discount_id',
		'code',
		'usage_limit',
		'usage_limit_per_customer',
		'times_used',
		'customer_id',
		'starts_at',
		'ends_at',
		'is_active'
	];

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function sale_discounts()
	{
		return $this->hasMany(SaleDiscount::class);
	}

	public function coupon_redemptions()
	{
		return $this->hasMany(CouponRedemption::class);
	}
}
