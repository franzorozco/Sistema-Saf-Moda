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
 * Class Discount
 * 
 * @property int $id
 * @property string|null $code
 * @property string $name
 * @property string|null $description
 * @property string $discount_type
 * @property float $discount_value
 * @property float|null $max_discount_amount
 * @property int|null $buy_quantity
 * @property int|null $get_quantity
 * @property string $applies_to
 * @property float $min_purchase_amount
 * @property float|null $max_purchase_amount
 * @property int $min_items_quantity
 * @property int|null $max_uses
 * @property int|null $max_uses_per_customer
 * @property int $times_used
 * @property bool $requires_coupon
 * @property bool $is_stackable
 * @property int $priority
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 * @property int|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property User|null $user
 * @property Collection|Coupon[] $coupons
 * @property Collection|Branch[] $branches
 * @property Collection|Customer[] $customers
 * @property Collection|Employee[] $employees
 * @property Collection|DiscountTarget[] $discount_targets
 * @property Collection|Sale[] $sales
 *
 * @package App\Models
 */
class Discount extends Model
{
	use SoftDeletes;
	protected $table = 'discounts';

	protected $casts = [
		'discount_value' => 'float',
		'max_discount_amount' => 'float',
		'buy_quantity' => 'int',
		'get_quantity' => 'int',
		'min_purchase_amount' => 'float',
		'max_purchase_amount' => 'float',
		'min_items_quantity' => 'int',
		'max_uses' => 'int',
		'max_uses_per_customer' => 'int',
		'times_used' => 'int',
		'requires_coupon' => 'bool',
		'is_stackable' => 'bool',
		'priority' => 'int',
		'starts_at' => 'datetime',
		'ends_at' => 'datetime',
		'is_active' => 'bool',
		'created_by_user_id' => 'int'
	];

	protected $fillable = [
		'code',
		'name',
		'description',
		'discount_type',
		'discount_value',
		'max_discount_amount',
		'buy_quantity',
		'get_quantity',
		'applies_to',
		'min_purchase_amount',
		'max_purchase_amount',
		'min_items_quantity',
		'max_uses',
		'max_uses_per_customer',
		'times_used',
		'requires_coupon',
		'is_stackable',
		'priority',
		'starts_at',
		'ends_at',
		'is_active',
		'created_by_user_id'
	];

	public function user()
	{
		return $this->belongsTo(User::class, 'created_by_user_id');
	}

	public function coupons()
	{
		return $this->hasMany(Coupon::class);
	}

	public function branches()
	{
		return $this->belongsToMany(Branch::class, 'discount_branches');
	}

	public function customers()
	{
		return $this->belongsToMany(Customer::class, 'discount_customers')
					->withPivot('id', 'customer_tier');
	}

	public function employees()
	{
		return $this->belongsToMany(Employee::class, 'discount_employees');
	}

	public function discount_targets()
	{
		return $this->hasMany(DiscountTarget::class);
	}

	public function sales()
	{
		return $this->belongsToMany(Sale::class, 'sale_discounts')
					->withPivot('id', 'sale_item_id', 'coupon_id', 'discount_name_snapshot', 'discount_type', 'discount_value', 'applied_amount');
	}
}
