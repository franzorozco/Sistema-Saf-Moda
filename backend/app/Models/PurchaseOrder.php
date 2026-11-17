<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class PurchaseOrder
 * 
 * @property int $id
 * @property string $po_number
 * @property int $supplier_id
 * @property int $target_warehouse_id
 * @property string $status
 * @property Carbon $order_date
 * @property Carbon|null $expected_date
 * @property Carbon|null $received_at
 * @property float $subtotal
 * @property float $tax_amount
 * @property float $shipping_cost
 * @property float $total_amount
 * @property int|null $created_by_user_id
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Supplier $supplier
 * @property Warehouse $warehouse
 * @property User|null $user
 * @property Collection|PurchaseOrderItem[] $purchase_order_items
 *
 * @package App\Models
 */
class PurchaseOrder extends Model
{
	protected $table = 'purchase_orders';

	protected $casts = [
		'supplier_id' => 'int',
		'target_warehouse_id' => 'int',
		'order_date' => 'datetime',
		'expected_date' => 'datetime',
		'received_at' => 'datetime',
		'subtotal' => 'float',
		'tax_amount' => 'float',
		'shipping_cost' => 'float',
		'total_amount' => 'float',
		'created_by_user_id' => 'int'
	];

	protected $fillable = [
		'po_number',
		'supplier_id',
		'target_warehouse_id',
		'status',
		'order_date',
		'expected_date',
		'received_at',
		'subtotal',
		'tax_amount',
		'shipping_cost',
		'total_amount',
		'created_by_user_id',
		'notes'
	];

	public function supplier()
	{
		return $this->belongsTo(Supplier::class);
	}

	public function warehouse()
	{
		return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
	}

	public function user()
	{
		return $this->belongsTo(User::class, 'created_by_user_id');
	}

	public function purchase_order_items()
	{
		return $this->hasMany(PurchaseOrderItem::class);
	}
}
