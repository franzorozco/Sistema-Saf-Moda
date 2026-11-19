<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmployeeCommission;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeCommissionController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = EmployeeCommission::with([
            'employee.person:id,first_name,last_name',
            'employee.branch:id,code,name',
            'sale:id,sale_number,total_amount,sold_at',
        ]);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->query('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $items = $query->orderByDesc('created_at')->get();

        return $this->success([
            'items' => $items,
            'stats' => $this->buildStats(),
        ], 'Comisiones obtenidas');
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $commission = EmployeeCommission::findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', 'in:pending,approved,paid,cancelled'],
        ]);

        $commission->update([
            'status' => $validated['status'],
            'paid_at' => $validated['status'] === 'paid' ? now() : null,
        ]);

        return $this->success([
            'commission' => $commission->fresh()->load([
                'employee.person:id,first_name,last_name',
                'employee.branch:id,code,name',
                'sale:id,sale_number,total_amount,sold_at',
            ]),
            'stats' => $this->buildStats(),
        ], 'Estado de comisión actualizado');
    }

    private function buildStats(): array
    {
        return [
            'pending_total' => round((float) EmployeeCommission::where('status', 'pending')->sum('commission_amount'), 2),
            'approved_total' => round((float) EmployeeCommission::where('status', 'approved')->sum('commission_amount'), 2),
            'paid_total' => round((float) EmployeeCommission::where('status', 'paid')->sum('commission_amount'), 2),
            'pending_count' => EmployeeCommission::where('status', 'pending')->count(),
        ];
    }
}
