<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class DiscountBranch
 * 
 * @property int $discount_id
 * @property int $branch_id
 * 
 * @property Discount $discount
 * @property Branch $branch
 *
 * @package App\Models
 */
class DiscountBranch extends Model
{
	protected $table = 'discount_branches';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'discount_id' => 'int',
		'branch_id' => 'int'
	];

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
