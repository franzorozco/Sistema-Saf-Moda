<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SizeGuide
 * 
 * @property int $id
 * @property int|null $department_id
 * @property int|null $category_id
 * @property string $name
 * @property string $unit
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Department|null $department
 * @property Category|null $category
 * @property Collection|SizeGuideItem[] $size_guide_items
 * @property Collection|Product[] $products
 *
 * @package App\Models
 */
class SizeGuide extends Model
{
	protected $table = 'size_guides';

	protected $casts = [
		'department_id' => 'int',
		'category_id' => 'int'
	];

	protected $fillable = [
		'department_id',
		'category_id',
		'name',
		'unit',
		'notes'
	];

	public function department()
	{
		return $this->belongsTo(Department::class);
	}

	public function category()
	{
		return $this->belongsTo(Category::class);
	}

	public function size_guide_items()
	{
		return $this->hasMany(SizeGuideItem::class);
	}

	public function products()
	{
		return $this->hasMany(Product::class);
	}
}
