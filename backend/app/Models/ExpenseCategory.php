<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class ExpenseCategory
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property bool $is_active
 * 
 * @property Collection|Expense[] $expenses
 *
 * @package App\Models
 */
class ExpenseCategory extends Model
{
	protected $table = 'expense_categories';
	public $timestamps = false;

	protected $casts = [
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'description',
		'is_active'
	];

	public function expenses()
	{
		return $this->hasMany(Expense::class);
	}
}
