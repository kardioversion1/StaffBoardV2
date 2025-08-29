<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$DATA_DIR = __DIR__ . '/data';
if (!is_dir($DATA_DIR)) {
  @mkdir($DATA_DIR, 0775, true);
}

/* ----------------- Utils ----------------- */
function safeReadJson(string $path, $default) {
  if (!is_file($path)) return $default;
  $raw = @file_get_contents($path);
  if ($raw === false) return $default;
  $data = json_decode($raw, true);
  return (json_last_error() === JSON_ERROR_NONE && $data !== null) ? $data : $default;
}

function safeWriteJson(string $path, $data): void {
  $dir = dirname($path);
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  // lock on the final file, write atomically with tmp
  $tmp = $path . '.tmp';
  $fp = @fopen($tmp, 'w');
  if (!$fp) throw new RuntimeException('open tmp failed');
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($json === false) throw new RuntimeException('encode failed');
  if (@fwrite($fp, $json) === false) { @fclose($fp); @unlink($tmp); throw new RuntimeException('write failed'); }
  @fclose($fp);
  if (!@rename($tmp, $path)) { @unlink($path); if (!@rename($tmp, $path)) throw new RuntimeException('rename failed'); }
}

function bad(string $msg, int $code = 400): void {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

/** Allow only known keys to map to files in /data */
function normalizeKey(string $key): string {
  $key = basename($key);
  $allowed = ['roster', 'config', 'active'];
  if (!in_array($key, $allowed, true)) bad('invalid key');
  return $key;
}

/** Validate date/shift and build path for active snapshots */
function activePath(string $dataDir, ?string $date, ?string $shift): string {
  $dateOk  = $date !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date);
  $shiftOk = $shift === 'day' || $shift === 'night';
  if ($dateOk && $shiftOk) {
    return "$dataDir/active-$date-$shift.json";
  }
  return "$dataDir/active.json"; // fallback
}

/* ----------------- Router ----------------- */
$action      = $_GET['action'] ?? '';
$keyParam    = $_GET['key'] ?? '';
$historyPath = $DATA_DIR . '/history.json';
$physiciansUrl = 'https://www.bytebloc.com/sk/?76b6a156';

switch ($action) {
  case 'load': {
    if ($keyParam === '') bad('missing key');
    $key  = normalizeKey($keyParam);

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
    echo json_encode(safeReadJson($path, $defaults[$key] ?? new stdClass()), JSON_UNESCAPED_UNICODE);
    exit;
  }

  case 'save': {
    if ($keyParam === '') bad('missing key');
    $key = normalizeKey($keyParam);

    $raw  = file_get_contents('php://input');
    $data = ($raw === '' ? new stdClass() : json_decode($raw, true));
    if ($raw !== '' && json_last_error() !== JSON_ERROR_NONE) bad('invalid JSON');

    // choose path (and also update latest pointer for active)
    if ($key === 'active') {
      $date  = (is_array($data) ? ($data['dateISO'] ?? null) : null) ?? ($_GET['date']  ?? null);
      $shift = (is_array($data) ? ($data['shift']   ?? null) : null) ?? ($_GET['shift'] ?? null);
      $snapPath = activePath($DATA_DIR, $date, $shift);
      safeWriteJson($snapPath, $data);
      // also write the latest pointer so clients without date/shift stay in sync
      safeWriteJson("$DATA_DIR/active.json", $data);
    } else {
      safeWriteJson("$DATA_DIR/$key.json", $data);
    }

    // optional history append
    if ($key === 'active' && (($_GET['appendHistory'] ?? '') === 'true')) {
      $hist = safeReadJson($historyPath, []);
      if (!is_array($hist)) $hist = [];
      if (is_array($data))  $data['publishedAt'] = gmdate('c');
      $hist[] = $data;
      safeWriteJson($historyPath, $hist);
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  case 'history': {
    $mode = $_GET['mode'] ?? '';
    $hist = safeReadJson($historyPath, []);
    if (!is_array($hist)) $hist = [];

    if ($mode === 'list') {
      $date = $_GET['date'] ?? '';
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) bad('invalid date');
      $out = array_values(array_filter($hist, fn($h) => ($h['dateISO'] ?? '') === $date));
      echo json_encode($out, JSON_UNESCAPED_UNICODE); exit;
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
      echo json_encode($out, JSON_UNESCAPED_UNICODE); exit;
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
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  case 'exportHistoryCSV': {
    // switch to CSV headers
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

  case 'physicians': {
    header('Content-Type: text/calendar; charset=utf-8');
    $cachePath = $DATA_DIR . '/physicians.ics';
    $ttl = 300; // 5 minutes
    $ics = null;
    if (is_file($cachePath) && (time() - filemtime($cachePath) < $ttl)) {
      $ics = @file_get_contents($cachePath);
    }
    if ($ics === null) {
      $ics = @file_get_contents($physiciansUrl);
      if ($ics === false) {
        $ics = is_file($cachePath) ? @file_get_contents($cachePath) : null;
      } else {
        @file_put_contents($cachePath, $ics);
      }
    }
    if ($ics === null) bad('calendar fetch failed', 502);
    echo $ics;
    exit;
  }

  default:
    bad('unknown action', 404);
}
