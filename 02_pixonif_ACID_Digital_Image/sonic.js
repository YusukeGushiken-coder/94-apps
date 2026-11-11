// --- sonic.js ---
var currentSynthNote = "-";
var currentFilterFreq = 0;
var currentFilterRes = 0;
var currentEnvMod = 0; // ★ Env Mod モニター用

// 1. 発音判定用フラグ
var currentBeats = {
  BD: false, SD: false, HC: false,
  CH: false, OH: false, HT: false, MT: false, LT: false, RC: false
};

// 2. 点滅描画用の最終発音時刻（ミリ秒）
var lastBeatTimes = {
  BD: 0, SD: 0, HC: 0,
  CH: 0, OH: 0, HT: 0, MT: 0, LT: 0, RC: 0
};

// フィルターエンベロープ（Env Mod用）
var filterEnv = null;

// Env Mod エンベロープの初期化 & フィルターへの接続関数
function setupFilterEnv() {
  if (typeof Tone === "undefined") return;
  if (!filterEnv) {
    filterEnv = new Tone.FrequencyEnvelope({
      attack: 0.005,  // 高速アタック
      decay: 0.2,     // TD-3風のアシッド・デケイ
      sustain: 0.0,
      release: 0.1,
      baseFrequency: 100,
      octaves: 4
    });
  }
  if (filterEnv && typeof filter !== "undefined" && filter) {
    try {
      filterEnv.connect(filter.frequency);
    } catch (e) {
      // 接続済み時の例外回避
    }
  }
}

// 色からピッチ倍率へのマッピング関数
function mapHueToPitch(h) {
  let semitone = Math.floor(map(h, 0, 360, 0, 24));
  return Math.pow(2, semitone / 12);
}

// --- SYNTH 処理 ---
function sonic(time) {
  if (typeof params !== "undefined" && !params.synthSound) {
    currentSynthNote = "-";
    return;
  }

  if (typeof pi1 === "undefined" || !pi1[seq]) return;

  push();
  colorMode(HSB, 360, 100, 100);
  const nowhue1 = hue(pi1[seq]);
  const currentSaturation1 = saturation(pi1[seq]);
  const currentBrightness1 = brightness(pi1[seq]);
  pop();

  let pitchRate1 = mapHueToPitch(nowhue1);
  let integratedFreq = (261.63 / 6) * pitchRate1;

  const synthGain = (typeof params !== "undefined" && params.synthVol !== undefined) ? params.synthVol / 100 : 1.0;
  const finalAmp1 = map(currentSaturation1, 0, 100, 0, 0.5) * synthGain;
  const targetAmp = constrain(finalAmp1, 0, 1.0);

  // ★ 1. 明度（Brightness） -> ベース・カットオフ周波数（80Hz - 2000Hz）
  let baseCutoff = map(currentBrightness1, 0, 100, 80, 2000);

  // ★ 2. 彩度（Saturation） -> Env Mod（アタック時の跳ね上がり幅: 0 - 6オクターブ）
  let envModOctaves = map(currentSaturation1, 0, 100, 0, 6);

  // ★ 3. レゾナンス（Q値） -> 固定値 14（params.resonance があればそれを優先）
  let resQ = (typeof params !== "undefined" && params.resonance !== undefined) ? params.resonance : 14;

  // モニター用数値の更新
  currentFilterFreq = Math.round(baseCutoff);
  currentFilterRes = resQ.toFixed(1);
  currentEnvMod = envModOctaves.toFixed(1);

  // フィルターエンベロープの接続確認
  setupFilterEnv();

  if (targetAmp > 0.001 && typeof synth !== "undefined" && synth) {
    // フィルターQ値（レゾナンス）の適用
    if (typeof filter !== "undefined" && filter) {
      filter.Q.setValueAtTime(resQ, time);
    }

    // Env Mod（エンベロープ）のパラメータ設定 & トリガー
    if (filterEnv) {
      filterEnv.baseFrequency = baseCutoff;
      filterEnv.octaves = envModOctaves;
      filterEnv.triggerAttackRelease("16n", time);
    }

    // シンセ本体の発音
    synth.volume.setValueAtTime(Tone.gainToDb(targetAmp), time);
    synth.triggerAttackRelease(integratedFreq, "16n", time);
    currentSynthNote = Tone.Frequency(integratedFreq).toNote();
  } else {
    currentSynthNote = "-";
  }
}

