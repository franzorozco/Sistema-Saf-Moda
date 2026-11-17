<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class DiscountEmployee
 * 
 * @property int $discount_id
 * @property int $employee_id
 * 
 * @property Discount $discount
 * @property Employee $employee
 *
 * @package App\Models
 */
class DiscountEmployee extends Model
{
	protected $table = 'discount_employees';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'discount_id' => 'int',
		'employee_id' => 'int'
	];

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function employee()
	{
		return $this->belongsTo(Employee::class);
	}
}
