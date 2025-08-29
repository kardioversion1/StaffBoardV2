<?php
declare(strict_types=1);

/**
 * Minimal JSON file-based API for Board.HeyBre.com
 * Storage: ./data/*.json (or move outside webroot and set DATA_DIR).
 *
 * Security:
 * - Set an env var HEYBRE_API_KEY in .htaccess or panel, and send it as "X-API-Key" header.
 * - Alternatively, set BASIC auth in .htaccess and remove/relax the API key check below.
 *
 * Endpoints (all return JSON; content-type: application/json):
 *   GET  /api.php?res=staff                  -> staff roster (nurses/techs)
 *   POST /api.php?res=staff                  -> replace staff (JSON body)
 *
 *   GET  /api.php?res=active&date=YYYY-MM-DD&shift=day|night
 *   POST /api.php?res=active                 -> upsert current board state (expects {dateISO, shift, ...})
 *
 *   GET  /api.php?res=config                 -> board/site settings
 *   POST /api.php?res=config                 -> replace config
 *
 *   GET  /api.php?res=history&date=YYYY-MM-DD -> shift snapshot for a date (combined day+night if stored)
 *   POST /api.php?res=history                -> append/replace daily snapshot (expects {dateISO, shift, ...})
 *
 *   GET  /api.php?res=huddles&date=YYYY-MM-DD -> list/record of huddle notes for a date
 *   POST /api.php?res=huddles                -> append or replace record
 *
 *   POST /api.php?res=reset&what=all|active|history|huddles|config|staff -> admin reset
 *
 * Notes:
 * - Uses flock() for safe writes. Returns {ok:true, data:{...}} or {ok:false, error:"..."}
 */

header('Content-Type: application/json; charset=utf-8');

// ----------- Config ----------- //
$DATA_DIR = getenv('HEYBRE_DATA_DIR') ?: __DIR__ . '/data';
$API_KEY  = getenv('HEYBRE_API_KEY') ?: ''; // define in hosting control panel or .htaccess
$ALLOWED_ORIGINS = [
  'https://board.heybre.com',
  'http://board.heybre.com',
  'https://www.board.heybre.com',
  'http://www.board.heybre.com',
  'https://heybre.com',
  'http://heybre.com',
  'http://localhost:5173',
  'http://localhost'
];

// CORS (simple)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $ALLOWED_ORIGINS, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Allow-Headers: Content-Type, X-API-Key");
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ----------- Auth (simple API key) ----------- //
function require_api_key(string $provided, string $configured) : void {
  if ($configured === '') { return; } // disabled if not set
  if (!hash_equals($configured, $provided ?: '')) {
    http_response_code(401);
    echo json_encode(['ok'=>false, 'error'=>'Unauthorized']);
    exit;
  }
}

// ----------- Helpers ----------- //
function ensure_dir(string $dir) : void {
  if (!is_dir($dir)) {
    if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
      throw new RuntimeException("Cannot create data dir: $dir");
    }
  }
}

function p(string $name, $default = null) {
  return $_GET[$name] ?? $_POST[$name] ?? $default;
}

function read_json(string $path) {
  if (!file_exists($path)) return null;
  $raw = file_get_contents($path);
  if ($raw === false) throw new RuntimeException("Failed to read $path");
  $decoded = json_decode($raw, true);
  if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    throw new RuntimeException("Invalid JSON in $path");
  }
  return $decoded;
}

function write_json_atomic(string $path, $data) : void {
  $tmp = $path . '.tmp';
  $fp = fopen($tmp, 'c+');
  if (!$fp) throw new RuntimeException("Cannot open temp file for $path");
  try {
    if (!flock($fp, LOCK_EX)) throw new RuntimeException("Cannot lock temp file for $path");
    ftruncate($fp, 0);
    $bytes = fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($bytes === false) throw new RuntimeException("Cannot write temp file for $path");
    fflush($fp);
    if (!rename($tmp, $path)) throw new RuntimeException("Cannot move temp file to $path");
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
    if (file_exists($tmp)) @unlink($tmp);
  }
}

function ok($data) {
  echo json_encode(['ok'=>true, 'data'=>$data]);
  exit;
}
function fail(string $msg, int $code=400) {
  http_response_code($code);
  echo json_encode(['ok'=>false, 'error'=>$msg]);
  exit;
}

