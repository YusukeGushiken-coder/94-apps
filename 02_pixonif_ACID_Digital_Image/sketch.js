/*
to do memo 1105
Tone.js 移植版

バージョン番号の仕組み（X.Y.Z）
メジャー（1）: 大規模なアップデート、画面構成の刷新、互換性の変わる変更
マイナー（0）: 機能の追加やUI改善（例：新機能追加で 1.1.0 へ）
パッチ（0）: 細かなバグ修正や微調整（例：バグ修正で 1.0.1 へ）
*/

// ★ バージョン表記文字列（ここで内容を変更できます）
const APP_VERSION_INFO = "pixonif ACID Digital Image v1.0.1 (2026.11.11) designed by Yusuke Gushiken";

// 固定値として設定するパラメータ
const AREA_PERCENTAGE = 50; // エリア
const TOGGLE_MODE = true; // 円形/直線のモード切り替え

// 設定
let kickmode = true;
let bpm = 130;

// 画像を表示する
let pixonif;

// Tone.js サウンド変数
let synth; // シンセサイザー
let filter; // フィルター
let distortion; // ディストーションエフェクト
let distGainNode; // ディストーションON時の自動音量補正ノード
let beatGainNode; // ドラム全体のマスター音量ノード
let reverb; // ドラム用リバーブエフェクト
let kits = {}; // ドラム用サンプルプレイヤー群（909, 808）
let kit; // 現在アクティブなドラムキットを参照する変数
let waveform; // ウェーブフォーム
let fft;

// ビデオ・画像変数
let video;
let videoLoaded = false;
let camAspectRatio;
let displayVideoWidth;
let displayVideoHeight;
let displayVideoX;
let displayVideoY;
let fileInput;
let radiusInitialized = false; // Rサイズ初回セット完了フラグ

// センシングと描画関連
let px = 0;
let py = 0;
let R = 150; // 確定済みの半径
let nowX;
let nowY;

// シーケンサー関連
let seq = 0; // 現在のシーケンスステップ
const STEP = 16; // シーケンスのステップ数
let lastStep = STEP - 1;

// ピクセルデータと座標配列
let sonicrad = [];
let pi1 = [];
let x = [];
let y = [];
let setrad = [];
let sonicEvents = [];

