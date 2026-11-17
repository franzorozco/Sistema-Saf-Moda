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
 * Class Employee
 * 
 * @property int $id
 * @property int $person_id
 * @property int|null $user_id
 * @property int $job_position_id
 * @property int $primary_branch_id
 * @property string $employee_code
 * @property Carbon $hire_date
 * @property Carbon|null $termination_date
 * @property string $contract_type
 * @property float $base_salary
 * @property float $commission_rate
 * @property string $employment_status
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Person $person
 * @property User|null $user
 * @property JobPosition $job_position
 * @property Branch $branch
 * @property Collection|Branch[] $branches
 * @property Collection|EmployeeShift[] $employee_shifts
 * @property Collection|Discount[] $discounts
 * @property Collection|CashRegisterSession[] $cash_register_sessions
 * @property Collection|Sale[] $sales
 * @property Collection|Layaway[] $layaways
 * @property Collection|EmployeeCommission[] $employee_commissions
 *
 * @package App\Models
 */
class Employee extends Model
{
	use SoftDeletes;
	protected $table = 'employees';

	protected $casts = [
		'person_id' => 'int',
		'user_id' => 'int',
		'job_position_id' => 'int',
		'primary_branch_id' => 'int',
		'hire_date' => 'datetime',
		'termination_date' => 'datetime',
		'base_salary' => 'float',
		'commission_rate' => 'float'
	];

	protected $fillable = [
		'person_id',
		'user_id',
		'job_position_id',
		'primary_branch_id',
		'employee_code',
		'hire_date',
		'termination_date',
		'contract_type',
		'base_salary',
		'commission_rate',
		'employment_status',
		'notes'
	];

	public function person()
	{
		return $this->belongsTo(Person::class);
	}

	public function user()
	{
		return $this->belongsTo(User::class);
	}

	public function job_position()
	{
		return $this->belongsTo(JobPosition::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class, 'primary_branch_id');
	}

	public function branches()
	{
		return $this->belongsToMany(Branch::class, 'employee_branches')
					->withPivot('is_primary', 'assigned_from', 'assigned_until');
	}

	public function employee_shifts()
	{
		return $this->hasMany(EmployeeShift::class);
	}

	public function discounts()
	{
		return $this->belongsToMany(Discount::class, 'discount_employees');
	}

	public function cash_register_sessions()
	{
		return $this->hasMany(CashRegisterSession::class);
	}

	public function sales()
	{
		return $this->hasMany(Sale::class, 'seller_employee_id');
	}

	public function layaways()
	{
		return $this->hasMany(Layaway::class, 'seller_employee_id');
	}

	public function employee_commissions()
	{
		return $this->hasMany(EmployeeCommission::class);
	}
}
