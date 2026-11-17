<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Class Product
 * 
 * @property int $id
 * @property int $department_id
 * @property int $category_id
 * @property int|null $brand_id
 * @property int|null $season_id
 * @property int|null $size_guide_id
 * @property string $product_type
 * @property string $set_stock_mode
 * @property string $sku_prefix
 * @property string $name
 * @property string $slug
 * @property string|null $short_description
 * @property string|null $description
 * @property string|null $care_instructions
 * @property bool $is_taxable
 * @property float $tax_rate
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Department $department
 * @property Category $category
 * @property Brand|null $brand
 * @property Season|null $season
 * @property SizeGuide|null $size_guide
 * @property Collection|Attribute[] $attributes
 * @property Collection|ProductVariant[] $product_variants
 * @property Collection|ProductImage[] $product_images
 * @property Collection|DiscountTarget[] $discount_targets
 *
 * @package App\Models
 */
class Product extends Model
{
	use SoftDeletes;
	protected $table = 'products';

	protected $casts = [
		'department_id' => 'int',
		'category_id' => 'int',
		'brand_id' => 'int',
		'season_id' => 'int',
		'size_guide_id' => 'int',
		'is_taxable' => 'bool',
		'tax_rate' => 'float',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'department_id',
		'category_id',
		'brand_id',
		'season_id',
		'size_guide_id',
		'product_type',
		'set_stock_mode',
		'sku_prefix',
		'name',
		'slug',
		'short_description',
		'description',
		'care_instructions',
		'is_taxable',
		'tax_rate',
		'is_active'
	];

	public function department()
	{
		return $this->belongsTo(Department::class);
	}

	public function category()
	{
		return $this->belongsTo(Category::class);
	}

	public function brand()
	{
		return $this->belongsTo(Brand::class);
	}

	public function season()
	{
		return $this->belongsTo(Season::class);
	}

	public function size_guide()
	{
		return $this->belongsTo(SizeGuide::class);
	}

	public function attributes()
	{
		return $this->belongsToMany(Attribute::class, 'product_attributes')
					->withPivot('is_required', 'sort_order');
	}

	public function product_variants()
	{
		return $this->hasMany(ProductVariant::class);
	}

	public function product_images()
	{
		return $this->hasMany(ProductImage::class);
	}

	public function discount_targets()
	{
		return $this->hasMany(DiscountTarget::class);
	}
}
