<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class Journey extends Model {
 use HasUuids;
 protected $fillable=['access_token_hash','phase'];
 protected $hidden=['access_token_hash'];
 public function messages(){return $this->hasMany(JourneyMessage::class);}
 public function concerns(){return $this->hasMany(JourneyConcern::class);}
 public function actions(){return $this->hasMany(JourneyAction::class);}
}
