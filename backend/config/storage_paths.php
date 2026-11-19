<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Disco por defecto para almacenamiento de archivos (Cloudflare R2)
    |--------------------------------------------------------------------------
    */
    'disk' => env('FILESYSTEM_DISK', 'r2'),

    /*
    |--------------------------------------------------------------------------
    | URL pública base del bucket R2 (para construir URLs completas)
    |--------------------------------------------------------------------------
    */
    'public_url' => rtrim((string) (
        env('R2_PUBLIC_URL')
            ?: env('AWS_URL')
            ?: (env('R2_ENDPOINT') && env('R2_BUCKET')
                ? rtrim(env('R2_ENDPOINT'), '/') . '/' . env('R2_BUCKET')
                : '')
    ), '/'),

    /*
    |--------------------------------------------------------------------------
    | Rutas / Prefijos parametrizados dentro del bucket R2
    | En la base de datos solo se guarda el nombre del archivo (ej. foto.webp).
    | Si necesitas mover una carpeta en R2, solo cambia la ruta aquí.
    |--------------------------------------------------------------------------
    */
    'paths' => [
        // Sistema
        'system_logos' => 'system/logos',
        'system_settings' => 'system/settings',

        // Catálogo
        'products' => 'catalog/products',
        'product_variants' => 'catalog/variants',
        'categories' => 'catalog/categories',
        'brands' => 'catalog/brands',

        // Usuarios
        'user_avatars' => 'users/avatars',
        'user_documents' => 'users/documents',

        // Sucursales
        'branches' => 'branch/photos',
        'branch_documents' => 'branch/documents',
    ],
];
