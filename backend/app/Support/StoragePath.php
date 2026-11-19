<?php

namespace App\Support;

class StoragePath
{
    public const SYSTEM_LOGOS = 'system_logos';
    public const SYSTEM_SETTINGS = 'system_settings';

    public const PRODUCTS = 'products';
    public const PRODUCT_VARIANTS = 'product_variants';
    public const CATEGORIES = 'categories';
    public const BRANDS = 'brands';

    public const USER_AVATARS = 'user_avatars';
    public const USER_DOCUMENTS = 'user_documents';

    public const BRANCHES = 'branches';
    public const BRANCH_DOCUMENTS = 'branch_documents';

    /**
     * Retorna el prefijo de carpeta configurado en config/storage_paths.php.
     */
    public static function directory(string $key): string
    {
        return trim((string) config("storage_paths.paths.{$key}", $key), '/');
    }

    /**
     * Construye la ruta completa dentro del bucket R2 (prefijo + nombre de archivo).
     */
    public static function objectKey(string $key, string $filename): string
    {
        $dir = self::directory($key);
        $cleanFilename = ltrim($filename, '/');

        return $dir !== '' ? "{$dir}/{$cleanFilename}" : $cleanFilename;
    }

    /**
     * Construye la URL pública completa a partir del nombre de archivo guardado en BD.
     */
    public static function publicUrl(string $key, ?string $filename): ?string
    {
        if (empty($filename)) {
            return null;
        }

        if (str_starts_with($filename, 'http://') || str_starts_with($filename, 'https://')) {
            return $filename;
        }

        $baseUrl = rtrim((string) config('storage_paths.public_url', ''), '/');
        $objectKey = self::objectKey($key, $filename);

        return $baseUrl !== '' ? "{$baseUrl}/{$objectKey}" : $objectKey;
    }
}
