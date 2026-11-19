<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeBranch;
use App\Models\EmployeeCommission;
use App\Models\EmployeeShift;
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

class EmployeeController extends Controller
{
    use ApiResponse;

    public function meta(): JsonResponse
    {
        return $this->success([
            'branches' => Branch::where('is_active', true)
                ->orderByDesc('is_main')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'is_main']),
            'job_positions' => JobPosition::orderBy('name')
                ->get(['id', 'code', 'name', 'base_salary_ref']),
            'roles' => Role::withCount('permissions')->orderBy('name')->get(['id', 'code', 'name']),
        ], 'Metadatos de empleados obtenidos');
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'active');
        $branchId = $request->query('branch_id');
        $jobPositionId = $request->query('job_position_id');
        $employmentStatus = $request->query('employment_status');
        $search = trim((string) $request->query('search', ''));

        $query = Employee::query();

        if ($scope === 'trashed') {
            $query->onlyTrashed();
        }

        if ($branchId !== null && $branchId !== '') {
            $bId = (int) $branchId;
            $query->where(function ($q) use ($bId) {
                $q->where('primary_branch_id', $bId)
                    ->orWhereHas('employee_branches', fn ($eb) => $eb->where('branch_id', $bId));
            });
        }

        if ($jobPositionId !== null && $jobPositionId !== '') {
            $query->where('job_position_id', (int) $jobPositionId);
        }

        if ($employmentStatus !== null && $employmentStatus !== '') {
            $query->where('employment_status', $employmentStatus);
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('employee_code', 'ilike', $like)
                    ->orWhereHas('person', function ($pq) use ($like) {
                        $pq->withTrashed()
                            ->where('first_name', 'ilike', $like)
                            ->orWhere('last_name', 'ilike', $like)
                            ->orWhere('document_number', 'ilike', $like);
                    })
                    ->orWhereHas('user', function ($uq) use ($like) {
                        $uq->withTrashed()
                            ->where('email', 'ilike', $like)
                            ->orWhere('username', 'ilike', $like);
                    });
            });
        }

        $employees = $query->orderByDesc('id')->get();
        $items = $employees->map(fn (Employee $e) => $this->loadEmployeeRelations($e))->values();

        return $this->success([
            'items' => $items,
            'stats' => $this->buildStats(),
        ], 'Empleados obtenidos');
    }

    public function show(string $id): JsonResponse
    {
        $employee = Employee::withTrashed()->findOrFail($id);

        return $this->success($this->loadEmployeeRelations($employee), 'Detalle de empleado');
    }

    public function store(Request $request): JsonResponse
    {
        $this->normalizeRequestPayload($request);

        $hasAccess = filter_var($request->input('has_system_access', false), FILTER_VALIDATE_BOOLEAN);

        $rules = [
            'person.first_name' => ['required', 'string', 'max:100'],
            'person.last_name' => ['required', 'string', 'max:100'],
            'person.document_type' => ['nullable', 'in:CI,DNI,NIT,PASSPORT,OTHER'],
            'person.document_number' => ['nullable', 'string', 'max:50'],
            'person.phone' => ['nullable', 'string', 'max:30'],
            'person.email' => ['nullable', 'string', 'max:150'],
            'person.birth_date' => ['nullable', 'date'],
            'person.gender' => ['nullable', 'in:female,male,non_binary,prefer_not_to_say'],

            'employee.employee_code' => ['nullable', 'string', 'max:30', 'unique:employees,employee_code'],
            'employee.job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
            'employee.hire_date' => ['required', 'date'],
            'employee.termination_date' => ['nullable', 'date', 'after_or_equal:employee.hire_date'],
            'employee.contract_type' => ['required', 'in:full_time,part_time,temporary,internship'],
            'employee.base_salary' => ['nullable', 'numeric', 'min:0'],
            'employee.commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'employee.employment_status' => ['nullable', 'in:active,on_leave,suspended,terminated'],
            'employee.notes' => ['nullable', 'string'],

            'branch_assignments' => ['required', 'array', 'min:1'],
            'branch_assignments.*.branch_id' => ['required', 'integer', 'exists:branches,id'],
            'branch_assignments.*.is_primary' => ['nullable', 'boolean'],
            'branch_assignments.*.role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'branch_assignments.*.assigned_from' => ['nullable', 'date'],
            'branch_assignments.*.assigned_until' => ['nullable', 'date'],

            'has_system_access' => ['boolean'],
        ];

        if ($hasAccess) {
            $rules = array_merge($rules, [
                'account.email' => ['required', 'string', 'max:150', 'unique:users,email'],
                'account.username' => ['nullable', 'string', 'max:80', 'unique:users,username'],
                'account.password' => ['required', 'string', 'min:4', 'max:100'],
                'account.status' => ['nullable', 'in:active,inactive,suspended,locked'],
                'system_role_id' => ['nullable', 'integer', 'exists:roles,id'],
            ]);
        }

        $validated = $request->validate($rules);

        $employee = DB::transaction(function () use ($validated, $hasAccess) {
            $personData = $validated['person'];
            $empData = $validated['employee'];
            $assignments = $validated['branch_assignments'];
            $primaryBranchId = $this->resolvePrimaryBranchId($assignments);

            $personEmail = $hasAccess
                ? $validated['account']['email']
                : ($personData['email'] ?? null);

            $person = Person::create([
                'first_name' => $personData['first_name'],
                'last_name' => $personData['last_name'],
                'document_type' => $personData['document_type'] ?? null,
                'document_number' => $personData['document_number'] ?? null,
                'phone' => $personData['phone'] ?? null,
                'email' => $personEmail,
                'birth_date' => $personData['birth_date'] ?? null,
                'gender' => $personData['gender'] ?? null,
            ]);

            $userId = null;
            if ($hasAccess) {
                $acc = $validated['account'];
                $user = User::create([
                    'person_id' => $person->id,
                    'username' => $acc['username'] ?? null,
                    'email' => $acc['email'],
                    'password_hash' => Hash::make($acc['password']),
                    'status' => $acc['status'] ?? 'active',
                    'email_verified_at' => now(),
                ]);

                UserProfile::create([
                    'user_id' => $user->id,
                    'display_name' => trim($person->first_name . ' ' . $person->last_name),
                ]);

                $this->syncUserRolesFromAssignments(
                    $user->id,
                    $validated['system_role_id'] ?? null,
                    $assignments
                );
                $userId = $user->id;
            }

            $empCode = !empty($empData['employee_code'])
                ? strtoupper($empData['employee_code'])
                : CodeGenerator::next('employees', 'E', 4, 'employee_code');

            $employee = Employee::create([
                'person_id' => $person->id,
                'user_id' => $userId,
                'job_position_id' => $empData['job_position_id'],
                'primary_branch_id' => $primaryBranchId,
                'employee_code' => $empCode,
                'hire_date' => $empData['hire_date'],
                'termination_date' => $empData['termination_date'] ?? null,
                'contract_type' => $empData['contract_type'],
                'base_salary' => $empData['base_salary'] ?? 0,
                'commission_rate' => $empData['commission_rate'] ?? 0,
                'employment_status' => $empData['employment_status'] ?? 'active',
                'notes' => $empData['notes'] ?? null,
            ]);

            $this->syncEmployeeBranches($employee->id, $primaryBranchId, $assignments);

            return $employee;
        });

        return $this->success([
            'employee' => $this->loadEmployeeRelations($employee),
            'stats' => $this->buildStats(),
        ], 'Empleado registrado correctamente', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);
        $this->normalizeRequestPayload($request);

        $hasAccess = filter_var($request->input('has_system_access', false), FILTER_VALIDATE_BOOLEAN);
        $existingUser = $employee->user_id ? User::withTrashed()->find($employee->user_id) : null;

        $rules = [
            'person.first_name' => ['required', 'string', 'max:100'],
            'person.last_name' => ['required', 'string', 'max:100'],
            'person.document_type' => ['nullable', 'in:CI,DNI,NIT,PASSPORT,OTHER'],
            'person.document_number' => ['nullable', 'string', 'max:50'],
            'person.phone' => ['nullable', 'string', 'max:30'],
            'person.email' => ['nullable', 'string', 'max:150'],
            'person.birth_date' => ['nullable', 'date'],
            'person.gender' => ['nullable', 'in:female,male,non_binary,prefer_not_to_say'],

            'employee.employee_code' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique('employees', 'employee_code')->ignore($employee->id),
            ],
            'employee.job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
            'employee.hire_date' => ['required', 'date'],
            'employee.termination_date' => ['nullable', 'date', 'after_or_equal:employee.hire_date'],
            'employee.contract_type' => ['required', 'in:full_time,part_time,temporary,internship'],
            'employee.base_salary' => ['nullable', 'numeric', 'min:0'],
            'employee.commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'employee.employment_status' => ['nullable', 'in:active,on_leave,suspended,terminated'],
            'employee.notes' => ['nullable', 'string'],

            'branch_assignments' => ['required', 'array', 'min:1'],
            'branch_assignments.*.branch_id' => ['required', 'integer', 'exists:branches,id'],
            'branch_assignments.*.is_primary' => ['nullable', 'boolean'],
            'branch_assignments.*.role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'branch_assignments.*.assigned_from' => ['nullable', 'date'],
            'branch_assignments.*.assigned_until' => ['nullable', 'date'],

            'has_system_access' => ['boolean'],
        ];

        if ($hasAccess) {
            $rules = array_merge($rules, [
                'account.email' => [
                    'required',
                    'string',
                    'max:150',
                    Rule::unique('users', 'email')->ignore($existingUser?->id),
                ],
                'account.username' => [
                    'nullable',
                    'string',
                    'max:80',
                    Rule::unique('users', 'username')->ignore($existingUser?->id),
                ],
                'account.password' => [
                    $existingUser ? 'nullable' : 'required',
                    'string',
                    'min:4',
                    'max:100',
                ],
                'account.status' => ['nullable', 'in:active,inactive,suspended,locked'],
                'system_role_id' => ['nullable', 'integer', 'exists:roles,id'],
            ]);
        }

        $validated = $request->validate($rules);

        DB::transaction(function () use ($employee, $validated, $hasAccess, $existingUser) {
            $person = Person::withTrashed()->findOrFail($employee->person_id);
            $personData = $validated['person'];
            $empData = $validated['employee'];
            $assignments = $validated['branch_assignments'];
            $primaryBranchId = $this->resolvePrimaryBranchId($assignments);

            $personEmail = $hasAccess
                ? $validated['account']['email']
                : ($personData['email'] ?? $person->email);

            $person->update([
                'first_name' => $personData['first_name'],
                'last_name' => $personData['last_name'],
                'document_type' => $personData['document_type'] ?? null,
                'document_number' => $personData['document_number'] ?? null,
                'phone' => $personData['phone'] ?? null,
                'email' => $personEmail,
                'birth_date' => $personData['birth_date'] ?? null,
                'gender' => $personData['gender'] ?? null,
            ]);

            $userId = $employee->user_id;
            if ($hasAccess) {
                $acc = $validated['account'];
                if ($existingUser) {
                    if ($existingUser->trashed()) {
                        $existingUser->restore();
                    }
                    $patch = [
                        'username' => $acc['username'] ?? null,
                        'email' => $acc['email'],
                        'status' => $acc['status'] ?? $existingUser->status,
                    ];
                    if (!empty($acc['password'])) {
                        $patch['password_hash'] = Hash::make($acc['password']);
                    }
                    $existingUser->update($patch);
                    $user = $existingUser;
                } else {
                    $user = User::create([
                        'person_id' => $person->id,
                        'username' => $acc['username'] ?? null,
                        'email' => $acc['email'],
                        'password_hash' => Hash::make($acc['password']),
                        'status' => $acc['status'] ?? 'active',
                        'email_verified_at' => now(),
                    ]);
                }

                UserProfile::updateOrCreate(
                    ['user_id' => $user->id],
                    ['display_name' => trim($person->first_name . ' ' . $person->last_name)]
                );

                $this->syncUserRolesFromAssignments(
                    $user->id,
                    $validated['system_role_id'] ?? null,
                    $assignments
                );
                $userId = $user->id;
            } elseif ($existingUser && !$this->isRootAdmin($existingUser)) {
                $existingUser->update(['status' => 'inactive']);
            }

            $empCode = !empty($empData['employee_code'])
                ? strtoupper($empData['employee_code'])
                : $employee->employee_code;

            $employee->update([
                'user_id' => $userId,
                'job_position_id' => $empData['job_position_id'],
                'primary_branch_id' => $primaryBranchId,
                'employee_code' => $empCode,
                'hire_date' => $empData['hire_date'],
                'termination_date' => $empData['termination_date'] ?? null,
                'contract_type' => $empData['contract_type'],
                'base_salary' => $empData['base_salary'] ?? 0,
                'commission_rate' => $empData['commission_rate'] ?? 0,
                'employment_status' => $empData['employment_status'] ?? $employee->employment_status,
                'notes' => $empData['notes'] ?? null,
            ]);

            $this->syncEmployeeBranches($employee->id, $primaryBranchId, $assignments);
        });

        return $this->success([
            'employee' => $this->loadEmployeeRelations($employee->fresh()),
            'stats' => $this->buildStats(),
        ], 'Empleado actualizado correctamente');
    }

    public function updateCommissionRate(Request $request, string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $employee->update(['commission_rate' => $validated['commission_rate']]);

        return $this->success([
            'employee' => $this->loadEmployeeRelations($employee->fresh()),
            'stats' => $this->buildStats(),
        ], 'Porcentaje de comisión actualizado');
    }

    public function destroy(string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $linkedUser = $employee->user_id ? User::withTrashed()->find($employee->user_id) : null;
        if ($linkedUser && $this->isRootAdmin($linkedUser)) {
            return $this->error('No se puede eliminar al empleado vinculado a la cuenta raíz del superadministrador.', 422);
        }

        DB::transaction(function () use ($employee, $linkedUser) {
            $employee->update(['employment_status' => 'terminated']);
            $employee->delete();

            if ($linkedUser && !$this->isRootAdmin($linkedUser)) {
                $linkedUser->update(['status' => 'inactive']);
            }
        });

        return $this->success([
            'id' => $employee->id,
            'stats' => $this->buildStats(),
        ], 'Empleado movido a la papelera');
    }

    public function restore(string $id): JsonResponse
    {
        $employee = Employee::onlyTrashed()->findOrFail($id);

        DB::transaction(function () use ($employee) {
            $person = Person::withTrashed()->find($employee->person_id);
            if ($person && $person->trashed()) {
                $person->restore();
            }

            $employee->restore();
            $employee->update(['employment_status' => 'active']);

            if ($employee->user_id) {
                $user = User::withTrashed()->find($employee->user_id);
                if ($user) {
                    if ($user->trashed()) {
                        $user->restore();
                    }
                    $user->update(['status' => 'active']);
                }
            }
        });

        return $this->success([
            'employee' => $this->loadEmployeeRelations($employee->fresh()),
            'stats' => $this->buildStats(),
        ], 'Empleado restaurado correctamente');
    }

    public function forceDestroy(string $id): JsonResponse
    {
        $employee = Employee::withTrashed()->findOrFail($id);

        $linkedUser = $employee->user_id ? User::withTrashed()->find($employee->user_id) : null;
        if ($linkedUser && $this->isRootAdmin($linkedUser)) {
            return $this->error('No se puede eliminar físicamente al empleado vinculado a la cuenta raíz del superadministrador.', 422);
        }

        try {
            DB::transaction(function () use ($employee) {
                $employee->forceDelete();
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23503') {
                return $this->error(
                    'No se puede eliminar físicamente este empleado porque tiene ventas, sesiones de caja, apartados o comisiones históricas registradas. Usa la eliminación lógica.',
                    409
                );
            }
            throw $e;
        }

        return $this->success([
            'id' => (int) $id,
            'stats' => $this->buildStats(),
        ], 'Empleado eliminado definitivamente');
    }

    private function isRootAdmin(User $user): bool
    {
        return $user->username === 'admin' || $user->email === 'admin';
    }

    private function loadEmployeeRelations(Employee $employee): Employee
    {
        $employee->load([
            'person' => fn ($q) => $q->withTrashed(),
            'job_position:id,code,name,base_salary_ref',
            'branch:id,code,name',
            'employee_branches.branch:id,code,name',
            'user' => fn ($q) => $q->withTrashed()->with([
                'user_roles.role:id,code,name',
                'user_roles.branch:id,code,name',
            ]),
        ])->loadCount('employee_shifts');

        $allUserRoles = $employee->user?->user_roles ?? collect();

        $employee->setAttribute(
            'system_roles',
            $allUserRoles->filter(fn ($ur) => $ur->branch_id === null)->values()
        );
        $employee->setAttribute(
            'branch_roles',
            $allUserRoles->filter(fn ($ur) => $ur->branch_id !== null)->values()
        );
        $employee->setAttribute('is_deleted', $employee->trashed());

        return $employee;
    }

    private function buildStats(): array
    {
        $today = now()->toDateString();

        return [
            'total_active' => Employee::where('employment_status', 'active')->count(),
            'shifts_today' => EmployeeShift::whereDate('shift_date', $today)->count(),
            'avg_commission_rate' => round((float) (Employee::avg('commission_rate') ?? 0), 2),
            'pending_commissions_total' => round(
                (float) EmployeeCommission::whereIn('status', ['pending', 'approved'])->sum('commission_amount'),
                2
            ),
            'trashed_count' => Employee::onlyTrashed()->count(),
        ];
    }

    private function resolvePrimaryBranchId(array $assignments): int
    {
        foreach ($assignments as $a) {
            if (!empty($a['is_primary'])) {
                return (int) $a['branch_id'];
            }
        }
        return (int) $assignments[0]['branch_id'];
    }

    private function syncEmployeeBranches(int $employeeId, int $primaryBranchId, array $assignments): void
    {
        EmployeeBranch::where('employee_id', $employeeId)->delete();

        $seen = [];
        foreach ($assignments as $a) {
            $branchId = (int) $a['branch_id'];
            if (isset($seen[$branchId])) {
                continue;
            }
            $seen[$branchId] = true;

            EmployeeBranch::create([
                'employee_id' => $employeeId,
                'branch_id' => $branchId,
                'is_primary' => $branchId === $primaryBranchId,
                'assigned_from' => !empty($a['assigned_from']) ? $a['assigned_from'] : now()->toDateString(),
                'assigned_until' => !empty($a['assigned_until']) ? $a['assigned_until'] : null,
            ]);
        }
    }

    private function syncUserRolesFromAssignments(int $userId, mixed $systemRoleId, array $assignments): void
    {
        UserRole::where('user_id', $userId)->delete();

        $seen = [];
        if (!empty($systemRoleId)) {
            $rId = (int) $systemRoleId;
            $seen[$rId . ':global'] = true;
            UserRole::create([
                'user_id' => $userId,
                'role_id' => $rId,
                'branch_id' => null,
                'assigned_at' => now(),
            ]);
        }

        foreach ($assignments as $a) {
            if (empty($a['role_id'])) {
                continue;
            }
            $rId = (int) $a['role_id'];
            $bId = (int) $a['branch_id'];
            $key = $rId . ':' . $bId;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            UserRole::create([
                'user_id' => $userId,
                'role_id' => $rId,
                'branch_id' => $bId,
                'assigned_at' => now(),
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
                'email',
                'birth_date',
                'gender',
            ]);
        }

        if (isset($payload['employee']) && is_array($payload['employee'])) {
            $payload['employee'] = $this->normalizeEmptyToNull($payload['employee'], [
                'employee_code',
                'termination_date',
                'base_salary',
                'commission_rate',
                'notes',
            ]);
        }

        if (isset($payload['account']) && is_array($payload['account'])) {
            $payload['account'] = $this->normalizeEmptyToNull($payload['account'], [
                'username',
                'password',
                'status',
            ]);
        }

        if (array_key_exists('system_role_id', $payload) && $payload['system_role_id'] === '') {
            $payload['system_role_id'] = null;
        }

        if (isset($payload['branch_assignments']) && is_array($payload['branch_assignments'])) {
            foreach ($payload['branch_assignments'] as $idx => $a) {
                if (is_array($a)) {
                    $payload['branch_assignments'][$idx] = $this->normalizeEmptyToNull($a, [
                        'role_id',
                        'assigned_from',
                        'assigned_until',
                    ]);
                }
            }
        }

        $request->replace($payload);
    }
}
