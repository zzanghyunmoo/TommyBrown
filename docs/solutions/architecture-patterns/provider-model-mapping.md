---
module: Model routing
date: 2026-10-05
problem_type: architecture_pattern
component: service_object
severity: medium
tags: [model-mapping, cliproxyapi, provider-routing, electron]
---

# 제공자를 구분하는 모델 매핑

모델의 작성자와 요청을 처리하는 계정 제공자는 다르다. 예를 들어 Antigravity 계정의 Claude 모델은 `owned_by`만 보면 Claude 계정 모델처럼 보일 수 있다. `/v1/models`는 합쳐진 목록이므로 제공자 선택의 근거로 사용하지 않는다.

## 구현 기준

1. `/v8/management/credentials`의 `provider`와 해당 파일의 `credentials/models?name=...`를 연결하여 제공자별 모델 목록을 만든다. 토큰이나 계정 파일 본문을 읽을 필요가 없다.
2. 매핑은 OpenAI, Claude, Antigravity 모델 ID를 한 행에 저장한다. CLI별 실행 제공자를 지정하면 CLI의 모델 ID로 행을 찾고 대상 열을 선택한다. 소스 계정이 연결되어 있을 필요는 없다.
3. CLIProxyAPI v8.0.10의 `oauth.model-alias`를 제공자별로 생성한다. 내부 별칭은 제공자와 모델 ID의 해시를 포함하며 `fork: true`로 원래 ID를 남긴다. 같은 별칭을 여러 제공자에 등록하면 라우팅이 모호해지므로 실행 전에 충돌도 검사한다.
4. 런타임 설정은 종료 시 삭제된다. 매핑은 별도 앱 데이터 파일에 저장하고 게이트웨이 시작 때 다시 포함한다. 실행 중 저장은 관리 API의 `PUT config/oauth/model-alias`로 적용한다.
5. 적용, 저장, 시작/중지, 프로필 생성은 직렬화한다. 저장 실패 시 이전 별칭을 복원한다. 복원도 실패하면 게이트웨이를 중지한다.
6. 렌더러의 실행 요청에는 미리 본 매핑의 revision을 포함한다. 저장된 설정이 바뀌면 실행을 거절하고 목록을 다시 열도록 안내한다. 이전 미리보기와 다른 제공자에 요청을 보내지 않는다.

Claude의 `opus`, `sonnet`, `haiku` 단축 이름은 행에 명시적으로 연결한다. 연결하지 않은 단축 이름은 사용자가 선택한 세션 모델을 사용하여 기존 CLI의 보조 작업도 같은 제공자에서 실행한다. 연결한 행에 대상 열이 비어 있으면 실행을 거절한다. 직접 모델 선택 모드는 기존 동작을 유지한다. 기존 CLI의 전역 설정과 계정 파일은 수정하지 않는다.

## 사용

모델 연결의 **모델 매핑**에서 행을 추가하고 두 개 이상의 제공자 모델 ID를 입력한다. 입력란에는 실제 계정별 모델 목록이 제공된다. **예시 4행 추가**는 Astra–Fable, Terra–Opus, Sonar–Sonnet, Lunar–Haiku 편집용 초안을 만든다. 예시 문자열을 실제 실행 제공자의 모델 ID로 바꾼 뒤 저장한다.

CLI별 실행 제공자를 저장하면 명령 복사와 작업 공간의 모델 목록에 소스 모델이 나타난다. 실행 미리보기에는 대상 제공자와 모델이 표시된다. 대상 계정이나 모델이 없으면 실행하지 않는다. 설정 변경 후 기존 CLI 세션은 새로 연다. 삭제한 별칭을 사용하는 기존 세션의 다음 요청은 실패할 수 있다.

## 검증

- `bun run test`는 여섯 방향 변환, 중복/잘못된 모델, 단축 이름, 저장 복원, 실패 복구와 오래된 미리보기를 검증한다.
- `bun run scripts/mapping-smoke.ts`는 고정된 실제 엔진에서 세 제공자의 계정별 별칭 등록, 원래 ID 유지, 재시작 복원을 확인한다.
- `bun run test:desktop tests/desktop/model-mappings.e2e.ts tests/desktop/cli.e2e.ts`는 네이티브 앱의 편집/복원, 여섯 방향 명령 복사와 Windows PTY에 전달되는 CLI 인수/환경을 확인한다.

실제 엔진 검증은 합성 계정과 연결되지 않는 로컬 프록시를 사용한다. 이 결과는 제공자 로그인 또는 유료 추론 성공을 의미하지 않는다. 계정별 모델이 등록되어 있더라도 구독, 권한, 할당량에 따른 실제 요청 실패는 해당 제공자의 응답으로 확인해야 한다.

근거: [v8 management API](https://help.router-for.me/management/apiv8), [v8.0.10 config](https://github.com/router-for-me/CLIProxyAPI/blob/v8.0.10/config.example.yaml), [provider alias lookup](https://github.com/router-for-me/CLIProxyAPI/blob/v8.0.10/sdk/cliproxy/auth/oauth_model_alias.go).
