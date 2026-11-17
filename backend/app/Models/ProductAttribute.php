<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class ProductAttribute
 * 
 * @property int $product_id
 * @property int $attribute_id
 * @property bool $is_required
 * @property int $sort_order
 * 
 * @property Product $product
 * @property Attribute $attribute
 *
 * @package App\Models
 */
class ProductAttribute extends Model
{
	protected $table = 'product_attributes';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'product_id' => 'int',
		'attribute_id' => 'int',
		'is_required' => 'bool',
		'sort_order' => 'int'
	];

	protected $fillable = [
		'is_required',
		'sort_order'
	];

	public function product()
	{
		return $this->belongsTo(Product::class);
	}

	public function attribute()
	{
		return $this->belongsTo(Attribute::class);
	}
}
