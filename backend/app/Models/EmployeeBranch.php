<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class EmployeeBranch
 * 
 * @property int $employee_id
 * @property int $branch_id
 * @property bool $is_primary
 * @property Carbon $assigned_from
 * @property Carbon|null $assigned_until
 * 
 * @property Employee $employee
 * @property Branch $branch
 *
 * @package App\Models
 */
class EmployeeBranch extends Model
{
	protected $table = 'employee_branches';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'employee_id' => 'int',
		'branch_id' => 'int',
		'is_primary' => 'bool',
		'assigned_from' => 'datetime',
		'assigned_until' => 'datetime'
	];

	protected $fillable = [
		'employee_id',
		'branch_id',
		'is_primary',
		'assigned_from',
		'assigned_until'
	];

	public function employee()
	{
		return $this->belongsTo(Employee::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
