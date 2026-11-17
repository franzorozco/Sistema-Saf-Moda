<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Department
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $slug
 * @property int $sort_order
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|SizeGuide[] $size_guides
 * @property Collection|Product[] $products
 * @property Collection|DiscountTarget[] $discount_targets
 *
 * @package App\Models
 */
class Department extends Model
{
	protected $table = 'departments';

	protected $casts = [
		'sort_order' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'slug',
		'sort_order',
		'is_active'
	];

	public function size_guides()
	{
		return $this->hasMany(SizeGuide::class);
	}

	public function products()
	{
		return $this->hasMany(Product::class);
	}

	public function discount_targets()
	{
		return $this->hasMany(DiscountTarget::class);
	}
}
