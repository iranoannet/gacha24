import { useCallback, useRef, useEffect, useMemo } from "react";

// ギャンブル感のあるサウンドエフェクトを生成
export function useGachaSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // AudioContextの初期化（安定した参照を維持）
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 0.3;
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    // AudioContextが停止状態の場合は再開
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return { ctx: audioContextRef.current, gain: gainNodeRef.current! };
  }, []);

  // スロットマシン回転音
  const playSlotSpin = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < 20; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "square";
      osc.frequency.value = 800 + Math.random() * 400;
      
      envGain.gain.setValueAtTime(0, now + i * 0.08);
      envGain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.01);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.06);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.06);
    }
  }, [getAudioContext]);

  // ===== 新規: パチンコ風リーチ音 =====
  // 「キュイーン」と上昇するシンセ音 + 心拍音
  const playPachinkoReach = useCallback((duration: number = 3) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    // メインのキュイーン上昇音
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + duration);
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + duration);
    filter.Q.value = 10;
    
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    envGain.gain.setValueAtTime(0.25, now + duration * 0.8);
    envGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(filter);
    filter.connect(envGain);
    envGain.connect(gain);
    
    osc.start(now);
    osc.stop(now + duration);
    
    // 副音（オクターブ上）
    const osc2 = ctx.createOscillator();
    const envGain2 = ctx.createGain();
    
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(4000, now + duration);
    
    envGain2.gain.setValueAtTime(0, now);
    envGain2.gain.linearRampToValueAtTime(0.1, now + 0.5);
    envGain2.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc2.connect(envGain2);
    envGain2.connect(gain);
    
    osc2.start(now);
    osc2.stop(now + duration);
    
    // 心拍音を重ねる
    const heartbeatCount = Math.floor(duration * 2);
    for (let i = 0; i < heartbeatCount; i++) {
      const interval = 0.5 - (i / heartbeatCount) * 0.2; // 徐々に速く
      const time = now + i * interval;
      
      if (time > now + duration) break;
      
      [0, 0.12].forEach((offset, j) => {
        const beatOsc = ctx.createOscillator();
        const beatGain = ctx.createGain();
        
        beatOsc.type = "sine";
        beatOsc.frequency.value = j === 0 ? 60 : 45;
        
        beatGain.gain.setValueAtTime(0, time + offset);
        beatGain.gain.linearRampToValueAtTime(0.35, time + offset + 0.02);
        beatGain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.12);
        
        beatOsc.connect(beatGain);
        beatGain.connect(gain);
        
        beatOsc.start(time + offset);
        beatOsc.stop(time + offset + 0.12);
      });
    }
  }, [getAudioContext]);

  // ===== 新規: 和太鼓ドラムロール =====
  // 祭りの太鼓が徐々に加速
  const playTaikoDrumRoll = useCallback((duration: number = 3) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    let time = 0;
    let interval = 0.25; // 開始時のテンポ
    let beatIndex = 0;
    
    while (time < duration) {
      const beatTime = now + time;
      
      // メイン太鼓（ドン）
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(80, beatTime);
      osc.frequency.exponentialRampToValueAtTime(40, beatTime + 0.2);
      
      filter.type = "lowpass";
      filter.frequency.value = 200;
      
      const volume = 0.3 + (time / duration) * 0.3; // 徐々に大きく
      envGain.gain.setValueAtTime(volume, beatTime);
      envGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.25);
      
      osc.connect(filter);
      filter.connect(envGain);
      envGain.connect(gain);
      
      osc.start(beatTime);
      osc.stop(beatTime + 0.25);
      
      // アタック音（カッ）
      const attackOsc = ctx.createOscillator();
      const attackGain = ctx.createGain();
      
      attackOsc.type = "square";
      attackOsc.frequency.value = 300 + Math.random() * 100;
      
      attackGain.gain.setValueAtTime(0.15, beatTime);
      attackGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.03);
      
      attackOsc.connect(attackGain);
      attackGain.connect(gain);
      
      attackOsc.start(beatTime);
      attackOsc.stop(beatTime + 0.03);
      
      // ノイズ成分（皮の振動）
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 150;
      noiseGain.gain.value = 0.1;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(gain);
      noise.start(beatTime);
      
      // テンポ加速
      interval = Math.max(0.05, interval * 0.85);
      time += interval;
      beatIndex++;
    }
  }, [getAudioContext]);

  // ===== 新規: スロット風連打音 =====
  // 「ダダダダダ」というリール回転音 + ベル音
  const playSlotRapidFire = useCallback((duration: number = 2) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const interval = 0.04; // 高速連打
    const count = Math.floor(duration / interval);
    
    for (let i = 0; i < count; i++) {
      const time = now + i * interval;
      
      // クリック音
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "square";
      osc.frequency.value = 600 + (i % 3) * 200 + Math.random() * 100;
      
      envGain.gain.setValueAtTime(0.2, time);
      envGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(time);
      osc.stop(time + 0.03);
      
      // 時々ベル音を重ねる
      if (i % 15 === 0) {
        const bellOsc = ctx.createOscillator();
        const bellGain = ctx.createGain();
        
        bellOsc.type = "sine";
        bellOsc.frequency.value = 1500 + Math.random() * 500;
        
        bellGain.gain.setValueAtTime(0.15, time);
        bellGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        bellOsc.connect(bellGain);
        bellGain.connect(gain);
        
        bellOsc.start(time);
        bellOsc.stop(time + 0.1);
      }
    }
  }, [getAudioContext]);

  // ===== 新規: 電子アラーム警告音 =====
  // 「ピピピピ」緊急感のある電子音
  const playElectronicAlarm = useCallback((duration: number = 2) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const interval = 0.12;
    const count = Math.floor(duration / interval);
    
    for (let i = 0; i < count; i++) {
      const time = now + i * interval;
      const isHigh = i % 2 === 0;
      
      // メイン警告音
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "square";
      osc.frequency.value = isHigh ? 1800 : 1400;
      
      envGain.gain.setValueAtTime(0, time);
      envGain.gain.linearRampToValueAtTime(0.25, time + 0.01);
      envGain.gain.setValueAtTime(0.25, time + 0.05);
      envGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(time);
      osc.stop(time + 0.08);
      
      // 副音（ハーモニクス）
      const osc2 = ctx.createOscillator();
      const envGain2 = ctx.createGain();
      
      osc2.type = "sine";
      osc2.frequency.value = (isHigh ? 1800 : 1400) * 2;
      
      envGain2.gain.setValueAtTime(0.1, time);
      envGain2.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      
      osc2.connect(envGain2);
      envGain2.connect(gain);
      
      osc2.start(time);
      osc2.stop(time + 0.05);
    }
  }, [getAudioContext]);

  // ===== 新規: 金属衝突音 =====
  // 「ガキーン！」ベーゴマ衝突
  const playMetalClash = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    // メインの金属音
    const frequencies = [800, 1200, 1600, 2400, 3200];
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.5);
      
      const volume = 0.2 - i * 0.03;
      envGain.gain.setValueAtTime(volume, now);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4 + i * 0.1);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now);
      osc.stop(now + 0.5 + i * 0.1);
    });
    
    // インパクトノイズ
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 2000;
    noiseGain.gain.value = 0.3;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start(now);
    
    // 低音のインパクト
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(100, now);
    bassOsc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    
    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    bassOsc.connect(bassGain);
    bassGain.connect(gain);
    
    bassOsc.start(now);
    bassOsc.stop(now + 0.2);
  }, [getAudioContext]);

  // ===== 新規: 雷鳴轟音 =====
  // 稲妻が落ちるような迫力の音
  const playThunder = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    // クラック音（瞬間的な高音）
    const crackOsc = ctx.createOscillator();
    const crackGain = ctx.createGain();
    
    crackOsc.type = "sawtooth";
    crackOsc.frequency.setValueAtTime(3000, now);
    crackOsc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
    
    crackGain.gain.setValueAtTime(0.5, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    crackOsc.connect(crackGain);
    crackGain.connect(gain);
    
    crackOsc.start(now);
    crackOsc.stop(now + 0.08);
    
    // 雷鳴（低音のランブル）
    const rumbleOsc = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    const rumbleFilter = ctx.createBiquadFilter();
    
    rumbleOsc.type = "sawtooth";
    rumbleOsc.frequency.setValueAtTime(60, now + 0.05);
    
    // LFOでゆらぎを追加
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 8;
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(rumbleOsc.frequency);
    lfo.start(now + 0.05);
    lfo.stop(now + 1.5);
    
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 200;
    
    rumbleGain.gain.setValueAtTime(0, now + 0.05);
    rumbleGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
    rumbleGain.gain.setValueAtTime(0.5, now + 0.5);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(gain);
    
    rumbleOsc.start(now + 0.05);
    rumbleOsc.stop(now + 1.5);
    
    // ノイズ成分（雷の余韻）
    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.3));
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 400;
    noiseGain.gain.value = 0.25;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start(now + 0.05);
  }, [getAudioContext]);

  // ドラムロール（期待煽り）
  const playDrumRoll = useCallback((duration: number = 2, intensity: "low" | "medium" | "high" = "medium") => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    const interval = intensity === "high" ? 0.02 : intensity === "medium" ? 0.03 : 0.04;
    const count = Math.floor(duration / interval);
    const maxVolume = intensity === "high" ? 0.35 : intensity === "medium" ? 0.25 : 0.15;
    
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = "triangle";
      const progress = i / count;
      const baseFreq = intensity === "high" ? 120 : intensity === "medium" ? 100 : 80;
      osc.frequency.value = baseFreq + progress * (intensity === "high" ? 300 : 200);
      
      filter.type = "lowpass";
      filter.frequency.value = 500 + progress * (intensity === "high" ? 3000 : 2000);
      
      envGain.gain.setValueAtTime(0, now + i * interval);
      envGain.gain.linearRampToValueAtTime(0.1 + progress * maxVolume, now + i * interval + 0.005);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + i * interval + 0.025);
      
      osc.connect(filter);
      filter.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now + i * interval);
      osc.stop(now + i * interval + 0.025);
    }
  }, [getAudioContext]);

  // サスペンス音
  const playSuspense = useCallback((tier: "S" | "A" | "B" = "A") => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const chords = {
      S: [220, 277.18, 329.63, 415.30],
      A: [196, 246.94, 293.66, 369.99],
      B: [174.61, 220, 261.63, 329.63],
    };
    
    const notes = chords[tier];
    const duration = tier === "S" ? 3 : tier === "A" ? 2.5 : 2;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = "sine";
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 4 + i;
      lfoGain.gain.value = freq * 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + duration);
      
      osc.frequency.value = freq;
      
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(500, now);
      filter.frequency.linearRampToValueAtTime(2000, now + duration * 0.8);
      
      envGain.gain.setValueAtTime(0, now);
      envGain.gain.linearRampToValueAtTime(0.08, now + 0.5);
      envGain.gain.setValueAtTime(0.08, now + duration * 0.7);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc.connect(filter);
      filter.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }, [getAudioContext]);

  // 期待上昇音
  const playRising = useCallback((tier: "S" | "A" | "B" = "A") => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const config = {
      S: { startFreq: 200, endFreq: 1200, duration: 1.5, volume: 0.25 },
      A: { startFreq: 180, endFreq: 900, duration: 1.2, volume: 0.2 },
      B: { startFreq: 150, endFreq: 600, duration: 1, volume: 0.15 },
    };
    
    const { startFreq, endFreq, duration, volume } = config[tier];
    
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(startFreq * 2, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq * 2, now + duration);
    
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(volume, now + 0.1);
    envGain.gain.setValueAtTime(volume, now + duration * 0.8);
    envGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(filter);
    filter.connect(envGain);
    envGain.connect(gain);
    
    osc.start(now);
    osc.stop(now + duration);
  }, [getAudioContext]);

  // A賞確定音（ゴールドファンファーレ）
  const playGoldReveal = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [392, 493.88, 587.33, 783.99, 987.77];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.12;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.22, startTime + 0.03);
      envGain.gain.setValueAtTime(0.22, startTime + 0.2);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.7);
    });
    
    for (let i = 0; i < 15; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = 2500 + Math.random() * 2500;
      
      const startTime = now + 0.4 + i * 0.04;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.1, startTime + 0.015);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.18);
    }
    
    const chord = [392, 493.88, 587.33, 783.99];
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      
      const startTime = now + 0.8;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 1.2);
    });
  }, [getAudioContext]);

  // B賞確定音（シルバーチャイム）
  const playSilverReveal = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.1;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.6);
    });
    
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = 3000 + Math.random() * 2000;
      
      const startTime = now + 0.3 + i * 0.05;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.06, startTime + 0.01);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.12);
    }
  }, [getAudioContext]);

  // 確定音
  const playReveal = useCallback((isHighTier: boolean = false) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const frequencies = isHighTier 
      ? [523.25, 659.25, 783.99, 1046.50]
      : [392, 493.88, 587.33, 783.99];
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = isHighTier ? "sawtooth" : "square";
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.15;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.8);
    });

    if (isHighTier) {
      for (let i = 0; i < 10; i++) {
        const osc = ctx.createOscillator();
        const envGain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.value = 2000 + Math.random() * 3000;
        
        const startTime = now + 0.3 + i * 0.05;
        envGain.gain.setValueAtTime(0, startTime);
        envGain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
        envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
        
        osc.connect(envGain);
        envGain.connect(gain);
        
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      }
    }
  }, [getAudioContext]);

  // コイン音
  const playCoinSound = useCallback((count: number = 1) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(2500 + Math.random() * 500, now + i * 0.1);
      osc.frequency.exponentialRampToValueAtTime(1500, now + i * 0.1 + 0.15);
      
      envGain.gain.setValueAtTime(0, now + i * 0.1);
      envGain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.01);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.15);
    }
  }, [getAudioContext]);

  // インパクト音
  const playImpact = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    
    envGain.gain.setValueAtTime(0.5, now);
    envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(envGain);
    envGain.connect(gain);
    
    osc.start(now);
    osc.stop(now + 0.3);
    
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15;
    noise.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start(now);
  }, [getAudioContext]);

  // ハートビート
  const playHeartbeat = useCallback((count: number = 4) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < count; i++) {
      const interval = 0.5 - (i * 0.05);
      const time = now + i * interval;
      
      [0, 0.15].forEach((offset, j) => {
        const osc = ctx.createOscillator();
        const envGain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.value = j === 0 ? 80 : 60;
        
        envGain.gain.setValueAtTime(0, time + offset);
        envGain.gain.linearRampToValueAtTime(0.3, time + offset + 0.03);
        envGain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.15);
        
        osc.connect(envGain);
        envGain.connect(gain);
        
        osc.start(time + offset);
        osc.stop(time + offset + 0.15);
      });
    }
  }, [getAudioContext]);

  // S賞確定音（ジャックポット）
  const playJackpot = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.08;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      envGain.gain.setValueAtTime(0.2, startTime + 0.15);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
    
    for (let i = 0; i < 20; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = 3000 + Math.random() * 4000;
      
      const startTime = now + 0.5 + i * 0.03;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }
    
    const chordNotes = [523.25, 659.25, 783.99, 1046.50];
    chordNotes.forEach(freq => {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      
      const startTime = now + 1;
      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      envGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5);
      
      osc.connect(envGain);
      envGain.connect(gain);
      
      osc.start(startTime);
      osc.stop(startTime + 1.5);
    });
  }, [getAudioContext]);

  // ミス音
  const playMiss = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
    
    envGain.gain.setValueAtTime(0.2, now);
    envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(envGain);
    envGain.connect(gain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }, [getAudioContext]);

  // 全てのサウンドを停止
  const stopAll = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
    }
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return useMemo(() => ({
    playSlotSpin,
    playDrumRoll,
    playReveal,
    playCoinSound,
    playImpact,
    playHeartbeat,
    playJackpot,
    playMiss,
    playSuspense,
    playRising,
    playGoldReveal,
    playSilverReveal,
    // 新規追加
    playPachinkoReach,
    playTaikoDrumRoll,
    playSlotRapidFire,
    playElectronicAlarm,
    playMetalClash,
    playThunder,
    stopAll,
  }), [
    playSlotSpin, playDrumRoll, playReveal, playCoinSound, playImpact, 
    playHeartbeat, playJackpot, playMiss, playSuspense, playRising, 
    playGoldReveal, playSilverReveal, playPachinkoReach, playTaikoDrumRoll,
    playSlotRapidFire, playElectronicAlarm, playMetalClash, playThunder, stopAll
  ]);
}
