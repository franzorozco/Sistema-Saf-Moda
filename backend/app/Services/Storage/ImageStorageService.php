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

    public function upload(UploadedFile $file, string $directory): string
    {
        $disk = $this->activeDisk();
        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = Str::uuid()->toString() . '.' . strtolower($extension);
        $path = trim($directory, '/') . '/' . $filename;

        Storage::disk($disk)->putFileAs(trim($directory, '/'), $file, $filename, 'public');

        if ($disk === 'r2') {
            $publicBase = rtrim((string) config('filesystems.disks.r2.url'), '/');
            if ($publicBase !== '') {
                return $publicBase . '/' . $path;
            }
            $endpoint = rtrim((string) config('filesystems.disks.r2.endpoint'), '/');
            $bucket = config('filesystems.disks.r2.bucket');
            return $endpoint . '/' . $bucket . '/' . $path;
        }

        return Storage::disk('public')->url($path);
    }

    public function deleteByUrl(string $imageUrl): void
    {
        $disk = $this->activeDisk();

        if ($disk === 'r2') {
            $publicBase = rtrim((string) config('filesystems.disks.r2.url'), '/');
            $endpointBase = rtrim((string) config('filesystems.disks.r2.endpoint'), '/') . '/' . config('filesystems.disks.r2.bucket');

            $path = null;
            if ($publicBase !== '' && str_starts_with($imageUrl, $publicBase . '/')) {
                $path = substr($imageUrl, strlen($publicBase . '/'));
            } elseif (str_starts_with($imageUrl, $endpointBase . '/')) {
                $path = substr($imageUrl, strlen($endpointBase . '/'));
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
        }
    }
}
