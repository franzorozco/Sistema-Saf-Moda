<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Permission
 * 
 * @property int $id
 * @property string $module
 * @property string $permission_class
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property int $sort_order
 * 
 * @property Collection|Role[] $roles
 *
 * @package App\Models
 */
class Permission extends Model
{
	protected $table = 'permissions';
	public $timestamps = false;

	protected $casts = [
		'sort_order' => 'int'
	];

	protected $fillable = [
		'module',
		'permission_class',
		'code',
		'name',
		'description',
		'sort_order'
	];

	public function roles()
	{
		return $this->belongsToMany(Role::class, 'role_permissions');
	}
}
