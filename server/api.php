<?php
declare(strict_types=1);

/**
 * StaffBoard API (cPanel-safe, file-backed JSON store)
 * - Data directory: /data (auto-created)
 * - Keys: roster.json, config.json, active.json, history.json
 * - Endpoints (via ?action=...):
 *    load&key=roster|config|active
 *    save&key=roster|config|active [&appendHistory=true]  (POST JSON body)
 *    history&mode=list&date=YYYY-MM-DD
 *    history&mode=byNurse&nurseId=ID
 *    softDeleteStaff&id=ID
 *    exportHistoryCSV[&from=YYYY-MM-DD&to=YYYY-MM-DD&nurseId=ID]
 *    ping
 */

header('Content-Type: application/json; charset=utf-8');
// Prevent stale caches on phones
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$ROOT_DIR = __DIR__;
$DATA_DIR = $ROOT_DIR . '/data';

// Ensure data dir exists
if (!is_dir($DATA_DIR)) {
  @mkdir($DATA_DIR, 0775, true);
}

/** ---------- Helpers ---------- */
function bad(string $msg, int $code = 400): void {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

function ok($payload = null): void {
  echo json_encode($payload ?? ['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Restrict a requested key to known safe filenames.
 *
 * Prevents directory traversal and access to unintended files.
 */
function normalizeKey(string $key): string {
  $key = basename($key);
  $allowed = ['roster', 'config', 'active'];
  if (!in_array($key, $allowed, true)) {
    bad('invalid key');
  }
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
  if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
  }
  $tmp = $path . '.tmp';
  $fp = @fopen($tmp, 'w');
  if (!$fp) throw new RuntimeException('write open failed: ' . $tmp);
  if (@fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    @fclose($fp);
    @unlink($tmp);
    throw new RuntimeException('write failed');
  }
  @fclose($fp);
  // Atomic-ish replace
  if (!@rename($tmp, $path)) {
    // fallback
    @unlink($path);
    if (!@rename($tmp, $path)) throw new RuntimeException('rename failed');
  }
}

/** Initialize roster from bundled file on first run */
function ensureRosterExists(string $dataDir, string $rootDir): void {
  $rosterPath = $dataDir . '/roster.json';
  if (file_exists($rosterPath)) return;
  $seed = $rootDir . '/staff-roster-full.json';
  $default = [];
  if (file_exists($seed)) {
    $seedData = safeReadJson($seed, []);
    // Normalize: add active:true if missing
    foreach ($seedData as &$r) if (!isset($r['active'])) $r['active'] = true;
    $default = $seedData;
  }
  safeWriteJson($rosterPath, $default);
}

/** ---------- Router ---------- */
$action = $_GET['action'] ?? '';
$key    = $_GET['key'] ?? '';

$historyPath = $DATA_DIR . '/history.json';

try {
  // Make sure roster exists on first load
  ensureRosterExists($DATA_DIR, $ROOT_DIR);

  switch ($action) {
    case 'ping':
      ok(['ok' => true, 'time' => gmdate('c')]);

    case 'load': {
      if ($key === '') bad('missing key');
      $key = normalizeKey($key);
      $path = "$DATA_DIR/$key.json";
      // Sensible defaults
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
      $raw = file_get_contents('php://input') ?: '';
      $data = $raw === '' ? new stdClass() : json_decode($raw, true);
      if ($raw !== '' && (json_last_error() !== JSON_ERROR_NONE)) bad('invalid JSON');

      // Normalize roster entries: ensure active flag exists
      if ($key === 'roster' && is_array($data)) {
        foreach ($data as &$s) {
          if (!isset($s['active'])) $s['active'] = true;
        }
      }

      $path = "$DATA_DIR/$key.json";
      safeWriteJson($path, $data);

      // Optional: append to history when saving active
      $appendHistory = ($_GET['appendHistory'] ?? '') === 'true';
      if ($key === 'active' && $appendHistory) {
        $hist = safeReadJson($historyPath, []);
        if (!is_array($hist)) $hist = [];
        $dataToStore = $data;
        if (is_array($dataToStore) || is_object($dataToStore)) {
          if (is_array($dataToStore)) {
            $dataToStore['publishedAt'] = gmdate('c');
          } else {
            $dataToStore = (array)$dataToStore;
            $dataToStore['publishedAt'] = gmdate('c');
          }
          $hist[] = $dataToStore;
          safeWriteJson($historyPath, $hist);
        }
      }

      ok(['ok' => true]);
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
        if (($s['id'] ?? '') === $id) {
          $s['active'] = false;
          $found = true;
          break;
        }
      }
      if (!$found) bad('not found', 404);
      safeWriteJson($rosterPath, $roster);
      ok(['ok' => true]);
    }

    case 'exportHistoryCSV': {
      // Switch to CSV headers first
      header('Content-Type: text/csv; charset=utf-8');
      header('Content-Disposition: attachment; filename="history.csv"');
      // For CSV, don’t emit JSON
      $from  = $_GET['from'] ?? '';
      $to    = $_GET['to'] ?? '';
      $nurse = $_GET['nurseId'] ?? '';

      $hist = safeReadJson($historyPath, []);
      if (!is_array($hist)) $hist = [];

      $out = fopen('php://output', 'w');
      fputcsv($out, ['date', 'shift', 'zone', 'id', 'name', 'type']);
      foreach ($hist as $entry) {
        $d = $entry['dateISO'] ?? '';
        if ($from && $d < $from) continue;
        if ($to && $d > $to) continue;
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
