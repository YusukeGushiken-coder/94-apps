//20250715 回転を加えた、フルスクリーン
//program by 94

let capture; // カメラ映像を格納する変数
let tileWidth; // 各タイルの幅
let tileHeight; // 各タイルの高さ
let GRID_SIZE = 4; // グリッドの初期サイズ (例: 4x4)
let currentRotation = 0; // 万華鏡パターン全体の回転角度
let ROTATION_SPEED = -0.01; // 回転の速度 (度/フレーム)
let count = 0;
let countspd = 0;

// グリッドサイズを自動変更するための変数
let lastGridResizeTime = 0;
const GRID_RESIZE_INTERVAL = 30000; // 30秒 (ミリ秒単位)

// カメラのキャプチャサイズを定義
const CAPTURE_WIDTH = 400;
const CAPTURE_HEIGHT = 400;

// 万華鏡パターン描画の基準となる全体のサイズ
let kaleidoscopePatternSize;

// ★ 追加する変数 ★
let fullscreenTimer; // タイマーのIDを保持する変数
const FULLSCREEN_DELAY = 10000; // 10秒 = 10000ミリ秒

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100,100);
    noCursor(); // フルスクリーンになったらカーソルを非表示にする

  // カメラを初期化。指定した解像度でキャプチャ
  capture = createCapture({
    video: {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
    },
    audio: false,
  });
  capture.hide(); // HTML要素として表示されるキャプチャ映像を非表示

  // colorMode(HSB); // 色モードをHSBに設定
  lastGridResizeTime = millis(); // 初期のグリッドサイズ変更タイマーを設定

  // 初期計算
  calculateKaleidoscopePatternSize();
  calculateTileSizes();

  // ★ 10秒後にフルスクリーンになるようにタイマーを設定 ★
  fullscreenTimer = setTimeout(() => {
    fullscreen(true); // フルスクリーンモードに切り替える
    noCursor(); // フルスクリーンになったらカーソルを非表示にする
  }, FULLSCREEN_DELAY); // 10秒後に実行
}

function draw() {
  background(0); // 毎回背景をクリア

  // 映像が準備できていない場合は何も描画しない
  if (!capture.loadedmetadata) {
    return;
  }

  // グリッドサイズを定期的に変更
  if (millis() - lastGridResizeTime > GRID_RESIZE_INTERVAL) {
    changeGridSize();
    calculateTileSizes(); // グリッドサイズ変更後にタイルサイズを再計算
    lastGridResizeTime = millis();
    count = random(360); //色相に適用
    countspd = random(-1,1); //色相が変化するスピード
  }

  // 万華鏡パターン全体の回転角度を更新
  currentRotation += ROTATION_SPEED;
  if (currentRotation >= 360) {
    currentRotation -= 360; // 360度を超えたら0に戻す
  }
  if (currentRotation < 0) {
    currentRotation += 360; // 360度を超えたら0に戻す
  }

  // --- 万華鏡パターンを描画する部分 ---
  push(); // 万華鏡パターン全体に変換を適用するため保存

  // キャンバスの中心を原点に移動
  translate(width / 2, height / 2);
  // 万華鏡パターン全体を回転
  rotate(radians(currentRotation));
  // 万華鏡パターンを中央に配置するためのオフセットを適用
  // パターン全体のサイズは kaleidoscopePatternSize を使う
  translate(-kaleidoscopePatternSize / 2, -kaleidoscopePatternSize / 2);

  // GRID_SIZE x GRID_SIZE 個のタイルを描画
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      push(); // タイルごとの変換を適用するため保存

      // 現在のタイルの左上隅に座標系の原点を移動
      // 各タイルは kaleidoscopePatternSize の中で描画される
      translate(
        x * (kaleidoscopePatternSize / GRID_SIZE),
        y * (kaleidoscopePatternSize / GRID_SIZE)
      );

      let scaleX = 1;
      let scaleY = 1;

      // X軸方向の反転を決定
      if (x % 2 === 1) {
        scaleX = -1;
      }

      // Y軸方向の反転を決定
      if (y % 2 === 1) {
        scaleY = -1;
      }

      // スケール（反転）を適用
      scale(scaleX, scaleY);

      // 反転によって映像がずれた分を補正
      let drawX = 0;
      let drawY = 0;

      if (scaleX === -1) {
        drawX = -(kaleidoscopePatternSize / GRID_SIZE);
      }
      if (scaleY === -1) {
        drawY = -(kaleidoscopePatternSize / GRID_SIZE);
      }

      // 映像を描画
      // 各タイルの描画サイズも kaleidoscopePatternSize に合わせて調整
      image(
        capture,
        drawX,
        drawY,
        kaleidoscopePatternSize / GRID_SIZE,
        kaleidoscopePatternSize / GRID_SIZE
      );

      pop(); // タイルごとの描画状態を元に戻す
    }
  }

  pop(); // 万華鏡パターン全体の変換を元に戻す

  // --- 静止した画面枠の四角形を描画する部分 ---

  /*
  let a = get(1, 1);
  let b = get(windowWidth - 1, 1);
  let c = get(1, windowHeight - 1);
  let d = get(windowWidth - 1, windowHeight - 1);

  noFill();
  strokeWeight(5);
  // 色相を時間とともに変化させる（0から360の範囲でループ）
  //stroke((frameCount * 2) % 360, 100, 90);

  stroke(a);
  rect(0, 0, windowWidth, windowHeight); // ウィンドウいっぱいに静止した枠線を描画

  stroke(b);
  rect(5, 5, windowWidth - 10, windowHeight - 10); // ウィンドウいっぱいに静止した枠線を描画

  stroke(d);
  rect(10, 10, width - 20, height - 20); // ウィンドウいっぱいに静止した枠線を描画

  stroke(c);
  rect(15, 15, width - 30, height - 30); // ウィンドウいっぱいに静止した枠線を描画
*/
  //マジカルな演出のための描画
  for (let i = 0; i < 5; i++) {
    noFill();
    strokeWeight(10 * i);
    stroke(count, 100, 100, 20);
    rect(0, 0, windowWidth, windowHeight);
  }

  count = count + countspd;
  if (count > 360) {
    count = 0;
  }   else if (count < 0) {
    count = 360;
  }
}

