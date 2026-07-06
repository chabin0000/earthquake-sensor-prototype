const elements = {
  startButton: document.getElementById("startButton"),
  stopSensorButton: document.getElementById("stopSensorButton"),
  clearAlarmButton: document.getElementById("clearAlarmButton"),
  resetBaselineButton: document.getElementById("resetBaselineButton"),
  testAlarmButton: document.getElementById("testAlarmButton"),
  saveCsvButton: document.getElementById("saveCsvButton"),
  thresholdSlider: document.getElementById("thresholdSlider"),
  thresholdValue: document.getElementById("thresholdValue"),
  statusText: document.getElementById("statusText"),
  supportMessage: document.getElementById("supportMessage"),
  xValue: document.getElementById("xValue"),
  yValue: document.getElementById("yValue"),
  zValue: document.getElementById("zValue"),
  magnitudeValue: document.getElementById("magnitudeValue"),
  deltaValue: document.getElementById("deltaValue"),
  baselineDeltaValue: document.getElementById("baselineDeltaValue"),
  maxDeltaValue: document.getElementById("maxDeltaValue"),
  motionCountValue: document.getElementById("motionCountValue"),
  detectedTime: document.getElementById("detectedTime"),
  detectedDelta: document.getElementById("detectedDelta"),
  detectedBaselineDelta: document.getElementById("detectedBaselineDelta"),
  lastMotionTime: document.getElementById("lastMotionTime"),
  sensorSource: document.getElementById("sensorSource"),
  deltaBars: document.getElementById("deltaBars"),
  eventLog: document.getElementById("eventLog")
};

let threshold = Number(elements.thresholdSlider.value);
let sensorRunning = false;
let userStoppedSensor = false;
let previousMagnitude = null;
let currentMagnitude = null;
let baselineMagnitude = null;
let currentBaselineDelta = 0;
let maxDelta = 0;
let recentDeltas = [];
let eventLogItems = [];
let experimentRows = [];
let isAlarmActive = false;
let stabilizationUntil = 0;
let motionEventCount = 0;
let invalidMotionEventCount = 0;
let lastMotionReceivedAt = null;
let lastGraphUpdateTime = 0;
let lastDataRecordTime = 0;

let audioContext = null;
let alarmTimerId = null;
const activeOscillators = new Set();
const maxExperimentRows = 1000;

elements.startButton.addEventListener("click", startSensor);
elements.stopSensorButton.addEventListener("click", stopSensor);
elements.clearAlarmButton.addEventListener("click", clearAlarm);
elements.resetBaselineButton.addEventListener("click", resetBaseline);
elements.testAlarmButton.addEventListener("click", runTestAlarm);
elements.saveCsvButton.addEventListener("click", downloadCsv);
elements.thresholdSlider.addEventListener("input", updateThreshold);

updateThreshold();
updateMotionStats();
renderDeltaBars();
document.documentElement.dataset.appReady = "true";

