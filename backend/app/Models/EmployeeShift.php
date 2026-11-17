<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class EmployeeShift
 * 
 * @property int $id
 * @property int $employee_id
 * @property int $branch_id
 * @property Carbon $shift_date
 * @property time without time zone $starts_at
 * @property time without time zone $ends_at
 * @property Carbon|null $actual_check_in
 * @property Carbon|null $actual_check_out
 * @property string $status
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Employee $employee
 * @property Branch $branch
 *
 * @package App\Models
 */
class EmployeeShift extends Model
{
	protected $table = 'employee_shifts';

	protected $casts = [
		'employee_id' => 'int',
		'branch_id' => 'int',
		'shift_date' => 'datetime',
		'starts_at' => 'time without time zone',
		'ends_at' => 'time without time zone',
		'actual_check_in' => 'datetime',
		'actual_check_out' => 'datetime'
	];

	protected $fillable = [
		'employee_id',
		'branch_id',
		'shift_date',
		'starts_at',
		'ends_at',
		'actual_check_in',
		'actual_check_out',
		'status',
		'notes'
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
