<?php

namespace App\Models;

use App\Support\StoragePath;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $purchase_order_id
 * @property int|null $purchase_order_item_id
 * @property string $attachment_type
 * @property string $file_path
 * @property string|null $caption
 * @property int|null $uploaded_by_user_id
 * @property Carbon $created_at
 */
class PurchaseAttachment extends Model
{
    protected $table = 'purchase_attachments';
    public $timestamps = false;

    protected $casts = [
        'purchase_order_id' => 'int',
        'purchase_order_item_id' => 'int',
        'uploaded_by_user_id' => 'int',
        'created_at' => 'datetime',
    ];

    protected $fillable = [
        'purchase_order_id',
        'purchase_order_item_id',
        'attachment_type',
        'file_path',
        'caption',
        'uploaded_by_user_id',
    ];

    protected $appends = [
        'file_url',
    ];

    public function storageKey(): string
    {
        return $this->attachment_type === 'product_photo'
            ? StoragePath::PURCHASE_ITEMS
            : StoragePath::PURCHASE_RECEIPTS;
    }

    public function getFileUrlAttribute(): ?string
    {
        return StoragePath::publicUrl($this->storageKey(), $this->attributes['file_path'] ?? null);
    }

    public function getRawFilename(): ?string
    {
        return $this->attributes['file_path'] ?? null;
    }

    public function purchase_order()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function purchase_order_item()
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function uploaded_by()
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}
