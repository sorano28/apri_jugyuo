const STORAGE_KEYS = {
  SELECTED_PRESET: "selectedPreset",
  PRESETS: "presets",
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

let presets = loadPresets();
let selectedPreset = localStorage.getItem(STORAGE_KEYS.SELECTED_PRESET) || "";
let alarmActive = false;
let alarmTriggeredAtMinute = "";
let currentMission = createMission();
let tauntIntervalId = null;
let audioIntervalId = null;

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
  const sentence = `${randomItem(tauntFragments)}。${randomItem(tauntFragments)}。`;
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  utterance.rate = 1.03;
  utterance.pitch = 1;
  utterance.volume = 1;
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
    await alarmAudio.play();
  } catch {
    // ユーザー操作がない場合は再生失敗することがある
  }
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

  speakTaunt();
  tauntIntervalId = window.setInterval(speakTaunt, 30000);
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
  presetForm.classList.toggle("hidden");
  if (!presetForm.classList.contains("hidden")) {
    presetTimeInput.focus();
  }
});

presetForm.addEventListener("submit", (event) => {
  event.preventDefault();
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

initializeSelectedPreset();
renderPresets();
checkAlarmTrigger();
setInterval(checkAlarmTrigger, 1000);
