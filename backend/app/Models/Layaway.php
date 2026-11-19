<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Layaway
 * 
 * @property int $id
 * @property string $layaway_number
 * @property int $branch_id
 * @property int $warehouse_id
 * @property int $customer_id
 * @property int|null $seller_employee_id
 * @property int|null $sale_id
 * @property float $total_amount
 * @property float $paid_amount
 * @property string $status
 * @property Carbon $expires_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $cancelled_at
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property float|null $balance_due
 * 
 * @property Branch $branch
 * @property Warehouse $warehouse
 * @property Customer $customer
 * @property Employee|null $employee
 * @property Sale|null $sale
 * @property Collection|LayawayItem[] $layaway_items
 * @property Collection|LayawayPayment[] $layaway_payments
 *
 * @package App\Models
 */
class Layaway extends Model
{
	protected $table = 'layaways';

	protected $casts = [
		'branch_id' => 'int',
		'warehouse_id' => 'int',
		'customer_id' => 'int',
		'seller_employee_id' => 'int',
		'sale_id' => 'int',
		'total_amount' => 'float',
		'paid_amount' => 'float',
		'expires_at' => 'datetime',
		'completed_at' => 'datetime',
		'cancelled_at' => 'datetime',
		'balance_due' => 'float'
	];

	protected $fillable = [
		'layaway_number',
		'branch_id',
		'warehouse_id',
		'customer_id',
		'seller_employee_id',
		'sale_id',
		'total_amount',
		'paid_amount',
		'status',
		'expires_at',
		'completed_at',
		'cancelled_at',
		'notes'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function employee()
	{
		return $this->belongsTo(Employee::class, 'seller_employee_id');
	}

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function layaway_items()
	{
		return $this->hasMany(LayawayItem::class);
	}

	public function layaway_payments()
	{
		return $this->hasMany(LayawayPayment::class);
	}
}