async function startSensor() {
  if (sensorRunning) {
    return;
  }

  elements.startButton.disabled = true;
  elements.stopSensorButton.disabled = true;
  setSupportMessage("센서 권한을 확인하고 있습니다.", false);
  elements.statusText.textContent = "센서 준비 중...";

  const audioReady = await initializeAudio();

  if (!("DeviceMotionEvent" in window)) {
    showUnsupportedBrowser();
    return;
  }

  if (!window.isSecureContext && location.protocol !== "file:") {
    setSupportMessage("센서 API는 HTTPS 환경에서 안정적으로 작동합니다. GitHub Pages 배포 후 모바일 테스트를 권장합니다.", false);
  }

  try {
    /*
      센서 권한 요청:
      iOS Safari 계열은 사용자가 버튼을 누른 뒤 DeviceMotionEvent.requestPermission()을 호출해야 한다.
      Android Chrome은 보통 별도 권한 창 없이 devicemotion 이벤트가 바로 들어오지만,
      사용자 클릭 이후에 시작하도록 만들어 모바일 브라우저 정책을 만족시킨다.
    */
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        throw new Error("센서 권한이 허용되지 않았습니다.");
      }
    }

    window.addEventListener("devicemotion", handleDeviceMotion);
    sensorRunning = true;
    userStoppedSensor = false;
    previousMagnitude = null;
    invalidMotionEventCount = 0;
    stabilizationUntil = performance.now() + 1500;

    elements.startButton.disabled = true;
    elements.stopSensorButton.disabled = false;
    elements.statusText.textContent = "감시 중 - 강한 진동 없음";

    if (audioReady) {
      setSupportMessage("센서가 시작되었습니다. 처음 1.5초 동안은 기준값 안정화를 위해 경보를 울리지 않습니다.", false);
    } else {
      setSupportMessage("센서는 시작되었지만 이 브라우저에서는 Web Audio API 경보음이 지원되지 않거나 차단되었습니다.", true);
    }

    const validCountAtStart = motionEventCount;
    setTimeout(() => {
      if (sensorRunning && motionEventCount === validCountAtStart) {
        removeSensorListener();
        elements.statusText.textContent = "대기 중 - 센서 데이터 수신 불가";
        setSupportMessage("센서 이벤트가 아직 수신되지 않았습니다. 모바일 Chrome, HTTPS 주소, 센서 권한을 확인해 주세요.", true);
      }
    }, 2200);
  } catch (error) {
    removeSensorListener();
    elements.statusText.textContent = "대기 중 - 센서 시작 버튼을 눌러 주세요.";
    setSupportMessage(error.message || "센서 접근 중 오류가 발생했습니다.", true);
  }
}

function stopSensor() {
  if (!sensorRunning) {
    return;
  }

  removeSensorListener();
  userStoppedSensor = true;
  isAlarmActive = false;
  document.body.classList.remove("alarm-active");
  stopAlarmSound();
  elements.statusText.textContent = "대기 중 - 센서가 중지되었습니다.";
  setSupportMessage("devicemotion 이벤트 수신을 중지했습니다. 다시 측정하려면 센서 시작을 눌러 주세요.", false);
}

function removeSensorListener() {
  window.removeEventListener("devicemotion", handleDeviceMotion);
  sensorRunning = false;
  elements.startButton.disabled = false;
  elements.stopSensorButton.disabled = true;
}

function handleDeviceMotion(event) {
  const reading = readAcceleration(event);

  if (!reading.isValid) {
    invalidMotionEventCount += 1;

    if (invalidMotionEventCount >= 5) {
      removeSensorListener();
      elements.statusText.textContent = "대기 중 - 센서 데이터 수신 불가";
      setSupportMessage("이 브라우저에서는 센서 접근이 지원되지 않거나 센서 값이 제공되지 않습니다.", true);
    } else {
      setSupportMessage("센서 이벤트를 받았지만 아직 x, y, z 값이 비어 있습니다. 잠시 기다려 주세요.", false);
    }

    return;
  }

  const receivedAt = new Date();
  motionEventCount += 1;
  invalidMotionEventCount = 0;
  lastMotionReceivedAt = receivedAt;
  updateMotionStats();

  /*
    x, y, z축 데이터 수집:
    DeviceMotionEvent에서 스마트폰의 3축 가속도 값을 읽는다.
    우선 accelerationIncludingGravity를 사용하고, 값이 없으면 acceleration 값을 대신 사용한다.
  */
  const { x, y, z, sourceName } = reading;

  /*
    3축 가속도 벡터 합성:
    방향이 다른 x, y, z축 값을 하나의 전체 가속도 크기(magnitude)로 합친다.
  */
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  /*
    이전 값과 현재 값의 차이 계산:
    전체 가속도 크기 자체보다 순간적으로 얼마나 변했는지를 보기 위해 delta를 계산한다.
  */
  const delta = previousMagnitude === null ? 0 : Math.abs(magnitude - previousMagnitude);

  if (baselineMagnitude === null) {
    baselineMagnitude = magnitude;
  }

  const baselineDelta = Math.abs(magnitude - baselineMagnitude);
  currentBaselineDelta = baselineDelta;
  previousMagnitude = magnitude;
  currentMagnitude = magnitude;

  if (delta > maxDelta) {
    maxDelta = delta;
  }

  updateSensorDisplay(x, y, z, magnitude, delta, baselineDelta, sourceName);
  rememberDelta(delta);

  let alarmTriggered = false;

  if (performance.now() < stabilizationUntil) {
    if (!isAlarmActive) {
      elements.statusText.textContent = "감시 중 - 기준값 안정화 중";
    }

    recordExperimentRow({
      timestamp: receivedAt,
      x,
      y,
      z,
      magnitude,
      delta,
      baselineDelta,
      sourceName,
      alarm: false,
      force: false
    });
    return;
  }

  /*
    임계값 판별:
    기존 경보 판단은 그대로 delta를 사용한다.
    baselineDelta는 기준값 대비 변화를 분석하기 위한 실험 지표이며 경보 조건에는 사용하지 않는다.
  */
  if (delta > threshold) {
    alarmTriggered = true;
    triggerAlarm(delta, false, baselineDelta);
  } else if (!isAlarmActive) {
    elements.statusText.textContent = "감시 중 - 강한 진동 없음";
  }

  recordExperimentRow({
    timestamp: receivedAt,
    x,
    y,
    z,
    magnitude,
    delta,
    baselineDelta,
    sourceName,
    alarm: alarmTriggered,
    force: alarmTriggered
  });
}

