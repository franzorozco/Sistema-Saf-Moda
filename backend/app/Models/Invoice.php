<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Invoice
 * 
 * @property int $id
 * @property int $sale_id
 * @property int $branch_id
 * @property string $document_type
 * @property string|null $invoice_series
 * @property string $invoice_number
 * @property string|null $customer_tax_id
 * @property string $customer_legal_name
 * @property float $subtotal
 * @property float $tax_amount
 * @property float $total_amount
 * @property string $status
 * @property Carbon $issued_at
 * @property Carbon|null $voided_at
 * @property string|null $external_cuf
 * 
 * @property Sale $sale
 * @property Branch $branch
 *
 * @package App\Models
 */
class Invoice extends Model
{
	protected $table = 'invoices';
	public $timestamps = false;

	protected $casts = [
		'sale_id' => 'int',
		'branch_id' => 'int',
		'subtotal' => 'float',
		'tax_amount' => 'float',
		'total_amount' => 'float',
		'issued_at' => 'datetime',
		'voided_at' => 'datetime'
	];

	protected $fillable = [
		'sale_id',
		'branch_id',
		'document_type',
		'invoice_series',
		'invoice_number',
		'customer_tax_id',
		'customer_legal_name',
		'subtotal',
		'tax_amount',
		'total_amount',
		'status',
		'issued_at',
		'voided_at',
		'external_cuf'
	];

	public function sale()
	{
		return $this->belongsTo(Sale::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
