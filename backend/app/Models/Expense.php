<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Expense
 * 
 * @property int $id
 * @property string $expense_number
 * @property int $branch_id
 * @property int $expense_category_id
 * @property int|null $cash_register_session_id
 * @property int $payment_method_id
 * @property float $amount
 * @property Carbon $expense_date
 * @property string|null $vendor_name
 * @property string|null $receipt_number
 * @property string $description
 * @property int|null $recorded_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Branch $branch
 * @property ExpenseCategory $expense_category
 * @property CashRegisterSession|null $cash_register_session
 * @property PaymentMethod $payment_method
 * @property User|null $user
 *
 * @package App\Models
 */
class Expense extends Model
{
	protected $table = 'expenses';

	protected $casts = [
		'branch_id' => 'int',
		'expense_category_id' => 'int',
		'cash_register_session_id' => 'int',
		'payment_method_id' => 'int',
		'amount' => 'float',
		'expense_date' => 'datetime',
		'recorded_by_user_id' => 'int'
	];

	protected $fillable = [
		'expense_number',
		'branch_id',
		'expense_category_id',
		'cash_register_session_id',
		'payment_method_id',
		'amount',
		'expense_date',
		'vendor_name',
		'receipt_number',
		'description',
		'recorded_by_user_id'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function expense_category()
	{
		return $this->belongsTo(ExpenseCategory::class);
	}

	public function cash_register_session()
	{
		return $this->belongsTo(CashRegisterSession::class);
	}

	public function payment_method()
	{
		return $this->belongsTo(PaymentMethod::class);
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'recorded_by_user_id');
	}
}
