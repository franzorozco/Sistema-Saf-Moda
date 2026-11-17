<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class DiscountCustomer
 * 
 * @property int $id
 * @property int $discount_id
 * @property int|null $customer_id
 * @property string|null $customer_tier
 * 
 * @property Discount $discount
 * @property Customer|null $customer
 *
 * @package App\Models
 */
class DiscountCustomer extends Model
{
	protected $table = 'discount_customers';
	public $timestamps = false;

	protected $casts = [
		'discount_id' => 'int',
		'customer_id' => 'int'
	];

	protected $fillable = [
		'discount_id',
		'customer_id',
		'customer_tier'
	];

	public function discount()
	{
		return $this->belongsTo(Discount::class);
	}

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}
}
