
// --- mousePressed関数 ---
function mousePressed() {
  const leftPanelWidth = width * 0.65;
  if (mouseX < leftPanelWidth && videoLoaded) {
    let dWidth = displayVideoWidth || width;
    let dHeight = displayVideoHeight || height;
    let dX = displayVideoX || 0;
    let dY = displayVideoY || 0;

    // クリック位置が画像領域内の場合
    if (
      mouseX >= dX &&
      mouseX <= dX + dWidth &&
      mouseY >= dY &&
      mouseY <= dY + dHeight
    ) {
      R = params.radius;

      // 半径 R が画像サイズを超えている場合の制限範囲逆転を防止
      let safeR = min(R, dWidth / 2, dHeight / 2);

      // ★ px, py を「画像の端から半径 R 分だけ内側の範囲」に抑え込む
      px = constrain(nowX, dX + safeR, dX + dWidth - safeR);
      py = constrain(nowY, dY + safeR, dY + dHeight - safeR);

      colorGet();
    }
  }
}

// --- doubleClicked関数 ---
function doubleClicked() {

  if (!fullscreen()) {
    fullscreen(true);
  }
  
}

// --- windowResized関数 ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  px = width / 2;
  py = height / 2;
}