// --- BEATS 処理 ---
function beats(time) {
  // 毎ステップ冒頭でフラグをリセット
  for (let k in currentBeats) {
    currentBeats[k] = false;
  }

  if (typeof kit === "undefined" || !kit) return;

  const isBeatOn = typeof params !== "undefined" && params.beatSound !== undefined ? params.beatSound : true;
  const isKickOn = typeof params !== "undefined" && params.kick !== undefined ? params.kick : kickmode;

  if (!isBeatOn && !isKickOn) return;

  push();
  colorMode(HSB, 360, 100, 100);
  const currentBrightness1 = brightness(pi1[seq]);
  let pseq = seq - 1 < 0 ? STEP - 1 : seq - 1;
  const PastBrightness1 = brightness(pi1[pseq]);
  pop();

  const bdPlayer = kit.player("BD");
  const chPlayer = kit.player("CH");
  const ohPlayer = kit.player("OH");
  const sdPlayer = kit.player("SD");
  const hcPlayer = kit.player("HC");
  const htPlayer = kit.player("HT");
  const mtPlayer = kit.player("MT");
  const ltPlayer = kit.player("LT");
  const rcPlayer = kit.player("RC");

  let currentStep = seq;

  // 安全な再生 & 時刻記録ヘルパー関数
  const playSound = (player, key, vol) => {
    if (player) {
      if (vol !== undefined) {
        // ★ リニア値 (0.0〜1.0) を Tone.gainToDb() でデシベル (dB) に変換
        // vol が 0.2 なら約 -14dB、0.5 なら約 -6dB に正しく減衰されます
        player.volume.value = vol > 0 ? Tone.gainToDb(vol) : -100;
      }
      player.start(time);
      currentBeats[key] = true;
      lastBeatTimes[key] = millis();
    }
  };

  // AUTO KICK
  if (isKickOn) {
    if (currentStep === 0 || currentStep === 4 || currentStep === 8 || currentStep === 12) {
      playSound(bdPlayer, "BD", 1);
    }
  }

  // BEATS ON 判定（数値がそのまま 0%〜100% の音量割合になります）
  if (isBeatOn) {
    if (!currentBeats.BD && currentBrightness1 <= 15) {
      playSound(bdPlayer, "BD", 0.7); // キック: 70%
    }

    if (currentBrightness1 > 80 && currentBrightness1 <= 90) {
      if (ohPlayer && ohPlayer.state === "started") ohPlayer.stop();
      playSound(chPlayer, "CH", 0.5); // CH: 50%
    } else if (currentBrightness1 > 90) {
      if (chPlayer && chPlayer.state === "started") chPlayer.stop();
      playSound(ohPlayer, "OH", 0.4); // OH: 60%
    } else if (currentBrightness1 > 70 && currentBrightness1 <= 80) {
      if (rcPlayer && rcPlayer.state === "started") rcPlayer.stop();
      playSound(rcPlayer, "RC", 0.4); // RC: 50%
    }

    if (currentBrightness1 > 20 && currentBrightness1 <= 25) {
      if (ltPlayer && ltPlayer.state === "started") ltPlayer.stop();
      playSound(ltPlayer, "LT", 0.4);
    } else if (currentBrightness1 > 25 && currentBrightness1 <= 30) {
      if (mtPlayer && mtPlayer.state === "started") mtPlayer.stop();
      playSound(mtPlayer, "MT", 0.4);
    } else if (currentBrightness1 > 30 && currentBrightness1 <= 35) {
      if (htPlayer && htPlayer.state === "started") htPlayer.stop();
      playSound(htPlayer, "HT", 0.4);
    }

    // スネア (SD) と クラップ (HC) の音量を下げる
    if (currentBrightness1 - PastBrightness1 > 20.0) {
      playSound(sdPlayer, "SD", 0.2); // ★ スネア: 30%（うるさい場合は 0.2 などに下げる）
    }

    if (PastBrightness1 - currentBrightness1 > 20.0) {
      playSound(hcPlayer, "HC", 0.35); // ★ クラップ: 35%（うるさい場合は 0.25 などに下げる）
    }
  }
}