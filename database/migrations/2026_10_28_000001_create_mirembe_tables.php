<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {
  Schema::create('journeys',function(Blueprint $t){
   $t->uuid('id')->primary();$t->string('access_token_hash',64);$t->string('phase')->default('express');$t->timestamps();
  });
  Schema::create('journey_messages',function(Blueprint $t){
   $t->id();$t->foreignUuid('journey_id')->constrained('journeys')->cascadeOnDelete();
   $t->string('role',20);$t->text('content');$t->timestamps();
  });
  Schema::create('journey_concerns',function(Blueprint $t){
   $t->id();$t->foreignUuid('journey_id')->constrained('journeys')->cascadeOnDelete();
   $t->string('title');$t->string('category')->default('other');$t->string('urgency')->default('unknown');
   $t->string('deadline')->nullable();$t->boolean('confirmed')->default(false);$t->timestamps();
  });
  Schema::create('journey_actions',function(Blueprint $t){
   $t->id();$t->foreignUuid('journey_id')->constrained('journeys')->cascadeOnDelete();
   $t->foreignId('concern_id')->nullable()->constrained('journey_concerns')->nullOnDelete();
   $t->string('title');$t->string('status')->default('pending');$t->timestamps();
  });
 }
 public function down(): void {
  Schema::dropIfExists('journey_actions');Schema::dropIfExists('journey_concerns');
  Schema::dropIfExists('journey_messages');Schema::dropIfExists('journeys');
 }
};
