<?php
declare(strict_types=1);

/**
 * JSON file-based API for Board.HeyBre.com
 * Storage: ./data/*.json (or set HEYBRE_DATA_DIR to move outside webroot)
 * Auth for writes: X-API-Key header (set HEYBRE_API_KEY server-side)
 */

header('Content-Type: application/json; charset=utf-8');

// --- Config ---
$DATA_DIR = getenv('HEYBRE_DATA_DIR') ?: __DIR__ . '/data';
$API_KEY  = getenv('HEYBRE_API_KEY') ?: ''; // set via .htaccess or host env
$ALLOWED_ORIGINS = [
  'https://board.heybre.com','http://board.heybre.com',
  'https://www.board.heybre.com','http://www.board.heybre.com',
  'https://heybre.com','http://heybre.com',
  'http://localhost','http://localhost:5173'
];

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $ALLOWED_ORIGINS, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Allow-Headers: Content-Type, X-API-Key");
  header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function require_api_key($provided, $configured) {
  if ($configured === '') return; // disabled if not set
  if (!hash_equals($configured, $provided ?: '')) {
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'Unauthorized']); exit;
  }
}
function ensure_dir($d){ if(!is_dir($d)){ if(!mkdir($d,0775,true)&&!is_dir($d)) throw new RuntimeException("mk:$d");}}
function p($k,$d=null){ return $_GET[$k] ?? $_POST[$k] ?? $d; }
function read_json($f){ if(!file_exists($f)) return null; $r=file_get_contents($f); if($r===false) throw new RuntimeException("read:$f"); $j=json_decode($r,true); if($j===null && json_last_error()) throw new RuntimeException("bad json:$f"); return $j; }
function write_json_atomic($f,$data){
  $tmp=$f.'.tmp'; $fp=fopen($tmp,'c+'); if(!$fp) throw new RuntimeException("tmp:$f");
  try{ if(!flock($fp,LOCK_EX)) throw new RuntimeException("lock:$f");
    ftruncate($fp,0); fwrite($fp,json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)); fflush($fp);
    if(!rename($tmp,$f)) throw new RuntimeException("rename:$f");
  } finally { flock($fp,LOCK_UN); fclose($fp); if(file_exists($tmp)) @unlink($tmp); }
}
function ok($d){ echo json_encode(['ok'=>true,'data'=>$d]); exit; }
function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }
function now_iso(){ return gmdate('Y-m-d\TH:i:s\Z'); }

