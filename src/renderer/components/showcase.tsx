import { Button, Notice, Panel, Status } from "./primitives";

export function Showcase() {
  return (
    <main className="showcase">
      <h1>TommyBrown controls</h1>
      <p>Shared states for the desktop workspace.</p>
      <Panel
        title="Actions"
        description="Keyboard focus, hover, busy, and disabled states."
      >
        <div className="cluster padded">
          <Button tone="primary">계정 연결</Button>
          <Button>새로고침</Button>
          <Button tone="quiet">취소</Button>
          <Button disabled>사용 불가</Button>
          <Button busy>연결 중…</Button>
        </div>
      </Panel>
      <Panel title="Connection states">
        <div className="cluster padded">
          <Status>연결 전</Status>
          <Status tone="success">연결됨</Status>
          <Status tone="pending">브라우저 응답 대기</Status>
          <Status tone="error">연결 실패</Status>
        </div>
      </Panel>
      <Panel title="Empty models">
        <div className="empty-state">
          <h3>연결된 모델이 없습니다</h3>
          <p>계정에 로그인하면 사용할 수 있는 모델이 여기에 나타납니다.</p>
        </div>
      </Panel>
      <Notice error>
        연결할 수 없습니다. 네트워크 상태를 확인하고 다시 시도하세요.
      </Notice>
      <label className="field">
        모델 선택
        <select>
          <option>사용 가능한 모델을 선택하세요</option>
        </select>
      </label>
    </main>
  );
}
