<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class JourneyAction extends Model {
 protected $fillable=['journey_id','concern_id','title','status'];
 public function journey(){return $this->belongsTo(Journey::class);}
}
