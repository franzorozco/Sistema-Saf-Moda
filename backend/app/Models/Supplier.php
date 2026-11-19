<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use App\Support\StoragePath;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Class Supplier
 * 
 * @property int $id
 * @property string $code
 * @property string $business_name
 * @property string|null $contact_name
 * @property string|null $tax_id
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $address
 * @property string|null $city
 * @property string $country
 * @property string|null $payment_terms
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Collection|PurchaseOrder[] $purchase_orders
 *
 * @package App\Models
 */
class Supplier extends Model
{
	use SoftDeletes;
	protected $table = 'suppliers';

	protected $casts = [
		'is_active' => 'bool'
	];

	protected $fillable = [
		'code',
		'business_name',
		'contact_name',
		'tax_id',
		'phone',
		'whatsapp',
		'secondary_phone',
		'email',
		'address',
		'city',
		'country',
		'payment_terms',
		'photo_url',
		'notes',
		'is_active'
	];

	public function getPhotoUrlAttribute($value): ?string
	{
		return StoragePath::publicUrl(StoragePath::SUPPLIERS, $value);
	}

	public function getRawPhotoFilename(): ?string
	{
		return $this->attributes['photo_url'] ?? null;
	}

	public function purchase_orders()
	{
		return $this->hasMany(PurchaseOrder::class);
	}

	public function purchase_price_histories()
	{
		return $this->hasMany(PurchasePriceHistory::class);
	}
}
