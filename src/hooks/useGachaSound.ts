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
    
    // 複数の短い「カチカチ」音を連続再生
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

  // ドラムロール（期待煽り）
  const playDrumRoll = useCallback((duration: number = 2) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    const interval = 0.03;
    const count = Math.floor(duration / interval);
    
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = "triangle";
      // ピッチを徐々に上げる
      const progress = i / count;
      osc.frequency.value = 100 + progress * 200;
      
      filter.type = "lowpass";
      filter.frequency.value = 500 + progress * 2000;
      
      envGain.gain.setValueAtTime(0, now + i * interval);
      envGain.gain.linearRampToValueAtTime(0.1 + progress * 0.2, now + i * interval + 0.005);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + i * interval + 0.025);
      
      osc.connect(filter);
      filter.connect(envGain);
      envGain.connect(gain);
      
      osc.start(now + i * interval);
      osc.stop(now + i * interval + 0.025);
    }
  }, [getAudioContext]);

  // 確定音（ジャジャーン）
  const playReveal = useCallback((isHighTier: boolean = false) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    // 基本的なファンファーレ
    const frequencies = isHighTier 
      ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (メジャー)
      : [392, 493.88, 587.33, 783.99];     // G4, B4, D5, G5
    
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

    // 高ティア時は追加の効果音
    if (isHighTier) {
      // シャラーン（高周波のキラキラ）
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

  // インパクト音（ドン！）
  const playImpact = useCallback(() => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    // 低音のドン
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
    
    // ノイズ成分
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

  // ハートビート（ドキドキ）
  const playHeartbeat = useCallback((count: number = 4) => {
    const { ctx, gain } = getAudioContext();
    const now = ctx.currentTime;
    
    for (let i = 0; i < count; i++) {
      // 速度を徐々に上げる
      const interval = 0.5 - (i * 0.05);
      const time = now + i * interval;
      
      // 「ドクン」の2拍
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
    
    // アルペジオ上昇
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
    
    // キラキラ効果
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
    
    // 最後の和音
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

  // 安定した参照を返す
  return useMemo(() => ({
    playSlotSpin,
    playDrumRoll,
    playReveal,
    playCoinSound,
    playImpact,
    playHeartbeat,
    playJackpot,
    playMiss,
    stopAll,
  }), [playSlotSpin, playDrumRoll, playReveal, playCoinSound, playImpact, playHeartbeat, playJackpot, playMiss, stopAll]);
}
