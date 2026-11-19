<?php

namespace App\Models;

use App\Support\StoragePath;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class ProductImage extends Model
{
	protected $table = 'product_images';
	public $timestamps = false;

	protected $casts = [
		'product_id' => 'int',
		'variant_id' => 'int',
		'is_primary' => 'bool',
		'sort_order' => 'int'
	];

	protected $fillable = [
		'product_id',
		'variant_id',
		'image_url',
		'alt_text',
		'is_primary',
		'sort_order'
	];

	protected $appends = [
		'filename',
	];

	public function getImageUrlAttribute($value): string
	{
		if (empty($value)) {
			return '';
		}

		if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
			return $value;
		}

		$storageKey = $this->variant_id ? StoragePath::PRODUCT_VARIANTS : StoragePath::PRODUCTS;

		return StoragePath::publicUrl($storageKey, $value) ?? $value;
	}

	public function getFilenameAttribute(): string
	{
		$raw = $this->attributes['image_url'] ?? '';
		return basename($raw);
	}

	public function product()
	{
		return $this->belongsTo(Product::class);
	}

	public function product_variant()
	{
		return $this->belongsTo(ProductVariant::class, 'variant_id');
	}
}
