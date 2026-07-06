# 스마트폰 가속도 센서 기반 지진 초기 진동 감지 프로토타입

## 1. 프로젝트 개요

이 프로젝트는 고등학교 통합과학 지구과학 탐구보고서를 위한 교육용 모바일 웹앱입니다. 스마트폰의 가속도 센서 값을 이용해 강한 진동을 감지하고, 순간적인 진동 변화량이 임계값을 넘으면 화면과 소리로 경보를 출력합니다.

중요: 이 앱은 실제 지진 경보용으로 사용할 수 없는 교육용 실험 앱입니다. 실제 지진 여부를 정확히 판별하지 않으며, 재난 상황에서 이 앱에 의존하면 안 됩니다.

본 앱은 실제 P파를 판별하지 않고, 스마트폰에서 감지되는 순간적인 진동 변화량을 기준으로 경보를 출력합니다.

## 2. 파일 구조

```text
index.html
style.css
script.js
README.md
```

- `index.html`: 화면 구조, 버튼, 센서 데이터 표시 영역, 로그 영역
- `style.css`: 모바일 반응형 UI, 경보 시 빨간색 배경과 깜빡임 효과
- `script.js`: 센서 데이터 수집, magnitude/delta/baselineDelta 계산, 경보, CSV 저장
- `README.md`: 실행 방법, 과학 원리, 한계, 배포 방법 설명

## 3. 실행 방법

PC에서 화면만 확인하려면 `index.html` 파일을 브라우저로 열면 됩니다. 단, PC에는 일반적으로 스마트폰 가속도 센서가 없으므로 실제 센서 감지는 되지 않을 수 있습니다.

PC 또는 크롬북에서는 `테스트 경보 실행` 버튼을 사용해 경보 화면, 경보음, 로그, CSV 저장 기능을 확인할 수 있습니다.

## 4.예상 배포 주소 형식

```text
https://chabin0000.github.io/earthquake-sensor-prototype/index.html
```



## 5. 모바일 Chrome 테스트 방법

1. 안드로이드 스마트폰에서 Chrome 브라우저를 엽니다.
2. GitHub Pages 배포 주소에 접속합니다.
3. `센서 시작` 버튼을 누릅니다.
4. 휴대폰을 책상 위에 가만히 둔 상태에서 `기준값 재설정` 버튼을 누릅니다.
5. 휴대폰을 약하게 흔들거나 책상을 살짝 진동시킵니다.
6. `delta` 값과 `baselineDelta` 값이 어떻게 변하는지 관찰합니다.
7. `delta`가 임계값보다 커지면 경보가 발생합니다.
8. 실험이 끝나면 `센서 중지` 버튼을 눌러 센서 수신을 멈춥니다.
9. `CSV 저장` 버튼을 눌러 실험 데이터를 파일로 저장합니다.

## 6. HTTPS 환경이 필요한 이유

모바일 브라우저의 센서 API와 오디오 재생은 개인정보와 보안 문제 때문에 제한을 받습니다. 가속도 센서 같은 장치 정보는 HTTPS 환경에서 더 안정적으로 동작합니다. GitHub Pages는 무료 HTTPS 주소를 제공하므로 스마트폰 실험에 적합합니다.

## 7. 사용한 핵심 기술

- HTML: 화면 구조 작성
- CSS: 모바일 반응형 UI와 경보 시각 효과 구현
- JavaScript: 센서 데이터 처리, 임계값 판별, CSV 저장
- DeviceMotionEvent API: 스마트폰의 가속도 센서 값 수집
- Web Audio API: 외부 mp3 없이 전자음 경보 생성

## 8. 과학적 원리 설명

지진이 발생하면 일반적으로 P파가 S파보다 먼저 도달합니다. 실제 지진 조기 경보 시스템은 먼저 도착하는 초기 진동을 빠르게 감지하고, 더 강한 흔들림이 도착하기 전에 경보를 보내는 것을 목표로 합니다.

이 프로토타입은 그 원리 중 일부를 단순화했습니다. 스마트폰 가속도 센서에서 x, y, z축 가속도를 읽고, 3축 값을 합성해 전체 가속도 크기 `magnitude`를 구합니다.

```text
magnitude = sqrt(x*x + y*y + z*z)
```

그 다음 두 가지 변화량을 계산합니다.

- `delta`: 바로 이전 `magnitude`와 현재 `magnitude`의 차이
- `baselineDelta`: 기준값 재설정 시 저장한 `baselineMagnitude`와 현재 `magnitude`의 차이

경보 판단에는 기존 방식인 `delta > threshold`만 사용합니다. `baselineDelta`는 경보 조건이 아니라, 기준 상태에서 얼마나 멀어졌는지 분석하기 위한 실험 지표입니다.

## 9. delta와 baselineDelta의 차이

`delta`는 순간적인 변화량입니다. 예를 들어 직전 순간의 magnitude가 10.1이고 현재 magnitude가 15.2라면 `delta`는 5.1입니다. 갑자기 흔들렸는지 확인하는 데 적합합니다.

