---
module: Desktop CLI startup
date: 2026-10-06
problem_type: integration_issue
component: service_object
severity: medium
symptoms:
  - "앱 재시작 후 게이트웨이가 멈추고 CLI 모델 선택이 초기화됨"
  - "앱 안 PowerShell에서 Antigravity 실행 또는 게이트웨이 연결이 실패함"
  - "Claude의 Fable 대신 실제 OpenAI 모델 ID가 선택됨"
root_cause: incomplete_setup
resolution_type: code_fix
tags: [electron, powershell, persistence, model-mapping, antigravity, terminal]
---

# 재시작 후 CLI 실행 환경 복원

현재 수정 브랜치에서 검증한 동작이다. 계정 저장, 모델 대응 관계 저장,
CLI 선택 저장, 자식 프로세스 환경 설정은 각각 복원해야 한다.

## 원인

게이트웨이 설치 여부를 읽어도 시작하지 않았고, CLI 선택은 렌더러 컴포넌트
메모리에만 있었다. 일반 PowerShell은 모델 프로필을 받지 않았다. Windows의
사용자 환경 변수를 나중에 설정해도 이미 실행된 앱의 환경과 PATH는 갱신되지 않는다.
따라서 새 PowerShell도 오래된 환경을 상속했다. Fable은 지원 단축 이름에서 빠져 있었다.

## 수정

- `src/main/models.ts`는 설치된 엔진을 앱 시작 시 실행한다. 게이트웨이 시작 실패는
  모델 연결 화면에 표시하고 재시도할 수 있다. 미설치 엔진을 자동 다운로드하지 않는다.
- `src/main/proxy/launch-settings.ts`는 마지막 CLI와 각 CLI의 모델 선택을
  원자적으로 저장한다. 저장 실패 시 메모리의 이전 설정을 유지한다.
- `src/main/terminal/shell-profile.ts`는 저장된 Claude/Antigravity 선택으로
  새 PowerShell의 환경과 실행 함수를 만든다. 네이티브 실행 경로를 해석하고
  `antigravity`를 `agy`에 연결한다. 프로필 생성 실패 시 해당 명령은 오류를 내며
  기본 제공자 로그인으로 넘어가지 않는다.
- `src/main/proxy/routing.ts`는 `--model fable`을 유지하고
  `ANTHROPIC_DEFAULT_FABLE_MODEL`로 제공자가 고정된 내부 별칭을 전달한다.
  같은 방식으로 네 개의 Claude 단축 이름과 표시 이름을 설정한다.
- `src/main/terminal/service.ts`는 대소문자를 무시해 Windows 환경 변수를
  병합하고 터미널 색상 기능을 전달한다. `src/main/terminal/powershell.ts`는
  프롬프트와 사용 가능한 PSReadLine 구문 색상을 설정한다.

새 프로필은 새 세션부터 적용한다. 기존 세션과 외부 터미널의 설정은 별도다.
전역 CLI 설정 파일이나 Windows 사용자 환경 변수를 수정하지 않는다.

## 검증과 예방

`tests/desktop/cli-restart.e2e.ts`는 부모 PATH에서 AGY를 제외한 채 네이티브 앱을
완전히 재시작한다. 프록시 자동 시작과 선택 복원을 확인하고 실제 PowerShell에서
두 명령을 실행하여 자식 프로세스의 인수와 환경을 검사한다. 명령을 보내기 전에
이전 세션 종료와 새 프롬프트 출력을 기다린다. 이전 터미널의 출력은 새 실행의 증거가 아니다.

`tests/desktop/terminal.e2e.ts`는 부모의 `NO_COLOR`와 `TERM=dumb`에도 색상을
복원하는지 확인하고 밝은/어두운 테마의 네이티브 창을 캡처한다.
실제 계정과 설치된 CLI를 사용한 결과는
[검증 기록](../../verification/2026-10-06-cli-restart-and-colors.md)에 구분했다.