function readAcceleration(event) {
  const withGravity = event.accelerationIncludingGravity;
  const withoutGravity = event.acceleration;
  let source = withGravity;
  let sourceName = "accelerationIncludingGravity";

  if (!hasAnyAxisValue(source)) {
    source = withoutGravity;
    sourceName = "acceleration";
  }

  if (!hasAnyAxisValue(source)) {
    return {
      isValid: false,
      x: 0,
      y: 0,
      z: 0,
      sourceName: "사용 가능한 센서 없음"
    };
  }

  return {
    isValid: true,
    x: Number(source.x ?? 0),
    y: Number(source.y ?? 0),
    z: Number(source.z ?? 0),
    sourceName
  };
}

function hasAnyAxisValue(source) {
  if (!source) {
    return false;
  }

  return [source.x, source.y, source.z].some((value) => Number.isFinite(value));
}

function updateSensorDisplay(x, y, z, magnitude, delta, baselineDelta, sourceName) {
  elements.xValue.textContent = formatNumber(x);
  elements.yValue.textContent = formatNumber(y);
  elements.zValue.textContent = formatNumber(z);
  elements.magnitudeValue.textContent = formatNumber(magnitude);
  elements.deltaValue.textContent = formatNumber(delta);
  elements.baselineDeltaValue.textContent = formatNumber(baselineDelta);
  elements.maxDeltaValue.textContent = formatNumber(maxDelta);
  elements.sensorSource.textContent = `센서 데이터: ${sourceName}`;
}

function updateMotionStats() {
  elements.motionCountValue.textContent = String(motionEventCount);
  elements.lastMotionTime.textContent = `마지막 센서 수신: ${lastMotionReceivedAt ? formatTime(lastMotionReceivedAt) : "없음"}`;
}

function updateThreshold() {
  threshold = Number(elements.thresholdSlider.value);
  elements.thresholdValue.textContent = threshold.toFixed(1);
}

function triggerAlarm(delta, isTestMode, baselineDelta = currentBaselineDelta) {
  const now = new Date();
  const nowText = formatTime(now);

  isAlarmActive = true;

  /*
    경보 UI 전환:
    경보 상태가 되면 body에 alarm-active 클래스를 붙여 빨간 배경과 깜빡임 효과를 적용한다.
  */
  document.body.classList.add("alarm-active");
  elements.statusText.textContent = "강한 초기 진동 감지! 안전한 곳으로 이동하세요.";
  elements.detectedTime.textContent = `감지 시각: ${nowText}${isTestMode ? " (테스트)" : ""}`;
  elements.detectedDelta.textContent = `감지 delta: ${formatNumber(delta)}`;
  elements.detectedBaselineDelta.textContent = `감지 baselineDelta: ${formatNumber(baselineDelta)}`;

  if (delta > maxDelta) {
    maxDelta = delta;
    elements.maxDeltaValue.textContent = formatNumber(maxDelta);
  }

  addEventLog(`${nowText} - ${isTestMode ? "테스트 경보" : "강한 진동 감지"} / delta ${formatNumber(delta)} / baselineDelta ${formatNumber(baselineDelta)}`);
  startAlarmSound();

  if ("vibrate" in navigator) {
    navigator.vibrate([180, 90, 180]);
  }
}

