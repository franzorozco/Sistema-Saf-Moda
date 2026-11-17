<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class LoyaltyTransaction
 * 
 * @property int $id
 * @property int $customer_id
 * @property int|null $sale_id
 * @property int $points_delta
 * @property int $balance_after
 * @property string $reason
 * @property Carbon $created_at
 * 
 * @property Customer $customer
 * @property Sale|null $sale
 *
 * @package App\Models
 */
class LoyaltyTransaction extends Model
{
	protected $table = 'loyalty_transactions';
	public $timestamps = false;

	protected $casts = [
		'customer_id' => 'int',
		'sale_id' => 'int',
		'points_delta' => 'int',
		'balance_after' => 'int'
	];

	protected $fillable = [
		'customer_id',
		'sale_id',
		'points_delta',
		'balance_after',
		'reason'
	];

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}
}