// GUI管理用オブジェクト
const params = {
  bpm: 130,
  isPlaying: true, // 画像読み込み後即再生
  radius: 50, // 次に確定させるRサイズ（スライダー変更値）
  kick: true,
  beatSound: true, // BEAT ON/OFF
  beatVol: 80, // BEAT VOL (0 - 100)
  synthSound: true, // SYNTH ON/OFF
  synthVol: 80, // SYNTH VOL (0 - 100)
  resonance: 14, // RESONANCE (Q値: 1 - 30)
  distSound: false, // DISTORTION ON/OFF
  distAmount: 40, // 歪み具合 (0 - 100)
  reverbSound: false, // REVERB ON/OFF
  reverbAmount: 40,   // REVERB MIX (0 - 100)
  oscType: "square",
  kitType: "909", // 909 / 808 切り替え用
};
let pane;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);

  pixonif = loadImage("banner/pixonif3.PNG");

  // 画像のアップロードボタンを作成
  fileInput = createFileInput(handleFile);
  fileInput.position(width / 2 - 100, height / 2 - 20);

  // 安全対策の初期化
  video = createImage(1, 1);
  video.loadedmetadata = false;

  // Tone.js 音源＆タイマー初期化
  Tone.Transport.bpm.value = bpm;

  // ドラム用マスター音量ノードの構築
  const initialGain = params.beatSound ? (params.beatVol / 100) : 0;
  beatGainNode = new Tone.Gain(initialGain).toDestination();

  // リバーブの初期構築
  reverb = new Tone.Freeverb({
    roomSize: 0.7,
    dampening: 3000,
    wet: params.reverbSound ? (params.reverbAmount / 100) : 0.0,
  }).connect(beatGainNode);

  // --- TR-909 サンプルのロード ---
  kits["909"] = new Tone.Players(
    {
      BD: "beats/909_BD.mp3",
      CH: "beats/909_CH.mp3",
      OH: "beats/909_OH.mp3",
      SD: "beats/909_SD.mp3",
      HC: "beats/909_HC.mp3",

      HT: "beats/909_HT.mp3",
      MT: "beats/909_MT.mp3",
      LT: "beats/909_LT.mp3",
      RC: "beats/909_RC.mp3",
    },
    () => {
      console.log("909ドラムサンプルの読み込みが完了しました！");
      setupDrumRouting(kits["909"]);
      updateBeatVolume();
    }
  );

  // --- TR-808 サンプルのロード ---
  kits["808"] = new Tone.Players(
    {
      BD: "beats/808_BD.mp3",
      CH: "beats/808_CH.mp3",
      OH: "beats/808_OH.mp3",
      SD: "beats/808_SD.mp3",
      HC: "beats/808_HC.mp3",

      HT: "beats/808_HT.mp3",
      MT: "beats/808_CB.mp3",
      LT: "beats/808_LT.mp3",
      RC: "beats/808_RC.mp3",
    },
    () => {
      console.log("808ドラムサンプルの読み込みが完了しました！");
      setupDrumRouting(kits["808"]);
      updateBeatVolume();
    }
  );

  kit = kits["909"];

  // ディストーションの構築
  distortion = new Tone.Distortion({
    distortion: params.distAmount / 100,
    oversample: "2x",
    wet: params.distSound ? 1.0 : 0.0,
  });

  distGainNode = new Tone.Gain(params.distSound ? 0.75 : 1.0).toDestination();
  filter = new Tone.Filter(1000, "lowpass");

  synth = new Tone.Synth({
    oscillator: { type: params.oscType },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.1,
      release: 0.1,
    },
  }).connect(filter);

  filter.connect(distortion);
  distortion.connect(distGainNode);

  fft = new Tone.FFT(32);
  waveform = new Tone.Waveform(1024);
  Tone.getDestination().connect(waveform);
  Tone.getDestination().connect(fft);

  Tone.Transport.scheduleRepeat(onStep, "16n");

  px = width / 2;
  py = height / 2;

  // ★ 12時方向（-90度）を Step 0 として初期設定
  for (let i = 0; i < STEP; i++) {
    sonicrad[i] = (360 / STEP) * i - 90;
    pi1[i] = color(0, 0, 0);
    x[i] = px;
    y[i] = py;
    setrad[i] = 0;
  }

  setupGUI();
}

function setupDrumRouting(playersObj) {
  if (!playersObj || !beatGainNode) return;

  const dryOnly = ["BD", "HT", "MT", "LT"];
  const reverbSend = ["SD", "CH", "OH", "HC", "RC"];

  dryOnly.forEach((name) => {
    try {
      let p = playersObj.player(name);
      if (p) {
        p.disconnect();
        p.connect(beatGainNode);
      }
    } catch (e) {}
  });

  reverbSend.forEach((name) => {
    try {
      let p = playersObj.player(name);
      if (p) {
        p.disconnect();
        p.connect(beatGainNode);
        p.connect(reverb);
      }
    } catch (e) {}
  });
}

function updateReverbState() {
  if (reverb) {
    const wetVal = params.reverbSound ? params.reverbAmount / 100 : 0.0;
    reverb.wet.rampTo(wetVal, 0.05);
  }
}

function updateDistortionState() {
  if (distortion && distGainNode) {
    distortion.wet.value = params.distSound ? 1.0 : 0.0;
    const targetGain = params.distSound ? 0.75 : 1.0;
    distGainNode.gain.rampTo(targetGain, 0.05);
  }
}

function updateBeatVolume() {
  if (beatGainNode) {
    // beatSound の ON/OFF でミュートせず、BEATS VOL の値だけを適用
    const targetGain = params.beatVol / 100;
    beatGainNode.gain.rampTo(targetGain, 0.05);
  }
}

function onStep(time) {
  lastStep = seq;

  seq = (seq + 1) % STEP;
  if (typeof sonic === "function") {
    sonic(time);
  }

  if (typeof beats === "function") {
    beats(time);
  }

}

async function stepForward() {
  await Tone.start();
  onStep(Tone.now());
}

