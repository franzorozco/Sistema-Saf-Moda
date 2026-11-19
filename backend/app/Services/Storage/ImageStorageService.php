<?php

namespace App\Services\Storage;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageStorageService
{
    public function activeDisk(): string
    {
        $hasR2 = !empty(config('filesystems.disks.r2.key'))
            && !empty(config('filesystems.disks.r2.secret'));

        return $hasR2 ? 'r2' : 'public';
    }

    /**
     * Sube el archivo y retorna ÚNICAMENTE el nombre de archivo (ej. uuid.jpg).
     */
    public function uploadFile(UploadedFile $file, string $directory): string
    {
        $disk = $this->activeDisk();
        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = Str::uuid()->toString() . '.' . strtolower($extension);
        $cleanDir = trim($directory, '/');

        // En R2 no se envía 'public' para evitar error de ACL
        Storage::disk($disk)->putFileAs($cleanDir, $file, $filename);

        return $filename;
    }

    /**
     * Compatibilidad: Sube archivo y retorna el nombre.
     */
    public function upload(UploadedFile $file, string $directory): string
    {
        return $this->uploadFile($file, $directory);
    }

    /**
     * Elimina el archivo físico a partir de su directorio y nombre de archivo.
     */
    public function deleteFile(string $directory, string $filename): void
    {
        $disk = $this->activeDisk();
        $cleanDir = trim($directory, '/');
        $cleanFilename = basename($filename);
        $path = $cleanDir !== '' ? "{$cleanDir}/{$cleanFilename}" : $cleanFilename;

        Storage::disk($disk)->delete($path);
    }

    /**
     * Elimina el archivo si se pasa una URL o ruta relativa.
     */
    public function deleteByUrl(string $imageUrl): void
    {
        $disk = $this->activeDisk();

        if ($disk === 'r2') {
            $publicBase = rtrim((string) config('storage_paths.public_url'), '/');
            $endpointBase = rtrim((string) config('filesystems.disks.r2.endpoint'), '/') . '/' . config('filesystems.disks.r2.bucket');

            $path = null;
            if ($publicBase !== '' && str_starts_with($imageUrl, $publicBase . '/')) {
                $path = substr($imageUrl, strlen($publicBase . '/'));
            } elseif (str_starts_with($imageUrl, $endpointBase . '/')) {
                $path = substr($imageUrl, strlen($endpointBase . '/'));
            } else {
                $path = ltrim($imageUrl, '/');
            }

            if ($path) {
                Storage::disk('r2')->delete($path);
            }
            return;
        }

        $publicUrlPrefix = rtrim((string) Storage::disk('public')->url(''), '/') . '/';
        if (str_starts_with($imageUrl, $publicUrlPrefix)) {
            $path = substr($imageUrl, strlen($publicUrlPrefix));
            Storage::disk('public')->delete($path);
        } else {
            Storage::disk('public')->delete(ltrim($imageUrl, '/'));
        }
    }
}
