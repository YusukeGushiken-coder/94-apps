// --- colorGet関数 ---
function colorGet() {
  if (!videoLoaded || !video || video.width === 0 || video.height === 0) return;

  let dWidth = displayVideoWidth || width;
  let dHeight = displayVideoHeight || height;
  let dX = displayVideoX || 0;
  let dY = displayVideoY || 0;

  // ★ RADIUS (R) が画像サイズを超えないよう安全制限
  let maxR = min(dWidth, dHeight) / 2;
  R = min((typeof params !== "undefined" && params.radius) ? params.radius : R, maxR);

  // ★ 画像枠内に円全体が収まるよう中心座標 (px, py) を自動引き戻し補正
  if (TOGGLE_MODE === true) {
    px = constrain(px, dX + R, dX + dWidth - R);
    py = constrain(py, dY + R, dY + dHeight - R);
  } else {
    px = constrain(px, dX, dX + dWidth);
    py = constrain(py, dY, dY + dHeight);
  }

  const adrad = 360 / STEP;

  for (let i = 0; i < STEP; i++) {
    // 角度計算 (12時の方向から開始)
    let radpoint = floor(map(adrad + adrad * i, 0, 360, 0, STEP)) * (360 / STEP) - 90;
    setrad[i] = radpoint;

    // センシング座標 (キャンバス座標)
    let tempCanvasX, tempCanvasY;
    if (TOGGLE_MODE === true) {
      // 円形モード
      tempCanvasX = px + R * cos(radians(setrad[i]));
      tempCanvasY = py + R * sin(radians(setrad[i]));
    } else {
      // 直線モード
      const lineR = map(AREA_PERCENTAGE, 1, 100, 0, 1);
      tempCanvasX = map(
        setrad[i],
        -90, // -90から270度までをマッピング
        270 - adrad,
        width / 2 - (width / 2) * lineR,
        width / 2 + (width / 2) * lineR
      );
      tempCanvasY = py;
    }

    // キャンバス座標をビデオテクスチャ座標に変換
    let relativeX = (tempCanvasX - displayVideoX) / displayVideoWidth;
    let relativeY = (tempCanvasY - displayVideoY) / displayVideoHeight;

    // x[i], y[i]にビデオテクスチャ座標 (0 - video.width/height) を格納
    var xx = (relativeX * video.width);
    var yy = (relativeY * video.height);
    x[i] = constrain(xx, 0, video.width - 1);
    y[i] = constrain(yy, 0, video.height - 1);

    // pi1[i] (現在値) を取得し正規化
    push();
    colorMode(RGB, 255, 255, 255);
    
    let rawColorForPi1 = video.get(int(x[i]), int(y[i]));

    pi1[i] = getNormalizedColor(rawColorForPi1);
    pop();
  }
}

// 新しいヘルパー関数: p5.Colorオブジェクトを受け取り、正規化されたp5.Colorオブジェクトを返す
// --- getNormalizedColor (クロマ適用版) ---
function getNormalizedColor(inputColor) {
  let r = red(inputColor);
  let g = green(inputColor);
  let b = blue(inputColor);

  // クロマ (純色の鮮やかさ: 黒や白に向かうほど 0 に近づく)
  let chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; // 0 〜 1.0

  push();
  colorMode(RGB, 255, 255, 255);
  let h = hue(inputColor);
  let br = brightness(inputColor);
  pop();

  // H のみデジタイズ
  let hertz_digi = mapHueToPitch(h);
  h = mapPitchToHue(hertz_digi);

  // HSB の S にクロマ (0〜100%) を適用
  push();
  colorMode(HSB, 360, 100, 100);
  let normalizedColor = color(h, chroma * 100, br);
  pop();

  return normalizedColor;
}

// --- mapHueToPitch関数の修正 (7音階メジャー) ---
function mapHueToPitch(h) {
  // 色相環を7分割（360 / 7 ≈ 51.428度）し、メジャースケールにマッピングします。
  const step = 360 / 7; // 約 51.428度

  // C (赤): 334.3 - 25.7 (境界は ± step/2)
  if ((h >= 360 - step / 2 && h <= 360) || (h >= 0 && h < step / 2)) return 1.0;
  // D: 25.7 - 77.1
  else if (h >= step / 2 && h < step * 1.5) return 1.125;
  // E: 77.1 - 128.5
  else if (h >= step * 1.5 && h < step * 2.5) return 1.25;
  // F: 128.5 - 179.9
  else if (h >= step * 2.5 && h < step * 3.5) return 1.333333333333333; // 4/3
  // G: 179.9 - 231.3
  else if (h >= step * 3.5 && h < step * 4.5) return 1.5; // 3/2
  // A: 231.3 - 282.7
  else if (h >= step * 4.5 && h < step * 5.5) return 1.666666666666667; // 5/3 (純正律A)
  // B: 282.7 - 334.3
  else if (h >= step * 5.5 && h < 360 - step / 2) return 1.875; // 15/8

  return 1.0; // デフォルト (C)
}

// --- mapPitchToHue関数の修正 (7音階メジャー) ---
function mapPitchToHue(pitchRate) {
  // 色相環を7分割（360 / 7 ≈ 51.428度）し、対応する中心色相にマッピングします。
  const step = 360 / 7; // 約 51.428度

  switch (pitchRate) {
    case 1.0: // C
      return 0; // 赤 (中心)
    case 1.125: // D
      return step * 1; // 51.428...度
    case 1.25: // E
      return step * 2; // 102.857...度
    case 1.333333333333333: // F
      return step * 3; // 154.285...度
    case 1.5: // G
      return step * 4; // 205.714...度
    case 1.666666666666667: // A
      return step * 5; // 257.142...度
    case 1.875: // B
      return step * 6; // 308.571...度
    default:
      return 0; // デフォルトは赤 (C)
  }
}