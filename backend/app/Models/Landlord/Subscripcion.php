<?php

namespace App\Models\Landlord;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscripcion extends Model
{
    protected $connection = 'landlord';
    protected $table = 'subscripciones';

    protected $fillable = [
        'empresa_id', 'plan_id', 'inicio', 'fin', 'monto',
        'estado', 'metodo_pago', 'pasarela', 'pasarela_ref', 'notas',
    ];

    protected $casts = [
        'inicio' => 'date',
        'fin'    => 'date',
        'monto'  => 'decimal:2',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
