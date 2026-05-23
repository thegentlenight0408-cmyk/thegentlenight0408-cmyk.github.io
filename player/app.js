"use strict";

const STATE_KEY = "nyxa-player-state-v1";

const audio = document.getElementById("audio");
audio.preservesPitch = true;
audio.mozPreservesPitch = true;
audio.webkitPreservesPitch = true;

const state = {
  songs: [],
  order: [],
  currentIdx: -1,
  mode: "loop-all",
  targetBpm: 180,
  shuffleHistory: [],
};

function $(id) { return document.getElementById(id); }
function effectiveBaseBpm(s) {
  // 用戶手動覆寫 > 偵測值（aubio）> Suno 標籤；若都沒有就回 null
  if (s.userBpm) return s.userBpm;
  return s.detectedBpm ? Math.round(s.detectedBpm) : (s.sunoBpm || null);
}
function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2,"0")}`;
}
function save() {
  const minimal = {
    order: state.order,
    overrides: Object.fromEntries(state.songs.map(s => [s.id, {targetBpm: s.targetBpm, removed: s.removed}])),
    currentIdx: state.currentIdx,
    mode: state.mode,
    targetBpm: state.targetBpm,
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(minimal)); } catch(e) {}
}
function restore() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

async function loadLibrary() {
  const resp = await fetch("songs/metadata.json");
  const meta = await resp.json();
  const arr = Object.entries(meta).map(([id, m]) => ({
    id,
    title: m.title,
    tags: m.tags,
    duration: m.duration,
    sunoBpm: m.suno_bpm,
    detectedBpm: m.detected_bpm,         // 由 aubio 量測的實際 BPM（主要參考）
    aubioBpm: m.aubio_bpm,
    beatCountBpm: m.beat_count_bpm,
    filename: m.filename,
    order: m.order,
    src: `songs/${encodeURIComponent(m.filename)}`,
    targetBpm: null,
    removed: false,
  }));
  arr.sort((a,b) => a.order - b.order);
  state.songs = arr;
  state.order = arr.map(s => s.id);

  // Restore overrides
  const saved = restore();
  if (saved) {
    if (saved.order && saved.order.length) {
      const idMap = new Map(arr.map(s => [s.id, s]));
      const restoredOrder = saved.order.filter(id => idMap.has(id));
      const missing = arr.filter(s => !restoredOrder.includes(s.id)).map(s => s.id);
      state.order = [...restoredOrder, ...missing];
    }
    if (saved.overrides) {
      for (const s of arr) {
        const o = saved.overrides[s.id];
        if (o) { s.targetBpm = o.targetBpm || null; s.removed = !!o.removed; }
      }
    }
    if (saved.mode) state.mode = saved.mode;
    if (saved.targetBpm) state.targetBpm = saved.targetBpm;
    if (typeof saved.currentIdx === "number") state.currentIdx = saved.currentIdx;
  }
}

function visible() {
  return state.order
    .map(id => state.songs.find(s => s.id === id))
    .filter(s => s && !s.removed);
}

function currentSong() {
  const list = visible();
  if (state.currentIdx < 0 || state.currentIdx >= list.length) return null;
  return list[state.currentIdx];
}

function renderPlaylist() {
  const ul = $("playlist");
  ul.innerHTML = "";
  const list = visible();
  list.forEach((s, idx) => {
    const li = document.createElement("li");
    if (idx === state.currentIdx) li.classList.add("playing");
    li.dataset.songId = s.id;
    li.draggable = true;

    const idxSpan = document.createElement("span");
    idxSpan.className = "pl-idx";
    idxSpan.textContent = String(idx + 1).padStart(2, "0");

    const title = document.createElement("span");
    title.className = "pl-title";
    title.textContent = s.title;

    const bpm = document.createElement("span");
    bpm.className = "pl-bpm";
    if (s.targetBpm && s.targetBpm !== effectiveBaseBpm(s)) {
      bpm.classList.add("has-target");
      bpm.textContent = `${effectiveBaseBpm(s)}→${s.targetBpm}`;
    } else {
      bpm.textContent = effectiveBaseBpm(s) || "?";
    }
    bpm.contentEditable = "true";
    bpm.spellcheck = false;
    bpm.title = "點擊編輯目標 BPM（清空 = 回原速）";

    const dur = document.createElement("span");
    dur.className = "pl-duration";
    dur.textContent = s.duration || "";

    const rm = document.createElement("button");
    rm.className = "pl-remove";
    rm.textContent = "×";
    rm.title = "從歌單移除";

    li.appendChild(idxSpan);
    li.appendChild(title);
    li.appendChild(bpm);
    li.appendChild(dur);
    li.appendChild(rm);
    ul.appendChild(li);

    // Click row → play
    li.addEventListener("click", e => {
      if (e.target === bpm || e.target === rm) return;
      state.currentIdx = idx;
      playCurrent();
    });

    // Edit BPM inline
    bpm.addEventListener("focus", e => {
      bpm.textContent = s.targetBpm || effectiveBaseBpm(s) || "";
      window.getSelection().selectAllChildren(bpm);
    });
    bpm.addEventListener("blur", e => {
      const val = parseInt(bpm.textContent.replace(/[^0-9]/g, ""), 10);
      s.targetBpm = (val && val !== effectiveBaseBpm(s)) ? val : null;
      save();
      renderPlaylist();
      if (idx === state.currentIdx) applyRate();
    });
    bpm.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); bpm.blur(); }
      if (e.key === "Escape") { bpm.textContent = s.targetBpm || effectiveBaseBpm(s) || ""; bpm.blur(); }
    });

    // Remove
    rm.addEventListener("click", e => {
      e.stopPropagation();
      if (idx === state.currentIdx) audio.pause();
      s.removed = true;
      save();
      renderPlaylist();
      renderNowPlaying();
    });

    // Drag/drop reorder
    li.addEventListener("dragstart", e => {
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", s.id);
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", e => { e.preventDefault(); li.classList.add("drop-target"); });
    li.addEventListener("dragleave", () => li.classList.remove("drop-target"));
    li.addEventListener("drop", e => {
      e.preventDefault();
      li.classList.remove("drop-target");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId === s.id) return;
      const fromIdx = state.order.indexOf(draggedId);
      const toIdx = state.order.indexOf(s.id);
      if (fromIdx === -1 || toIdx === -1) return;
      state.order.splice(fromIdx, 1);
      const newToIdx = state.order.indexOf(s.id);
      state.order.splice(newToIdx, 0, draggedId);
      // remap currentIdx
      const visibleList = visible();
      const cur = visibleList[state.currentIdx];
      // Recompute after re-render
      save();
      renderPlaylist();
      if (cur) {
        const newIdx = visible().indexOf(cur);
        if (newIdx >= 0) state.currentIdx = newIdx;
      }
    });
  });
}

function renderNowPlaying() {
  const s = currentSong();
  if (!s) {
    $("np-title").textContent = "尚未選曲";
    $("np-tags").textContent = "";
    $("bpm-original").textContent = "—";
    $("bpm-current").textContent = "—";
    $("rate-current").textContent = "";
    return;
  }
  $("np-title").textContent = s.title + (s.duration ? "" : "");
  // Tags 顯示加上 Suno claim vs detected 對照
  let extraInfo = "";
  if (s.sunoBpm && s.detectedBpm && Math.abs(s.sunoBpm - Math.round(s.detectedBpm)) > 5) {
    extraInfo = ` ｜ Suno 標 ${s.sunoBpm}、實測 ${Math.round(s.detectedBpm)}`;
  } else if (s.sunoBpm) {
    extraInfo = ` ｜ Suno 標 ${s.sunoBpm}`;
  }
  $("np-tags").textContent = (s.tags || "") + extraInfo;
  $("bpm-original").textContent = effectiveBaseBpm(s) || "?";
  const effectiveBpm = s.targetBpm || effectiveBaseBpm(s);
  $("bpm-current").textContent = effectiveBpm || "?";
  const rate = (s.targetBpm && effectiveBaseBpm(s)) ? (s.targetBpm / effectiveBaseBpm(s)) : 1;
  $("rate-current").textContent = `${rate.toFixed(2)}×`;
}

function applyRate() {
  const s = currentSong();
  if (!s) return;
  const rate = (s.targetBpm && effectiveBaseBpm(s)) ? s.targetBpm / effectiveBaseBpm(s) : 1;
  audio.playbackRate = Math.max(0.25, Math.min(4, rate));
  renderNowPlaying();
}

function playCurrent() {
  const s = currentSong();
  if (!s) return;
  if (audio.src !== new URL(s.src, location.href).href) {
    audio.src = s.src;
  }
  applyRate();
  audio.play().catch(err => console.warn("play failed", err));
  renderPlaylist();
  renderNowPlaying();
  save();
}

function next(skipShuffle = false) {
  const list = visible();
  if (list.length === 0) return;
  if (state.mode === "shuffle" && !skipShuffle) {
    let r;
    do { r = Math.floor(Math.random() * list.length); }
    while (list.length > 1 && r === state.currentIdx);
    state.currentIdx = r;
  } else {
    state.currentIdx++;
    if (state.currentIdx >= list.length) {
      if (state.mode === "loop-all" || state.mode === "shuffle") state.currentIdx = 0;
      else { audio.pause(); state.currentIdx = list.length - 1; return; }
    }
  }
  playCurrent();
}

function prev() {
  const list = visible();
  if (list.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  state.currentIdx--;
  if (state.currentIdx < 0) state.currentIdx = list.length - 1;
  playCurrent();
}

function setMode(mode) {
  state.mode = mode;
  for (const btn of document.querySelectorAll(".mode")) {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  }
  save();
}

// Audio events
audio.addEventListener("timeupdate", () => {
  const t = audio.currentTime, d = audio.duration || 0;
  $("t-current").textContent = fmt(t);
  $("t-total").textContent = fmt(d);
  $("progress-fill").style.width = (d > 0 ? (t/d*100) : 0) + "%";
});
audio.addEventListener("ended", () => {
  if (state.mode === "loop-one") {
    audio.currentTime = 0;
    audio.play();
  } else {
    next();
  }
});
audio.addEventListener("play", () => $("btn-play").textContent = "⏸");
audio.addEventListener("pause", () => $("btn-play").textContent = "▶");

// Controls
$("btn-play").addEventListener("click", () => {
  if (state.currentIdx === -1) { state.currentIdx = 0; playCurrent(); return; }
  if (audio.paused) audio.play(); else audio.pause();
});
$("btn-next").addEventListener("click", () => next());
$("btn-prev").addEventListener("click", () => prev());
$("btn-loop-one").addEventListener("click", () => setMode("loop-one"));
$("btn-loop-all").addEventListener("click", () => setMode("loop-all"));
$("btn-shuffle").addEventListener("click", () => setMode("shuffle"));

// Progress seek
$("progress-bar").addEventListener("click", e => {
  if (!audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

// BPM control
function applyTargetToCurrent() {
  const v = parseInt($("target-bpm").value, 10);
  const s = currentSong();
  if (!s || !v) return;
  s.targetBpm = (v === effectiveBaseBpm(s)) ? null : v;
  save();
  applyRate();
  renderPlaylist();
}
function applyTargetToAll() {
  const v = parseInt($("target-bpm").value, 10);
  if (!v) return;
  state.targetBpm = v;
  for (const s of state.songs) {
    s.targetBpm = (effectiveBaseBpm(s) && v !== effectiveBaseBpm(s)) ? v : null;
  }
  save();
  applyRate();
  renderPlaylist();
}
$("btn-apply-current").addEventListener("click", applyTargetToCurrent);
$("btn-apply-all").addEventListener("click", applyTargetToAll);
$("target-bpm").addEventListener("keydown", e => {
  if (e.key === "Enter") applyTargetToCurrent();
});
for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    $("target-bpm").value = chip.dataset.bpm;
  });
}

$("btn-reset").addEventListener("click", () => {
  for (const s of state.songs) s.targetBpm = null;
  save();
  applyRate();
  renderPlaylist();
});

// Sort actions
$("btn-sort-order").addEventListener("click", () => {
  state.order = [...state.songs].sort((a,b)=>a.order-b.order).map(s=>s.id);
  save();
  renderPlaylist();
});
$("btn-sort-bpm").addEventListener("click", () => {
  state.order = [...state.songs].sort((a,b) => (a.sunoBpm||9999) - (b.sunoBpm||9999) || a.order - b.order).map(s=>s.id);
  save();
  renderPlaylist();
});

$("btn-clear").addEventListener("click", () => {
  if (!confirm("確定清空全部歌曲？\n（檔案不會被刪除，按「還原全部」可恢復）")) return;
  for (const s of state.songs) s.removed = true;
  state.currentIdx = -1;
  audio.pause();
  save();
  renderPlaylist();
  renderNowPlaying();
});

// ===== 節拍器 (Metronome) =====
let metroCtx = null;
let metroOn = false;
let metroNextTime = 0;
let metroBpm = 180;
let metroSchedTimer = null;
let metroVisualTimer = null;
let metroBeatCount = 0;

function metroSchedule() {
  // 預先排程未來 0.2 秒內的所有 click
  const lookahead = 0.2;
  const now = metroCtx.currentTime;
  while (metroNextTime < now + lookahead) {
    metroPlayClick(metroNextTime, metroBeatCount);
    metroNextTime += 60.0 / metroBpm;
    metroBeatCount++;
  }
}

function metroPlayClick(when, beatIdx) {
  // 強拍（每 4 拍一次）用較高頻、較強；其他拍用低頻短音
  const isAccent = (beatIdx % 4 === 0);
  const osc = metroCtx.createOscillator();
  const gain = metroCtx.createGain();
  osc.frequency.value = isAccent ? 1800 : 1200;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(isAccent ? 0.4 : 0.22, when + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  osc.connect(gain).connect(metroCtx.destination);
  osc.start(when);
  osc.stop(when + 0.06);
  // 視覺脈動
  const delay = Math.max(0, (when - metroCtx.currentTime) * 1000);
  setTimeout(() => {
    const btn = $("btn-metronome");
    if (btn && metroOn) {
      btn.classList.remove("active");
      void btn.offsetWidth; // restart animation
      btn.classList.add("active");
    }
  }, delay);
}

function metroStart() {
  if (!metroCtx) metroCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (metroCtx.state === "suspended") metroCtx.resume();
  metroBpm = Math.max(40, Math.min(300, parseInt($("target-bpm").value, 10) || 180));
  metroOn = true;
  metroNextTime = metroCtx.currentTime + 0.05;
  metroBeatCount = 0;
  metroSchedTimer = setInterval(metroSchedule, 25);
  const btn = $("btn-metronome");
  btn.classList.add("active");
  btn.textContent = `🥁 停止 (${metroBpm})`;
}

function metroStop() {
  metroOn = false;
  if (metroSchedTimer) clearInterval(metroSchedTimer);
  metroSchedTimer = null;
  const btn = $("btn-metronome");
  btn.classList.remove("active");
  btn.textContent = "🥁 節拍器";
}

$("btn-metronome").addEventListener("click", () => {
  if (metroOn) metroStop(); else metroStart();
});

// BPM 變更時，若節拍器在跑就自動同步
$("target-bpm").addEventListener("input", () => {
  if (metroOn) {
    const newBpm = Math.max(40, Math.min(300, parseInt($("target-bpm").value, 10) || 180));
    metroBpm = newBpm;
    $("btn-metronome").textContent = `🥁 停止 (${newBpm})`;
  }
});

// ===== TAP TEMPO =====
let tapTimes = [];
let tapResetTimer = null;
let tapFinalizedBpm = null;

function tapBpm() {
  // 從最近 8 次 tap 算 BPM（用中位數，抗抖動）
  if (tapTimes.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i-1]);
  intervals.sort((a,b)=>a-b);
  const median = intervals[Math.floor(intervals.length/2)];
  return 60000 / median;
}

function tapRender() {
  const r = $("tap-readout");
  const bpm = tapBpm();
  if (bpm === null) {
    r.textContent = "請連點...";
  } else {
    const conf = tapTimes.length >= 6 ? "✓" : "...";
    r.textContent = `${bpm.toFixed(1)} BPM ${conf}`;
  }
}

function tapEvent() {
  const now = performance.now();
  // 距上次 tap > 2 秒視為重新開始
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length-1] > 2000) {
    tapTimes = [];
    tapFinalizedBpm = null;
  }
  tapTimes.push(now);
  if (tapTimes.length > 8) tapTimes.shift();
  // 視覺閃光
  const btn = $("btn-tap");
  btn.classList.remove("flash"); void btn.offsetWidth; btn.classList.add("flash");
  tapRender();
  // 1.5 秒後沒新 tap → 自動把 BPM 填到目標欄
  if (tapResetTimer) clearTimeout(tapResetTimer);
  tapResetTimer = setTimeout(() => {
    const bpm = tapBpm();
    if (bpm !== null && tapTimes.length >= 4) {
      tapFinalizedBpm = Math.round(bpm);
      $("target-bpm").value = tapFinalizedBpm;
      $("tap-readout").textContent = `${tapFinalizedBpm} BPM → 已填入`;
      // 如果節拍器在跑，同步新 BPM
      if (metroOn) {
        metroBpm = tapFinalizedBpm;
        $("btn-metronome").textContent = `🥁 停止 (${tapFinalizedBpm})`;
      }
    }
    // 清空準備下一輪
    tapTimes = [];
  }, 1500);
}

$("btn-tap").addEventListener("click", tapEvent);
// 鍵盤空白鍵也能 tap（player 不在 input focus 時）
document.addEventListener("keydown", e => {
  if (e.code === "Space" && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
    e.preventDefault();
    tapEvent();
  }
});

$("btn-restore").addEventListener("click", () => {
  // 還原全部被移除的歌
  let restored = 0;
  for (const s of state.songs) {
    if (s.removed) { s.removed = false; restored++; }
  }
  save();
  renderPlaylist();
  renderNowPlaying();
  if (restored === 0) alert("沒有需要還原的歌曲");
});

// Add local songs
$("btn-add-song").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", e => {
  for (const file of e.target.files) {
    const id = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);
    const url = URL.createObjectURL(file);
    const newSong = {
      id, title: file.name.replace(/\.[^.]+$/,""),
      tags: "本機檔案",
      duration: "",
      sunoBpm: null,
      filename: file.name,
      order: state.songs.length + 1,
      src: url,
      targetBpm: null,
      removed: false,
    };
    state.songs.push(newSong);
    state.order.push(id);
  }
  save();
  renderPlaylist();
  e.target.value = "";
});

// Boot
(async () => {
  // 緊急重置：網址加 ?reset=1 就清空 localStorage
  if (new URL(location.href).searchParams.has("reset")) {
    localStorage.removeItem(STATE_KEY);
    // 移掉 query 避免重新整理又清一次
    history.replaceState(null, "", location.pathname);
  }
  try {
    await loadLibrary();
  } catch(err) {
    $("np-title").textContent = "讀取 metadata 失敗：" + err.message;
    return;
  }
  setMode(state.mode);
  $("target-bpm").value = state.targetBpm;
  renderPlaylist();
  if (state.currentIdx >= 0 && state.currentIdx < visible().length) {
    const s = visible()[state.currentIdx];
    if (s) { audio.src = s.src; applyRate(); }
  }
  renderNowPlaying();
})();
