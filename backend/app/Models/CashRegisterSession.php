<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class CashRegisterSession
 * 
 * @property int $id
 * @property int $cash_register_id
 * @property int $employee_id
 * @property Carbon $opened_at
 * @property Carbon|null $closed_at
 * @property float $opening_amount
 * @property float|null $expected_amount
 * @property float|null $counted_amount
 * @property float|null $difference_amount
 * @property string $status
 * @property string|null $closing_notes
 * 
 * @property CashRegister $cash_register
 * @property Employee $employee
 * @property Collection|Sale[] $sales
 * @property Collection|LayawayPayment[] $layaway_payments
 * @property Collection|Expense[] $expenses
 *
 * @package App\Models
 */
class CashRegisterSession extends Model
{
	protected $table = 'cash_register_sessions';
	public $timestamps = false;

	protected $casts = [
		'cash_register_id' => 'int',
		'employee_id' => 'int',
		'opened_at' => 'datetime',
		'closed_at' => 'datetime',
		'opening_amount' => 'float',
		'expected_amount' => 'float',
		'counted_amount' => 'float',
		'difference_amount' => 'float'
	];

	protected $fillable = [
		'cash_register_id',
		'employee_id',
		'opened_at',
		'closed_at',
		'opening_amount',
		'expected_amount',
		'counted_amount',
		'difference_amount',
		'status',
		'closing_notes'
	];

	public function cash_register()
	{
		return $this->belongsTo(CashRegister::class);
	}

	public function employee()
	{
		return $this->belongsTo(Employee::class);
	}

	public function sales()
	{
		return $this->hasMany(Sale::class);
	}

	public function layaway_payments()
	{
		return $this->hasMany(LayawayPayment::class);
	}

	public function expenses()
	{
		return $this->hasMany(Expense::class);
	}
}
