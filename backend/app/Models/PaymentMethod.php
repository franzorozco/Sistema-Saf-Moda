<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class PaymentMethod
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $method_type
 * @property bool $is_active
 * 
 * @property Collection|SalePayment[] $sale_payments
 * @property Collection|LayawayPayment[] $layaway_payments
 * @property Collection|Expense[] $expenses
 *
 * @package App\Models
 */
class PaymentMethod extends Model
{
	protected $table = 'payment_methods';
	public $timestamps = false;

	protected $casts = [
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'method_type',
		'is_active'
	];

	public function sale_payments()
	{
		return $this->hasMany(SalePayment::class);
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
