<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\GiftCard;
use App\Models\Layaway;
use App\Models\LoyaltyTransaction;
use App\Models\Person;
use App\Models\Sale;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\CodeGenerator;
use App\Traits\ApiResponse;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    use ApiResponse;

    public function meta(): JsonResponse
    {
        return $this->success([
            'branches' => Branch::where('is_active', true)
                ->orderByDesc('is_main')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'is_main']),
        ], 'Metadatos de clientes obtenidos');
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'active');
        $tier = $request->query('tier');
        $branchId = $request->query('branch_id');
        $isActive = $request->query('is_active');
        $search = trim((string) $request->query('search', ''));

        $query = Customer::query();

        if ($scope === 'trashed') {
            $query->onlyTrashed();
        }

        if ($tier !== null && $tier !== '') {
            $query->where('customer_tier', $tier);
        }

        if ($branchId !== null && $branchId !== '') {
            $query->where('acquired_branch_id', (int) $branchId);
        }

        if ($isActive !== null && $isActive !== '') {
            $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
        }

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('customer_code', 'ilike', $like)
                    ->orWhereHas('person', function ($pq) use ($like) {
                        $pq->withTrashed()
                            ->where('first_name', 'ilike', $like)
                            ->orWhere('last_name', 'ilike', $like)
                            ->orWhere('document_number', 'ilike', $like)
                            ->orWhere('phone', 'ilike', $like)
                            ->orWhere('email', 'ilike', $like);
                    })
                    ->orWhereHas('user', function ($uq) use ($like) {
                        $uq->withTrashed()->where('email', 'ilike', $like);
                    });
            });
        }

        $customers = $query->orderByDesc('id')->get();
        $items = $customers->map(fn (Customer $c) => $this->loadCustomerSummary($c))->values();

        return $this->success([
            'items' => $items,
            'stats' => $this->buildStats(),
        ], 'Clientes obtenidos');
    }

    public function show(string $id): JsonResponse
    {
        $customer = Customer::withTrashed()->findOrFail($id);

        $customer->load([
            'person' => fn ($q) => $q->withTrashed(),
            'branch:id,code,name',
            'user' => fn ($q) => $q->withTrashed(),
            'customer_addresses' => fn ($q) => $q->orderByDesc('is_default')->orderByDesc('id'),
        ]);
        $customer->setAttribute('is_deleted', $customer->trashed());

        $sales = Sale::where('customer_id', $customer->id)
            ->with([
                'branch:id,code,name',
                'employee.person:id,first_name,last_name',
                'sale_items.product_variant.product:id,name,sku_prefix',
                'sale_payments.payment_method:id,name',
            ])
            ->orderByDesc('sold_at')
            ->limit(50)
            ->get();

        $layaways = Layaway::where('customer_id', $customer->id)
            ->with([
                'branch:id,code,name',
                'layaway_items.product_variant.product:id,name',
            ])
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        $loyaltyTransactions = LoyaltyTransaction::where('customer_id', $customer->id)
            ->with('sale:id,sale_number')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $giftCards = GiftCard::where('customer_id', $customer->id)
            ->orderByDesc('created_at')
            ->get();

        $activityLogs = AuditLog::where(function ($q) use ($customer) {
            $q->where(fn ($sub) => $sub->where('entity_table', 'customers')->where('entity_id', $customer->id));
            if ($customer->user_id) {
                $q->orWhere('user_id', $customer->user_id);
            }
        })
            ->with([
                'user.person:id,first_name,last_name',
                'branch:id,code,name',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(60)
            ->get();

        $completedSales = $sales->where('status', '!=', 'voided');
        $totalSpent = round((float) $completedSales->sum('total_amount'), 2);
        $totalPurchasesCount = $completedSales->count();

        $summary = [
            'total_purchases_count' => $totalPurchasesCount,
            'total_spent' => $totalSpent,
            'average_ticket' => $totalPurchasesCount > 0 ? round($totalSpent / $totalPurchasesCount, 2) : 0,
            'active_layaways_count' => $layaways->where('status', 'active')->count(),
            'gift_cards_balance' => round((float) $giftCards->where('status', 'active')->sum('current_balance'), 2),
            'loyalty_points' => (int) $customer->loyalty_points,
            'store_credit' => round((float) $customer->store_credit, 2),
            'last_purchase_at' => $completedSales->first()?->sold_at,
        ];

        return $this->success([
            'customer' => $customer,
            'summary' => $summary,
            'sales' => $sales,
            'layaways' => $layaways,
            'loyalty_transactions' => $loyaltyTransactions,
            'gift_cards' => $giftCards,
            'activity_logs' => $activityLogs,
        ], 'Detalle de cliente obtenido');
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

            'customer.customer_code' => ['nullable', 'string', 'max:30', 'unique:customers,customer_code'],
            'customer.customer_tier' => ['required', 'in:regular,silver,gold,vip,wholesale'],
            'customer.loyalty_points' => ['nullable', 'integer', 'min:0'],
            'customer.store_credit' => ['nullable', 'numeric', 'min:0'],
            'customer.accepts_marketing' => ['nullable', 'boolean'],
            'customer.acquired_branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'customer.notes' => ['nullable', 'string'],
            'customer.is_active' => ['nullable', 'boolean'],

            'has_system_access' => ['boolean'],

            'address' => ['nullable', 'array'],
            'address.label' => ['nullable', 'string', 'max:60'],
            'address.city' => ['nullable', 'string', 'max:100'],
            'address.address_line1' => ['nullable', 'string', 'max:255'],
            'address.address_line2' => ['nullable', 'string', 'max:255'],
            'address.reference_notes' => ['nullable', 'string', 'max:255'],
            'address.phone' => ['nullable', 'string', 'max:30'],
        ];

        if ($hasAccess) {
            $rules = array_merge($rules, [
                'account.email' => ['required', 'string', 'max:150', 'unique:users,email'],
                'account.username' => ['nullable', 'string', 'max:80', 'unique:users,username'],
                'account.password' => ['required', 'string', 'min:4', 'max:100'],
            ]);
        }

        $validated = $request->validate($rules);

        $customer = DB::transaction(function () use ($request, $validated, $hasAccess) {
            $personData = $validated['person'];
            $custData = $validated['customer'];

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
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]);

                UserProfile::create([
                    'user_id' => $user->id,
                    'display_name' => trim($person->first_name . ' ' . $person->last_name),
                ]);

                $userId = $user->id;
            }

            $custCode = !empty($custData['customer_code'])
                ? strtoupper($custData['customer_code'])
                : CodeGenerator::next('customers', 'CL', 4, 'customer_code');

            $initialPoints = (int) ($custData['loyalty_points'] ?? 0);

            $customer = Customer::create([
                'person_id' => $person->id,
                'user_id' => $userId,
                'customer_code' => $custCode,
                'customer_tier' => $custData['customer_tier'],
                'loyalty_points' => $initialPoints,
                'store_credit' => $custData['store_credit'] ?? 0,
                'accepts_marketing' => (bool) ($custData['accepts_marketing'] ?? false),
                'acquired_branch_id' => $custData['acquired_branch_id'] ?? null,
                'notes' => $custData['notes'] ?? null,
                'is_active' => $custData['is_active'] ?? true,
            ]);

            $addr = $validated['address'] ?? null;
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

            if ($initialPoints > 0) {
                LoyaltyTransaction::create([
                    'customer_id' => $customer->id,
                    'points_delta' => $initialPoints,
                    'balance_after' => $initialPoints,
                    'reason' => 'Saldo inicial al registrar cliente',
                ]);
            }

            $this->recordAudit($request, $customer, 'INSERT', null, [
                'customer_code' => $customer->customer_code,
                'customer_tier' => $customer->customer_tier,
                'loyalty_points' => $customer->loyalty_points,
                'store_credit' => $customer->store_credit,
            ]);

            return $customer;
        });

        return $this->success([
            'customer' => $this->loadCustomerSummary($customer),
            'stats' => $this->buildStats(),
        ], 'Cliente registrado correctamente', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);
        $this->normalizeRequestPayload($request);

        $hasAccess = filter_var($request->input('has_system_access', false), FILTER_VALIDATE_BOOLEAN);
        $existingUser = $customer->user_id ? User::withTrashed()->find($customer->user_id) : null;

        $rules = [
            'person.first_name' => ['required', 'string', 'max:100'],
            'person.last_name' => ['required', 'string', 'max:100'],
            'person.document_type' => ['nullable', 'in:CI,DNI,NIT,PASSPORT,OTHER'],
            'person.document_number' => ['nullable', 'string', 'max:50'],
            'person.phone' => ['nullable', 'string', 'max:30'],
            'person.email' => ['nullable', 'string', 'max:150'],
            'person.birth_date' => ['nullable', 'date'],
            'person.gender' => ['nullable', 'in:female,male,non_binary,prefer_not_to_say'],

            'customer.customer_code' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique('customers', 'customer_code')->ignore($customer->id),
            ],
            'customer.customer_tier' => ['required', 'in:regular,silver,gold,vip,wholesale'],
            'customer.store_credit' => ['nullable', 'numeric', 'min:0'],
            'customer.accepts_marketing' => ['nullable', 'boolean'],
            'customer.acquired_branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'customer.notes' => ['nullable', 'string'],
            'customer.is_active' => ['nullable', 'boolean'],

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
            ]);
        }

        $validated = $request->validate($rules);

        DB::transaction(function () use ($request, $customer, $validated, $hasAccess, $existingUser) {
            $oldSnapshot = [
                'customer_tier' => $customer->customer_tier,
                'store_credit' => $customer->store_credit,
                'is_active' => $customer->is_active,
                'accepts_marketing' => $customer->accepts_marketing,
            ];

            $person = Person::withTrashed()->findOrFail($customer->person_id);
            $personData = $validated['person'];
            $custData = $validated['customer'];

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

            $userId = $customer->user_id;
            if ($hasAccess) {
                $acc = $validated['account'];
                if ($existingUser) {
                    if ($existingUser->trashed()) {
                        $existingUser->restore();
                    }
                    $patch = [
                        'username' => $acc['username'] ?? null,
                        'email' => $acc['email'],
                        'status' => 'active',
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
                        'status' => 'active',
                        'email_verified_at' => now(),
                    ]);
                }

                UserProfile::updateOrCreate(
                    ['user_id' => $user->id],
                    ['display_name' => trim($person->first_name . ' ' . $person->last_name)]
                );
                $userId = $user->id;
            } elseif ($existingUser && !$this->isRootAdmin($existingUser)) {
                $existingUser->update(['status' => 'inactive']);
            }

            $custCode = !empty($custData['customer_code'])
                ? strtoupper($custData['customer_code'])
                : $customer->customer_code;

            $customer->update([
                'user_id' => $userId,
                'customer_code' => $custCode,
                'customer_tier' => $custData['customer_tier'],
                'store_credit' => $custData['store_credit'] ?? $customer->store_credit,
                'accepts_marketing' => (bool) ($custData['accepts_marketing'] ?? false),
                'acquired_branch_id' => $custData['acquired_branch_id'] ?? null,
                'notes' => $custData['notes'] ?? null,
                'is_active' => $custData['is_active'] ?? $customer->is_active,
            ]);

            $this->recordAudit($request, $customer, 'UPDATE', $oldSnapshot, [
                'customer_tier' => $customer->customer_tier,
                'store_credit' => $customer->store_credit,
                'is_active' => $customer->is_active,
                'accepts_marketing' => $customer->accepts_marketing,
            ]);
        });

        return $this->success([
            'customer' => $this->loadCustomerSummary($customer->fresh()),
            'stats' => $this->buildStats(),
        ], 'Cliente actualizado correctamente');
    }

    public function adjustLoyalty(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'points_delta' => ['required', 'integer', 'not_in:0'],
            'reason' => ['required', 'string', 'max:150'],
        ]);

        $newBalance = $customer->loyalty_points + (int) $validated['points_delta'];
        if ($newBalance < 0) {
            return $this->error('Puntos insuficientes para realizar el descuento solicitado.', 422);
        }

        $tx = DB::transaction(function () use ($request, $customer, $validated, $newBalance) {
            $oldPoints = $customer->loyalty_points;
            $customer->update(['loyalty_points' => $newBalance]);

            $tx = LoyaltyTransaction::create([
                'customer_id' => $customer->id,
                'points_delta' => (int) $validated['points_delta'],
                'balance_after' => $newBalance,
                'reason' => $validated['reason'],
            ]);

            $this->recordAudit(
                $request,
                $customer,
                'UPDATE',
                ['loyalty_points' => $oldPoints],
                ['loyalty_points' => $newBalance, 'reason' => $validated['reason']]
            );

            return $tx;
        });

        return $this->success([
            'customer' => $this->loadCustomerSummary($customer->fresh()),
            'transaction' => $tx,
            'stats' => $this->buildStats(),
        ], 'Puntos de fidelidad actualizados');
    }

    public function adjustStoreCredit(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'amount_delta' => ['required', 'numeric', 'not_in:0'],
            'reason' => ['required', 'string', 'max:150'],
        ]);

        $newCredit = round((float) $customer->store_credit + (float) $validated['amount_delta'], 2);
        if ($newCredit < 0) {
            return $this->error('El crédito en tienda no puede quedar en negativo.', 422);
        }

        DB::transaction(function () use ($request, $customer, $validated, $newCredit) {
            $oldCredit = round((float) $customer->store_credit, 2);
            $customer->update(['store_credit' => $newCredit]);

            $this->recordAudit(
                $request,
                $customer,
                'UPDATE',
                ['store_credit' => $oldCredit],
                ['store_credit' => $newCredit, 'reason' => $validated['reason']]
            );
        });

        return $this->success([
            'customer' => $this->loadCustomerSummary($customer->fresh()),
            'stats' => $this->buildStats(),
        ], 'Crédito en tienda actualizado');
    }

    public function storeAddress(Request $request, string $id): JsonResponse
    {
        $customer = Customer::with('person')->findOrFail($id);

        $input = $this->normalizeEmptyToNull($request->all(), [
            'label',
            'recipient_name',
            'phone',
            'address_line2',
            'reference_notes',
        ]);
        $request->replace($input);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:60'],
            'recipient_name' => ['nullable', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'city' => ['required', 'string', 'max:100'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'reference_notes' => ['nullable', 'string', 'max:255'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $address = DB::transaction(function () use ($request, $customer, $validated) {
            $isDefault = (bool) ($validated['is_default'] ?? false);
            if ($isDefault) {
                CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);
            }

            $recipient = $validated['recipient_name']
                ?? trim(($customer->person->first_name ?? '') . ' ' . ($customer->person->last_name ?? ''));

            $addr = CustomerAddress::create([
                'customer_id' => $customer->id,
                'label' => $validated['label'] ?? 'Casa',
                'recipient_name' => $recipient !== '' ? $recipient : $customer->customer_code,
                'phone' => $validated['phone'] ?? $customer->person?->phone,
                'city' => $validated['city'],
                'address_line1' => $validated['address_line1'],
                'address_line2' => $validated['address_line2'] ?? null,
                'reference_notes' => $validated['reference_notes'] ?? null,
                'is_default' => $isDefault,
            ]);

            $this->recordAudit($request, $customer, 'OTHER', null, [
                'action_detail' => 'Dirección agregada',
                'city' => $addr->city,
                'address_line1' => $addr->address_line1,
            ]);

            return $addr;
        });

        return $this->success(['address' => $address], 'Dirección registrada', 201);
    }

    public function destroyAddress(Request $request, string $addressId): JsonResponse
    {
        $address = CustomerAddress::findOrFail($addressId);
        $customer = Customer::find($address->customer_id);

        $snapshot = [
            'action_detail' => 'Dirección eliminada',
            'label' => $address->label,
            'city' => $address->city,
            'address_line1' => $address->address_line1,
        ];
        $address->delete();

        if ($customer) {
            $this->recordAudit($request, $customer, 'DELETE', $snapshot, null);
        }

        return $this->success(['id' => (int) $addressId], 'Dirección eliminada');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $linkedUser = $customer->user_id ? User::withTrashed()->find($customer->user_id) : null;
        if ($linkedUser && $this->isRootAdmin($linkedUser)) {
            return $this->error('No se puede eliminar al cliente vinculado a la cuenta raíz.', 422);
        }

        DB::transaction(function () use ($request, $customer, $linkedUser) {
            $customer->update(['is_active' => false]);
            $customer->delete();

            if ($linkedUser && !$this->isRootAdmin($linkedUser)) {
                $linkedUser->update(['status' => 'inactive']);
            }

            $this->recordAudit($request, $customer, 'DELETE', ['is_active' => true], ['is_active' => false]);
        });

        return $this->success([
            'id' => $customer->id,
            'stats' => $this->buildStats(),
        ], 'Cliente movido a la papelera');
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        $customer = Customer::onlyTrashed()->findOrFail($id);

        DB::transaction(function () use ($request, $customer) {
            $person = Person::withTrashed()->find($customer->person_id);
            if ($person && $person->trashed()) {
                $person->restore();
            }

            $customer->restore();
            $customer->update(['is_active' => true]);

            if ($customer->user_id) {
                $user = User::withTrashed()->find($customer->user_id);
                if ($user) {
                    if ($user->trashed()) {
                        $user->restore();
                    }
                    $user->update(['status' => 'active']);
                }
            }

            $this->recordAudit($request, $customer, 'UPDATE', ['deleted' => true], ['restored' => true]);
        });

        return $this->success([
            'customer' => $this->loadCustomerSummary($customer->fresh()),
            'stats' => $this->buildStats(),
        ], 'Cliente restaurado correctamente');
    }

    public function forceDestroy(string $id): JsonResponse
    {
        $customer = Customer::withTrashed()->findOrFail($id);

        $linkedUser = $customer->user_id ? User::withTrashed()->find($customer->user_id) : null;
        if ($linkedUser && $this->isRootAdmin($linkedUser)) {
            return $this->error('No se puede eliminar físicamente al cliente vinculado a la cuenta raíz.', 422);
        }

        try {
            DB::transaction(function () use ($customer) {
                $customer->forceDelete();
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23503') {
                return $this->error(
                    'No se puede eliminar físicamente este cliente porque tiene ventas o apartados históricos registrados. Usa la eliminación lógica.',
                    409
                );
            }
            throw $e;
        }

        return $this->success([
            'id' => (int) $id,
            'stats' => $this->buildStats(),
        ], 'Cliente eliminado definitivamente');
    }

    private function isRootAdmin(User $user): bool
    {
        return $user->username === 'admin' || $user->email === 'admin';
    }

    private function loadCustomerSummary(Customer $customer): Customer
    {
        $customer->load([
            'person' => fn ($q) => $q->withTrashed(),
            'branch:id,code,name',
            'user' => fn ($q) => $q->withTrashed(),
            'customer_addresses',
        ])
            ->loadCount(['sales', 'layaways'])
            ->loadSum('sales', 'total_amount');

        $customer->setAttribute('is_deleted', $customer->trashed());

        return $customer;
    }

    private function buildStats(): array
    {
        return [
            'total_active' => Customer::where('is_active', true)->count(),
            'vip_or_gold_count' => Customer::whereIn('customer_tier', ['gold', 'vip'])->count(),
            'total_loyalty_points' => (int) (Customer::sum('loyalty_points') ?? 0),
            'total_store_credit' => round((float) (Customer::sum('store_credit') ?? 0), 2),
            'trashed_count' => Customer::onlyTrashed()->count(),
        ];
    }

    private function recordAudit(
        Request $request,
        Customer $customer,
        string $action,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        AuditLog::create([
            'user_id' => $request->user()?->id ?? $customer->user_id,
            'branch_id' => $customer->acquired_branch_id,
            'entity_table' => 'customers',
            'entity_id' => $customer->id,
            'action' => $action,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 300) ?: null,
        ]);
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

        if (isset($payload['customer']) && is_array($payload['customer'])) {
            $payload['customer'] = $this->normalizeEmptyToNull($payload['customer'], [
                'customer_code',
                'loyalty_points',
                'store_credit',
                'acquired_branch_id',
                'notes',
            ]);
        }

        if (isset($payload['account']) && is_array($payload['account'])) {
            $payload['account'] = $this->normalizeEmptyToNull($payload['account'], [
                'username',
                'password',
            ]);
        }

        if (isset($payload['address']) && is_array($payload['address'])) {
            $payload['address'] = $this->normalizeEmptyToNull($payload['address'], [
                'label',
                'city',
                'address_line1',
                'address_line2',
                'reference_notes',
                'phone',
            ]);
        }

        $request->replace($payload);
    }
}
