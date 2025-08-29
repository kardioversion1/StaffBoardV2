<?php
declare(strict_types=1);
$API_KEY = getenv('HEYBRE_API_KEY') ?: '';
$what = $_GET['what'] ?? 'all';
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$url = $scheme.$_SERVER['HTTP_HOST'].'/api.php?res=reset&what='.urlencode($what);
$ch = curl_init($url);
curl_setopt_array($ch,[
  CURLOPT_RETURNTRANSFER=>true,
  CURLOPT_POST=>true,
  CURLOPT_HTTPHEADER=>$API_KEY?['X-API-Key: '.$API_KEY]:[],
]);
$out=curl_exec($ch); $err=curl_error($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
header('Content-Type: application/json');
http_response_code($code ?: 500);
echo $err? json_encode(['ok'=>false,'error'=>$err]) : $out;
