<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')
                ->prefix('api/v1/admin')
                ->name('api.v1.admin.')
                ->group(base_path('routes/admin.php'));

            Route::middleware('api')
                ->prefix('api/v1/pos')
                ->name('api.v1.pos.')
                ->group(base_path('routes/pos.php'));

            Route::middleware('api')
                ->prefix('api/v1/home')
                ->name('api.v1.home.')
                ->group(base_path('routes/home.php'));

            Route::middleware('api')
                ->prefix('api/v1/shop')
                ->name('api.v1.shop.')
                ->group(base_path('routes/shop.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\ForceJsonResponse::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
