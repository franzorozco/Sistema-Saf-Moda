<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SystemSetting
 * 
 * @property int $id
 * @property int|null $branch_id
 * @property string $group_name
 * @property string $setting_key
 * @property string|null $setting_value
 * @property string $value_type
 * @property string|null $description
 * @property bool $is_public
 * @property Carbon $updated_at
 * 
 * @property Branch|null $branch
 *
 * @package App\Models
 */
class SystemSetting extends Model
{
	protected $table = 'system_settings';
	public $timestamps = false;

	protected $casts = [
		'branch_id' => 'int',
		'is_public' => 'bool'
	];

	protected $fillable = [
		'branch_id',
		'group_name',
		'setting_key',
		'setting_value',
		'value_type',
		'description',
		'is_public'
	];

	public function branch()
	{
		return $this->belongsTo(Branch::class);
	}
}
