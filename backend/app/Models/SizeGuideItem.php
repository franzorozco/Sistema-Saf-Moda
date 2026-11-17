<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class SizeGuideItem
 * 
 * @property int $id
 * @property int $size_guide_id
 * @property string $size_label
 * @property string $measurements
 * @property int $sort_order
 * 
 * @property SizeGuide $size_guide
 *
 * @package App\Models
 */
class SizeGuideItem extends Model
{
	protected $table = 'size_guide_items';
	public $timestamps = false;

	protected $casts = [
		'size_guide_id' => 'int',
		'measurements' => 'array',
		'sort_order' => 'int'
	];

	protected $fillable = [
		'size_guide_id',
		'size_label',
		'measurements',
		'sort_order'
	];

	public function size_guide()
	{
		return $this->belongsTo(SizeGuide::class);
	}
}
