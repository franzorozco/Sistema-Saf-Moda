<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SaleReturn
 * 
 * @property int $id
 * @property string $return_number
 * @property int $sale_id
 * @property int $branch_id
 * @property int $warehouse_id
 * @property int|null $processed_by_user_id
 * @property string $return_type
 * @property string $refund_method
 * @property float $total_refund_amount
 * @property string|null $reason
 * @property Carbon $returned_at
 * 
 * @property Sale $sale
 * @property Branch $branch
 * @property Warehouse $warehouse
 * @property User|null $user
 * @property Collection|SaleReturnItem[] $sale_return_items
 *
 * @package App\Models
 */
class SaleReturn extends Model
{
	protected $table = 'sale_returns';
	public $timestamps = false;

	protected $casts = [
		'sale_id' => 'int',
		'branch_id' => 'int',
		'warehouse_id' => 'int',
		'processed_by_user_id' => 'int',
		'total_refund_amount' => 'float',
		'returned_at' => 'datetime'
	];

	protected $fillable = [
		'return_number',
		'sale_id',
		'branch_id',
		'warehouse_id',
		'processed_by_user_id',
		'return_type',
		'refund_method',
		'total_refund_amount',
		'reason',
		'returned_at'
	];

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'processed_by_user_id');
	}

	public function sale_return_items()
	{
		return $this->hasMany(SaleReturnItem::class);
	}
}