// ★ 高速ピクセルカラー取得関数（12時方向スタートで座標決定）
function colorGet() {
  if (!video || !videoLoaded || video.width === 0 || video.height === 0) return;
  
  video.loadPixels();
  if (!video.pixels || video.pixels.length === 0) return;

  for (let i = 0; i < STEP; i++) {
    let rad = (360 / STEP) * i - 90; // 12時方向スタート
    let sx = px + R * cos(radians(rad));
    let sy = py + R * sin(radians(rad));
    x[i] = sx;
    y[i] = sy;

    let vx = floor(map(sx, displayVideoX, displayVideoX + displayVideoWidth, 0, video.width));
    let vy = floor(map(sy, displayVideoY, displayVideoY + displayVideoHeight, 0, video.height));
    vx = constrain(vx, 0, video.width - 1);
    vy = constrain(vy, 0, video.height - 1);

    let index = (vy * video.width + vx) * 4;
    let r = video.pixels[index];
    let g = video.pixels[index + 1];
    let b = video.pixels[index + 2];
    
    push();
    colorMode(RGB, 255, 255, 255);
    pi1[i] = color(r, g, b);
    pop();
  }
}

// --- draw関数 ---
function draw() {
  cursor(CROSS);
  colorMode(RGB, 255, 255, 255);
  background(20);

  const container = document.getElementById("tweakpane-container");
  if (container) {
    container.style.display = videoLoaded ? "block" : "none";
  }

  if (!videoLoaded) {
    if (fileInput) {
      fileInput.show();
      fileInput.position(width / 2 - 100, height / 2 - 20);
    }

    fill(255);
    noStroke();
    textSize(22);
    textAlign(CENTER, CENTER);
    text("画像をアップロードしてください", width / 2, height / 2 - 70);

    if (pixonif && pixonif.width > 0) {
      const bannerW = min(width * 0.4, 280);
      const bannerAspect = pixonif.height / pixonif.width;
      const bannerH = bannerW * bannerAspect;

      const bannerX = width / 2 - bannerW / 2;
      const bannerY = height - bannerH - 30;

      push();
      fill(160);
      noStroke();
      textSize(11);
      textAlign(CENTER, BOTTOM);
      text(APP_VERSION_INFO, width / 2, bannerY - 8);
      pop();

      image(pixonif, bannerX, bannerY, bannerW, bannerH);
    }
    return;
  }

  if (fileInput) fileInput.hide();

  const leftPanelWidth = width * 0.65;
  const leftPanelHeight = height;

  if (video.loadedmetadata && camAspectRatio) {
    const maxAvailableWidth = leftPanelWidth - 80;
    const baseSquareSize = min(maxAvailableWidth, leftPanelHeight);

    if (camAspectRatio < 1) {
      displayVideoHeight = leftPanelHeight;
      displayVideoWidth = displayVideoHeight * camAspectRatio;
      if (displayVideoWidth > maxAvailableWidth) {
        displayVideoWidth = maxAvailableWidth;
        displayVideoHeight = displayVideoWidth / camAspectRatio;
      }
    } else {
      displayVideoWidth = baseSquareSize;
      displayVideoHeight = displayVideoWidth / camAspectRatio;
    }

    displayVideoX = 40;
    displayVideoY = (leftPanelHeight - displayVideoHeight) / 2;

    image(
      video,
      displayVideoX,
      displayVideoY,
      displayVideoWidth,
      displayVideoHeight
    );

    if (!radiusInitialized) {
      R = round(baseSquareSize / 7);
      params.radius = R;
      if (pane) pane.refresh();
      radiusInitialized = true;
    }
  }

  if (video && video.width > 0 && video.height > 0) {
    colorGet();
  }

  drawControlPanelArea(leftPanelWidth);
  monitor();
}



function drawControlPanelArea(leftWidth) {
  push();
  colorMode(RGB, 255, 255, 255);
  fill(30);
  noStroke();
  rect(leftWidth, 0, width - leftWidth, height);
  stroke(60);
  strokeWeight(2);
  line(leftWidth, 0, leftWidth, height);

  if (pixonif && pixonif.width > 0) {
    const margin = 20;

    const panelWidth = width - leftWidth;
    const imgWidth = panelWidth - margin * 2;

    const imgAspect = pixonif.height / pixonif.width;
    const imgHeight = imgWidth * imgAspect;

    const imgX = leftWidth + margin;
    const imgY = height - imgHeight - margin;

    push();
    fill(160);
    noStroke();
    textSize(10);
    textAlign(LEFT, BOTTOM);
    text(APP_VERSION_INFO, imgX + 1, imgY - 32, imgWidth, 28);
    pop();

    image(pixonif, imgX, imgY, imgWidth, imgHeight);
  }

  pop();
}


