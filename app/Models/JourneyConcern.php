<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class JourneyConcern extends Model {
 protected $fillable=['journey_id','title','category','urgency','deadline','confirmed'];
 protected $casts=['confirmed'=>'boolean'];
 public function journey(){return $this->belongsTo(Journey::class);}
}