async function initializeAudio() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    setSupportMessage("이 브라우저에서는 Web Audio API 경보음이 지원되지 않습니다.", true);
    return false;
  }

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  if (audioContext.state === "suspended") {
    try {
      await Promise.race([
        audioContext.resume(),
        new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        })
      ]);
    } catch (error) {
      return false;
    }
  }

  return audioContext.state === "running";
}

function startAlarmSound() {
  if (!audioContext || audioContext.state !== "running" || alarmTimerId) {
    return;
  }

  /*
    Web Audio API 경보음 생성:
    외부 mp3 파일을 쓰지 않고 OscillatorNode와 GainNode로 짧은 전자음을 반복 생성한다.
  */
  playBeep();
  alarmTimerId = window.setInterval(playBeep, 650);
}

function playBeep() {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);

  activeOscillators.add(oscillator);
  oscillator.addEventListener("ended", () => {
    activeOscillators.delete(oscillator);
  });
}

function clearAlarm() {
  /*
    경보 해제:
    화면의 경보 클래스를 제거하고, 반복 경보음 타이머와 현재 재생 중인 소리를 모두 멈춘다.
  */
  isAlarmActive = false;
  document.body.classList.remove("alarm-active");
  stopAlarmSound();

  if (sensorRunning) {
    elements.statusText.textContent = "감시 중 - 강한 진동 없음";
  } else if (userStoppedSensor) {
    elements.statusText.textContent = "대기 중 - 센서가 중지되었습니다.";
  } else {
    elements.statusText.textContent = "대기 중 - 센서 시작 버튼을 눌러 주세요.";
  }

  stabilizationUntil = performance.now() + 800;
  setSupportMessage("경보가 해제되었습니다. 짧은 안정화 시간 뒤 다시 감시합니다.", false);
}

function stopAlarmSound() {
  if (alarmTimerId) {
    window.clearInterval(alarmTimerId);
    alarmTimerId = null;
  }

  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch (error) {
      // 이미 종료된 OscillatorNode는 stop()을 다시 호출하면 오류가 날 수 있으므로 무시한다.
    }
  });

  activeOscillators.clear();
}

function resetBaseline() {
  /*
    기준값 재설정:
    휴대폰을 책상 위에 가만히 둔 상태의 현재 magnitude를 기준으로 삼고,
    직후 작은 흔들림으로 바로 경보가 울리지 않도록 안정화 시간을 둔다.
  */
  if (currentMagnitude === null) {
    setSupportMessage("아직 기준값으로 사용할 센서 데이터가 없습니다. 센서 시작 후 다시 눌러 주세요.", true);
    return;
  }

  if (isAlarmActive) {
    clearAlarm();
  }

  baselineMagnitude = currentMagnitude;
  previousMagnitude = currentMagnitude;
  currentBaselineDelta = 0;
  maxDelta = 0;
  recentDeltas = [];
  stabilizationUntil = performance.now() + 1500;

  elements.baselineDeltaValue.textContent = "0.00";
  elements.maxDeltaValue.textContent = "0.00";
  renderDeltaBars();

  if (sensorRunning) {
    elements.statusText.textContent = "감시 중 - 기준값 안정화 중";
  }

  setSupportMessage(`기준값이 ${formatNumber(baselineMagnitude)}로 재설정되었습니다. 1.5초 동안 안정화합니다.`, false);
}

