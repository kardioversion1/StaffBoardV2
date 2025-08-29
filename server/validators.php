<?php
declare(strict_types=1);

/**
 * Validate JSON payload for save operations.
 * Returns decoded data or emits 400 on failure.
 */
function validateSavePayload(string $raw) {
  if ($raw === '') return new stdClass();
  $data = json_decode($raw, true);
  if ($data === null || json_last_error() !== JSON_ERROR_NONE) {
    bad('invalid JSON');
  }
  if (!is_array($data) && !is_object($data)) {
    bad('invalid payload');
  }
  return $data;
}

/**
 * Validate history query parameters and return normalized array.
 */
function validateHistoryQuery(array $query): array {
  $mode = $query['mode'] ?? '';
  if ($mode === 'list') {
    $date = $query['date'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) bad('invalid date');
    return ['mode' => 'list', 'date' => $date];
  }
  if ($mode === 'byNurse') {
    $id = $query['nurseId'] ?? '';
    if ($id === '') bad('missing nurseId');
    return ['mode' => 'byNurse', 'nurseId' => $id];
  }
  bad('unknown history mode');
}