try {
  ensure_dir($DATA_DIR);
  $res = strtolower((string)p('res',''));
  $mth = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
  $body = file_get_contents('php://input') ?: '';
  $json = $body ? json_decode($body,true) : null;
  if ($body && $json===null && json_last_error()) fail('Invalid JSON body',400);

  $paths = [
    'staff'  => $DATA_DIR.'/staff.json',
    'config' => $DATA_DIR.'/config.json',
  ];

  // STAFF: GET/POST/DELETE
  if ($res==='staff' && $mth==='GET') {
    ok(read_json($paths['staff']) ?? ['nurses'=>[], 'techs'=>[]]);
  }
  if ($res==='staff' && $mth==='POST') {
    require_api_key($key,$API_KEY);
    if(!is_array($json)) fail('Expected JSON object');
    write_json_atomic($paths['staff'],$json);
    ok(['saved'=>true]);
  }
  if ($res==='staff' && $mth==='DELETE') {
    require_api_key($key,$API_KEY);
    parse_str($_SERVER['QUERY_STRING'] ?? '', $qs);
    $id = $qs['id'] ?? '';
    if(!$id) fail('Missing id');
    $staff = read_json($paths['staff']) ?? ['nurses'=>[], 'techs'=>[]];
    $removedPath = $DATA_DIR.'/staff-removed.json';
    $removedList = read_json($removedPath) ?? [];
    $found = null;
    foreach (['nurses','techs'] as $k) {
      $arr = $staff[$k] ?? [];
      $staff[$k] = array_values(array_filter($arr, function($row) use($id,&$found){
        if (($row['id']??'') === $id){ $found=$row; return false; } return true;
      }));
      if ($found) break;
    }
    if(!$found) fail('Not found',404);
    $found['_removed']=['at'=>now_iso()];
    $removedList[]=$found;
    write_json_atomic($paths['staff'],$staff);
    write_json_atomic($removedPath,$removedList);
    ok(['deleted'=>true,'id'=>$id]);
  }

  // CONFIG
  if ($res==='config' && $mth==='GET') ok(read_json($paths['config']) ?? new stdClass());
  if ($res==='config' && $mth==='POST'){
    require_api_key($key,$API_KEY);
    if(!is_array($json)) fail('Expected JSON object');
    write_json_atomic($paths['config'],$json);
    ok(['saved'=>true]);
  }

  // ACTIVE (per date + shift)
  if ($res==='active') {
    $date = (string)p('date', $json['dateISO'] ?? '');
    $shift= (string)p('shift',$json['shift'] ?? '');
    if(!$date || !$shift) fail('Missing date or shift');
    $file = $DATA_DIR."/active-{$date}-{$shift}.json";
    if($mth==='GET') ok(read_json($file) ?? new stdClass());
    if($mth==='POST'){ require_api_key($key,$API_KEY); if(!is_array($json)) fail('Expected JSON'); write_json_atomic($file,$json); ok(['saved'=>true]); }
    fail('Method not allowed',405);
  }

  // HISTORY (daily snapshot, entries[] per shift)
  if ($res==='history') {
    $date = (string)p('date',$json['dateISO'] ?? '');
    if(!$date) fail('Missing date');
    $file = $DATA_DIR."/history-{$date}.json";
    if($mth==='GET') ok(read_json($file) ?? ['entries'=>[]]);
    if($mth==='POST'){ require_api_key($key,$API_KEY); if(!is_array($json)) fail('Expected JSON'); write_json_atomic($file,$json); ok(['saved'=>true]); }
    fail('Method not allowed',405);
  }

  // HISTORY list
  if ($res==='history_list' && $mth==='GET') {
    $files = glob($DATA_DIR.'/history-*.json') ?: [];
    $dates = [];
    foreach($files as $f){ if(preg_match('~/history-(\d{4}-\d{2}-\d{2})\.json$~',$f,$m)) $dates[]=$m[1]; }
    sort($dates); ok(['dates'=>$dates]);
  }

  // HISTORY export (CSV)
  if ($res==='history_export' && $mth==='GET') {
    $date  = p('date',''); $start = p('start',''); $end = p('end','');

    $toRows = function($snap,$d,$shift){
      $rows=[]; $zones = $snap['zones'] ?? [];
      foreach($zones as $zone=>$arr){
        foreach($arr as $slot){
          $rows[]=[
            'date'=>$d,'shift'=>$shift,'zone'=>$zone,
            'id'=>$slot['id']??'','name'=>$slot['name']??($slot['label']??''),'type'=>$slot['type']??''
          ];
        }
      }
      return $rows;
    };
    $emit = function($rows,$fn){
      header('Content-Type: text/csv; charset=utf-8');
      header('Content-Disposition: attachment; filename="'.$fn.'"');
      $out=fopen('php://output','w');
      fputcsv($out,['date','shift','zone','id','name','type']);
      foreach($rows as $r){ fputcsv($out,[$r['date'],$r['shift'],$r['zone'],$r['id'],$r['name'],$r['type']]); }
      fclose($out); exit;
    };

    if($date){
      $rows=[]; $day = read_json($DATA_DIR."/history-{$date}.json");
      if($day && is_array($day['entries']??null)){
        foreach($day['entries'] as $e){ $rows=array_merge($rows,$toRows($e,$date,$e['shift']??'')); }
      } else {
        foreach(['day','night'] as $sh){ $a=read_json($DATA_DIR."/active-{$date}-{$sh}.json"); if($a) $rows=array_merge($rows,$toRows($a,$date,$sh)); }
      }
      $emit($rows,"history-{$date}.csv");
    }

    if($start && $end){
      $rows=[]; $period = new DatePeriod(new DateTime($start), new DateInterval('P1D'), (new DateTime($end))->modify('+1 day'));
      foreach($period as $dt){
        $d=$dt->format('Y-m-d'); $day=read_json($DATA_DIR."/history-{$d}.json");
        if($day && is_array($day['entries']??null)){
          foreach($day['entries'] as $e){ $rows=array_merge($rows,$toRows($e,$d,$e['shift']??'')); }
        } else {
          foreach(['day','night'] as $sh){ $a=read_json($DATA_DIR."/active-{$d}-{$sh}.json"); if($a) $rows=array_merge($rows,$toRows($a,$d,$sh)); }
        }
      }
      $emit($rows,"history-{$start}_to_{$end}.csv");
    }

    fail('Provide date=YYYY-MM-DD or start=YYYY-MM-DD&end=YYYY-MM-DD',400);
  }

  if ($res==='reset' && $mth==='POST'){
    require_api_key($key,$API_KEY);
    $what=(string)p('what','all'); $patterns=[];
    switch($what){
      case 'all':     $patterns=['/active-*.json','/history-*.json','/huddles-*.json','/config.json']; break;
      case 'active':  $patterns=['/active-*.json']; break;
      case 'history': $patterns=['/history-*.json']; break;
      case 'huddles': $patterns=['/huddles-*.json']; break;
      case 'config':  $patterns=['/config.json']; break;
      case 'staff':   $patterns=['/staff.json']; break;
      default: fail('Unknown reset target');
    }
    $deleted=[];
    foreach($patterns as $p){ foreach(glob($DATA_DIR.$p) as $f){ if(@unlink($f)) $deleted[]=basename($f); } }
    ok(['deleted'=>$deleted]);
  }

  if ($res==='huddles'){
    $date = (string)p('date',$json['dateISO'] ?? p('date',''));
    if(!$date) fail('Missing date');
    $file = $DATA_DIR."/huddles-{$date}.json";
    if($mth==='GET') ok(read_json($file) ?? ['checks'=>[],'notes'=>'']);
    if($mth==='POST'){ require_api_key($key,$API_KEY); if(!is_array($json)) fail('Expected JSON'); write_json_atomic($file,$json); ok(['saved'=>true]); }
    fail('Method not allowed',405);
  }

  if ($res==='') ok(['hello'=>'heybre api']);
  fail('Unknown resource',404);

} catch(Throwable $e){
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'Server error','detail'=>$e->getMessage()]);
  exit;
}
