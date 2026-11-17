<?php

namespace App\Services\Pos;

class SaleService
{
    public function createSale(array $payload): array
    {
        return [
            'sale_id' => null,
            'status' => 'pending_model_implementation',
            'payload' => $payload,
        ];
    }
}
