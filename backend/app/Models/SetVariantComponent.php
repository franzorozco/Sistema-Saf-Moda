<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class SetVariantComponent
 * 
 * @property int $set_variant_id
 * @property int $component_variant_id
 * @property int $quantity
 * @property bool $is_optional
 * 
 * @property ProductVariant $product_variant
 *
 * @package App\Models
 */
class SetVariantComponent extends Model
{
	protected $table = 'set_variant_components';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'set_variant_id' => 'int',
		'component_variant_id' => 'int',
		'quantity' => 'int',
		'is_optional' => 'bool'
	];

	protected $fillable = [
		'quantity',
		'is_optional'
	];

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'component_variant_id');
	}
}
