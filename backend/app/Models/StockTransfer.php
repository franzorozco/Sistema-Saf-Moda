<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class StockTransfer
 * 
 * @property int $id
 * @property string $transfer_number
 * @property int $source_warehouse_id
 * @property int $target_warehouse_id
 * @property string $status
 * @property int|null $requested_by_user_id
 * @property int|null $shipped_by_user_id
 * @property int|null $received_by_user_id
 * @property Carbon|null $shipped_at
 * @property Carbon|null $received_at
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Warehouse $warehouse
 * @property User|null $user
 * @property Collection|StockTransferItem[] $stock_transfer_items
 *
 * @package App\Models
 */
class StockTransfer extends Model
{
	protected $table = 'stock_transfers';

	protected $casts = [
		'source_warehouse_id' => 'int',
		'target_warehouse_id' => 'int',
		'requested_by_user_id' => 'int',
		'shipped_by_user_id' => 'int',
		'received_by_user_id' => 'int',
		'shipped_at' => 'datetime',
		'received_at' => 'datetime'
	];

	protected $fillable = [
		'transfer_number',
		'source_warehouse_id',
		'target_warehouse_id',
		'status',
		'requested_by_user_id',
		'shipped_by_user_id',
		'received_by_user_id',
		'shipped_at',
		'received_at',
		'notes'
	];

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'received_by_user_id');
	}

	public function stock_transfer_items()
	{
		return $this->hasMany(StockTransferItem::class);
	}
}
