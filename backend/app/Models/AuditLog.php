<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class AuditLog
 * 
 * @property int $id
 * @property int|null $user_id
 * @property int|null $branch_id
 * @property string $entity_table
 * @property int $entity_id
 * @property string $action
 * @property string|null $old_values
 * @property string|null $new_values
 * @property inet|null $ip_address
 * @property string|null $user_agent
 * @property Carbon $created_at
 * 
 * @property User|null $user
 * @property Branch|null $branch
 *
 * @package App\Models
 */
class AuditLog extends Model
{
	protected $table = 'audit_logs';
	public $timestamps = false;

	protected $casts = [
		'user_id' => 'int',
		'branch_id' => 'int',
		'entity_id' => 'int',
		'old_values' => 'binary',
		'new_values' => 'binary',
		'ip_address' => 'inet'
	];

	protected $fillable = [
		'user_id',
		'branch_id',
		'entity_table',
		'entity_id',
		'action',
		'old_values',
		'new_values',
		'ip_address',
		'user_agent'
	];

	public function user()
	{
		return $this->belongsTo(User::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
