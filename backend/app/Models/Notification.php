<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Notification
 * 
 * @property int $id
 * @property int|null $user_id
 * @property int|null $branch_id
 * @property string $category
 * @property string $severity
 * @property string $title
 * @property string $message
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property bool $is_read
 * @property Carbon|null $read_at
 * @property Carbon $created_at
 * 
 * @property User|null $user
 * @property Branch|null $branch
 *
 * @package App\Models
 */
class Notification extends Model
{
	protected $table = 'notifications';
	public $timestamps = false;

	protected $casts = [
		'user_id' => 'int',
		'branch_id' => 'int',
		'reference_id' => 'int',
		'is_read' => 'bool',
		'read_at' => 'datetime'
	];

	protected $fillable = [
		'user_id',
		'branch_id',
		'category',
		'severity',
		'title',
		'message',
		'reference_type',
		'reference_id',
		'is_read',
		'read_at'
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
