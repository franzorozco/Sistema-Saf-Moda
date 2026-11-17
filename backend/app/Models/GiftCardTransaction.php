<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class GiftCardTransaction
 * 
 * @property int $id
 * @property int $gift_card_id
 * @property int|null $sale_id
 * @property string $transaction_type
 * @property float $amount_delta
 * @property float $balance_after
 * @property Carbon $created_at
 * 
 * @property GiftCard $gift_card
 * @property Sale|null $sale
 *
 * @package App\Models
 */
class GiftCardTransaction extends Model
{
	protected $table = 'gift_card_transactions';
	public $timestamps = false;

	protected $casts = [
		'gift_card_id' => 'int',
		'sale_id' => 'int',
		'amount_delta' => 'float',
		'balance_after' => 'float'
	];

	protected $fillable = [
		'gift_card_id',
		'sale_id',
		'transaction_type',
		'amount_delta',
		'balance_after'
	];

	public function gift_card()
	{
		return $this->belongsTo(GiftCard::class);
	}

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}
}
