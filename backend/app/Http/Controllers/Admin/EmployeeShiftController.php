<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmployeeShift;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeShiftController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = EmployeeShift::with([
            'employee.person:id,first_name,last_name',
            'employee.job_position:id,name',
            'branch:id,code,name',
        ]);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->query('employee_id'));
        }

        if ($request->filled('branch_id')) {
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('shift_date', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('shift_date', '<=', $request->query('date_to'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $shifts = $query->orderByDesc('shift_date')->orderBy('starts_at')->get();

        $stats = [
            'total' => $shifts->count(),
            'scheduled' => $shifts->where('status', 'scheduled')->count(),
            'completed' => $shifts->where('status', 'completed')->count(),
            'late' => $shifts->where('status', 'late')->count(),
            'absent' => $shifts->where('status', 'absent')->count(),
        ];

        return $this->success([
            'items' => $shifts,
            'stats' => $stats,
        ], 'Turnos obtenidos');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'shift_date' => ['required', 'date'],
            'starts_at' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'ends_at' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'status' => ['nullable', 'in:scheduled,completed,absent,late,cancelled'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $shift = EmployeeShift::create([
            'employee_id' => $validated['employee_id'],
            'branch_id' => $validated['branch_id'],
            'shift_date' => $validated['shift_date'],
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'status' => $validated['status'] ?? 'scheduled',
            'notes' => $validated['notes'] ?? null,
        ]);

        return $this->success([
            'shift' => $shift->load([
                'employee.person:id,first_name,last_name',
                'employee.job_position:id,name',
                'branch:id,code,name',
            ]),
        ], 'Turno creado', 201);
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'dates' => ['required', 'array', 'min:1'],
            'dates.*' => ['required', 'date'],
            'starts_at' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'ends_at' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $created = DB::transaction(function () use ($validated) {
            $items = [];
            foreach (array_unique($validated['dates']) as $date) {
                $shift = EmployeeShift::create([
                    'employee_id' => $validated['employee_id'],
                    'branch_id' => $validated['branch_id'],
                    'shift_date' => $date,
                    'starts_at' => $validated['starts_at'],
                    'ends_at' => $validated['ends_at'],
                    'status' => 'scheduled',
                    'notes' => $validated['notes'] ?? null,
                ]);
                $items[] = $shift->load([
                    'employee.person:id,first_name,last_name',
                    'employee.job_position:id,name',
                    'branch:id,code,name',
                ]);
            }
            return $items;
        });

        return $this->success(['items' => $created], 'Horarios semanales generados', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $shift = EmployeeShift::findOrFail($id);

        $validated = $request->validate([
            'employee_id' => ['sometimes', 'required', 'integer', 'exists:employees,id'],
            'branch_id' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
            'shift_date' => ['sometimes', 'required', 'date'],
            'starts_at' => ['sometimes', 'required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'ends_at' => ['sometimes', 'required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'status' => ['sometimes', 'required', 'in:scheduled,completed,absent,late,cancelled'],
            'actual_check_in' => ['nullable', 'date'],
            'actual_check_out' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $shift->update($validated);

        return $this->success([
            'shift' => $shift->fresh()->load([
                'employee.person:id,first_name,last_name',
                'employee.job_position:id,name',
                'branch:id,code,name',
            ]),
        ], 'Turno actualizado');
    }

    public function checkIn(string $id): JsonResponse
    {
        $shift = EmployeeShift::findOrFail($id);
        $now = now();
        $isToday = $shift->shift_date->toDateString() === $now->toDateString();
        $isLate = $isToday && $now->format('H:i:s') > $shift->starts_at;

        $shift->update([
            'actual_check_in' => $now,
            'status' => $isLate ? 'late' : 'scheduled',
        ]);

        return $this->success([
            'shift' => $shift->fresh()->load([
                'employee.person:id,first_name,last_name',
                'employee.job_position:id,name',
                'branch:id,code,name',
            ]),
        ], 'Entrada registrada');
    }

    public function checkOut(string $id): JsonResponse
    {
        $shift = EmployeeShift::findOrFail($id);

        $shift->update([
            'actual_check_out' => now(),
            'status' => 'completed',
        ]);

        return $this->success([
            'shift' => $shift->fresh()->load([
                'employee.person:id,first_name,last_name',
                'employee.job_position:id,name',
                'branch:id,code,name',
            ]),
        ], 'Salida registrada');
    }

    public function destroy(string $id): JsonResponse
    {
        EmployeeShift::findOrFail($id)->delete();

        return $this->success(['id' => (int) $id], 'Turno eliminado');
    }
}
