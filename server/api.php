<?php
declare(strict_types=1);

/**
 * StaffBoard API (DB-backed JSON store)
 * - Database: SQLite file specified by `HEYBRE_DB_PATH` (defaults to server/data.sqlite)
 * - Auth: send `X-API-Key` header matching `HEYBRE_API_KEY`
 * - Endpoints:
 *   ?action=load&key=roster|config|active[&date=YYYY-MM-DD&shift=day|night]
 *   ?action=save&key=roster|config|active[&appendHistory=true]   (POST JSON)
 *   ?action=history&mode=list&date=YYYY-MM-DD
 *   ?action=history&mode=byNurse&nurseId=ID
 *   ?action=softDeleteStaff&id=ID
 *   ?action=exportHistoryCSV[&from=YYYY-MM-DD&to=YYYY-MM-DD&nurseId=ID]
 *   ?action=physicians
 *   ?action=ping
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$ROOT_DIR = __DIR__;
$DATA_DIR = $ROOT_DIR . '/data';
if (!is_dir($DATA_DIR)) {
  try {
    if (!mkdir($DATA_DIR, 0775, true) && !is_dir($DATA_DIR)) {
      throw new RuntimeException('data directory creation failed');
    }
  } catch (Throwable $e) {
    error_log('data dir: ' . $e->getMessage());
  }
}

require __DIR__ . '/db.php';
require_once __DIR__ . '/validators.php';

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

/** Seed roster on first run from staff-roster-full.json (marks missing 'active' as true) */
function ensureRosterExists(string $rootDir): void {
  $existing = kvGet('roster', null);
  if ($existing !== null) return;
  $seed = $rootDir . '/staff-roster-full.json';
  $default = [];
  if (file_exists($seed)) {
    $seedData = json_decode(@file_get_contents($seed) ?: '[]', true);
    if (is_array($seedData)) {
      foreach ($seedData as &$r) if (!isset($r['active'])) $r['active'] = true;
      $default = $seedData;
    }
  }
  kvSet('roster', $default);
}

/* ---------- auth ---------- */
$API_KEY = getenv('HEYBRE_API_KEY') ?: '';
$REQ_KEY = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($API_KEY === '' || $REQ_KEY !== $API_KEY) {
  error_log('unauthorized');
  bad('unauthorized', 401);
}

/* ---------- router ---------- */
$action = $_GET['action'] ?? '';
$key    = $_GET['key'] ?? '';
$physiciansUrl = 'https://www.bytebloc.com/sk/?76b6a156';

try {
  ensureRosterExists($ROOT_DIR);

  switch ($action) {
    case 'ping':
      ok(['ok' => true, 'time' => gmdate('c')]);

    case 'load': {
      if ($key === '') bad('missing key');
      $key = normalizeKey($key);

      if ($key === 'active') {
        $date  = $_GET['date']  ?? null;
        $shift = $_GET['shift'] ?? null;
        $data  = activeLoad($date, $shift);
      } else {
        $defaults = [
          'roster' => [],
          'config' => new stdClass(),
        ];
        $data = kvGet($key, $defaults[$key] ?? new stdClass());
      }
      ok($data);
    }

    case 'save': {
      if ($key === '') bad('missing key');
      $key = normalizeKey($key);

      $raw  = file_get_contents('php://input') ?: '';
      $data = validateSavePayload($raw);

      if ($key === 'roster' && is_array($data)) {
        foreach ($data as &$s) if (!isset($s['active'])) $s['active'] = true;
      }

      if ($key === 'active') {
        $date  = (is_array($data) ? ($data['dateISO'] ?? null) : null) ?? ($_GET['date']  ?? null);
        $shift = (is_array($data) ? ($data['shift']   ?? null) : null) ?? ($_GET['shift'] ?? null);
        activeSave($data, $date, $shift);
        if (($_GET['appendHistory'] ?? '') === 'true') {
          if (is_array($data)) $data['publishedAt'] = gmdate('c');
          historyInsert($data);
        }
      } else {
        kvSet($key, $data);
      }

      ok(['ok' => true]);
    }

    case 'history': {
      $params = validateHistoryQuery($_GET); // expects mode + (date|nurseId)
      $hist = historyAll(); // array of published shift snapshots

      if ($params['mode'] === 'list') {
        $date = $params['date'];
        $out = array_values(array_filter($hist, fn($h) => ($h['dateISO'] ?? '') === $date));
        ok($out);
      }

      if ($params['mode'] === 'byNurse') {
        $id = $params['nurseId'];
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
      $roster = kvGet('roster', []);
      if (!is_array($roster)) $roster = [];
      $found = false;
      foreach ($roster as &$s) {
        if (($s['id'] ?? '') === $id) { $s['active'] = false; $found = true; break; }
      }
      if (!$found) bad('not found', 404);
      kvSet('roster', $roster);
      ok(['ok' => true]);
    }

    case 'exportHistoryCSV': {
      header('Content-Type: text/csv; charset=utf-8');
      header('Content-Disposition: attachment; filename="history.csv"');

      $from  = $_GET['from'] ?? '';
      $to    = $_GET['to'] ?? '';
      $nurse = $_GET['nurseId'] ?? '';

      $hist = historyAll();

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
      try {
        $ics = null;
        if (is_file($cachePath) && (time() - filemtime($cachePath) < $ttl)) {
          $ics = file_get_contents($cachePath);
        }
        if ($ics === null) {
          $ics = file_get_contents($physiciansUrl);
          if ($ics === false) {
            $ics = is_file($cachePath) ? file_get_contents($cachePath) : null;
          } else {
            file_put_contents($cachePath, $ics);
          }
        }
        if ($ics === null) bad('calendar fetch failed', 502);
        echo $ics;
        exit;
      } catch (Throwable $e) {
        error_log('physicians: ' . $e->getMessage());
        bad('calendar fetch failed', 502);
      }
    }

    default:
      bad('unknown action', 404);
  }
} catch (Throwable $e) {
  error_log('api: ' . $e->getMessage());
  bad('server error: ' . $e->getMessage(), 500);
}
