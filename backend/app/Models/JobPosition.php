<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class JobPosition
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property float|null $base_salary_ref
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Employee[] $employees
 *
 * @package App\Models
 */
class JobPosition extends Model
{
	protected $table = 'job_positions';

	protected $casts = [
		'base_salary_ref' => 'float'
	];

	protected $fillable = [
		'code',
		'name',
		'description',
		'base_salary_ref'
	];

	public function employees()
	{
		return $this->hasMany(Employee::class);
	}
}
