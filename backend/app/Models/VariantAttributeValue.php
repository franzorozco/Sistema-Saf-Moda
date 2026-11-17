<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class VariantAttributeValue
 * 
 * @property int $variant_id
 * @property int $attribute_id
 * @property int $attribute_value_id
 * 
 * @property ProductVariant $product_variant
 * @property Attribute $attribute
 * @property AttributeValue $attribute_value
 *
 * @package App\Models
 */
class VariantAttributeValue extends Model
{
	protected $table = 'variant_attribute_values';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'variant_id' => 'int',
		'attribute_id' => 'int',
		'attribute_value_id' => 'int'
	];

	protected $fillable = [
		'attribute_value_id'
	];

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}

	public function attribute()
	{
		return $this->belongsTo(Attribute::class);
	}

	public function attribute_value()
	{
		return $this->belongsTo(AttributeValue::class);
	}
}
