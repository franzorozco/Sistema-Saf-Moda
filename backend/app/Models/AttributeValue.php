<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class AttributeValue
 * 
 * @property int $id
 * @property int $attribute_id
 * @property string $code
 * @property string $value
 * @property string|null $meta_hex
 * @property int $sort_order
 * @property bool $is_active
 * 
 * @property Attribute $attribute
 * @property Collection|VariantAttributeValue[] $variant_attribute_values
 *
 * @package App\Models
 */
class AttributeValue extends Model
{
	protected $table = 'attribute_values';
	public $timestamps = false;

	protected $casts = [
		'attribute_id' => 'int',
		'sort_order' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'attribute_id',
		'code',
		'value',
		'meta_hex',
		'sort_order',
		'is_active'
	];

	public function attribute()
	{
		return $this->belongsTo(Attribute::class);
	}

	public function variant_attribute_values()
	{
		return $this->hasMany(VariantAttributeValue::class);
	}
}
