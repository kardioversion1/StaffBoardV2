<?php
declare(strict_types=1);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$envUser = getenv('MM_USER') ?: '';
$envPass = getenv('MM_PASS') ?: '';

if (!$envUser || !$envPass) {
  $local = @include __DIR__ . '/config.local.php';
  if (is_array($local)) {
    $envUser = $envUser ?: ($local['MM_USER'] ?? '');
    $envPass = $envPass ?: ($local['MM_PASS'] ?? '');
  }
}

if (!$envUser || !$envPass) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'Missing Meteomatics credentials']);
  exit;
}

function q(string $key, string $default = ''): string {
  return isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default;
}

$start  = q('start');
$end    = q('end', $start);
$step   = q('step', 'PT1H');
$params = q('params');
$lat    = q('lat');
$lon    = q('lon');
$format = q('format', 'html');
$model  = q('model', 'mix');

if (!$start || !$params || !$lat || !$lon) {
  http_response_code(400);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'Missing required query params']);
  exit;
}

$path = sprintf(
  '%s--%s:%s/%s/%s,%s/%s?model=%s',
  rawurlencode($start),
  rawurlencode($end),
  rawurlencode($step),
  rawurlencode($params),
  rawurlencode($lat),
  rawurlencode($lon),
  rawurlencode($format),
  rawurlencode($model)
);

$url = "https://api.meteomatics.com/$path";

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
  CURLOPT_USERPWD => $envUser . ':' . $envPass,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 20,
  CURLOPT_HEADER => true,
]);

$resp = curl_exec($ch);
if ($resp === false) {
  http_response_code(502);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'Upstream request failed', 'details' => curl_error($ch)]);
  exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($resp, 0, $headerSize);
$body = substr($resp, $headerSize);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status);

// Pass through a sensible content-type
if (preg_match('/Content-Type:\s*([^\r\n]+)/i', $headers, $m)) {
  header('Content-Type: ' . trim($m[1]));
} else {
  header('Content-Type: text/html; charset=utf-8');
}

echo $body;
