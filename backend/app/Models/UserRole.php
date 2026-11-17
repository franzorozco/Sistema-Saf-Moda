<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class UserRole
 * 
 * @property int $id
 * @property int $user_id
 * @property int $role_id
 * @property int|null $branch_id
 * @property Carbon $assigned_at
 * 
 * @property User $user
 * @property Role $role
 * @property Branch|null $branch
 *
 * @package App\Models
 */
class UserRole extends Model
{
	protected $table = 'user_roles';
	public $timestamps = false;

	protected $casts = [
		'user_id' => 'int',
		'role_id' => 'int',
		'branch_id' => 'int',
		'assigned_at' => 'datetime'
	];

	protected $fillable = [
		'user_id',
		'role_id',
		'branch_id',
		'assigned_at'
	];

	public function user()
	{
		return $this->belongsTo(User::class);
	}

	public function role()
	{
		return $this->belongsTo(Role::class);
	}

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
