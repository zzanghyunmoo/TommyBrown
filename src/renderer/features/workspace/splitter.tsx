import { useRef } from "react";
import type { Divider } from "./layout";

export function Splitter({
  divider,
  canvas,
  resize,
  dragging,
}: {
  readonly divider: Divider;
  readonly canvas: React.RefObject<HTMLDivElement | null>;
  readonly resize: (id: string, ratio: number) => void;
  readonly dragging: (value: boolean) => void;
}) {
  const pointer = useRef<number | null>(null);
  const vertical = divider.axis === "vertical";
  return (
    <hr
      tabIndex={0}
      className={`workbench-splitter ${vertical ? "vertical" : "horizontal"}`}
      aria-label={vertical ? "좌우 패널 크기" : "상하 패널 크기"}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuemin={20}
      aria-valuemax={80}
      aria-valuenow={Math.round(divider.ratio * 100)}
      style={
        vertical
          ? {
              left: `${divider.x + divider.width * divider.ratio}%`,
              top: `${divider.y}%`,
              height: `${divider.height}%`,
            }
          : {
              top: `${divider.y + divider.height * divider.ratio}%`,
              left: `${divider.x}%`,
              width: `${divider.width}%`,
            }
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging(true);
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return;
        const bounds = canvas.current?.getBoundingClientRect();
        if (!bounds) return;
        const position = vertical
          ? ((event.clientX - bounds.x) / bounds.width) * 100
          : ((event.clientY - bounds.y) / bounds.height) * 100;
        resize(
          divider.id,
          (position - (vertical ? divider.x : divider.y)) /
            (vertical ? divider.width : divider.height),
        );
      }}
      onPointerUp={(event) => {
        if (pointer.current === event.pointerId) {
          pointer.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragging(false);
        }
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
        dragging(false);
      }}
      onKeyDown={(event) => {
        const delta =
          event.key === (vertical ? "ArrowLeft" : "ArrowUp")
            ? -0.05
            : event.key === (vertical ? "ArrowRight" : "ArrowDown")
              ? 0.05
              : 0;
        if (delta || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          resize(
            divider.id,
            event.key === "Home"
              ? 0.2
              : event.key === "End"
                ? 0.8
                : divider.ratio + delta,
          );
        }
      }}
    />
  );
}
