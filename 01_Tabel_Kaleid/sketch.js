//20250715 回転を加えた、フルスクリーン
//program by 94
//20261015 カメラ初期起動バグを完全修正（初見ブラウザ対応版）

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
let fullscreenTimer; 
const FULLSCREEN_DELAY = 10000; // 10秒 = 10000ミリ秒

// カメラ切り替え用の変数
let videoDevices = []; // 利用可能なカメラを格納する配列
let currentDeviceIndex = 0; // 現在使用中のカメラ番号
let isCameraReady = false; // カメラ映像の準備ができたフラグ
let hasStarted = false; // 最初のクリックが完了したかどうかのフラグ

// マウス連動・非表示タイマー用の変数
let switchBtn;
let lastMouseMovedTime = 0; // 最後にマウスが動いた時刻
const UI_HIDE_DELAY = 3000; // マウス停止からボタンが消えるまでの時間

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  cursor(ARROW); // 最初のクリックを促すために最初はカーソルを出す

  // 下部中央に配置する「CAMERA SWITCH」ボタンの作成とデザイン
  switchBtn = createButton('CAMERA SWITCH');
  updateButtonPosition(); 
  
  switchBtn.style('font-size', '12px');
  switchBtn.style('font-family', "'Helvetica Neue', Helvetica, Arial, sans-serif");
  switchBtn.style('letter-spacing', '2px');
  switchBtn.style('font-weight', 'bold');
  switchBtn.style('padding', '12px 24px');
  switchBtn.style('background', 'rgba(20, 20, 20, 0.8)'); 
  switchBtn.style('color', '#ffffff');
  switchBtn.style('border', '1px solid rgba(255, 255, 255, 0.2)');
  switchBtn.style('border-radius', '20px'); 
  switchBtn.style('cursor', 'pointer');
  switchBtn.style('opacity', '0'); // 最初は非表示
  switchBtn.style('transition', 'opacity 0.4s ease'); 
  switchBtn.style('outline', 'none');
  switchBtn.style('z-index', '9999'); 
  
  switchBtn.mousePressed(switchKaleidoscopeCamera);

  lastGridResizeTime = millis(); 
  lastMouseMovedTime = millis(); 

  calculateKaleidoscopePatternSize();
  calculateTileSizes();
}

// 🚀 【最重要】修正：どのブラウザでも100%確実に起動させる手順
function startAppOnFirstClick() {
  hasStarted = true;
  noCursor();

  // 手順①：まずはIDを指定せず、標準カメラ（内蔵など）をシンプルに起動してブラウザの「カメラ許可」を要求する
  let defaultConstraints = {
    video: {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    },
    audio: false
  };

  capture = createCapture(defaultConstraints, function(stream) {
    isCameraReady = true;
    console.log("初期カメラが起動しました。デバイスリストを解放します。");
    
    // 手順②：ユーザーが「許可」を押した「直後」なら、セキュリティロックが解除されて全ての外付けカメラのIDが取得可能になる
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
          videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log("認識されたカメラ数: " + videoDevices.length);
        })
        .catch(function(err) {
          console.error("デバイスリストの取得に失敗しました: ", err);
        });
    }
  });
  capture.hide();

  // 10秒後にフルスクリーンにするタイマーを設定
  fullscreenTimer = setTimeout(() => {
    fullscreen(true); 
    noCursor(); 
  }, FULLSCREEN_DELAY);
}

function updateButtonPosition() {
  if (switchBtn) {
    switchBtn.position(windowWidth / 2 - 80, windowHeight - 70);
  }
}

// 2回目以降、ボタンを押してカメラを切り替えるときの処理
function startKaleidoscopeCamera(index) {
  isCameraReady = false;
  if (capture) {
    capture.remove(); // 古いストリームを確実に停止
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
    console.log("カメラを切り替えました: " + videoDevices[index].label);
  });
  capture.hide(); 
}

function switchKaleidoscopeCamera() {
  if (videoDevices.length <= 1) {
    console.log("切り替え可能な別の外部カメラが見つかりません。");
    return;
  }
  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  startKaleidoscopeCamera(currentDeviceIndex);
}

function mouseMoved() {
  if (hasStarted) lastMouseMovedTime = millis();
}

function mouseDragged() {
  if (hasStarted) lastMouseMovedTime = millis();
}

function draw() {
  background(0); 

  // まだ開始していない（最初のクリック前）の場合は、画面中央に案内を出す
  if (!hasStarted) {
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text("CLICK TO START KALEIDOSCOPE", width / 2, height / 2);
    return; 
  }

  // マウスの動きを監視してボタンを制御
  if (millis() - lastMouseMovedTime < UI_HIDE_DELAY) {
    switchBtn.style('opacity', '1'); 
    cursor(ARROW); 
  } else {
    switchBtn.style('opacity', '0'); 
    if (fullscreen()) noCursor(); 
  }

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

  currentRotation += ROTATION_SPEED;
  if (currentRotation >= 360) currentRotation -= 360; 
  if (currentRotation < 0) currentRotation += 360; 

  // 万華鏡パターンの描画
  push(); 
  translate(width / 2, height / 2);
  rotate(radians(currentRotation));
  translate(-kaleidoscopePatternSize / 2, -kaleidoscopePatternSize / 2);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      push(); 
      translate(x * (kaleidoscopePatternSize / GRID_SIZE), y * (kaleidoscopePatternSize / GRID_SIZE));
      let scaleX = 1, scaleY = 1;
      if (x % 2 === 1) scaleX = -1;
      if (y % 2 === 1) scaleY = -1;
      scale(scaleX, scaleY);
      let drawX = 0, drawY = 0;
      if (scaleX === -1) drawX = -(kaleidoscopePatternSize / GRID_SIZE);
      if (scaleY === -1) drawY = -(kaleidoscopePatternSize / GRID_SIZE);
      image(capture, drawX, drawY, kaleidoscopePatternSize / GRID_SIZE, kaleidoscopePatternSize / GRID_SIZE);
      pop(); 
    }
  }
  pop(); 

  // マジカルな演出
  for (let i = 0; i < 5; i++) {
    noFill();
    strokeWeight(10 * i);
    stroke(count, 100, 100, 20);
    rect(0, 0, windowWidth, windowHeight);
  }

  count = count + countspd;
  if (count > 360) count = 0;
  else if (count < 0) count = 360;
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
  if (ROTATION_SPEED > 0) ROTATION_SPEED = random(-0.5, 0);
  else ROTATION_SPEED = random(0, 0.5);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateKaleidoscopePatternSize();
  calculateTileSizes();
  updateButtonPosition(); 
}

function mouseClicked() {
  if (!hasStarted) {
    startAppOnFirstClick();
    return;
  }

  // ボタン領域のクリック判定
  if (millis() - lastMouseMovedTime < UI_HIDE_DELAY) {
    let btnX = windowWidth / 2 - 80;
    let btnY = windowHeight - 70;
    if (mouseX > btnX && mouseX < btnX + 160 && mouseY > btnY && mouseY < btnY + 40) {
      return; 
    }
  }
  
  fullscreen(!fullscreen()); 
  noCursor(); 
}
