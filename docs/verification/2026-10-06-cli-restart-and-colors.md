# CLI 재시작과 터미널 색상 검증

2026-10-06 Windows x64, 현재 수정 브랜치의 개발 패키지에서 확인했다.

## 실제 앱과 계정

- 앱을 완전히 종료한 뒤 다시 실행해 설치된 CLIProxyAPI 8.0.10의 자동 시작을 확인했다.
- 기존 OpenAI 계정과 모델 목록을 유지하고 Fable 및 Antigravity의 Astra 선택을 저장했다.
- 다시 시작한 앱 안 PowerShell에서 설치된 Claude Code 2.1.212의 `claude` 명령과
  Antigravity 1.2.17의 `antigravity` 명령을 실행했다. 두 명령 모두 실제 OpenAI
  `gpt-6-astra`를 통해 요청한 짧은 확인 문자열을 반환했다. Google 로그인은 요구하지 않았다.
- 별도의 로컬 프로토콜 검사에서는 Claude의 Fable 요청이 매핑된 모델로
  `/v1/messages`에 전달되고, Antigravity 요청이 `/v1/chat/completions`에 전달되는지 확인했다.
  이 검사는 합성 응답을 사용하며 실제 계정 추론 검증과 구분한다.

## 자동 검사

- TypeScript 검사와 Biome 검사 통과.
- 단위/통합 검사 86개 통과. 자동 시작, 실패 후 재시도, 네 개의 Claude 단축 이름,
  CLI별 선택 저장, 동시 저장 및 저장 실패 복구를 포함한다.
- Windows 패키지 빌드 성공. 기존 Monaco 번들의 크기 경고는 남아 있다.
- 패키지 데스크톱 검사 12개 통과. 재시작 후 인수/환경 복원, 여섯 방향 모델 매핑,
  테마별 터미널 색상, 문서, 브라우저, 커넥터, 보관함 및 작업 화면을 다룬다.

```sh
bun run check
bun run lint
bun run test
bun run package:windows
# TOMMYBROWN_PACKAGED_APP에 생성된 실행 파일을 지정한 뒤 실행
bun run test:desktop
```

`test-results/terminal-colors-light-native.png`와
`test-results/terminal-colors-dark-native.png`는 실제 네이티브 창 캡처다.
두 캡처를 직접 열어 프롬프트, 명령 구문, 빨강/초록/청록 출력의 구분을 확인했다.
검사 데이터와 캡처는 무시된 디렉터리에만 보관한다. 공개 문서에는 계정 정보,
인증 값 또는 개인 로컬 경로를 포함하지 않는다.

실행 중인 터미널 프로세스와 이전 출력의 재개는 제공하지 않는다. 저장되는 것은
계정, 매핑 및 CLI별 실행 선택이며, 앱을 다시 켠 뒤 새 세션에 적용한다.