// 万華鏡パターン全体のサイズを計算するヘルパー関数
// 回転時に黒い余白が出ないように、キャンバスの対角線の長さを基準にする
function calculateKaleidoscopePatternSize() {
  kaleidoscopePatternSize = dist(0, 0, width, height);
}

// 各タイルのサイズを計算するヘルパー関数
function calculateTileSizes() {
  // tileWidth, tileHeight は直接使わないが、以前のロジックの名残で残しておく
  // 実際のタイルサイズは kaleidoscopePatternSize / GRID_SIZE で計算される
  tileWidth = kaleidoscopePatternSize / GRID_SIZE;
  tileHeight = kaleidoscopePatternSize / GRID_SIZE;
}

// グリッドサイズを変更するヘルパー関数
function changeGridSize() {
  let newSize = round(random(2, 6)); // 2から6の範囲でランダムなサイズを選択
  if (newSize === GRID_SIZE) {
    // 偶然同じサイズになった場合は、異なるサイズになるまで調整
    newSize = (newSize % 5) + 2;
    if (newSize === GRID_SIZE) newSize = ((newSize + 1) % 5) + 2; // さらに調整
  }
  GRID_SIZE = newSize;
  // GRID_SIZEが変わったら、万華鏡パターン全体のサイズ計算は不要（常に対角線基準のため）
  // タイルごとのサイズは draw() ループ内で kaleidoscopePatternSize / GRID_SIZE として計算される

  //回転の値を変更する。時計回り／反時計回りを繰り返す
  print(ROTATION_SPEED);
  if (ROTATION_SPEED > 0) {
    ROTATION_SPEED = random(-0.5, 0);
  } else {
    ROTATION_SPEED = random(0, 0.5);
  }
}

// ウィンドウサイズが変更されたときにキャンバスをリサイズする
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // ウィンドウのリサイズ時に万華鏡パターン全体のサイズとタイルサイズを再計算
  calculateKaleidoscopePatternSize();
  calculateTileSizes();
}

// マウスがクリックされたときにフルスクリーンを切り替える
function mouseClicked() {
  fullscreen(true); // true を渡すとトグル動作になります
  noCursor(); //フルスクリーンの時はカーソルを消す
}