`baselineDelta`는 기준 상태와 현재 상태의 차이입니다. 사용자가 휴대폰을 책상 위에 가만히 둔 뒤 `기준값 재설정`을 누르면 그 순간의 magnitude가 `baselineMagnitude`로 저장됩니다. 이후 현재 magnitude가 기준값에서 얼마나 벗어났는지를 `baselineDelta`로 표시합니다.

정리하면 다음과 같습니다.

```text
delta = abs(currentMagnitude - previousMagnitude)
baselineDelta = abs(currentMagnitude - baselineMagnitude)
```

이 앱의 경보 조건:

```text
delta > threshold
```

따라서 `baselineDelta`는 실험 분석용이며, 실제 경보 발생 여부는 `delta`가 결정합니다.

## 10. 임계값 설정 방법

기본 임계값은 `5.0`입니다. 값이 낮을수록 작은 흔들림에도 민감하게 반응하고, 값이 높을수록 강한 흔들림에서만 반응합니다.

임계값은 실험 환경에 따라 조정해야 합니다. 책상의 재질, 스마트폰 기종, 브라우저, 휴대폰을 놓은 방향, 흔드는 세기에 따라 delta 값이 다르게 나올 수 있습니다. 탐구보고서에서는 여러 임계값을 시험해 보고, 어떤 값에서 오작동이 줄고 강한 진동은 잘 감지되는지 비교하면 좋습니다.

## 10. CSV 저장 기능

`CSV 저장` 버튼을 누르면 최근 실험 데이터가 CSV 파일로 다운로드됩니다. CSV에는 다음 항목이 들어갑니다.

- 감지 시각
- 센서 수신 횟수
- x축, y축, z축 가속도
- magnitude
- delta
- baselineDelta
- threshold
- 경보 여부
- 센서 데이터 종류

이 CSV 파일은 엑셀, 구글 스프레드시트, 한셀 등에 열 수 있습니다. 탐구보고서의 실험 결과 표로 활용하거나, delta와 baselineDelta 값을 비교하는 그래프를 만드는 데 사용할 수 있습니다.

## 11. 실제 안드로이드 지진 경보 시스템과 내 프로토타입의 차이

실제 구글 안드로이드 지진 조기 경보 시스템은 여러 스마트폰의 센서 데이터를 서버가 함께 분석합니다. 한 기기에서만 흔들림이 감지되면 사용자의 움직임, 낙하, 책상 충격 등과 구별하기 어렵기 때문입니다.

반면 이 프로토타입은 스마트폰 한 대의 가속도 센서만 사용합니다. 서버 분석, 여러 기기 데이터 비교, 위치 기반 판단, 지진파 모델링을 하지 않습니다. 따라서 이 앱은 지진 자체를 판별하는 시스템이 아니라, 강한 진동이 임계값을 넘으면 경보를 보여 주는 교육용 실험 도구입니다.

## 12. 이 앱의 한계

- 스마트폰 한 대의 센서 데이터만 사용합니다.
- 실제 P파와 S파를 구분하지 않습니다.
- 사용자가 휴대폰을 흔드는 동작과 실제 지진 진동을 구별하지 못합니다.
- 위치 정보와 주변 여러 기기의 데이터를 분석하지 않습니다.
- 책상 충격, 이동, 낙하 같은 상황에서도 경보가 울릴 수 있습니다.
- 임계값은 실험 환경에 맞게 조정해야 합니다.
- 브라우저와 기기 설정에 따라 센서 접근이 제한될 수 있습니다.

## 13. 실제 지진 경보용으로 사용하면 안 된다는 경고

이 앱은 교육용 실험 프로토타입입니다. 실제 지진을 정확히 감지하거나 공식 경보를 대체할 수 없습니다. 실제 재난 상황에서는 정부, 기상청, 지자체, 통신사 등 공식 재난 경보를 따라야 합니다.

## 14. Python 의사코드로 설명한 핵심 알고리즘

아래 코드는 실제 실행용 Python 코드가 아니라, 알고리즘을 이해하기 위한 의사코드입니다.

```python
previous_magnitude = 0
baseline_magnitude = 0
threshold = 5.0

while sensor_is_running:
    x, y, z = read_accelerometer()
    current_magnitude = sqrt(x*x + y*y + z*z)

    delta = abs(current_magnitude - previous_magnitude)
    baseline_delta = abs(current_magnitude - baseline_magnitude)

    save_experiment_data(
        x, y, z,
        current_magnitude,
        delta,
        baseline_delta
    )

    if delta > threshold:
        trigger_alarm()

    previous_magnitude = current_magnitude
```

쉽게 말하면, 센서에서 x, y, z 값을 계속 읽고, 세 값을 하나로 합친 뒤, 바로 전 순간과 얼마나 달라졌는지 비교합니다. 그 차이인 `delta`가 임계값보다 크면 강한 진동으로 판단합니다. `baselineDelta`는 기준 상태와 현재 상태의 차이를 보기 위한 추가 분석값입니다.
