<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Class Person
 * 
 * @property int $id
 * @property string $first_name
 * @property string $last_name
 * @property string|null $document_type
 * @property string|null $document_number
 * @property string|null $phone
 * @property string|null $email
 * @property Carbon|null $birth_date
 * @property string|null $gender
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $deleted_at
 * 
 * @property Collection|User[] $users
 * @property Collection|Employee[] $employees
 * @property Collection|Customer[] $customers
 *
 * @package App\Models
 */
class Person extends Model
{
	use SoftDeletes;
	protected $table = 'persons';

	protected $casts = [
		'birth_date' => 'datetime'
	];

	protected $fillable = [
		'first_name',
		'last_name',
		'document_type',
		'document_number',
		'phone',
		'email',
		'birth_date',
		'gender'
	];

	public function users()
	{
		return $this->hasMany(User::class);
	}

	public function employees()
	{
		return $this->hasMany(Employee::class);
	}

	public function customers()
	{
		return $this->hasMany(Customer::class);
	}
}