function setupGUI() {
  const leftPanelWidth = width * 0.65;
  const paneWidth = width - leftPanelWidth - 40;

  let container = document.getElementById("tweakpane-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "tweakpane-container";
    document.body.appendChild(container);
  }

  container.style.position = "absolute";
  container.style.top = "20px";
  container.style.left = `${leftPanelWidth + 20}px`;
  container.style.width = `${paneWidth}px`;
  container.style.zIndex = "99999";

  let PaneClass = window.Pane;
  if (!PaneClass && window.Tweakpane) {
    PaneClass = window.Tweakpane.Pane || window.Tweakpane;
  }

  if (!PaneClass) {
    setTimeout(setupGUI, 100);
    return;
  }

  if (pane) pane.dispose();

  pane = new PaneClass({
    container: container,
    title: "CONTROL PANEL",
  });

  const addCtrl = (target, key, opt) => {
    if (typeof pane.addBinding === "function") {
      return pane.addBinding(target, key, opt);
    } else if (typeof pane.addInput === "function") {
      return pane.addInput(target, key, opt);
    }
  };

  const addSep = () => {
    if (typeof pane.addBlade === "function") {
      pane.addBlade({ view: "separator" });
    } else if (typeof pane.addSeparator === "function") {
      pane.addSeparator();
    }
  };

  addCtrl(params, "isPlaying", { label: "PLAY / STOP (P)" }).on(
    "change",
    (ev) => {
      const val = typeof ev.value !== "undefined" ? ev.value : ev;
      if (val) Tone.Transport.start();
      else Tone.Transport.stop();
    }
  );

  if (typeof pane.addButton === "function") {
    pane.addButton({ title: "NEXT STEP (Space / →)" }).on("click", () => {
      if (!params.isPlaying || Tone.Transport.state !== "started") {
        stepForward();
      }
    });
  }

  addCtrl(params, "bpm", { min: 60, max: 200, step: 1, label: "BPM (↑/↓)" }).on(
    "change",
    (ev) => {
      const val = typeof ev.value !== "undefined" ? ev.value : ev;
      bpm = val;
      Tone.Transport.bpm.value = bpm;
    }
  );

  addCtrl(params, "radius", {
    min: 10,
    max: 200,
    step: 1,
    label: "RADIUS (R)",
  }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.radius = val;
  });

  addSep();

