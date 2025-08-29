<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

$DATA_DIR = __DIR__ . '/data';

// ensure database exists
initDb(db());

// migrate simple keys
foreach (['roster', 'config', 'active'] as $key) {
  $path = "$DATA_DIR/$key.json";
  if (is_file($path)) {
    $data = json_decode(file_get_contents($path) ?: '', true);
    if ($data !== null) {
      kvSet($key, $data);
    }
  }
}

// migrate active snapshots
foreach (glob($DATA_DIR . '/active-*-*.json') as $file) {
  if (preg_match('/active-(\d{4}-\d{2}-\d{2})-(day|night)\.json$/', $file, $m)) {
    $data = json_decode(file_get_contents($file) ?: '', true);
    if ($data !== null) {
      activeSave($data, $m[1], $m[2]);
    }
  }
}

// migrate history
$histPath = $DATA_DIR . '/history.json';
if (is_file($histPath)) {
  $hist = json_decode(file_get_contents($histPath) ?: '', true);
  if (is_array($hist)) {
    foreach ($hist as $entry) {
      historyInsert($entry);
    }
  }
}

echo "Migration complete\n";
