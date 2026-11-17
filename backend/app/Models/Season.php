<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Season
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property int $year
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Product[] $products
 *
 * @package App\Models
 */
class Season extends Model
{
	protected $table = 'seasons';

	protected $casts = [
		'year' => 'int',
		'starts_at' => 'datetime',
		'ends_at' => 'datetime',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'year',
		'starts_at',
		'ends_at',
		'is_active'
	];

	public function products()
	{
		return $this->hasMany(Product::class);
	}
}
