<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class InventoryCount
 * 
 * @property int $id
 * @property string $count_number
 * @property int $warehouse_id
 * @property string $status
 * @property int|null $conducted_by_user_id
 * @property int|null $approved_by_user_id
 * @property Carbon $started_at
 * @property Carbon|null $completed_at
 * @property string|null $notes
 * 
 * @property Warehouse $warehouse
 * @property User|null $user
 * @property Collection|InventoryCountItem[] $inventory_count_items
 *
 * @package App\Models
 */
class InventoryCount extends Model
{
	protected $table = 'inventory_counts';
	public $timestamps = false;

	protected $casts = [
		'warehouse_id' => 'int',
		'conducted_by_user_id' => 'int',
		'approved_by_user_id' => 'int',
		'started_at' => 'datetime',
		'completed_at' => 'datetime'
	];

	protected $fillable = [
		'count_number',
		'warehouse_id',
		'status',
		'conducted_by_user_id',
		'approved_by_user_id',
		'started_at',
		'completed_at',
		'notes'
	];

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function conducted_by()
	{
		return $this->belongsTo(User::class, 'conducted_by_user_id');
	}

	public function approved_by()
	{
		return $this->belongsTo(User::class, 'approved_by_user_id');
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'approved_by_user_id');
	}

	public function inventory_count_items()
	{
		return $this->hasMany(InventoryCountItem::class);
	}
}
