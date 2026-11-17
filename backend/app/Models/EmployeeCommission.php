<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class EmployeeCommission
 * 
 * @property int $id
 * @property int $employee_id
 * @property int $sale_id
 * @property float $commission_base
 * @property float $commission_rate
 * @property float $commission_amount
 * @property string $status
 * @property Carbon|null $paid_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Employee $employee
 * @property Sale $sale
 *
 * @package App\Models
 */
class EmployeeCommission extends Model
{
	protected $table = 'employee_commissions';

	protected $casts = [
		'employee_id' => 'int',
		'sale_id' => 'int',
		'commission_base' => 'float',
		'commission_rate' => 'float',
		'commission_amount' => 'float',
		'paid_at' => 'datetime'
	];

	protected $fillable = [
		'employee_id',
		'sale_id',
		'commission_base',
		'commission_rate',
		'commission_amount',
		'status',
		'paid_at'
	];

	public function employee()
	{
		return $this->belongsTo(Employee::class);
	}

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}
}
