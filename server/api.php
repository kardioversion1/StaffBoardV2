<?php
declare(strict_types=1);

/**
 * StaffBoard API (cPanel-safe, file-backed JSON store)
 * - Data directory: /data (auto-created)
 * - Keys: roster.json, config.json, active.json, history.json
 * - Auth: send `X-API-Key` header matching `HEYBRE_API_KEY`
 * - Endpoints:
 *   ?action=load&key=roster|config|active[&date=YYYY-MM-DD&shift=day|night]
 *   ?action=save&key=roster|config|active[&appendHistory=true]   (POST JSON)
 *   ?action=history&mode=list&date=YYYY-MM-DD
 *   ?action=history&mode=byNurse&nurseId=ID
 *   ?action=softDeleteStaff&id=ID
 *   ?action=exportHistoryCSV[&from=YYYY-MM-DD&to=YYYY-MM-DD&nurseId=ID]
 *   ?action=ping
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$ROOT_DIR = __DIR__;
$DATA_DIR = $ROOT_DIR . '/data';
if (!is_dir($DATA_DIR)) { @mkdir($DATA_DIR, 0775, true); }

/* ---------- helpers ---------- */
function bad(string $msg, int $code = 400): void {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}
function ok($payload = null): void {
  echo json_encode($payload ?? ['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}
function normalizeKey(string $key): string {
  $key = basename($key);
  $allowed = ['roster','config','active'];
  if (!in_array($key, $allowed, true)) bad('invalid key');
  return $key;
}
function safeReadJson(string $path, $default) {
  if (!file_exists($path)) return $default;
  $raw = @file_get_contents($path);
  if ($raw === false) return $default;
  $data = json_decode($raw, true);
  return (json_last_error() === JSON_ERROR_NONE && $data !== null) ? $data : $default;
}
function safeWriteJson(string $path, $data): void {
  $dir = dirname($path);
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  $tmp = $path . '.tmp';
  $fp = @fopen($tmp, 'w');
  if (!$fp) throw new RuntimeException('write open failed');
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($json === false) { @fclose($fp); @unlink($tmp); throw new RuntimeException('encode failed'); }
  if (@fwrite($fp, $json) === false) { @fclose($fp); @unlink($tmp); throw new RuntimeException('write failed'); }
  @fclose($fp);
  if (!@rename($tmp, $path)) { @unlink($path); if (!@rename($tmp, $path)) throw new RuntimeException('rename failed'); }
}
/** seed roster on first run from staff-roster-full.json */
function ensureRosterExists(string $dataDir, string $rootDir): void {
  $rosterPath = $dataDir . '/roster.json';
  if (file_exists($rosterPath)) return;
  $seed = $rootDir . '/staff-roster-full.json';
  $default = [];
  if (file_exists($seed)) {
    $seedData = safeReadJson($seed, []);
    foreach ($seedData as &$r) if (!isset($r['active'])) $r['active'] = true;
    $default = $seedData;
  }
  safeWriteJson($rosterPath, $default);
}
/** build path for per-shift active snapshots; fallback to active.json */
function activePath(string $dataDir, ?string $date, ?string $shift): string {
  $dateOk  = $date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date);
  $shiftOk = $shift === 'day' || $shift === 'night';
  return ($dateOk && $shiftOk) ? "$dataDir/active-$date-$shift.json" : "$dataDir/active.json";
}

$API_KEY = getenv('HEYBRE_API_KEY') ?: '';
$REQ_KEY = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($API_KEY === '' || $REQ_KEY !== $API_KEY) {
  bad('unauthorized', 401);
}

/* ---------- router ---------- */
$action = $_GET['action'] ?? '';
$key    = $_GET['key'] ?? '';
$historyPath = $DATA_DIR . '/history.json';

try {
  ensureRosterExists($DATA_DIR, $ROOT_DIR);

  switch ($action) {
    case 'ping':
      ok(['ok'=>true,'time'=>gmdate('c')]);

    case 'load': {
      if ($key === '') bad('missing key');
      $key = normalizeKey($key);

      if ($key === 'active') {
        $date  = $_GET['date']  ?? null;
        $shift = $_GET['shift'] ?? null;
        $path  = activePath($DATA_DIR, $date, $shift);
      } else {
        $path = "$DATA_DIR/$key.json";
      }

      $defaults = [
        'roster' => [],
        'config' => new stdClass(),
        'active' => new stdClass(),
      ];
      ok(safeReadJson($path, $defaults[$key] ?? new stdClass()));
    }

    case 'save': {
      if ($key === '') bad('missing key');
      $key = normalizeKey($key);

      $raw  = file_get_contents('php://input') ?: '';
      $data = $raw === '' ? new stdClass() : json_decode($raw, true);
      if ($raw !== '' && json_last_error() !== JSON_ERROR_NONE) bad('invalid JSON');

      if ($key === 'roster' && is_array($data)) {
        foreach ($data as &$s) if (!isset($s['active'])) $s['active'] = true;
      }

      if ($key === 'active') {
        $date  = (is_array($data) ? ($data['dateISO'] ?? null) : null) ?? ($_GET['date']  ?? null);
        $shift = (is_array($data) ? ($data['shift']   ?? null) : null) ?? ($_GET['shift'] ?? null);
        $snapPath = activePath($DATA_DIR, $date, $shift);
        safeWriteJson($snapPath, $data);
        // also keep latest pointer for clients that don't pass date/shift
        safeWriteJson("$DATA_DIR/active.json", $data);
      } else {
        safeWriteJson("$DATA_DIR/$key.json", $data);
      }

      if ($key === 'active' && (($_GET['appendHistory'] ?? '') === 'true')) {
        $hist = safeReadJson($historyPath, []);
        if (!is_array($hist)) $hist = [];
        if (is_array($data))  $data['publishedAt'] = gmdate('c');
        $hist[] = $data;
        safeWriteJson($historyPath, $hist);
      }

      ok(['ok'=>true]);
    }

    case 'history': {
      $mode = $_GET['mode'] ?? '';
      $hist = safeReadJson($historyPath, []);
      if (!is_array($hist)) $hist = [];

      if ($mode === 'list') {
        $date = $_GET['date'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) bad('invalid date');
        $out = array_values(array_filter($hist, fn($h) => ($h['dateISO'] ?? '') === $date));
        ok($out);
      }

      if ($mode === 'byNurse') {
        $id = $_GET['nurseId'] ?? '';
        if ($id === '') bad('missing nurseId');
        $out = [];
        foreach ($hist as $entry) {
          foreach (($entry['assignments'] ?? []) as $a) {
            $nid = $a['id'] ?? $a['staffId'] ?? '';
            if ($nid === $id) { $out[] = $entry; break; }
          }
        }
        ok($out);
      }

      bad('unknown history mode');
    }

    case 'softDeleteStaff': {
      $id = $_GET['id'] ?? '';
      if ($id === '') bad('missing id');
      $rosterPath = "$DATA_DIR/roster.json";
      $roster = safeReadJson($rosterPath, []);
      if (!is_array($roster)) $roster = [];
      $found = false;
      foreach ($roster as &$s) {
        if (($s['id'] ?? '') === $id) { $s['active'] = false; $found = true; break; }
      }
      if (!$found) bad('not found', 404);
      safeWriteJson($rosterPath, $roster);
      ok(['ok'=>true]);
    }

    case 'exportHistoryCSV': {
      header('Content-Type: text/csv; charset=utf-8');
      header('Content-Disposition: attachment; filename="history.csv"');

      $from  = $_GET['from'] ?? '';
      $to    = $_GET['to'] ?? '';
      $nurse = $_GET['nurseId'] ?? '';

      $hist = safeReadJson($historyPath, []);
      if (!is_array($hist)) $hist = [];

      $out = fopen('php://output', 'w');
      fputcsv($out, ['date','shift','zone','id','name','type']);
      foreach ($hist as $entry) {
        $d = $entry['dateISO'] ?? '';
        if ($from && $d < $from) continue;
        if ($to   && $d > $to)   continue;
        foreach (($entry['assignments'] ?? []) as $a) {
          $nid = $a['id'] ?? $a['staffId'] ?? '';
          if ($nurse && $nid !== $nurse) continue;
          fputcsv($out, [
            $d,
            $entry['shift'] ?? '',
            $a['zone'] ?? '',
            $nid,
            $a['name'] ?? ($a['label'] ?? ''),
            $a['type'] ?? ''
          ]);
        }
      }
      fclose($out);
      exit;
    }

    default:
      bad('unknown action', 404);
  }
} catch (Throwable $e) {
  bad('server error: ' . $e->getMessage(), 500);
}
