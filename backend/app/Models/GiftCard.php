<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class GiftCard
 * 
 * @property int $id
 * @property string $code
 * @property int|null $customer_id
 * @property int|null $issued_branch_id
 * @property float $initial_balance
 * @property float $current_balance
 * @property string $status
 * @property Carbon|null $expires_at
 * @property int|null $issued_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Customer|null $customer
 * @property Branch|null $branch
 * @property User|null $user
 * @property Collection|SalePayment[] $sale_payments
 * @property Collection|GiftCardTransaction[] $gift_card_transactions
 *
 * @package App\Models
 */
class GiftCard extends Model
{
	protected $table = 'gift_cards';

	protected $casts = [
		'customer_id' => 'int',
		'issued_branch_id' => 'int',
		'initial_balance' => 'float',
		'current_balance' => 'float',
		'expires_at' => 'datetime',
		'issued_by_user_id' => 'int'
	];

	protected $fillable = [
		'code',
		'customer_id',
		'issued_branch_id',
		'initial_balance',
		'current_balance',
		'status',
		'expires_at',
		'issued_by_user_id'
	];

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class, 'issued_branch_id');
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'issued_by_user_id');
	}

	public function sale_payments()
	{
		return $this->hasMany(SalePayment::class);
	}

	public function gift_card_transactions()
	{
		return $this->hasMany(GiftCardTransaction::class);
	}
}
