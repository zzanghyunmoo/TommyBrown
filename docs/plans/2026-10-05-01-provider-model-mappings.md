---
title: 제공자 간 모델 매핑
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
---

# 제공자 간 모델 매핑

## Goal Capsule

사용자가 OpenAI, Claude, Antigravity의 대응 모델을 연결하고 CLI마다 실행 제공자를 선택한다. 사용자가 확인한 방식은 CLI의 모델 선택을 대상 제공자의 모델로 변환하는 것이다. 기존 PR #3은 먼저 병합했다. 이 기능은 별도 브랜치에서 구현하고 검증한다.

## Product Contract

- R1: 모델 행에 이름과 제공자별 모델 ID를 저장한다. 두 제공자 이상을 연결하면 양방향으로 사용할 수 있다. 세 제공자의 여섯 방향을 지원한다.
- R2: CLI마다 실행 제공자를 지정하거나 기존 모델 직접 선택 방식을 유지한다. 소스 계정 로그인 없이도 등록한 소스 모델을 선택할 수 있다.
- R3: 모델 연결 화면의 명령 복사와 작업 공간의 터미널 실행에 같은 매핑을 적용하며 대상 제공자와 실제 모델을 미리 표시한다.
- R4: Claude의 opus, sonnet, haiku 단축 이름을 행에 명시적으로 연결할 수 있다. 실제 모델 ID와 구분한다.
- R4a: 연결하지 않은 Claude 단축 이름은 선택한 세션 모델을 사용한다. 연결한 단축 이름의 대상 열이 비어 있으면 실행을 거절한다.
- R5: 매핑은 재시작 후 유지된다. 중복 소스, 단축 이름 중복, 빈 대상, 미연결 계정, 사용할 수 없는 대상 모델은 명확한 오류로 처리한다. 다른 제공자로 자동 전환하지 않는다.
- R6: 기존 전역 CLI 설정이나 계정 파일은 변경하지 않는다. 계정 정보는 main에 보관하며 매핑에는 모델 ID와 선택만 저장한다.

F1: 모델 연결 → 매핑 행 추가 → 제공자별 ID 선택/입력 → CLI별 실행 제공자 → 저장 → 모델 선택 → 대상 미리보기 → 명령 복사/새 세션.

AE1: Claude의 opus 행에 OpenAI 모델을 연결하고 Claude Code 실행 제공자를 OpenAI로 선택하면 Claude 환경의 Opus 모델은 해당 OpenAI 경로가 된다.
AE2: Antigravity가 제공하는 Claude 모델의 owned_by가 anthropic이어도 Antigravity 계정으로만 실행한다.
AE3: 대상이 없는 행을 선택하면 요청을 보내지 않고 설정 오류를 표시한다.

## Planning Contract

- KTD1: CLIProxyAPI v8.0.10의 oauth.model-alias와 fork를 사용한다. 제공자와 실제 모델에서 고유한 내부 alias를 생성하여 같은 모델명에 대한 제공자 충돌을 방지한다. 원래 ID도 유지한다.
- KTD2: 제공자는 credentials 목록과 credentials/models의 관계로 판별한다. /v1/models의 owned_by는 모델 저자 정보이므로 계정 제공자로 사용하지 않는다.
- KTD3: 저장 파일은 main에서 검증하고 임시 파일 + rename으로 교체한다. 실행 중 설정 적용과 저장을 직렬화하고 실패하면 이전 alias를 복구한다. 복구가 실패하면 게이트웨이를 중지하여 잘못된 라우팅을 막는다.
- KTD4: 실행 시 매핑을 다시 검증하고 대상 계정의 모델 및 alias 등록을 확인한다. 시작 시 저장된 alias를 설정에 포함한다. 설정 변경 후 기존 CLI는 새 세션으로 열도록 안내한다.
- KTD5: 예시 astra/fable, terra/opus, sonar/sonnet, lunar/haiku는 사용자 지정 대응 관계다. 계정에 없는 전체 모델 ID를 추측해 저장하지 않는다. 수동 입력과 실제 계정별 모델 추천을 함께 제공한다.
- KTD6: 렌더러에서 본 설정 revision을 실행 요청에 포함한다. 미리보기 이후 매핑이 바뀌었다면 실행하지 않고 모델 목록을 다시 열도록 안내한다.

근거: [v8 management API](https://help.router-for.me/management/apiv8), [v8.0.10 configuration](https://github.com/router-for-me/CLIProxyAPI/blob/v8.0.10/config.example.yaml), [alias routing](https://github.com/router-for-me/CLIProxyAPI/blob/v8.0.10/sdk/cliproxy/auth/oauth_model_alias.go).

## Implementation Units

- U1 (R1, R4, R5): shared schema/resolver와 main 저장소, alias compiler. 여섯 방향, 중복, 잘못된 입력, 저장 복원 테스트.
- U2 (R2, R5, R6; U1 이후): ProxyClient, runtime/config, ModelService, typed IPC와 프로필 연결. 계정 출처, alias 충돌, 적용 실패 복구, Claude 단축 이름 테스트.
- U3 (R1–R4; U2 이후): 모델 매핑 편집기와 CLI별 경로 선택, 두 실행 화면의 선택/미리보기. 기존 스타일과 네이티브 접근성 유지.
- U4 (전체; U3 이후): 실제 엔진 alias 적용, 네이티브 UI 편집/재시작, CLI 실행 검증. 증거와 재사용 지식을 프로젝트 docs에 기록.

## Verification Contract

V1: check, lint, 전체 단위 테스트, build 통과.
V2: 고정된 실제 엔진에서 alias가 지정한 계정의 모델 목록에 등록되고 원래 모델이 남는지 확인한다. 합성 계정은 inference 성공의 증거로 주장하지 않는다.
V3: 데스크톱에서 추가/수정/삭제/저장/취소/재시작과 명령 복사 및 터미널의 매핑 동작을 관찰한다. 넓은 창과 최소 창에서 읽기/조작 가능성을 확인한다.
V4: 변경 diff를 순차 리뷰하고 기존 터미널, 브라우저 분할, 계정 연결 경로의 회귀 검사를 실행한다.

## Definition of Done

R1–R6 구현, V1–V4 실행 결과 기록, 기능 브랜치의 검토 가능한 변경과 실행 가능한 Windows 앱 제공. 새 기능의 PR 병합은 이번 범위에 포함하지 않는다.

## Plan Review

순차 검토에서 제공자 판별, 저장 실패 시 복구, 빈 대상의 오류, 기존 CLI 세션 안내를 보강했다. 새 프록시 구현 대신 고정된 엔진의 alias 기능을 사용한다. 공개 문서에는 계정·토큰·개인 경로를 포함하지 않는다. 남은 제품 결정은 없다.
