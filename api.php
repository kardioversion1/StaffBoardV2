<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$DATA_DIR = __DIR__ . '/data';
if (!is_dir($DATA_DIR)) {
  mkdir($DATA_DIR, 0775, true);
}

function safeReadJson(string $path, $default) {
  if (!file_exists($path)) return $default;
  $raw = file_get_contents($path);
  if ($raw === false) return $default;
  $data = json_decode($raw, true);
  return $data === null ? $default : $data;
}

function safeWriteJson(string $path, $data): void {
  $dir = dirname($path);
  if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
  }
  $fp = fopen($path, 'c+');
  if (!$fp) throw new RuntimeException('open');
  try {
    if (!flock($fp, LOCK_EX)) throw new RuntimeException('lock');
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}

function bad(string $msg, int $code = 400): void {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg]);
  exit;
}

/**
 * Restrict a requested key to known safe filenames.
 *
 * Only allow simple keys that map to files within the data directory.
 */
function normalizeKey(string $key): string {
  $key = basename($key);
  $allowed = ['roster', 'config', 'active'];
  if (!in_array($key, $allowed, true)) {
    bad('invalid key');
  }
  return $key;
}

$action = $_GET['action'] ?? '';
$key = $_GET['key'] ?? '';
$historyPath = $DATA_DIR . '/history.json';

switch ($action) {
  case 'load':
    if (!$key) bad('missing key');
    $key = normalizeKey($key);
    $path = "$DATA_DIR/$key.json";
    $defaults = [
      'roster' => [],
      'config' => new stdClass(),
      'active' => new stdClass(),
    ];
    echo json_encode(safeReadJson($path, $defaults[$key] ?? new stdClass()));
    exit;

  case 'save':
    if (!$key) bad('missing key');
    $key = normalizeKey($key);
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data === null && $raw !== '') bad('invalid JSON');
    $path = "$DATA_DIR/$key.json";
    safeWriteJson($path, $data);
    if ($key === 'active' && (($_GET['appendHistory'] ?? '') === 'true')) {
      $hist = safeReadJson($historyPath, []);
      $hist[] = $data;
      safeWriteJson($historyPath, $hist);
    }
    echo json_encode(['ok' => true]);
    exit;

  case 'history':
    $mode = $_GET['mode'] ?? '';
    $hist = safeReadJson($historyPath, []);
    if ($mode === 'list') {
      $date = $_GET['date'] ?? '';
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) bad('invalid date');
      $out = array_values(array_filter($hist, fn($h) => ($h['dateISO'] ?? '') === $date));
      echo json_encode($out);
      exit;
    }
    if ($mode === 'byNurse') {
      $id = $_GET['nurseId'] ?? '';
      if ($id === '') bad('missing nurseId');
      $out = [];
      foreach ($hist as $entry) {
        foreach ($entry['assignments'] ?? [] as $a) {
          $nid = $a['id'] ?? $a['staffId'] ?? '';
          if ($nid === $id) {
            $out[] = $entry;
            break;
          }
        }
      }
      echo json_encode($out);
      exit;
    }
    bad('unknown history mode');

  case 'softDeleteStaff':
    $id = $_GET['id'] ?? '';
    if ($id === '') bad('missing id');
    $rosterPath = "$DATA_DIR/roster.json";
    $roster = safeReadJson($rosterPath, []);
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
    echo json_encode(['ok' => true]);
    exit;

  case 'exportHistoryCSV':
    $from = $_GET['from'] ?? '';
    $to = $_GET['to'] ?? '';
    $nurse = $_GET['nurseId'] ?? '';
    $hist = safeReadJson($historyPath, []);
    $rows = [];
    foreach ($hist as $entry) {
      $d = $entry['dateISO'] ?? '';
      if ($from && $d < $from) continue;
      if ($to && $d > $to) continue;
      foreach ($entry['assignments'] ?? [] as $a) {
        $nid = $a['id'] ?? $a['staffId'] ?? '';
        if ($nurse && $nid !== $nurse) continue;
        $rows[] = [$d, $entry['shift'] ?? '', $a['zone'] ?? '', $nid, $a['name'] ?? ($a['label'] ?? ''), $a['type'] ?? ''];
      }
    }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="history.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['date', 'shift', 'zone', 'id', 'name', 'type']);
    foreach ($rows as $r) fputcsv($out, $r);
    fclose($out);
    exit;

  default:
    bad('unknown action', 404);
}

?>
