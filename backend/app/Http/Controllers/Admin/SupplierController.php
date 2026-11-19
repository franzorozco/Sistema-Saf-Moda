<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use App\Models\PurchasePriceHistory;
use App\Models\Supplier;
use App\Services\Storage\ImageStorageService;
use App\Support\CodeGenerator;
use App\Support\StoragePath;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly ImageStorageService $storageService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'active');
        $search = trim((string) $request->query('search', ''));
        $isActive = $request->query('is_active');

        $query = Supplier::query();

        if ($scope === 'trashed') {
            $query->onlyTrashed();
        }

        if ($isActive !== null && $isActive !== '') {
            $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('code', 'ilike', $like)
                    ->orWhere('business_name', 'ilike', $like)
                    ->orWhere('contact_name', 'ilike', $like)
                    ->orWhere('tax_id', 'ilike', $like)
                    ->orWhere('phone', 'ilike', $like)
                    ->orWhere('whatsapp', 'ilike', $like)
                    ->orWhere('city', 'ilike', $like);
            });
        }

        $suppliers = $query->orderByDesc('id')->get();

        $poStats = PurchaseOrder::query()
            ->where('status', '!=', 'cancelled')
            ->selectRaw('supplier_id, COUNT(*) as orders_count, COALESCE(SUM(total_amount), 0) as total_purchased, MAX(order_date) as last_order_date')
            ->groupBy('supplier_id')
            ->get()
            ->keyBy('supplier_id');

        $items = $suppliers->map(function (Supplier $s) use ($poStats) {
            $st = $poStats->get($s->id);
            return [
                'id' => $s->id,
                'code' => $s->code,
                'business_name' => $s->business_name,
                'contact_name' => $s->contact_name,
                'tax_id' => $s->tax_id,
                'phone' => $s->phone,
                'whatsapp' => $s->whatsapp,
                'secondary_phone' => $s->secondary_phone,
                'email' => $s->email,
                'address' => $s->address,
                'city' => $s->city,
                'country' => $s->country,
                'payment_terms' => $s->payment_terms,
                'photo_url' => $s->photo_url,
                'notes' => $s->notes,
                'is_active' => (bool) $s->is_active,
                'created_at' => $s->created_at?->toISOString(),
                'deleted_at' => $s->deleted_at,
                'orders_count' => (int) ($st?->orders_count ?? 0),
                'total_purchased' => round((float) ($st?->total_purchased ?? 0), 2),
                'last_order_date' => $st?->last_order_date,
            ];
        })->values();

        return $this->success([
            'items' => $items,
            'stats' => [
                'total_active' => Supplier::where('is_active', true)->count(),
                'with_whatsapp' => Supplier::whereNotNull('whatsapp')->where('whatsapp', '!=', '')->count(),
                'total_orders' => PurchaseOrder::where('status', '!=', 'cancelled')->count(),
                'trashed_count' => Supplier::onlyTrashed()->count(),
            ],
        ], 'Proveedores obtenidos');
    }

    public function show(string $id): JsonResponse
    {
        $supplier = Supplier::withTrashed()->findOrFail($id);

        $orders = PurchaseOrder::with('warehouse.branch:id,code,name')
            ->withCount('purchase_order_items')
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->limit(30)
            ->get()
            ->map(fn (PurchaseOrder $po) => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'invoice_number' => $po->invoice_number,
                'status' => $po->status,
                'payment_status' => $po->payment_status,
                'order_date' => $po->order_date?->format('Y-m-d'),
                'total_amount' => round((float) $po->total_amount, 2),
                'amount_paid' => round((float) $po->amount_paid, 2),
                'items_count' => (int) $po->purchase_order_items_count,
                'branch_name' => $po->warehouse?->branch?->name,
                'warehouse_name' => $po->warehouse?->name,
            ]);

        $priceHistory = PurchasePriceHistory::with('purchase_order:id,po_number')
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->limit(60)
            ->get()
            ->map(fn (PurchasePriceHistory $h) => [
                'id' => $h->id,
                'item_key' => $h->item_key,
                'item_name' => $h->item_name,
                'item_sku' => $h->item_sku,
                'variant_id' => $h->variant_id,
                'unit_cost' => round((float) $h->unit_cost, 2),
                'previous_unit_cost' => $h->previous_unit_cost !== null ? round((float) $h->previous_unit_cost, 2) : null,
                'price_diff' => $h->price_diff !== null ? round((float) $h->price_diff, 2) : null,
                'price_diff_pct' => $h->price_diff_pct !== null ? round((float) $h->price_diff_pct, 2) : null,
                'quantity' => (int) $h->quantity,
                'recorded_at' => $h->recorded_at?->format('Y-m-d'),
                'po_number' => $h->purchase_order?->po_number,
                'photo_url' => $h->photo_url,
                'notes' => $h->notes,
            ]);

        return $this->success([
            'supplier' => [
                'id' => $supplier->id,
                'code' => $supplier->code,
                'business_name' => $supplier->business_name,
                'contact_name' => $supplier->contact_name,
                'tax_id' => $supplier->tax_id,
                'phone' => $supplier->phone,
                'whatsapp' => $supplier->whatsapp,
                'secondary_phone' => $supplier->secondary_phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'city' => $supplier->city,
                'country' => $supplier->country,
                'payment_terms' => $supplier->payment_terms,
                'photo_url' => $supplier->photo_url,
                'notes' => $supplier->notes,
                'is_active' => (bool) $supplier->is_active,
                'created_at' => $supplier->created_at?->toISOString(),
            ],
            'orders' => $orders,
            'price_histories' => $priceHistory,
            'summary' => [
                'orders_count' => $orders->where('status', '!=', 'cancelled')->count(),
                'total_purchased' => round((float) $orders->where('status', '!=', 'cancelled')->sum('total_amount'), 2),
                'pending_balance' => round((float) $orders->where('status', '!=', 'cancelled')->sum(fn ($o) => max(0, $o['total_amount'] - $o['amount_paid'])), 2),
            ],
        ], 'Detalle del proveedor obtenido');
    }

    public function store(Request $request): JsonResponse
    {
        $this->normalizeInputs($request);

        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:30', 'unique:suppliers,code'],
            'business_name' => ['required', 'string', 'max:180'],
            'contact_name' => ['nullable', 'string', 'max:150'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:30'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'secondary_phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'payment_terms' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $code = !empty($validated['code'])
            ? strtoupper(trim($validated['code']))
            : CodeGenerator::next('suppliers', 'PRV-', 4, 'code');

        $photoFilename = null;
        if ($request->hasFile('photo')) {
            $photoFilename = $this->storageService->uploadFile(
                $request->file('photo'),
                StoragePath::directory(StoragePath::SUPPLIERS)
            );
        }

        $supplier = DB::transaction(function () use ($validated, $code, $photoFilename, $request) {
            $supplier = Supplier::create([
                'code' => $code,
                'business_name' => trim($validated['business_name']),
                'contact_name' => $validated['contact_name'] ?? null,
                'tax_id' => $validated['tax_id'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'whatsapp' => $validated['whatsapp'] ?? null,
                'secondary_phone' => $validated['secondary_phone'] ?? null,
                'email' => $validated['email'] ?? null,
                'address' => $validated['address'] ?? null,
                'city' => $validated['city'] ?? null,
                'country' => $validated['country'] ?? 'Bolivia',
                'payment_terms' => $validated['payment_terms'] ?? null,
                'photo_url' => $photoFilename,
                'notes' => $validated['notes'] ?? null,
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'entity_table' => 'suppliers',
                'entity_id' => $supplier->id,
                'action' => 'INSERT',
                'old_values' => null,
                'new_values' => $supplier->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $supplier;
        });

        return $this->success($supplier, 'Proveedor registrado correctamente', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::withTrashed()->findOrFail($id);
        $this->normalizeInputs($request);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('suppliers', 'code')->ignore($supplier->id)],
            'business_name' => ['sometimes', 'required', 'string', 'max:180'],
            'contact_name' => ['nullable', 'string', 'max:150'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:30'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'secondary_phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'payment_terms' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'remove_photo' => ['nullable', 'boolean'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $newPhotoFilename = $supplier->getRawPhotoFilename();
        $oldPhotoFilename = $supplier->getRawPhotoFilename();

        if (!empty($validated['remove_photo']) && $oldPhotoFilename) {
            $this->storageService->deleteFile(StoragePath::directory(StoragePath::SUPPLIERS), $oldPhotoFilename);
            $newPhotoFilename = null;
        }

        if ($request->hasFile('photo')) {
            if ($oldPhotoFilename) {
                $this->storageService->deleteFile(StoragePath::directory(StoragePath::SUPPLIERS), $oldPhotoFilename);
            }
            $newPhotoFilename = $this->storageService->uploadFile(
                $request->file('photo'),
                StoragePath::directory(StoragePath::SUPPLIERS)
            );
        }

        $updated = DB::transaction(function () use ($supplier, $validated, $newPhotoFilename, $request) {
            $old = $supplier->toArray();

            $supplier->fill([
                'code' => isset($validated['code']) ? strtoupper(trim($validated['code'])) : $supplier->code,
                'business_name' => isset($validated['business_name']) ? trim($validated['business_name']) : $supplier->business_name,
                'contact_name' => array_key_exists('contact_name', $validated) ? $validated['contact_name'] : $supplier->contact_name,
                'tax_id' => array_key_exists('tax_id', $validated) ? $validated['tax_id'] : $supplier->tax_id,
                'phone' => array_key_exists('phone', $validated) ? $validated['phone'] : $supplier->phone,
                'whatsapp' => array_key_exists('whatsapp', $validated) ? $validated['whatsapp'] : $supplier->whatsapp,
                'secondary_phone' => array_key_exists('secondary_phone', $validated) ? $validated['secondary_phone'] : $supplier->secondary_phone,
                'email' => array_key_exists('email', $validated) ? $validated['email'] : $supplier->email,
                'address' => array_key_exists('address', $validated) ? $validated['address'] : $supplier->address,
                'city' => array_key_exists('city', $validated) ? $validated['city'] : $supplier->city,
                'country' => array_key_exists('country', $validated) ? ($validated['country'] ?: 'Bolivia') : $supplier->country,
                'payment_terms' => array_key_exists('payment_terms', $validated) ? $validated['payment_terms'] : $supplier->payment_terms,
                'notes' => array_key_exists('notes', $validated) ? $validated['notes'] : $supplier->notes,
                'photo_url' => $newPhotoFilename,
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $supplier->is_active,
            ]);
            $supplier->save();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'entity_table' => 'suppliers',
                'entity_id' => $supplier->id,
                'action' => 'UPDATE',
                'old_values' => $old,
                'new_values' => $supplier->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
            ]);

            return $supplier->fresh();
        });

        return $this->success($updated, 'Proveedor actualizado correctamente');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'entity_table' => 'suppliers',
            'entity_id' => $supplier->id,
            'action' => 'DELETE',
            'old_values' => ['deleted_at' => null],
            'new_values' => ['deleted_at' => now()->toISOString()],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
        ]);

        return $this->success(null, 'Proveedor enviado a papelera');
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::onlyTrashed()->findOrFail($id);
        $supplier->restore();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'entity_table' => 'suppliers',
            'entity_id' => $supplier->id,
            'action' => 'UPDATE',
            'old_values' => ['deleted_at' => 'trashed'],
            'new_values' => ['deleted_at' => null],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ? substr($request->userAgent(), 0, 300) : null,
        ]);

        return $this->success($supplier->fresh(), 'Proveedor restaurado');
    }

    public function forceDestroy(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::withTrashed()->findOrFail($id);

        if (PurchaseOrder::where('supplier_id', $supplier->id)->exists()) {
            return $this->error(
                'No se puede eliminar definitivamente porque el proveedor tiene órdenes de compra registradas.',
                422
            );
        }

        if ($rawPhoto = $supplier->getRawPhotoFilename()) {
            $this->storageService->deleteFile(StoragePath::directory(StoragePath::SUPPLIERS), $rawPhoto);
        }

        DB::table('purchase_price_histories')->where('supplier_id', $supplier->id)->delete();
        $supplier->forceDelete();

        return $this->success(null, 'Proveedor eliminado definitivamente');
    }

    private function normalizeInputs(Request $request): void
    {
        $data = $request->all();

        $nullableFields = [
            'code', 'contact_name', 'tax_id', 'phone', 'whatsapp',
            'secondary_phone', 'email', 'address', 'city', 'country',
            'payment_terms', 'notes',
        ];

        foreach ($nullableFields as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field])) {
                $trimmed = trim($data[$field]);
                $data[$field] = $trimmed === '' ? null : $trimmed;
            }
        }

        foreach (['is_active', 'remove_photo'] as $boolField) {
            if (array_key_exists($boolField, $data) && !is_bool($data[$boolField])) {
                $parsed = filter_var($data[$boolField], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($parsed !== null) {
                    $data[$boolField] = $parsed;
                }
            }
        }

        $request->replace($data);
    }
}
