<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class InventoryMovement
 * 
 * @property int $id
 * @property int $warehouse_id
 * @property int $variant_id
 * @property string $movement_type
 * @property int $quantity
 * @property float $unit_cost
 * @property int $balance_after
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string|null $notes
 * @property int|null $performed_by_user_id
 * @property Carbon $created_at
 * 
 * @property Warehouse $warehouse
 * @property ProductVariant $product_variant
 * @property User|null $user
 *
 * @package App\Models
 */
class InventoryMovement extends Model
{
	protected $table = 'inventory_movements';
	public $timestamps = false;

	protected $casts = [
		'warehouse_id' => 'int',
		'variant_id' => 'int',
		'quantity' => 'int',
		'unit_cost' => 'float',
		'balance_after' => 'int',
		'reference_id' => 'int',
		'performed_by_user_id' => 'int',
		'created_at' => 'datetime'
	];

	protected $fillable = [
		'warehouse_id',
		'variant_id',
		'movement_type',
		'quantity',
		'unit_cost',
		'balance_after',
		'reference_type',
		'reference_id',
		'notes',
		'performed_by_user_id'
	];

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'performed_by_user_id');
	}
}
