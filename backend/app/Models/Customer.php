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
 * Class Customer
 * 
 * @property int $id
 * @property int $person_id
 * @property int|null $user_id
 * @property string $customer_code
 * @property string $customer_tier
 * @property int $loyalty_points
 * @property float $store_credit
 * @property bool $accepts_marketing
 * @property int|null $acquired_branch_id
 * @property string|null $notes
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Person $person
 * @property User|null $user
 * @property Branch|null $branch
 * @property Collection|CustomerAddress[] $customer_addresses
 * @property Collection|Coupon[] $coupons
 * @property Collection|Discount[] $discounts
 * @property Collection|Sale[] $sales
 * @property Collection|CouponRedemption[] $coupon_redemptions
 * @property Collection|LoyaltyTransaction[] $loyalty_transactions
 * @property Collection|Layaway[] $layaways
 * @property Collection|GiftCard[] $gift_cards
 *
 * @package App\Models
 */
class Customer extends Model
{
	use SoftDeletes;
	protected $table = 'customers';

	protected $casts = [
		'person_id' => 'int',
		'user_id' => 'int',
		'loyalty_points' => 'int',
		'store_credit' => 'float',
		'accepts_marketing' => 'bool',
		'acquired_branch_id' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'person_id',
		'user_id',
		'customer_code',
		'customer_tier',
		'loyalty_points',
		'store_credit',
		'accepts_marketing',
		'acquired_branch_id',
		'notes',
		'is_active'
	];

	public function person()
	{
		return $this->belongsTo(Person::class);
	}

	public function user()
	{
		return $this->belongsTo(User::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class, 'acquired_branch_id');
	}

	public function customer_addresses()
	{
		return $this->hasMany(CustomerAddress::class);
	}

	public function coupons()
	{
		return $this->hasMany(Coupon::class);
	}

	public function discounts()
	{
		return $this->belongsToMany(Discount::class, 'discount_customers')
					->withPivot('id', 'customer_tier');
	}

	public function sales()
	{
		return $this->hasMany(Sale::class);
	}

	public function coupon_redemptions()
	{
		return $this->hasMany(CouponRedemption::class);
	}

	public function loyalty_transactions()
	{
		return $this->hasMany(LoyaltyTransaction::class);
	}

	public function layaways()
	{
		return $this->hasMany(Layaway::class);
	}

	public function gift_cards()
	{
		return $this->hasMany(GiftCard::class);
	}
}
