<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class CashRegister
 * 
 * @property int $id
 * @property int $branch_id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Branch $branch
 * @property Collection|CashRegisterSession[] $cash_register_sessions
 *
 * @package App\Models
 */
class CashRegister extends Model
{
	protected $table = 'cash_registers';

	protected $casts = [
		'branch_id' => 'int',
		'is_active' => 'bool'
	];

	protected $fillable = [
		'branch_id',
		'code',
		'name',
		'is_active'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}

	public function cash_register_sessions()
	{
		return $this->hasMany(CashRegisterSession::class);
	}
}
