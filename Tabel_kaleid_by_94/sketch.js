//20250715 回転を加えた、フルスクリーン
//program by 94
//20261014 デバイス（外付けカメラ）切り替え機能を追加（マウス連動ステルスボタン仕様）

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

// フルスクリーン用の変数
let fullscreenTimer; // タイマーのIDを保持する変数
const FULLSCREEN_DELAY = 10000; // 10秒 = 10000ミリ秒

// カメラ切り替え用の変数
let videoDevices = []; // 利用可能なカメラを格納する配列
let currentDeviceIndex = 0; // 現在使用中のカメラ番号
let isCameraReady = false; // カメラ映像の準備ができたフラグ

// ★ マウス連動・非表示タイマー用の変数 ★
let switchBtn;
let lastMouseMovedTime = 0; // 最後にマウスが動いた時刻
const UI_HIDE_DELAY = 3000; // マウス停止からボタンが消えるまでの時間（3秒 = 3000ミリ秒）

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noCursor(); // 初期状態ではカーソルを非表示にする

  // 1. パソコンに接続されているすべてのデバイス（カメラ）を取得する
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices()
      .then(function(devices) {
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length > 0) {
          startKaleidoscopeCamera(0);
        } else {
          initDefaultCamera();
        }
      })
      .catch(function(err) {
        console.error("カメラデバイスの取得に失敗しました: ", err);
        initDefaultCamera();
      });
  } else {
    initDefaultCamera();
  }

  // ★ 2. 下部中央に配置する「CAMERA SWITCH」ボタンの作成とデザイン ★
  switchBtn = createButton('CAMERA SWITCH');
  updateButtonPosition(); // ボタンの位置を画面下部中央に配置
  
  // スタイルをCSSで美しく制御
  switchBtn.style('font-size', '12px');
  switchBtn.style('font-family', "'Helvetica Neue', Helvetica, Arial, sans-serif");
  switchBtn.style('letter-spacing', '2px');
  switchBtn.style('font-weight', 'bold');
  switchBtn.style('padding', '12px 24px');
  switchBtn.style('background', 'rgba(20, 20, 20, 0.8)'); // 高級感のある半透明の黒
  switchBtn.style('color', '#ffffff');
  switchBtn.style('border', '1px solid rgba(255, 255, 255, 0.2)');
  switchBtn.style('border-radius', '20px'); // 角を丸くしてモダンに
  switchBtn.style('cursor', 'pointer');
  switchBtn.style('opacity', '0'); // 最初は完全に透明（見えない）
  switchBtn.style('transition', 'opacity 0.4s ease'); // 消える・現れるスピードを滑らかに
  switchBtn.style('outline', 'none');
  switchBtn.style('z-index', '9999'); // 最前面に配置
  
  switchBtn.mousePressed(switchKaleidoscopeCamera);

  lastGridResizeTime = millis(); // 初期のグリッドサイズ変更タイマーを設定
  lastMouseMovedTime = millis(); // マウス移動タイマーを現在時刻で初期化

  // 初期計算
  calculateKaleidoscopePatternSize();
  calculateTileSizes();

  // 10秒後にフルスクリーンになるようにタイマーを設定
  fullscreenTimer = setTimeout(() => {
    fullscreen(true); // フルスクリーンモードに切り替える
    noCursor(); // フルスクリーンになったらカーソルを非表示にする
  }, FULLSCREEN_DELAY); // 10秒後に実行
}

// ボタンの位置を画面の「下部中央」に更新する関数（画面リサイズ対応）
function updateButtonPosition() {
  if (switchBtn) {
    // 画面の横中央、下から70pxの位置に配置（ボタンの幅 約160pxを考慮してマイナス80でセンター合わせ）
    switchBtn.position(windowWidth / 2 - 80, windowHeight - 70);
  }
}

// 指定したインデックス番号のカメラを起動する関数
function startKaleidoscopeCamera(index) {
  isCameraReady = false;
  if (capture) {
    capture.remove(); 
  }

  let constraints = {
    video: {
      deviceId: { exact: videoDevices[index].deviceId },
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    },
    audio: false
  };

  capture = createCapture(constraints, function(stream) {
    isCameraReady = true;
    console.log("カメラが正常に起動しました: " + videoDevices[index].label);
  });
  capture.hide(); 
}

function initDefaultCamera() {
  capture = createCapture({
    video: {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    },
    audio: false
  }, function() {
    isCameraReady = true;
  });
  capture.hide();
}

function switchKaleidoscopeCamera() {
  if (videoDevices.length <= 1) {
    console.log("利用可能な外部カメラが他にありません。");
    return;
  }
  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  startKaleidoscopeCamera(currentDeviceIndex);
}

// ★ 3. p5.js標準の「マウスが動いたとき」に呼び出される関数 ★
function mouseMoved() {
  lastMouseMovedTime = millis(); // マウスが動いたら、その瞬間の時刻を記録する
}

