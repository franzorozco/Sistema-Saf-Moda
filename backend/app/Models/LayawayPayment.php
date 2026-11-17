<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class LayawayPayment
 * 
 * @property int $id
 * @property int $layaway_id
 * @property int $payment_method_id
 * @property int|null $cash_register_session_id
 * @property float $amount
 * @property string|null $reference_number
 * @property int|null $received_by_user_id
 * @property Carbon $paid_at
 * 
 * @property Layaway $layaway
 * @property PaymentMethod $payment_method
 * @property CashRegisterSession|null $cash_register_session
 * @property User|null $user
 *
 * @package App\Models
 */
class LayawayPayment extends Model
{
	protected $table = 'layaway_payments';
	public $timestamps = false;

	protected $casts = [
		'layaway_id' => 'int',
		'payment_method_id' => 'int',
		'cash_register_session_id' => 'int',
		'amount' => 'float',
		'received_by_user_id' => 'int',
		'paid_at' => 'datetime'
	];

	protected $fillable = [
		'layaway_id',
		'payment_method_id',
		'cash_register_session_id',
		'amount',
		'reference_number',
		'received_by_user_id',
		'paid_at'
	];

	public function layaway()
	{
		return $this->belongsTo(Layaway::class);
	}

	public function payment_method()
	{
		return $this->belongsTo(PaymentMethod::class);
	}

	public function cash_register_session()
	{
		return $this->belongsTo(CashRegisterSession::class);
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'received_by_user_id');
	}
}
