<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class JobPositionSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $positions = [
            [
                'code' => 'J0001',
                'name' => 'Administrador General',
                'description' => 'Responsable de la gestión general y administrativa',
                'base_salary_ref' => 5500,
            ],
            [
                'code' => 'J0002',
                'name' => 'Encargado de Sucursal',
                'description' => 'Supervisión operativa de tienda y personal',
                'base_salary_ref' => 4200,
            ],
            [
                'code' => 'J0003',
                'name' => 'Cajero / Caja POS',
                'description' => 'Atención en caja, cobros y arqueo diario',
                'base_salary_ref' => 3000,
            ],
            [
                'code' => 'J0004',
                'name' => 'Asesora de Ventas',
                'description' => 'Atención al cliente y asesoramiento en boutique',
                'base_salary_ref' => 2800,
            ],
            [
                'code' => 'J0005',
                'name' => 'Encargado de Almacén',
                'description' => 'Control de inventario, recepción y reposición',
                'base_salary_ref' => 3000,
            ],
        ];

        foreach ($positions as $position) {
            DB::table('job_positions')->updateOrInsert(
                ['code' => $position['code']],
                [
                    'name' => $position['name'],
                    'description' => $position['description'],
                    'base_salary_ref' => $position['base_salary_ref'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
