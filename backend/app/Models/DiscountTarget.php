<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class DiscountTarget
 * 
 * @property int $id
 * @property int $discount_id
 * @property int|null $department_id
 * @property int|null $category_id
 * @property int|null $product_id
 * @property int|null $variant_id
 * 
 * @property Discount $discount
 * @property Department|null $department
 * @property Category|null $category
 * @property Product|null $product
 * @property ProductVariant|null $product_variant
 *
 * @package App\Models
 */
class DiscountTarget extends Model
{
	protected $table = 'discount_targets';
	public $timestamps = false;

	protected $casts = [
		'discount_id' => 'int',
		'department_id' => 'int',
		'category_id' => 'int',
		'product_id' => 'int',
		'variant_id' => 'int'
	];

	protected $fillable = [
		'discount_id',
		'department_id',
		'category_id',
		'product_id',
		'variant_id'
	];

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function department()
	{
		return $this->belongsTo(Department::class);
	}

	public function category()
	{
		return $this->belongsTo(Category::class);
	}

	public function product()
	{
		return $this->belongsTo(Product::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
