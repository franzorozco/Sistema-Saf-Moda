<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Attribute
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $data_type
 * @property bool $is_variant_axis
 * @property int $sort_order
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|AttributeValue[] $attribute_values
 * @property Collection|Product[] $products
 * @property Collection|VariantAttributeValue[] $variant_attribute_values
 *
 * @package App\Models
 */
class Attribute extends Model
{
	protected $table = 'attributes';

	protected $casts = [
		'is_variant_axis' => 'bool',
		'sort_order' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'data_type',
		'is_variant_axis',
		'sort_order',
		'is_active'
	];

	public function attribute_values()
	{
		return $this->hasMany(AttributeValue::class);
	}

	public function products()
	{
		return $this->belongsToMany(Product::class, 'product_attributes')
					->withPivot('is_required', 'sort_order');
	}

	public function variant_attribute_values()
	{
		return $this->hasMany(VariantAttributeValue::class);
	}
}
