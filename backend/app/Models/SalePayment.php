<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SalePayment
 * 
 * @property int $id
 * @property int $sale_id
 * @property int $payment_method_id
 * @property float $amount
 * @property string|null $reference_number
 * @property Carbon $paid_at
 * @property int|null $gift_card_id
 * 
 * @property Sale $sale
 * @property PaymentMethod $payment_method
 * @property GiftCard|null $gift_card
 *
 * @package App\Models
 */
class SalePayment extends Model
{
	protected $table = 'sale_payments';
	public $timestamps = false;

	protected $casts = [
		'sale_id' => 'int',
		'payment_method_id' => 'int',
		'amount' => 'float',
		'paid_at' => 'datetime',
		'gift_card_id' => 'int'
	];

	protected $fillable = [
		'sale_id',
		'payment_method_id',
		'amount',
		'reference_number',
		'paid_at',
		'gift_card_id'
	];

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function payment_method()
	{
		return $this->belongsTo(PaymentMethod::class);
	}

	public function gift_card()
	{
		return $this->belongsTo(GiftCard::class);
	}
}
