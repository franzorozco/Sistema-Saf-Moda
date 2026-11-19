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
 * Class User
 * 
 * @property int $id
 * @property int $person_id
 * @property string|null $username
 * @property string $email
 * @property string $password_hash
 * @property string $status
 * @property Carbon|null $email_verified_at
 * @property string|null $remember_token
 * @property Carbon|null $last_login_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Person $person
 * @property UserProfile|null $user_profile
 * @property Collection|Role[] $roles
 * @property Collection|Employee[] $employees
 * @property Collection|Customer[] $customers
 * @property Collection|InventoryMovement[] $inventory_movements
 * @property Collection|StockTransfer[] $stock_transfers
 * @property Collection|InventoryCount[] $inventory_counts
 * @property Collection|PurchaseOrder[] $purchase_orders
 * @property Collection|Discount[] $discounts
 * @property Collection|SaleReturn[] $sale_returns
 * @property Collection|AuditLog[] $audit_logs
 * @property Collection|LayawayPayment[] $layaway_payments
 * @property Collection|Expense[] $expenses
 * @property Collection|GiftCard[] $gift_cards
 * @property Collection|Notification[] $notifications
 *
 * @package App\Models
 */
class User extends Model
{
	use SoftDeletes;
	protected $table = 'users';

	protected $casts = [
		'person_id' => 'int',
		'email_verified_at' => 'datetime',
		'last_login_at' => 'datetime'
	];

	protected $hidden = [
		'password_hash',
		'remember_token'
	];

	protected $fillable = [
		'person_id',
		'username',
		'email',
		'password_hash',
		'status',
		'email_verified_at',
		'remember_token',
		'last_login_at'
	];

	public function person()
	{
		return $this->belongsTo(Person::class);
	}

	public function user_profile()
	{
		return $this->hasOne(UserProfile::class);
	}

	public function roles()
	{
		return $this->belongsToMany(Role::class, 'user_roles')
					->withPivot('id', 'branch_id', 'assigned_at');
	}

	public function user_roles()
	{
		return $this->hasMany(UserRole::class);
	}

	public function employee()
	{
		return $this->hasOne(Employee::class);
	}

	public function customer()
	{
		return $this->hasOne(Customer::class);
	}

	public function employees()
	{
		return $this->hasMany(Employee::class);
	}

	public function customers()
	{
		return $this->hasMany(Customer::class);
	}

	public function inventory_movements()
	{
		return $this->hasMany(InventoryMovement::class, 'performed_by_user_id');
	}

	public function stock_transfers()
	{
		return $this->hasMany(StockTransfer::class, 'received_by_user_id');
	}

	public function inventory_counts()
	{
		return $this->hasMany(InventoryCount::class, 'approved_by_user_id');
	}

	public function purchase_orders()
	{
		return $this->hasMany(PurchaseOrder::class, 'created_by_user_id');
	}

	public function discounts()
	{
		return $this->hasMany(Discount::class, 'created_by_user_id');
	}

	public function sale_returns()
	{
		return $this->hasMany(SaleReturn::class, 'processed_by_user_id');
	}

	public function audit_logs()
	{
		return $this->hasMany(AuditLog::class);
	}

	public function layaway_payments()
	{
		return $this->hasMany(LayawayPayment::class, 'received_by_user_id');
	}

	public function expenses()
	{
		return $this->hasMany(Expense::class, 'recorded_by_user_id');
	}

	public function gift_cards()
	{
		return $this->hasMany(GiftCard::class, 'issued_by_user_id');
	}

	public function notifications()
	{
		return $this->hasMany(Notification::class);
	}
}
