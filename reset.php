<?php
declare(strict_types=1);
$API_KEY = getenv('HEYBRE_API_KEY') ?: '';
$what = $_GET['what'] ?? 'all';
$ch = curl_init((isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/api.php?res=reset&what=' . urlencode($what));
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => $API_KEY ? ['X-API-Key: ' . $API_KEY] : [],
]);
$out = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
header('Content-Type: application/json');
if ($err) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>$err]);
} else {
  http_response_code($code);
  echo $out;
}

