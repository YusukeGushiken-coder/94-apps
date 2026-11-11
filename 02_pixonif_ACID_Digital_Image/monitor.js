// --- monitor関数 ---
function monitor() {
  const leftPanelWidth = width * 0.65;
  const margin = 20;
  const panelWidth = width - leftPanelWidth;
  const contentWidth = panelWidth - (margin * 2);
  const startX = leftPanelWidth + margin;

  let paneBottom = 380;
  const container = document.getElementById('tweakpane-container');
  if (container && container.offsetHeight > 0) {
    paneBottom = container.offsetTop + container.offsetHeight;
  }

  let logoH = 50;
  if (pixonif && pixonif.width > 0) {
    logoH = contentWidth * (pixonif.height / pixonif.width);
  }
  const bottomReservedY = height - logoH - margin - 25;

  const stepBarH = 20;
  const textH = 40;
  const spacing = 15;

  const availableH = bottomReservedY - paneBottom - stepBarH - textH - (spacing * 3);
  const waveH = max(30, availableH);

  const waveCenterY = paneBottom + spacing + (waveH / 2);
  const stepBarY = waveCenterY + (waveH / 2) + spacing;
  const stepW = contentWidth / STEP;

  let waveData = [];
  if (typeof waveform !== "undefined" && typeof waveform.getValue === "function") {
    waveData = waveform.getValue();
  }

  // ★ 右側パネル内での波形描画（暗色視認性補正付き）
  push();
  colorMode(HSB, 360, 100, 100);

  let currentC = (typeof pi1 !== "undefined" && pi1[seq]) ? pi1[seq] : color(0, 0, 100);
  let h = hue(currentC);
  let s = saturation(currentC);
  let b = brightness(currentC);

  b = max(b, 60);

  if (s < 10 && b <= 60) {
    stroke(180, 80, 100);
  } else {
    stroke(h, s, b);
  }

  strokeWeight(2);
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();
  if (waveData && waveData.length > 0) {
    beginShape();
    for (let i = 0; i < waveData.length; i++) {
      let xPos = map(i, 0, waveData.length, startX, startX + contentWidth);
      let val = (waveData[i] !== undefined) ? waveData[i] : 0;
      let yPos = map(val, -1, 1, waveCenterY - waveH / 2, waveCenterY + waveH / 2);
      vertex(xPos, yPos);
    }
    endShape();
  }
  pop();

  // カラーステップ描画
  push();
  colorMode(HSB, 360, 100, 100);
  for (let i = 0; i < STEP; i++) {
    noStroke();
    fill(pi1[i]);
    rect(startX + i * stepW, stepBarY, stepW, stepBarH);
  }

  noFill();
  stroke(0, 0, 100);
  strokeWeight(3);
  rect(startX + seq * stepW, stepBarY, stepW, stepBarH);
  pop();

  // ステップ下テキスト
  push();
  fill(255);
  noStroke();
  textSize(12);
  textFont('monospace');
  textAlign(LEFT, TOP);

  const textY = stepBarY + stepBarH + 10;

  const synthText = (typeof currentSynthNote !== "undefined") ? currentSynthNote : "-";
  const freqText = (typeof currentFilterFreq !== "undefined") ? currentFilterFreq + "Hz" : "-";
  const resText = (typeof currentFilterRes !== "undefined") ? currentFilterRes : "-";
  const envText = (typeof currentEnvMod !== "undefined") ? currentEnvMod + " Oct" : "-";

  text(`SYNTH : ${synthText} (CUTOFF:${freqText} / RES:${resText} / ENV:${envText})`, startX, textY);

  const mtLabel = (typeof params !== "undefined" && params.kitType === "808") ? "CB" : "MT";

  if (typeof lastBeatTimes !== "undefined") {
    const currentBpm = (typeof params !== "undefined" && params.bpm) ? params.bpm : 130;
    const stepDurationMs = (60000 / currentBpm) / 4; 
    const flashGateMs = stepDurationMs * 0.6;
    const now = millis();

    const getSlot = (key, label) => {
      const t = lastBeatTimes[key] || 0;
      return (now - t < flashGateMs) ? label : "  ";
    };

    const bd = getSlot("BD", "BD");
    const sd = getSlot("SD", "SD");
    const hc = getSlot("HC", "HC");
    const ch = getSlot("CH", "CH");
    const oh = getSlot("OH", "OH");
    const ht = getSlot("HT", "HT");
    const mt = getSlot("MT", mtLabel);
    const lt = getSlot("LT", "LT");
    const rc = getSlot("RC", "RC");

    text(`BEATS : ${bd}/${sd}/${hc}/${ch}/${oh}/${ht}/${mt}/${lt}/${rc}`, startX, textY + 20);
  } else {
    text("BEATS : --/--/--/--/--/--/--/--/--", startX, textY + 20);
  }
  pop();

  // --------------------------------------------------
  // 画像エリア上のセンシングガイド・判定用の描画
  // --------------------------------------------------
  push();
  const guideColor = color(255);
  stroke(guideColor);

  strokeWeight(3);
  noFill();
  ellipse(px, py, R * 2, R * 2);

  let dWidth = displayVideoWidth || width;
  let dHeight = displayVideoHeight || height;
  let dX = displayVideoX || 0;
  let dY = displayVideoY || 0;

  // ★ センシング円の半径（R）を取得
  const currentR = (typeof params !== "undefined" && params.radius) ? params.radius : R;

  // ★ マウスが画像エリア上にある場合のみ、画像枠内（半径rのマージン付き）に限定制限
  if (mouseX >= dX && mouseX <= dX + dWidth && mouseY >= dY && mouseY <= dY + dHeight) {
    nowX = constrain(mouseX, dX + currentR, dX + dWidth - currentR);
    nowY = constrain(mouseY, dY + currentR, dY + dHeight - currentR);
  } else {
    // 画像領域外へ出た場合はマウスプレビューを描画しない
    nowX = undefined;
    nowY = undefined;
  }

  noFill();
  strokeWeight(1);
  stroke(255, 255, 255);
  line(dX, py, dX + dWidth, py);
  line(px, dY, px, dY + dHeight);

  if (nowX !== undefined && nowY !== undefined) {
    strokeWeight(1.5);
    stroke(230, 255, 230, 150); 
    line(nowX, dY, nowX, dY + dHeight);
    line(dX, nowY, dX + dWidth, nowY);
    ellipse(nowX, nowY, params.radius * 2, params.radius * 2);

    // ★ マウス位置での16ステッププレビュー（12時スタート）
    if (videoLoaded && video && video.width > 0 && video.pixels && video.pixels.length > 0) {
      push();
      colorMode(RGB, 255, 255, 255, 255);
      for (let i = 0; i < STEP; i++) {
        let angle = radians((360 / STEP) * i - 90); // 12時方向スタート
        let sx = nowX + params.radius * cos(angle);
        let sy = nowY + params.radius * sin(angle);

        let vx = floor(map(sx, dX, dX + dWidth, 0, video.width));
        let vy = floor(map(sy, dY, dY + dHeight, 0, video.height));
        vx = constrain(vx, 0, video.width - 1);
        vy = constrain(vy, 0, video.height - 1);

        let idx = (vy * video.width + vx) * 4;
        let pr = video.pixels[idx];
        let pg = video.pixels[idx + 1];
        let pb = video.pixels[idx + 2];

        stroke(255, 255, 255, 200);
        strokeWeight(1);
        fill(pr, pg, pb, 180);
        ellipse(sx, sy, 12, 12);
      }
      pop();
    }
  }

  // ★ 確定センシングポイントの描画（Step 0, 4, 8, 12 ＝ 12時, 3時, 6時, 9時 が大円）
  for (let i = 0; i < STEP; i++) {
    push();
    colorMode(HSB, 360, 100, 100);
    strokeWeight(1);
    fill(pi1[i]);
    ellipse(x[i], y[i], 16, 16);

    // 拍アタマ（12時, 3時, 6時, 9時）を大円で表示
    if (i % 4 === 0) {
      ellipse(x[i], y[i], 24, 24); 
    }
    pop();
  }

  // 現在ステップのハイライト
  if (x[seq] !== undefined && y[seq] !== undefined) {
    push();
    colorMode(HSB, 360, 100, 100);
    strokeWeight(2);
    stroke(0, 0, 100);
    fill(pi1[seq]);
    ellipse(x[seq], y[seq], 32, 32);
    pop();
  }
  pop();
}