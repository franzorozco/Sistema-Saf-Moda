<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class BranchVariantPrice
 * 
 * @property int $branch_id
 * @property int $variant_id
 * @property float $sale_price
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 * @property Carbon $updated_at
 * 
 * @property Branch $branch
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class BranchVariantPrice extends Model
{
	protected $table = 'branch_variant_prices';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'branch_id' => 'int',
		'variant_id' => 'int',
		'sale_price' => 'float',
		'starts_at' => 'datetime',
		'ends_at' => 'datetime',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'sale_price',
		'starts_at',
		'ends_at',
		'is_active'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
