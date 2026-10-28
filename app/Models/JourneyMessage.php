<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class JourneyMessage extends Model {
 protected $fillable=['journey_id','role','content'];
 protected $hidden=['content'];
 public function journey(){return $this->belongsTo(Journey::class);}
}
