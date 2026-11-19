<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Employee;
use App\Models\JobPosition;
use App\Models\Person;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserRole;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use ApiResponse;

    public function meta(): JsonResponse
    {
        return $this->success([
            'roles' => Role::withCount('permissions')->orderBy('name')->get(),
            'branches' => Branch::where('is_active', true)
                ->orderByDesc('is_main')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'is_main']),
            'job_positions' => JobPosition::orderBy('name')
                ->get(['id', 'code', 'name', 'base_salary_ref']),
        ], 'Metadatos de usuarios obtenidos');
    }

    public function storeJobPosition(Request $request): JsonResponse
    {
        $input = $this->normalizeEmptyToNull($request->all(), ['code', 'base_salary_ref', 'description']);
        $request->replace($input);

        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:40', 'unique:job_positions,code'],
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'base_salary_ref' => ['nullable', 'numeric', 'min:0'],
        ]);

        $position = JobPosition::create([
            'code' => !empty($validated['code'])
                ? strtoupper($validated['code'])
                : CodeGenerator::next('job_positions', 'J', 4, 'code'),
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'base_salary_ref' => $validated['base_salary_ref'] ?? null,
        ]);

        return $this->success($position, 'Cargo creado', 201);
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'active');
        $type = $request->query('type');
        $status = $request->query('status');
        $roleId = $request->query('role_id');
        $search = trim((string) $request->query('search', ''));

        $query = User::query();

        if ($scope === 'trashed') {
            $query->onlyTrashed();
        } elseif ($scope === 'all') {
            $query->withTrashed();
        }

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        if ($roleId !== null && $roleId !== '') {
            $query->whereHas('user_roles', fn ($q) => $q->where('role_id', (int) $roleId));
        }

        if ($type === 'employee') {
            $query->whereHas('employee', fn ($q) => $q->withTrashed());
        } elseif ($type === 'customer') {
            $query->whereHas('customer', fn ($q) => $q->withTrashed());
        } elseif ($type === 'system') {
            $query->whereDoesntHave('employee', fn ($q) => $q->withTrashed())
                ->whereDoesntHave('customer', fn ($q) => $q->withTrashed());
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('username', 'ilike', $like)
                    ->orWhere('email', 'ilike', $like)
                    ->orWhereHas('person', function ($pq) use ($like) {
                        $pq->withTrashed()
                            ->where('first_name', 'ilike', $like)
                            ->orWhere('last_name', 'ilike', $like)
                            ->orWhere('document_number', 'ilike', $like);
                    })
                    ->orWhereHas('employee', function ($eq) use ($like) {
                        $eq->withTrashed()->where('employee_code', 'ilike', $like);
                    })
                    ->orWhereHas('customer', function ($cq) use ($like) {
                        $cq->withTrashed()->where('customer_code', 'ilike', $like);
                    });
            });
        }

        $users = $query->orderByDesc('id')->get();
        $items = $users->map(fn (User $u) => $this->loadUserRelations($u))->values();

        return $this->success([
            'items' => $items,
            'stats' => $this->buildStats(),
        ], 'Usuarios obtenidos');
    }

    public function show(string $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        return $this->success($this->loadUserRelations($user), 'Detalle de usuario');
    }

    public function store(Request $request): JsonResponse
    {
        $this->normalizeRequestPayload($request);

        $rules = [
            'user_type' => ['required', 'in:employee,customer'],
            'person.first_name' => ['required', 'string', 'max:100'],
            'person.last_name' => ['required', 'string', 'max:100'],
            'person.document_type' => ['nullable', 'in:CI,DNI,NIT,PASSPORT,OTHER'],
            'person.document_number' => ['nullable', 'string', 'max:50'],
            'person.phone' => ['nullable', 'string', 'max:30'],
            'person.birth_date' => ['nullable', 'date'],
            'person.gender' => ['nullable', 'in:female,male,non_binary,prefer_not_to_say'],
            'account.email' => ['required', 'string', 'max:150', 'unique:users,email'],
            'account.username' => ['nullable', 'string', 'max:80', 'unique:users,username'],
            'account.password' => ['required', 'string', 'min:4', 'max:100'],
            'account.status' => ['nullable', 'in:active,inactive,suspended,locked'],
            'roles' => ['nullable', 'array'],
            'roles.*.role_id' => ['required', 'integer', 'exists:roles,id'],
            'roles.*.branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];

        if ($request->input('user_type') === 'employee') {
            $rules = array_merge($rules, [
                'employee.job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
                'employee.primary_branch_id' => ['required', 'integer', 'exists:branches,id'],
                'employee.employee_code' => ['nullable', 'string', 'max:30', 'unique:employees,employee_code'],
                'employee.hire_date' => ['required', 'date'],
                'employee.contract_type' => ['required', 'in:full_time,part_time,temporary,internship'],
                'employee.base_salary' => ['nullable', 'numeric', 'min:0'],
                'employee.commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'employee.employment_status' => ['nullable', 'in:active,on_leave,suspended,terminated'],
                'employee.notes' => ['nullable', 'string'],
                'employee.branch_ids' => ['nullable', 'array'],
                'employee.branch_ids.*' => ['integer', 'exists:branches,id'],
            ]);
        } else {
            $rules = array_merge($rules, [
                'customer.customer_code' => ['nullable', 'string', 'max:30', 'unique:customers,customer_code'],
                'customer.customer_tier' => ['required', 'in:regular,silver,gold,vip,wholesale'],
                'customer.store_credit' => ['nullable', 'numeric', 'min:0'],
                'customer.accepts_marketing' => ['nullable', 'boolean'],
                'customer.acquired_branch_id' => ['nullable', 'integer', 'exists:branches,id'],
                'customer.notes' => ['nullable', 'string'],
                'customer.is_active' => ['nullable', 'boolean'],
                'customer.address' => ['nullable', 'array'],
                'customer.address.label' => ['nullable', 'string', 'max:60'],
                'customer.address.city' => ['nullable', 'string', 'max:100'],
                'customer.address.address_line1' => ['nullable', 'string', 'max:255'],
                'customer.address.address_line2' => ['nullable', 'string', 'max:255'],
                'customer.address.reference_notes' => ['nullable', 'string', 'max:255'],
                'customer.address.phone' => ['nullable', 'string', 'max:30'],
            ]);
        }

        $validated = $request->validate($rules);

        $user = DB::transaction(function () use ($validated) {
            $personData = $validated['person'];
            $accountData = $validated['account'];

            $person = Person::create([
                'first_name' => $personData['first_name'],
                'last_name' => $personData['last_name'],
                'document_type' => $personData['document_type'] ?? null,
                'document_number' => $personData['document_number'] ?? null,
                'phone' => $personData['phone'] ?? null,
                'email' => $accountData['email'],
                'birth_date' => $personData['birth_date'] ?? null,
                'gender' => $personData['gender'] ?? null,
            ]);

            $user = User::create([
                'person_id' => $person->id,
                'username' => $accountData['username'] ?? null,
                'email' => $accountData['email'],
                'password_hash' => Hash::make($accountData['password']),
                'status' => $accountData['status'] ?? 'active',
                'email_verified_at' => now(),
            ]);

            UserProfile::create([
                'user_id' => $user->id,
                'display_name' => trim($person->first_name . ' ' . $person->last_name),
            ]);

            $this->replaceUserRoles($user->id, $validated['roles'] ?? []);

            if ($validated['user_type'] === 'employee') {
                $empData = $validated['employee'];
                $empCode = !empty($empData['employee_code'])
                    ? strtoupper($empData['employee_code'])
                    : CodeGenerator::next('employees', 'E', 4, 'employee_code');

                $employee = Employee::create([
                    'person_id' => $person->id,
                    'user_id' => $user->id,
                    'job_position_id' => $empData['job_position_id'],
                    'primary_branch_id' => $empData['primary_branch_id'],
                    'employee_code' => $empCode,
                    'hire_date' => $empData['hire_date'],
                    'contract_type' => $empData['contract_type'],
                    'base_salary' => $empData['base_salary'] ?? 0,
                    'commission_rate' => $empData['commission_rate'] ?? 0,
                    'employment_status' => $empData['employment_status'] ?? 'active',
                    'notes' => $empData['notes'] ?? null,
                ]);

                $this->syncEmployeeBranches(
                    $employee->id,
                    (int) $empData['primary_branch_id'],
                    $empData['branch_ids'] ?? []
                );
            } else {
                $custData = $validated['customer'];
                $custCode = !empty($custData['customer_code'])
                    ? strtoupper($custData['customer_code'])
                    : CodeGenerator::next('customers', 'CL', 4, 'customer_code');

                $customer = Customer::create([
                    'person_id' => $person->id,
                    'user_id' => $user->id,
                    'customer_code' => $custCode,
                    'customer_tier' => $custData['customer_tier'],
                    'store_credit' => $custData['store_credit'] ?? 0,
                    'accepts_marketing' => (bool) ($custData['accepts_marketing'] ?? false),
                    'acquired_branch_id' => $custData['acquired_branch_id'] ?? null,
                    'notes' => $custData['notes'] ?? null,
                    'is_active' => $custData['is_active'] ?? true,
                ]);

                $addr = $custData['address'] ?? null;
                if ($addr && !empty($addr['city']) && !empty($addr['address_line1'])) {
                    CustomerAddress::create([
                        'customer_id' => $customer->id,
                        'label' => $addr['label'] ?? 'Casa',
                        'recipient_name' => trim($person->first_name . ' ' . $person->last_name),
                        'phone' => $addr['phone'] ?? $person->phone,
                        'city' => $addr['city'],
                        'address_line1' => $addr['address_line1'],
                        'address_line2' => $addr['address_line2'] ?? null,
                        'reference_notes' => $addr['reference_notes'] ?? null,
                        'is_default' => true,
                    ]);
                }
            }

            return $user;
        });

        return $this->success([
            'user' => $this->loadUserRelations($user),
            'stats' => $this->buildStats(),
        ], 'Usuario creado correctamente', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $this->normalizeRequestPayload($request);

        $rules = [
            'user_type' => ['nullable', 'in:employee,customer,system,both'],
            'person.first_name' => ['required', 'string', 'max:100'],
            'person.last_name' => ['required', 'string', 'max:100'],
            'person.document_type' => ['nullable', 'in:CI,DNI,NIT,PASSPORT,OTHER'],
            'person.document_number' => ['nullable', 'string', 'max:50'],
            'person.phone' => ['nullable', 'string', 'max:30'],
            'person.birth_date' => ['nullable', 'date'],
            'person.gender' => ['nullable', 'in:female,male,non_binary,prefer_not_to_say'],
            'account.email' => ['required', 'string', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'account.username' => ['nullable', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id)],
            'account.password' => ['nullable', 'string', 'min:4', 'max:100'],
            'account.status' => ['nullable', 'in:active,inactive,suspended,locked'],
            'roles' => ['nullable', 'array'],
            'roles.*.role_id' => ['required', 'integer', 'exists:roles,id'],
            'roles.*.branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];

        $existingEmployee = Employee::withTrashed()->where('user_id', $user->id)->first();
        $existingCustomer = Customer::withTrashed()->where('user_id', $user->id)->first();
        $targetType = $request->input('user_type');

        if ($targetType === 'employee' || ($targetType === 'both' && $request->has('employee'))) {
            $rules = array_merge($rules, [
                'employee.job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
                'employee.primary_branch_id' => ['required', 'integer', 'exists:branches,id'],
                'employee.employee_code' => [
                    'nullable',
                    'string',
                    'max:30',
                    Rule::unique('employees', 'employee_code')->ignore($existingEmployee?->id),
                ],
                'employee.hire_date' => ['required', 'date'],
                'employee.contract_type' => ['required', 'in:full_time,part_time,temporary,internship'],
                'employee.base_salary' => ['nullable', 'numeric', 'min:0'],
                'employee.commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'employee.employment_status' => ['nullable', 'in:active,on_leave,suspended,terminated'],
                'employee.notes' => ['nullable', 'string'],
                'employee.branch_ids' => ['nullable', 'array'],
                'employee.branch_ids.*' => ['integer', 'exists:branches,id'],
            ]);
        }

        if ($targetType === 'customer' || ($targetType === 'both' && $request->has('customer'))) {
            $rules = array_merge($rules, [
                'customer.customer_code' => [
                    'nullable',
                    'string',
                    'max:30',
                    Rule::unique('customers', 'customer_code')->ignore($existingCustomer?->id),
                ],
                'customer.customer_tier' => ['required', 'in:regular,silver,gold,vip,wholesale'],
                'customer.store_credit' => ['nullable', 'numeric', 'min:0'],
                'customer.accepts_marketing' => ['nullable', 'boolean'],
                'customer.acquired_branch_id' => ['nullable', 'integer', 'exists:branches,id'],
                'customer.notes' => ['nullable', 'string'],
                'customer.is_active' => ['nullable', 'boolean'],
                'customer.address' => ['nullable', 'array'],
                'customer.address.label' => ['nullable', 'string', 'max:60'],
                'customer.address.city' => ['nullable', 'string', 'max:100'],
                'customer.address.address_line1' => ['nullable', 'string', 'max:255'],
                'customer.address.address_line2' => ['nullable', 'string', 'max:255'],
                'customer.address.reference_notes' => ['nullable', 'string', 'max:255'],
                'customer.address.phone' => ['nullable', 'string', 'max:30'],
            ]);
        }

        $validated = $request->validate($rules);

        DB::transaction(function () use ($user, $validated, $existingEmployee, $existingCustomer, $targetType, $request) {
            $person = Person::withTrashed()->findOrFail($user->person_id);
            $personData = $validated['person'];
            $accountData = $validated['account'];

            $person->update([
                'first_name' => $personData['first_name'],
                'last_name' => $personData['last_name'],
                'document_type' => $personData['document_type'] ?? null,
                'document_number' => $personData['document_number'] ?? null,
                'phone' => $personData['phone'] ?? null,
                'email' => $accountData['email'],
                'birth_date' => $personData['birth_date'] ?? null,
                'gender' => $personData['gender'] ?? null,
            ]);

            $userPatch = [
                'username' => $accountData['username'] ?? null,
                'email' => $accountData['email'],
                'status' => $accountData['status'] ?? $user->status,
            ];
            if (!empty($accountData['password'])) {
                $userPatch['password_hash'] = Hash::make($accountData['password']);
            }
            $user->update($userPatch);

            UserProfile::updateOrCreate(
                ['user_id' => $user->id],
                ['display_name' => trim($person->first_name . ' ' . $person->last_name)]
            );

            if ($request->has('roles')) {
                $this->replaceUserRoles($user->id, $validated['roles'] ?? []);
            }

            if (isset($validated['employee']) && in_array($targetType, ['employee', 'both'], true)) {
                $empData = $validated['employee'];
                $empCode = !empty($empData['employee_code'])
                    ? strtoupper($empData['employee_code'])
                    : ($existingEmployee?->employee_code ?? CodeGenerator::next('employees', 'E', 4, 'employee_code'));

                if ($existingEmployee) {
                    if ($existingEmployee->trashed()) {
                        $existingEmployee->restore();
                    }
                    $existingEmployee->update([
                        'job_position_id' => $empData['job_position_id'],
                        'primary_branch_id' => $empData['primary_branch_id'],
                        'employee_code' => $empCode,
                        'hire_date' => $empData['hire_date'],
                        'contract_type' => $empData['contract_type'],
                        'base_salary' => $empData['base_salary'] ?? 0,
                        'commission_rate' => $empData['commission_rate'] ?? 0,
                        'employment_status' => $empData['employment_status'] ?? 'active',
                        'notes' => $empData['notes'] ?? null,
                    ]);
                    $employee = $existingEmployee;
                } else {
                    $employee = Employee::create([
                        'person_id' => $person->id,
                        'user_id' => $user->id,
                        'job_position_id' => $empData['job_position_id'],
                        'primary_branch_id' => $empData['primary_branch_id'],
                        'employee_code' => $empCode,
                        'hire_date' => $empData['hire_date'],
                        'contract_type' => $empData['contract_type'],
                        'base_salary' => $empData['base_salary'] ?? 0,
                        'commission_rate' => $empData['commission_rate'] ?? 0,
                        'employment_status' => $empData['employment_status'] ?? 'active',
                        'notes' => $empData['notes'] ?? null,
                    ]);
                }

                $this->syncEmployeeBranches(
                    $employee->id,
                    (int) $empData['primary_branch_id'],
                    $empData['branch_ids'] ?? []
                );
            }

            if (isset($validated['customer']) && in_array($targetType, ['customer', 'both'], true)) {
                $custData = $validated['customer'];
                $custCode = !empty($custData['customer_code'])
                    ? strtoupper($custData['customer_code'])
                    : ($existingCustomer?->customer_code ?? CodeGenerator::next('customers', 'CL', 4, 'customer_code'));

                if ($existingCustomer) {
                    if ($existingCustomer->trashed()) {
                        $existingCustomer->restore();
                    }
                    $existingCustomer->update([
                        'customer_code' => $custCode,
                        'customer_tier' => $custData['customer_tier'],
                        'store_credit' => $custData['store_credit'] ?? 0,
                        'accepts_marketing' => (bool) ($custData['accepts_marketing'] ?? false),
                        'acquired_branch_id' => $custData['acquired_branch_id'] ?? null,
                        'notes' => $custData['notes'] ?? null,
                        'is_active' => $custData['is_active'] ?? true,
                    ]);
                    $customer = $existingCustomer;
                } else {
                    $customer = Customer::create([
                        'person_id' => $person->id,
                        'user_id' => $user->id,
                        'customer_code' => $custCode,
                        'customer_tier' => $custData['customer_tier'],
                        'store_credit' => $custData['store_credit'] ?? 0,
                        'accepts_marketing' => (bool) ($custData['accepts_marketing'] ?? false),
                        'acquired_branch_id' => $custData['acquired_branch_id'] ?? null,
                        'notes' => $custData['notes'] ?? null,
                        'is_active' => $custData['is_active'] ?? true,
                    ]);
                }

                $addr = $custData['address'] ?? null;
                if ($addr && !empty($addr['city']) && !empty($addr['address_line1'])) {
                    $defaultAddr = CustomerAddress::where('customer_id', $customer->id)
                        ->orderByDesc('is_default')
                        ->first();
                    $addrPayload = [
                        'label' => $addr['label'] ?? 'Casa',
                        'recipient_name' => trim($person->first_name . ' ' . $person->last_name),
                        'phone' => $addr['phone'] ?? $person->phone,
                        'city' => $addr['city'],
                        'address_line1' => $addr['address_line1'],
                        'address_line2' => $addr['address_line2'] ?? null,
                        'reference_notes' => $addr['reference_notes'] ?? null,
                        'is_default' => true,
                    ];
                    if ($defaultAddr) {
                        $defaultAddr->update($addrPayload);
                    } else {
                        CustomerAddress::create(array_merge($addrPayload, ['customer_id' => $customer->id]));
                    }
                }
            }
        });

        return $this->success([
            'user' => $this->loadUserRelations($user->fresh()),
            'stats' => $this->buildStats(),
        ], 'Usuario actualizado correctamente');
    }

    public function syncRoles(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'roles' => ['present', 'array'],
            'roles.*.role_id' => ['required', 'integer', 'exists:roles,id'],
            'roles.*.branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        DB::transaction(function () use ($user, $validated) {
            $this->replaceUserRoles($user->id, $validated['roles']);
        });

        return $this->success([
            'user' => $this->loadUserRelations($user->fresh()),
            'stats' => $this->buildStats(),
        ], 'Roles actualizados correctamente');
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', 'in:active,inactive,suspended,locked'],
        ]);

        if ($this->isRootAdmin($user) && $validated['status'] !== 'active') {
            return $this->error('No se puede desactivar o bloquear la cuenta raíz del superadministrador.', 422);
        }

        $user->update(['status' => $validated['status']]);

        return $this->success([
            'user' => $this->loadUserRelations($user->fresh()),
            'stats' => $this->buildStats(),
        ], 'Estado de cuenta actualizado');
    }

    public function destroy(string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($this->isRootAdmin($user)) {
            return $this->error('No se puede eliminar la cuenta raíz del superadministrador.', 422);
        }

        DB::transaction(function () use ($user) {
            $user->update(['status' => 'inactive']);

            $employee = Employee::where('user_id', $user->id)->first();
            if ($employee) {
                $employee->delete();
            }

            $customer = Customer::where('user_id', $user->id)->first();
            if ($customer) {
                $customer->delete();
            }

            $user->delete();

            $person = Person::find($user->person_id);
            if ($person) {
                $person->delete();
            }
        });

        return $this->success([
            'id' => $user->id,
            'stats' => $this->buildStats(),
        ], 'Usuario movido a la papelera');
    }

    public function restore(string $id): JsonResponse
    {
        $user = User::onlyTrashed()->findOrFail($id);

        DB::transaction(function () use ($user) {
            $person = Person::withTrashed()->find($user->person_id);
            if ($person && $person->trashed()) {
                $person->restore();
            }

            $user->restore();
            $user->update(['status' => 'active']);

            $employee = Employee::onlyTrashed()->where('user_id', $user->id)->first();
            if ($employee) {
                $employee->restore();
            }

            $customer = Customer::onlyTrashed()->where('user_id', $user->id)->first();
            if ($customer) {
                $customer->restore();
            }
        });

        return $this->success([
            'user' => $this->loadUserRelations($user->fresh()),
            'stats' => $this->buildStats(),
        ], 'Usuario restaurado correctamente');
    }

    public function forceDestroy(string $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        if ($this->isRootAdmin($user)) {
            return $this->error('No se puede eliminar físicamente la cuenta raíz del superadministrador.', 422);
        }

        try {
            DB::transaction(function () use ($user) {
                $personId = $user->person_id;

                $employee = Employee::withTrashed()->where('user_id', $user->id)->first();
                if ($employee) {
                    $employee->forceDelete();
                }

                $customer = Customer::withTrashed()->where('user_id', $user->id)->first();
                if ($customer) {
                    $customer->forceDelete();
                }

                UserRole::where('user_id', $user->id)->delete();
                UserProfile::where('user_id', $user->id)->delete();
                $user->forceDelete();

                $personHasRefs = User::withTrashed()->where('person_id', $personId)->exists()
                    || Employee::withTrashed()->where('person_id', $personId)->exists()
                    || Customer::withTrashed()->where('person_id', $personId)->exists();

                if (!$personHasRefs) {
                    $person = Person::withTrashed()->find($personId);
                    if ($person) {
                        $person->forceDelete();
                    }
                }
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23503') {
                return $this->error(
                    'No se puede eliminar físicamente este usuario porque tiene registros históricos asociados (ventas, cajas, movimientos o auditoría). Usa la eliminación lógica en su lugar.',
                    409
                );
            }
            throw $e;
        }

        return $this->success([
            'id' => (int) $id,
            'stats' => $this->buildStats(),
        ], 'Usuario eliminado definitivamente');
    }

    private function isRootAdmin(User $user): bool
    {
        return $user->username === 'admin' || $user->email === 'admin';
    }

    private function loadUserRelations(User $user): User
    {
        $user->load([
            'person' => fn ($q) => $q->withTrashed(),
            'user_profile',
            'user_roles.role:id,code,name',
            'user_roles.branch:id,code,name',
            'employee' => fn ($q) => $q->withTrashed()->with([
                'job_position:id,code,name',
                'branch:id,code,name',
                'branches:id,code,name',
            ]),
            'customer' => fn ($q) => $q->withTrashed()->with([
                'branch:id,code,name',
                'customer_addresses',
            ]),
        ]);

        $hasEmp = $user->employee !== null;
        $hasCust = $user->customer !== null;
        $userType = $hasEmp && $hasCust
            ? 'both'
            : ($hasEmp ? 'employee' : ($hasCust ? 'customer' : 'system'));

        $user->setAttribute('user_type', $userType);
        $user->setAttribute('is_deleted', $user->trashed());

        return $user;
    }

    private function buildStats(): array
    {
        return [
            'total_active' => User::where('status', 'active')->count(),
            'employees_count' => User::whereHas('employee')->count(),
            'customers_count' => User::whereHas('customer')->count(),
            'inactive_count' => User::where('status', '!=', 'active')->count(),
            'trashed_count' => User::onlyTrashed()->count(),
        ];
    }

    private function replaceUserRoles(int $userId, array $roles): void
    {
        UserRole::where('user_id', $userId)->delete();

        $seen = [];
        foreach ($roles as $item) {
            $roleId = (int) $item['role_id'];
            $branchId = isset($item['branch_id']) && $item['branch_id'] !== '' ? (int) $item['branch_id'] : null;
            $key = $roleId . ':' . ($branchId ?? 'global');
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            UserRole::create([
                'user_id' => $userId,
                'role_id' => $roleId,
                'branch_id' => $branchId,
                'assigned_at' => now(),
            ]);
        }
    }

    private function syncEmployeeBranches(int $employeeId, int $primaryBranchId, array $extraBranchIds): void
    {
        DB::table('employee_branches')->where('employee_id', $employeeId)->delete();

        $allIds = collect($extraBranchIds)
            ->map(fn ($id) => (int) $id)
            ->push($primaryBranchId)
            ->unique()
            ->values();

        foreach ($allIds as $branchId) {
            DB::table('employee_branches')->insert([
                'employee_id' => $employeeId,
                'branch_id' => $branchId,
                'is_primary' => $branchId === $primaryBranchId,
                'assigned_from' => now()->toDateString(),
            ]);
        }
    }

    private function normalizeEmptyToNull(array $data, array $keys): array
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }
        return $data;
    }

    private function normalizeRequestPayload(Request $request): void
    {
        $payload = $request->all();

        if (isset($payload['person']) && is_array($payload['person'])) {
            $payload['person'] = $this->normalizeEmptyToNull($payload['person'], [
                'document_type',
                'document_number',
                'phone',
                'birth_date',
                'gender',
            ]);
        }

        if (isset($payload['account']) && is_array($payload['account'])) {
            $payload['account'] = $this->normalizeEmptyToNull($payload['account'], [
                'username',
                'password',
                'status',
            ]);
        }

        if (isset($payload['employee']) && is_array($payload['employee'])) {
            $payload['employee'] = $this->normalizeEmptyToNull($payload['employee'], [
                'employee_code',
                'base_salary',
                'commission_rate',
                'notes',
            ]);
        }

        if (isset($payload['customer']) && is_array($payload['customer'])) {
            $payload['customer'] = $this->normalizeEmptyToNull($payload['customer'], [
                'customer_code',
                'store_credit',
                'acquired_branch_id',
                'notes',
            ]);
            if (isset($payload['customer']['address']) && is_array($payload['customer']['address'])) {
                $payload['customer']['address'] = $this->normalizeEmptyToNull($payload['customer']['address'], [
                    'label',
                    'city',
                    'address_line1',
                    'address_line2',
                    'reference_notes',
                    'phone',
                ]);
            }
        }

        if (isset($payload['roles']) && is_array($payload['roles'])) {
            foreach ($payload['roles'] as $idx => $r) {
                if (is_array($r) && array_key_exists('branch_id', $r) && $r['branch_id'] === '') {
                    $payload['roles'][$idx]['branch_id'] = null;
                }
            }
        }

        $request->replace($payload);
    }
}