// ----------- Main ----------- //
try {
  ensure_dir($DATA_DIR);
  $res = strtolower((string)p('res', ''));
  $method = $_SERVER['REQUEST_METHOD'];
  $provided_key = $_SERVER['HTTP_X_API_KEY'] ?? '';

  $body = file_get_contents('php://input');
  $jsonBody = null;
  if ($body && strlen($body) > 0) {
    $jsonBody = json_decode($body, true);
    if ($jsonBody === null && json_last_error() !== JSON_ERROR_NONE) {
      fail('Invalid JSON body', 400);
    }
  }

  $paths = [
    'staff'   => $DATA_DIR . '/staff.json',
    'config'  => $DATA_DIR . '/config.json',
  ];

  if ($res === 'staff') {
    if ($method === 'GET') {
      $data = read_json($paths['staff']) ?? ['nurses'=>[], 'techs'=>[]];
      ok($data);
    } else if ($method === 'POST') {
      require_api_key($provided_key, $API_KEY);
      if (!is_array($jsonBody)) fail('Expected JSON object for staff');
      write_json_atomic($paths['staff'], $jsonBody);
      ok(['saved'=>true]);
    } else {
      fail('Method not allowed', 405);
    }
  }

  if ($res === 'config') {
    if ($method === 'GET') {
      $data = read_json($paths['config']) ?? new stdClass();
      ok($data);
    } else if ($method === 'POST') {
      require_api_key($provided_key, $API_KEY);
      if (!is_array($jsonBody)) fail('Expected JSON object for config');
      write_json_atomic($paths['config'], $jsonBody);
      ok(['saved'=>true]);
    } else {
      fail('Method not allowed', 405);
    }
  }

  if ($res === 'active') {
    $dateISO = (string) p('date', $jsonBody['dateISO'] ?? '');
    $shift   = (string) p('shift', $jsonBody['shift'] ?? '');
    if (!$dateISO || !$shift) fail('Missing date or shift');

    $file = $DATA_DIR . "/active-{$dateISO}-{$shift}.json";
    if ($method === 'GET') {
      $data = read_json($file) ?? new stdClass();
      ok($data);
    } else if ($method === 'POST') {
      require_api_key($provided_key, $API_KEY);
      if (!is_array($jsonBody)) fail('Expected JSON object for active');
      write_json_atomic($file, $jsonBody);
      ok(['saved'=>true]);
    } else {
      fail('Method not allowed', 405);
    }
  }

  if ($res === 'history') {
    $dateISO = (string) p('date', $jsonBody['dateISO'] ?? '');
    if (!$dateISO) fail('Missing date');

    $file = $DATA_DIR . "/history-{$dateISO}.json";
    if ($method === 'GET') {
      $data = read_json($file) ?? ['entries'=>[]];
      ok($data);
    } else if ($method === 'POST') {
      require_api_key($provided_key, $API_KEY);
      if (!is_array($jsonBody)) fail('Expected JSON object for history');
      $existing = read_json($file) ?? ['entries'=>[]];
      write_json_atomic($file, $jsonBody);
      ok(['saved'=>true]);
    } else {
      fail('Method not allowed', 405);
    }
  }

  if ($res === 'huddles') {
    $dateISO = (string) p('date', $jsonBody['dateISO'] ?? p('date', ''));
    if (!$dateISO) fail('Missing date');
    $file = $DATA_DIR . "/huddles-{$dateISO}.json";
    if ($method === 'GET') {
      $data = read_json($file) ?? ['checks'=>[], 'notes'=>''];
      ok($data);
    } else if ($method === 'POST') {
      require_api_key($provided_key, $API_KEY);
      if (!is_array($jsonBody)) fail('Expected JSON object for huddles');
      write_json_atomic($file, $jsonBody);
      ok(['saved'=>true]);
    } else {
      fail('Method not allowed', 405);
    }
  }

  if ($res === 'reset') {
    require_api_key($provided_key, $API_KEY);
    $what = (string) p('what', 'all');
    $glob = [];
    switch ($what) {
      case 'all':
        $glob = [
          $DATA_DIR . '/active-*.json',
          $DATA_DIR . '/history-*.json',
          $DATA_DIR . '/huddles-*.json',
          $DATA_DIR . '/config.json',
        ];
        break;
      case 'active':  $glob = [ $DATA_DIR . '/active-*.json' ]; break;
      case 'history': $glob = [ $DATA_DIR . '/history-*.json' ]; break;
      case 'huddles': $glob = [ $DATA_DIR . '/huddles-*.json' ]; break;
      case 'config':  $glob = [ $DATA_DIR . '/config.json' ]; break;
      case 'staff':   $glob = [ $DATA_DIR . '/staff.json' ]; break;
      default:        fail('Unknown reset target');
    }
    $deleted = [];
    foreach ($glob as $g) foreach (glob($g) as $f) if (@unlink($f)) $deleted[] = basename($f);
    ok(['deleted'=>$deleted]);
  }

  if ($res === '') ok(['hello'=>'heybre api']);
  fail('Unknown resource', 404);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Server error', 'detail'=>$e->getMessage()]);
  exit;
}