// ★ 4. p5.js標準の「マウスがドラッグされたとき」にも対応（クリック中の移動対策） ★
function mouseDragged() {
  lastMouseMovedTime = millis();
}

function draw() {
  background(0); // 毎回背景をクリア

  // ★ 5. マウスの動きを監視してボタンとカーソルの表示・非表示を制御するロジック ★
  // 現在の時刻から、最後にマウスが動いた時刻を引いた時間が「3秒以内」であれば表示
  if (millis() - lastMouseMovedTime < UI_HIDE_DELAY) {
    switchBtn.style('opacity', '1'); // ボタンをくっきり表示
    cursor(ARROW); // 位置を見失わないように矢印カーソルを復活させる
  } else {
    switchBtn.style('opacity', '0'); // マウスが3秒間止まったらボタンを完全に消す
    if (fullscreen()) {
      noCursor(); // フルスクリーン中はカーソルを再び消し去る
    }
  }

  // 映像およびカスタムフラグが準備できていない場合は何も描画しない
  if (!isCameraReady || !capture || !capture.loadedmetadata) {
    return;
  }

  // グリッドサイズを定期的に変更
  if (millis() - lastGridResizeTime > GRID_RESIZE_INTERVAL) {
    changeGridSize();
    calculateTileSizes(); 
    lastGridResizeTime = millis();
    count = random(360); 
    countspd = random(-1, 1); 
  }

  // 万華鏡パターン全体の回転角度を更新
  currentRotation += ROTATION_SPEED;
  if (currentRotation >= 360) {
    currentRotation -= 360; 
  }
  if (currentRotation < 0) {
    currentRotation += 360; 
  }

  // --- 万華鏡パターンを描画する部分 ---
  push(); 

  translate(width / 2, height / 2);
  rotate(radians(currentRotation));
  translate(-kaleidoscopePatternSize / 2, -kaleidoscopePatternSize / 2);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      push(); 

      translate(
        x * (kaleidoscopePatternSize / GRID_SIZE),
        y * (kaleidoscopePatternSize / GRID_SIZE)
      );

      let scaleX = 1;
      let scaleY = 1;

      if (x % 2 === 1) {
        scaleX = -1;
      }
      if (y % 2 === 1) {
        scaleY = -1;
      }

      scale(scaleX, scaleY);

      let drawX = 0;
      let drawY = 0;

      if (scaleX === -1) {
        drawX = -(kaleidoscopePatternSize / GRID_SIZE);
      }
      if (scaleY === -1) {
        drawY = -(kaleidoscopePatternSize / GRID_SIZE);
      }

      image(
        capture,
        drawX,
        drawY,
        kaleidoscopePatternSize / GRID_SIZE,
        kaleidoscopePatternSize / GRID_SIZE
      );

      pop(); 
    }
  }

  pop(); 

  // マジカルな演出のための描画
  for (let i = 0; i < 5; i++) {
    noFill();
    strokeWeight(10 * i);
    stroke(count, 100, 100, 20);
    rect(0, 0, windowWidth, windowHeight);
  }

  count = count + countspd;
  if (count > 360) {
    count = 0;
  } else if (count < 0) {
    count = 360;
  }
}

function calculateKaleidoscopePatternSize() {
  kaleidoscopePatternSize = dist(0, 0, width, height);
}

function calculateTileSizes() {
  tileWidth = kaleidoscopePatternSize / GRID_SIZE;
  tileHeight = kaleidoscopePatternSize / GRID_SIZE;
}

function changeGridSize() {
  let newSize = round(random(2, 6)); 
  if (newSize === GRID_SIZE) {
    newSize = (newSize % 5) + 2;
    if (newSize === GRID_SIZE) newSize = ((newSize + 1) % 5) + 2; 
  }
  GRID_SIZE = newSize;

  if (ROTATION_SPEED > 0) {
    ROTATION_SPEED = random(-0.5, 0);
  } else {
    ROTATION_SPEED = random(0, 0.5);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateKaleidoscopePatternSize();
  calculateTileSizes();
  updateButtonPosition(); // 画面リサイズ時にボタンの位置を中央下部に自動再配置
}

function mouseClicked() {
  // マウスを動かして「CAMERA SWITCH」ボタンが表示されている時に、
  // そのボタンの領域をピンポイントでクリックした場合はフルスクリーン処理（トグル）を無視してカメラ切り替えのみ行う
  if (millis() - lastMouseMovedTime < UI_HIDE_DELAY) {
    let btnX = windowWidth / 2 - 80;
    let btnY = windowHeight - 70;
    // ボタンのサイズ（幅 約160px、高さ 約40px）の範囲内か判定
    if (mouseX > btnX && mouseX < btnX + 160 && mouseY > btnY && mouseY < btnY + 40) {
      return; 
    }
  }
  
  fullscreen(true); 
  noCursor(); 
}
