<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Brand
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $slug
 * @property string|null $logo_url
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Product[] $products
 *
 * @package App\Models
 */
class Brand extends Model
{
	protected $table = 'brands';

	protected $casts = [
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'slug',
		'logo_url',
		'is_active'
	];

	public function products()
	{
		return $this->hasMany(Product::class);
	}
}