// 3. ドラムキット選択（909 / 808 切り替え）
  addCtrl(params, "kitType", {
    options: {
      "909": "909",
      "808": "808",
    },
    label: "DRUM KIT",
  }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.kitType = val;

    // ① 旧キットの再生中サンプルをすべて安全に即時停止
    if (kit && typeof kit.stopAll === "function") {
      try {
        kit.stopAll();
      } catch (e) {}
    }

    // ② 一瞬音量を0にし、50ミリ秒かけて滑らかに戻す（スパイクノイズ防止）
    if (beatGainNode) {
      beatGainNode.gain.setValueAtTime(0, Tone.now());
      const targetGain = params.beatSound ? (params.beatVol / 100) : 0;
      beatGainNode.gain.rampTo(targetGain, 0.05, Tone.now() + 0.01);
    }

    // ③ 新しいキットに参照を切り替え
    if (kits[val]) {
      kit = kits[val];
    }
  });

  addCtrl(params, "kick", { label: "AUTO KICK (K)" }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    kickmode = val;
  });

  addCtrl(params, "beatSound", { label: "BEATS (B)" }).on("change", (ev) => {
    params.beatSound = typeof ev.value !== "undefined" ? ev.value : ev;
    updateBeatVolume();
  });

  addCtrl(params, "beatVol", {
    min: 0,
    max: 100,
    step: 1,
    label: "BEATS VOL",
  }).on("change", (ev) => {
    params.beatVol = typeof ev.value !== "undefined" ? ev.value : ev;
    updateBeatVolume();
  });

  addCtrl(params, "reverbSound", { label: "BEAT REVERB (R)" }).on("change", (ev) => {
    params.reverbSound = typeof ev.value !== "undefined" ? ev.value : ev;
    updateReverbState();
  });

  addCtrl(params, "reverbAmount", {
    min: 0,
    max: 100,
    step: 1,
    label: "REVERB AMOUNT",
  }).on("change", (ev) => {
    params.reverbAmount = typeof ev.value !== "undefined" ? ev.value : ev;
    updateReverbState();
  });

  addSep();

  addCtrl(params, "oscType", {
    options: {
      Square: "square",
      Sawtooth: "sawtooth",
    },
    label: "OSCILLATOR",
  }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.oscType = val;
    if (synth) {
      synth.set({
        oscillator: { type: val },
      });
    }
  });

  addCtrl(params, "synthSound", { label: "SYNTH (S)" }).on("change", (ev) => {
    params.synthSound = typeof ev.value !== "undefined" ? ev.value : ev;
  });

  addCtrl(params, "synthVol", {
    min: 0,
    max: 100,
    step: 1,
    label: "SYNTH VOL",
  }).on("change", (ev) => {
    params.synthVol = typeof ev.value !== "undefined" ? ev.value : ev;
  });

  addCtrl(params, "resonance", {
    min: 1,
    max: 30,
    step: 0.5,
    label: "RESONANCE (Q)",
  }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.resonance = val;
  });

  addSep();

  addCtrl(params, "distSound", { label: "DISTORTION (D)" }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.distSound = val;
    updateDistortionState();
  });

  addCtrl(params, "distAmount", {
    min: 0,
    max: 100,
    step: 1,
    label: "DIST AMOUNT",
  }).on("change", (ev) => {
    const val = typeof ev.value !== "undefined" ? ev.value : ev;
    params.distAmount = val;
    if (distortion) {
      distortion.distortion = val / 100;
    }
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  if (fileInput && !videoLoaded) {
    fileInput.position(width / 2 - 100, height / 2 - 20);
  }
  
  const container = document.getElementById("tweakpane-container");
  if (container) {
    const leftPanelWidth = width * 0.65;
    container.style.left = `${leftPanelWidth + 20}px`;
    container.style.width = `${width - leftPanelWidth - 40}px`;
  }
}

function keyPressed() {
  if (key === "p" || key === "P") {
    params.isPlaying = !params.isPlaying;
    if (params.isPlaying) Tone.Transport.start();
    else Tone.Transport.stop();
  }

  if (key === " " || keyCode === RIGHT_ARROW) {
    if (!params.isPlaying || Tone.Transport.state !== "started") {
      stepForward();
    }
  }

  if (key === "k" || key === "K") {
    params.kick = !params.kick;
    kickmode = params.kick;
  }

  if (key === "b" || key === "B") {
    params.beatSound = !params.beatSound;
    updateBeatVolume();
  }

  if (key === "r" || key === "R") {
    params.reverbSound = !params.reverbSound;
    updateReverbState();
  }

  if (key === "s" || key === "S") {
    params.synthSound = !params.synthSound;
  }

  if (key === "d" || key === "D") {
    params.distSound = !params.distSound;
    updateDistortionState();
  }

  if (keyCode === UP_ARROW) {
    params.bpm = min(200, params.bpm + 5);
    bpm = params.bpm;
    Tone.Transport.bpm.value = bpm;
  } else if (keyCode === DOWN_ARROW) {
    params.bpm = max(60, params.bpm - 5);
    bpm = params.bpm;
    Tone.Transport.bpm.value = bpm;
  }

  if (pane) pane.refresh();
}

function handleFile(file) {
  if (file.type === "image") {
    let imgURL = URL.createObjectURL(file.file);
    loadImage(imgURL, (loadedImg) => {
      if (loadedImg && loadedImg.width > 0 && loadedImg.height > 0) {
        if (loadedImg.width > 1200) {
          loadedImg.resize(1200, 0);
        }

        video = loadedImg;
        video.loadedmetadata = true;
        camAspectRatio = video.width / video.height;
        
        const leftPanelWidth = width * 0.65;
        const maxAvailableWidth = leftPanelWidth - 80;
        const baseSquareSize = min(maxAvailableWidth, height);
        
        px = leftPanelWidth / 2;
        py = height / 2;
        R = round(baseSquareSize / 10);
        params.radius = R;
        radiusInitialized = false;

        if (fileInput) fileInput.hide();
        
        startAudioEngine();
        videoLoaded = true;
      }
    });
  } else {
    alert("画像ファイルを選択してください。");
  }
}

async function startAudioEngine() {
  try {
    if (Tone.context.state !== "running") {
      await Tone.start();
    }
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
    params.isPlaying = true;
    if (pane) pane.refresh();
  } catch (e) {
    console.warn("AudioEngine start pending user action:", e);
  }
}

function touchStarted() {
  startAudioEngine();
}