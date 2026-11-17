<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Warehouse
 * 
 * @property int $id
 * @property int $branch_id
 * @property string $code
 * @property string $name
 * @property string $warehouse_type
 * @property bool $is_default
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Branch $branch
 * @property Collection|InventoryMovement[] $inventory_movements
 * @property Collection|Inventory[] $inventories
 * @property Collection|StockTransfer[] $stock_transfers
 * @property Collection|InventoryCount[] $inventory_counts
 * @property Collection|PurchaseOrder[] $purchase_orders
 * @property Collection|Sale[] $sales
 * @property Collection|SaleReturn[] $sale_returns
 * @property Collection|Layaway[] $layaways
 *
 * @package App\Models
 */
class Warehouse extends Model
{
	protected $table = 'warehouses';

	protected $casts = [
		'branch_id' => 'int',
		'is_default' => 'bool',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'branch_id',
		'code',
		'name',
		'warehouse_type',
		'is_default',
		'is_active'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function inventory_movements()
	{
		return $this->hasMany(InventoryMovement::class);
	}

	public function inventories()
	{
		return $this->hasMany(Inventory::class);
	}

	public function stock_transfers()
	{
		return $this->hasMany(StockTransfer::class, 'target_warehouse_id');
	}

	public function inventory_counts()
	{
		return $this->hasMany(InventoryCount::class);
	}

	public function purchase_orders()
	{
		return $this->hasMany(PurchaseOrder::class, 'target_warehouse_id');
	}

	public function sales()
	{
		return $this->hasMany(Sale::class);
	}

	public function sale_returns()
	{
		return $this->hasMany(SaleReturn::class);
	}

	public function layaways()
	{
		return $this->hasMany(Layaway::class);
	}
}