async function runTestAlarm() {
  const audioReady = await initializeAudio();

  if (!audioReady) {
    setSupportMessage("테스트 경보 화면은 실행되지만, 이 브라우저에서는 경보음 재생이 차단되었거나 지원되지 않습니다.", true);
  }

  const testDelta = Math.max(threshold + 1.5, 6.5);
  const testBaselineDelta = Math.max(currentBaselineDelta, testDelta);
  elements.deltaValue.textContent = formatNumber(testDelta);
  elements.baselineDeltaValue.textContent = formatNumber(testBaselineDelta);
  triggerAlarm(testDelta, true, testBaselineDelta);

  recordExperimentRow({
    timestamp: new Date(),
    x: 0,
    y: 0,
    z: 0,
    magnitude: currentMagnitude ?? 0,
    delta: testDelta,
    baselineDelta: testBaselineDelta,
    sourceName: "test-mode",
    alarm: true,
    force: true
  });
}

function rememberDelta(delta) {
  const now = performance.now();

  if (now - lastGraphUpdateTime < 120) {
    return;
  }

  lastGraphUpdateTime = now;
  recentDeltas.push(delta);

  if (recentDeltas.length > 20) {
    recentDeltas.shift();
  }

  renderDeltaBars();
}

function renderDeltaBars() {
  elements.deltaBars.innerHTML = "";

  if (recentDeltas.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "아직 기록된 센서 데이터가 없습니다.";
    elements.deltaBars.appendChild(empty);
    return;
  }

  recentDeltas.forEach((delta) => {
    const bar = document.createElement("div");
    const heightRatio = Math.min(delta / Math.max(threshold * 1.5, 1), 1);
    bar.className = "delta-bar";
    bar.style.height = `${Math.max(4, heightRatio * 100)}%`;
    bar.title = `delta ${formatNumber(delta)}`;
    elements.deltaBars.appendChild(bar);
  });
}

function recordExperimentRow({ timestamp, x, y, z, magnitude, delta, baselineDelta, sourceName, alarm, force }) {
  const now = performance.now();

  if (!force && now - lastDataRecordTime < 100) {
    return;
  }

  lastDataRecordTime = now;
  experimentRows.push({
    timestamp: timestamp.toISOString(),
    localTime: formatTime(timestamp),
    motionEventCount,
    x,
    y,
    z,
    magnitude,
    delta,
    baselineDelta,
    threshold,
    alarm,
    sourceName
  });

  if (experimentRows.length > maxExperimentRows) {
    experimentRows.shift();
  }
}

function downloadCsv() {
  if (experimentRows.length === 0) {
    setSupportMessage("저장할 실험 데이터가 아직 없습니다. 센서 시작 후 데이터를 수집하거나 테스트 경보를 실행해 주세요.", true);
    return;
  }

  const headers = [
    "감지시각_ISO",
    "감지시각_표시",
    "센서수신횟수",
    "x축가속도",
    "y축가속도",
    "z축가속도",
    "magnitude",
    "delta",
    "baselineDelta",
    "threshold",
    "경보여부",
    "센서데이터종류"
  ];

  const rows = experimentRows.map((row) => [
    row.timestamp,
    row.localTime,
    row.motionEventCount,
    formatNumber(row.x),
    formatNumber(row.y),
    formatNumber(row.z),
    formatNumber(row.magnitude),
    formatNumber(row.delta),
    formatNumber(row.baselineDelta),
    row.threshold.toFixed(1),
    row.alarm ? "Y" : "N",
    row.sourceName
  ]);

  const csvText = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `earthquake-sensor-data-${makeFileTimestamp(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setSupportMessage(`CSV 파일을 저장했습니다. 최근 ${experimentRows.length}개의 실험 데이터가 포함되어 있습니다.`, false);
}

function escapeCsvValue(value) {
  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function addEventLog(message) {
  eventLogItems.unshift(message);

  if (eventLogItems.length > 8) {
    eventLogItems = eventLogItems.slice(0, 8);
  }

  elements.eventLog.innerHTML = "";
  eventLogItems.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    elements.eventLog.appendChild(li);
  });
}

function showUnsupportedBrowser() {
  removeSensorListener();
  elements.statusText.textContent = "대기 중 - 센서 접근 불가";
  setSupportMessage("이 브라우저에서는 센서 접근이 지원되지 않습니다.", true);
}

function setSupportMessage(message, isError) {
  elements.supportMessage.textContent = message;
  elements.supportMessage.classList.toggle("error", isError);
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function formatTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function makeFileTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}
