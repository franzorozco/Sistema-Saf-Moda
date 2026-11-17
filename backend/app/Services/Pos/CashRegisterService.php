<?php

namespace App\Services\Pos;

class CashRegisterService
{
    public function getCurrentSession(): array
    {
        return [
            'is_open' => false,
            'session_id' => null,
            'opening_amount' => 0,
        ];
    }
}
