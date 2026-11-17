<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Role
 * 
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property bool $is_system
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Permission[] $permissions
 * @property Collection|User[] $users
 *
 * @package App\Models
 */
class Role extends Model
{
	protected $table = 'roles';

	protected $casts = [
		'is_system' => 'bool'
	];

	protected $fillable = [
		'code',
		'name',
		'description',
		'is_system'
	];

	public function permissions()
	{
		return $this->belongsToMany(Permission::class, 'role_permissions');
	}

	public function users()
	{
		return $this->belongsToMany(User::class, 'user_roles')
					->withPivot('id', 'branch_id', 'assigned_at');
	}
}
