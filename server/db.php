<?php
declare(strict_types=1);

/**
 * Simple PDO-based storage for StaffBoard.
 */

function db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $path = getenv('HEYBRE_DB_PATH');
    if ($path === false || $path === '') {
      $path = __DIR__ . '/data.sqlite';
    }
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    initDb($pdo);
  }
  return $pdo;
}

function initDb(PDO $pdo): void {
  $pdo->exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS active_snapshots (date TEXT NOT NULL, shift TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(date, shift))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)');
}

function kvGet(string $key, $default) {
  $stmt = db()->prepare('SELECT value FROM kv_store WHERE key = :key');
  $stmt->execute([':key' => $key]);
  $raw = $stmt->fetchColumn();
  if ($raw === false) return $default;
  $data = json_decode($raw, true);
  return (json_last_error() === JSON_ERROR_NONE) ? $data : $default;
}

function kvSet(string $key, $data): void {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  db()->prepare('REPLACE INTO kv_store (key, value) VALUES (:k, :v)')->execute([':k' => $key, ':v' => $json]);
}

function activeSave($data, ?string $date, ?string $shift): void {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($date && $shift) {
    db()->prepare('REPLACE INTO active_snapshots (date, shift, data) VALUES (:d, :s, :j)')->execute([
      ':d' => $date,
      ':s' => $shift,
      ':j' => $json,
    ]);
  }
  db()->prepare('REPLACE INTO kv_store (key, value) VALUES ("active", :j)')->execute([':j' => $json]);
}

function activeLoad(?string $date, ?string $shift) {
  if ($date && $shift) {
    $stmt = db()->prepare('SELECT data FROM active_snapshots WHERE date = :d AND shift = :s');
    $stmt->execute([':d' => $date, ':s' => $shift]);
    $raw = $stmt->fetchColumn();
    if ($raw !== false) {
      $out = json_decode($raw, true);
      if (json_last_error() === JSON_ERROR_NONE) return $out;
    }
  }
  return kvGet('active', new stdClass());
}

function historyInsert($data): void {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  db()->prepare('INSERT INTO history (data) VALUES (:j)')->execute([':j' => $json]);
}

function historyAll(): array {
  $stmt = db()->query('SELECT data FROM history ORDER BY id ASC');
  $rows = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
  $out = [];
  foreach ($rows as $raw) {
    $d = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE) $out[] = $d;
  }
  return $out;
}

?>
