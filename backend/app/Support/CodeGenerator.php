<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class CodeGenerator
{
    public static function next(
        string $table,
        string $prefix,
        int $pad = 4,
        string $column = 'code',
        array $scope = []
    ): string {
        $baseQuery = DB::table($table);
        foreach ($scope as $col => $val) {
            $baseQuery->where($col, $val);
        }

        $nextNumber = ((int) ($baseQuery->max('id') ?? 0)) + 1;

        do {
            $candidate = strtoupper($prefix) . str_pad((string) $nextNumber, $pad, '0', STR_PAD_LEFT);

            $checkQuery = DB::table($table)->where($column, $candidate);
            foreach ($scope as $col => $val) {
                $checkQuery->where($col, $val);
            }

            $exists = $checkQuery->exists();
            $nextNumber++;
        } while ($exists);

        return $candidate;
    }
}
