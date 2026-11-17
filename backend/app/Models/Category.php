<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Category
 * 
 * @property int $id
 * @property int|null $parent_id
 * @property string $code
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property int $sort_order
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Category|null $category
 * @property Collection|Category[] $categories
 * @property Collection|SizeGuide[] $size_guides
 * @property Collection|Product[] $products
 * @property Collection|DiscountTarget[] $discount_targets
 *
 * @package App\Models
 */
class Category extends Model
{
	protected $table = 'categories';

	protected $casts = [
		'parent_id' => 'int',
		'sort_order' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'parent_id',
		'code',
		'name',
		'slug',
		'description',
		'sort_order',
		'is_active'
	];

	public function category()
	{
		return $this->belongsTo(Category::class, 'parent_id');
	}

	public function categories()
	{
		return $this->hasMany(Category::class, 'parent_id');
	}

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
