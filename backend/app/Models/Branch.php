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
 * Class Branch
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $branch_type
 * @property string $country
 * @property string|null $state_province
 * @property string $city
 * @property string $address_line
 * @property string|null $phone
 * @property string|null $email
 * @property bool $is_main
 * @property bool $is_active
 * @property Carbon|null $opened_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Collection|Warehouse[] $warehouses
 * @property Collection|CashRegister[] $cash_registers
 * @property Collection|UserRole[] $user_roles
 * @property Collection|Employee[] $employees
 * @property Collection|EmployeeShift[] $employee_shifts
 * @property Collection|Customer[] $customers
 * @property Collection|BranchVariantPrice[] $branch_variant_prices
 * @property Collection|Discount[] $discounts
 * @property Collection|Sale[] $sales
 * @property Collection|SaleReturn[] $sale_returns
 * @property Collection|AuditLog[] $audit_logs
 * @property Collection|Layaway[] $layaways
 * @property Collection|Expense[] $expenses
 * @property Collection|GiftCard[] $gift_cards
 * @property Collection|Invoice[] $invoices
 * @property Collection|Notification[] $notifications
 * @property Collection|SystemSetting[] $system_settings
 *
 * @package App\Models
 */
class Branch extends Model
{
	use SoftDeletes;
	protected $table = 'branches';

	protected $casts = [
		'is_main' => 'bool',
		'is_active' => 'bool',
		'opened_at' => 'datetime'
	];

	protected $fillable = [
		'code',
		'name',
		'branch_type',
		'country',
		'state_province',
		'city',
		'address_line',
		'phone',
		'email',
		'is_main',
		'is_active',
		'opened_at'
	];

	public function warehouses()
	{
		return $this->hasMany(Warehouse::class);
	}

	public function cash_registers()
	{
		return $this->hasMany(CashRegister::class);
	}

	public function user_roles()
	{
		return $this->hasMany(UserRole::class);
	}

	public function employees()
	{
		return $this->belongsToMany(Employee::class, 'employee_branches')
					->withPivot('is_primary', 'assigned_from', 'assigned_until');
	}

	public function employee_shifts()
	{
		return $this->hasMany(EmployeeShift::class);
	}

	public function customers()
	{
		return $this->hasMany(Customer::class, 'acquired_branch_id');
	}

	public function branch_variant_prices()
	{
		return $this->hasMany(BranchVariantPrice::class);
	}

	public function discounts()
	{
		return $this->belongsToMany(Discount::class, 'discount_branches');
	}

	public function sales()
	{
		return $this->hasMany(Sale::class);
	}

	public function sale_returns()
	{
		return $this->hasMany(SaleReturn::class);
	}

	public function audit_logs()
	{
		return $this->hasMany(AuditLog::class);
	}

	public function layaways()
	{
		return $this->hasMany(Layaway::class);
	}

	public function expenses()
	{
		return $this->hasMany(Expense::class);
	}

	public function gift_cards()
	{
		return $this->hasMany(GiftCard::class, 'issued_branch_id');
	}

	public function invoices()
	{
		return $this->hasMany(Invoice::class);
	}

	public function notifications()
	{
		return $this->hasMany(Notification::class);
	}

	public function system_settings()
	{
		return $this->hasMany(SystemSetting::class);
	}
}
