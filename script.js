const STORAGE_KEYS = {
  SELECTED_PRESET: "selectedPreset",
  PRESETS: "presets",
  FAIL_LOGS: "failLogs",
};

const currentClockEl = document.getElementById("currentClock");
const alarmClockEl = document.getElementById("alarmClock");
const presetListEl = document.getElementById("presetList");
const addPresetBtn = document.getElementById("addPresetBtn");
const presetForm = document.getElementById("presetForm");
const presetTimeInput = document.getElementById("presetTimeInput");
const normalModeEl = document.getElementById("normalMode");
const alarmModeEl = document.getElementById("alarmMode");
const missionQuestionEl = document.getElementById("missionQuestion");
const missionAnswerEl = document.getElementById("missionAnswer");
const missionSubmitBtn = document.getElementById("missionSubmit");
const missionFeedbackEl = document.getElementById("missionFeedback");
const alarmAudio = document.getElementById("alarmAudio");
const unlockAudioBtn = document.getElementById("unlockAudioBtn");
const lateMessageEl = document.getElementById("lateMessage");

let presets = loadPresets();
let selectedPreset = localStorage.getItem(STORAGE_KEYS.SELECTED_PRESET) || "";
let alarmActive = false;
let alarmTriggeredAtMinute = "";
let currentMission = createMission();
let tauntIntervalId = null;
let audioIntervalId = null;
let webAudioIntervalId = null;
let failTimeoutId = null;
let audioContext = null;
let audioUnlocked = false;
let selectedVoice = null;
let failLogs = loadFailLogs();

const tauntFragments = [
  "まだ寝てるの？",
  "ほんと終わってるよ",
  "いい加減起きろ",
  "起きないと今日が終わるぞ",
  "朝の自分に負けるな",
  "言い訳はあとで聞く",
];

function pad2(num) {
  return String(num).padStart(2, "0");
}

function formatTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESETS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => /^\d{2}:\d{2}$/.test(item));
  } catch {
    return [];
  }
}

function savePresets() {
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
}

function loadFailLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAIL_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  } catch {
    return [];
  }
}

function saveFailLogs() {
  localStorage.setItem(STORAGE_KEYS.FAIL_LOGS, JSON.stringify(failLogs));
}

function getTodayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function createLateMessage() {
  const total = failLogs.length;
  if (total <= 5) {
    return `今日も寝坊、累計${total}回`;
  }
  if (total <= 15) {
    return `またやったね。これで累計${total}回`;
  }
  return `もう言い訳できないよ。累計${total}回`;
}

function renderLateMessage() {
  lateMessageEl.textContent = createLateMessage();
}

function recordFailIfNeeded() {
  const today = getTodayKey();
  if (failLogs.includes(today)) return;
  failLogs.push(today);
  saveFailLogs();
  renderLateMessage();
}

function renderPresets() {
  presetListEl.innerHTML = "";

  if (presets.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "プリセットがありません。＋で追加してください。";
    presetListEl.append(li);
    return;
  }

  presets.forEach((time) => {
    const li = document.createElement("li");
    li.className = "preset-item";

    const selectBtn = document.createElement("button");
    selectBtn.className = "preset-select";
    if (selectedPreset === time) selectBtn.classList.add("active");
    selectBtn.textContent = time;
    selectBtn.addEventListener("click", () => {
      selectedPreset = time;
      localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, selectedPreset);
      renderPresets();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.setAttribute("aria-label", `${time}を削除`);
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => {
      presets = presets.filter((item) => item !== time);
      if (selectedPreset === time) {
        selectedPreset = presets[0] || "";
        if (selectedPreset) {
          localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, selectedPreset);
        } else {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_PRESET);
        }
      }
      savePresets();
      renderPresets();
    });

    li.append(selectBtn, delBtn);
    presetListEl.append(li);
  });
}

function createMission() {
  const left = Math.floor(Math.random() * 50) + 10;
  const right = Math.floor(Math.random() * 50) + 10;
  return {
    text: `${left} + ${right} = ?`,
    answer: left + right,
  };
}

function speakTaunt() {
  if (!("speechSynthesis" in window)) return;
  if (!audioUnlocked) return;

  const sentence = `${randomItem(tauntFragments)}。${randomItem(tauntFragments)}。`;
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  utterance.rate = 1.03;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.onerror = () => {
    window.setTimeout(speakTaunt, 500);
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function showAlarmMode() {
  normalModeEl.classList.add("hidden");
  alarmModeEl.classList.remove("hidden");
}

function showNormalMode() {
  alarmModeEl.classList.add("hidden");
  normalModeEl.classList.remove("hidden");
}

async function playAlarmAudio() {
  try {
    alarmAudio.currentTime = 0;
    alarmAudio.volume = 1;
    await alarmAudio.play();
  } catch {
    // ユーザー操作がない場合は再生失敗することがある
  }
}

function initAudioContext() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = new AudioContextClass();
}

function playWebAudioBlast() {
  if (!audioContext || audioContext.state !== "running") return;

  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.95, now);
  master.connect(audioContext.destination);

  const frequencies = [880, 660, 990];
  frequencies.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.65, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + index * 0.04);
    osc.stop(now + 0.35 + index * 0.04);
  });
}

function pickJapaneseVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  selectedVoice =
    voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("ja")) ||
    voices[0];
}

async function unlockAudioAndSpeech() {
  audioUnlocked = true;
  initAudioContext();
  if (audioContext?.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      // resumeできない端末もある
    }
  }

  pickJapaneseVoice();

  if ("speechSynthesis" in window) {
    const warmup = new SpeechSynthesisUtterance(" ");
    warmup.volume = 0;
    warmup.lang = "ja-JP";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(warmup);
  }

  unlockAudioBtn.classList.add("hidden");
}

function startAlarm(nowText) {
  if (alarmActive) return;
  alarmActive = true;
  showAlarmMode();
  alarmClockEl.textContent = nowText;

  currentMission = createMission();
  missionQuestionEl.textContent = currentMission.text;
  missionAnswerEl.value = "";
  missionFeedbackEl.textContent = "";

  playAlarmAudio();
  audioIntervalId = window.setInterval(playAlarmAudio, 8000);
  playWebAudioBlast();
  webAudioIntervalId = window.setInterval(playWebAudioBlast, 1200);

  speakTaunt();
  tauntIntervalId = window.setInterval(speakTaunt, 30000);

  if (failTimeoutId) {
    window.clearTimeout(failTimeoutId);
  }
  failTimeoutId = window.setTimeout(() => {
    if (alarmActive) {
      recordFailIfNeeded();
    }
  }, 3 * 60 * 1000);
}

function stopAlarm() {
  alarmActive = false;
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
  window.speechSynthesis?.cancel();

  if (tauntIntervalId) {
    window.clearInterval(tauntIntervalId);
    tauntIntervalId = null;
  }
  if (audioIntervalId) {
    window.clearInterval(audioIntervalId);
    audioIntervalId = null;
  }
  if (webAudioIntervalId) {
    window.clearInterval(webAudioIntervalId);
    webAudioIntervalId = null;
  }
  if (failTimeoutId) {
    window.clearTimeout(failTimeoutId);
    failTimeoutId = null;
  }

  showNormalMode();
}

function checkAlarmTrigger() {
  const now = new Date();
  const nowText = formatTime(now);
  currentClockEl.textContent = nowText;

  if (alarmActive) {
    alarmClockEl.textContent = nowText;
    return;
  }

  if (!selectedPreset) return;

  const minuteKey = `${nowText}:${now.getDate()}`;
  if (nowText === selectedPreset && alarmTriggeredAtMinute !== minuteKey) {
    alarmTriggeredAtMinute = minuteKey;
    startAlarm(nowText);
  }
}

function initializeSelectedPreset() {
  if (!selectedPreset && presets[0]) {
    selectedPreset = presets[0];
    localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, selectedPreset);
  }
  if (selectedPreset && !presets.includes(selectedPreset)) {
    selectedPreset = presets[0] || "";
    if (selectedPreset) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, selectedPreset);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_PRESET);
    }
  }
}

addPresetBtn.addEventListener("click", () => {
  unlockAudioAndSpeech();
  presetForm.classList.toggle("hidden");
  if (!presetForm.classList.contains("hidden")) {
    presetTimeInput.focus();
  }
});

presetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockAudioAndSpeech();
  const value = presetTimeInput.value;
  if (!value || presets.includes(value)) return;

  presets.push(value);
  presets.sort();
  selectedPreset = value;

  savePresets();
  localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, selectedPreset);

  presetForm.reset();
  presetForm.classList.add("hidden");
  renderPresets();
});

missionSubmitBtn.addEventListener("click", () => {
  unlockAudioAndSpeech();
  const input = Number(missionAnswerEl.value);
  if (input === currentMission.answer) {
    missionFeedbackEl.textContent = "正解。アラームを停止します。";
    stopAlarm();
    return;
  }

  missionFeedbackEl.textContent = "不正解。もう一度。";
  missionAnswerEl.focus();
});

missionAnswerEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    missionSubmitBtn.click();
  }
});

unlockAudioBtn.addEventListener("click", unlockAudioAndSpeech);
document.addEventListener("touchstart", unlockAudioAndSpeech, { once: true });
document.addEventListener("click", unlockAudioAndSpeech, { once: true });
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = pickJapaneseVoice;
}

initializeSelectedPreset();
renderPresets();
renderLateMessage();
checkAlarmTrigger();
setInterval(checkAlarmTrigger, 1000);
