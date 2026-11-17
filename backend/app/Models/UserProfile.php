<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class UserProfile
 * 
 * @property int $user_id
 * @property string|null $display_name
 * @property string|null $avatar_url
 * @property string|null $bio
 * @property string $preferred_language
 * @property string $timezone
 * @property string $ui_theme
 * @property string|null $emergency_contact_name
 * @property string|null $emergency_contact_phone
 * @property string $notification_prefs
 * @property Carbon $updated_at
 * 
 * @property User $user
 *
 * @package App\Models
 */
class UserProfile extends Model
{
	protected $table = 'user_profiles';
	protected $primaryKey = 'user_id';
	public $incrementing = false;
	public $timestamps = false;

	protected $casts = [
		'user_id' => 'int',
		'notification_prefs' => 'binary'
	];

	protected $fillable = [
		'display_name',
		'avatar_url',
		'bio',
		'preferred_language',
		'timezone',
		'ui_theme',
		'emergency_contact_name',
		'emergency_contact_phone',
		'notification_prefs'
	];

	public function user()
	{
		return $this->belongsTo(User::class);
	}
}
