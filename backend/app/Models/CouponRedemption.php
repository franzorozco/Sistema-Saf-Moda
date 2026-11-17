<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class CouponRedemption
 * 
 * @property int $id
 * @property int $coupon_id
 * @property int|null $customer_id
 * @property int $sale_id
 * @property float $discount_amount
 * @property Carbon $redeemed_at
 * 
 * @property Coupon $coupon
 * @property Customer|null $customer
 * @property Sale $sale
 *
 * @package App\Models
 */
class CouponRedemption extends Model
{
	protected $table = 'coupon_redemptions';
	public $timestamps = false;

	protected $casts = [
		'coupon_id' => 'int',
		'customer_id' => 'int',
		'sale_id' => 'int',
		'discount_amount' => 'float',
		'redeemed_at' => 'datetime'
	];

	protected $fillable = [
		'coupon_id',
		'customer_id',
		'sale_id',
		'discount_amount',
		'redeemed_at'
	];

	public function coupon()
	{
		return $this->belongsTo(Coupon::class);
	}

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}
}
