<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Sale
 * 
 * @property int $id
 * @property string $sale_number
 * @property int $branch_id
 * @property int $warehouse_id
 * @property int|null $cash_register_session_id
 * @property int|null $customer_id
 * @property string $customer_name_snapshot
 * @property string|null $customer_tax_id_snapshot
 * @property int|null $seller_employee_id
 * @property string $sale_channel
 * @property string $status
 * @property float $subtotal
 * @property float $discount_total
 * @property float $tax_total
 * @property float $total_amount
 * @property string $currency_code
 * @property string|null $notes
 * @property Carbon $sold_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Branch $branch
 * @property Warehouse $warehouse
 * @property CashRegisterSession|null $cash_register_session
 * @property Customer|null $customer
 * @property Employee|null $employee
 * @property Collection|SalePayment[] $sale_payments
 * @property Collection|SaleItem[] $sale_items
 * @property Collection|Discount[] $discounts
 * @property Collection|CouponRedemption[] $coupon_redemptions
 * @property Collection|SaleReturn[] $sale_returns
 * @property Collection|LoyaltyTransaction[] $loyalty_transactions
 * @property Collection|Layaway[] $layaways
 * @property Collection|GiftCardTransaction[] $gift_card_transactions
 * @property Collection|Invoice[] $invoices
 * @property Collection|EmployeeCommission[] $employee_commissions
 *
 * @package App\Models
 */
class Sale extends Model
{
	protected $table = 'sales';

	protected $casts = [
		'branch_id' => 'int',
		'warehouse_id' => 'int',
		'cash_register_session_id' => 'int',
		'customer_id' => 'int',
		'seller_employee_id' => 'int',
		'subtotal' => 'float',
		'discount_total' => 'float',
		'tax_total' => 'float',
		'total_amount' => 'float',
		'sold_at' => 'datetime'
	];

	protected $fillable = [
		'sale_number',
		'branch_id',
		'warehouse_id',
		'cash_register_session_id',
		'customer_id',
		'customer_name_snapshot',
		'customer_tax_id_snapshot',
		'seller_employee_id',
		'sale_channel',
		'status',
		'subtotal',
		'discount_total',
		'tax_total',
		'total_amount',
		'currency_code',
		'notes',
		'sold_at'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function cash_register_session()
	{
		return $this->belongsTo(CashRegisterSession::class);
	}

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function employee()
	{
		return $this->belongsTo(Employee::class, 'seller_employee_id');
	}

	public function sale_payments()
	{
		return $this->hasMany(SalePayment::class);
	}

	public function sale_items()
	{
		return $this->hasMany(SaleItem::class);
	}

	public function discounts()
	{
		return $this->belongsToMany(Discount::class, 'sale_discounts')
					->withPivot('id', 'sale_item_id', 'coupon_id', 'discount_name_snapshot', 'discount_type', 'discount_value', 'applied_amount');
	}

	public function coupon_redemptions()
	{
		return $this->hasMany(CouponRedemption::class);
	}

	public function sale_returns()
	{
		return $this->hasMany(SaleReturn::class);
	}

	public function loyalty_transactions()
	{
		return $this->hasMany(LoyaltyTransaction::class);
	}

	public function layaways()
	{
		return $this->hasMany(Layaway::class);
	}

	public function gift_card_transactions()
	{
		return $this->hasMany(GiftCardTransaction::class);
	}

	public function invoices()
	{
		return $this->hasMany(Invoice::class);
	}

	public function employee_commissions()
	{
		return $this->hasMany(EmployeeCommission::class);
	}
}
