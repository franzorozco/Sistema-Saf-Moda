<?php

namespace App\Services\Admin;

class DashboardService
{
    public function getSummary(): array
    {
        return [
            'total_sales_today' => 0,
            'total_orders_today' => 0,
            'low_stock_products' => 0,
            'active_cash_registers' => 0,
        ];
    }
}
