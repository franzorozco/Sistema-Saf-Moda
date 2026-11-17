<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class CustomerAddress
 * 
 * @property int $id
 * @property int $customer_id
 * @property string $label
 * @property string $recipient_name
 * @property string|null $phone
 * @property string $country
 * @property string|null $state_province
 * @property string $city
 * @property string $address_line1
 * @property string|null $address_line2
 * @property string|null $postal_code
 * @property string|null $reference_notes
 * @property bool $is_default
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Customer $customer
 *
 * @package App\Models
 */
class CustomerAddress extends Model
{
	protected $table = 'customer_addresses';

	protected $casts = [
		'customer_id' => 'int',
		'is_default' => 'bool'
	];

	protected $fillable = [
		'customer_id',
		'label',
		'recipient_name',
		'phone',
		'country',
		'state_province',
		'city',
		'address_line1',
		'address_line2',
		'postal_code',
		'reference_notes',
		'is_default'
	];

	public function customer()
	{
		return $this->belongsTo(Customer::class);
	}
}
