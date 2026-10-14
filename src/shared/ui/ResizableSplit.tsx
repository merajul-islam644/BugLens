import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The evidence viewer and investigation workspace use resizable panels so the
 * preview can be widened. Drag the handle between the two halves.
 */
export function ResizableSplit({
  first,
  firstWidth = 320,
  max = 560,
  min = 220,
  second
}: {
  first: ReactNode;
  firstWidth?: number;
  max?: number;
  min?: number;
  second: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(firstWidth);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      const container = containerRef.current;
      const total = container?.getBoundingClientRect().width ?? 800;

      function move(next: PointerEvent) {
        const left = container?.getBoundingClientRect().left ?? 0;
        setWidth(Math.min(max, Math.max(min, next.clientX - left - 4)));
        void total;
      }
      function up(next: PointerEvent) {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        void next;
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    },
    [max, min]
  );

  return (
    <div className="split" ref={containerRef}>
      <div className="split-first" style={{ flexBasis: width }}>{first}</div>
      <div aria-label="Resize panels" className="split-handle" onPointerDown={onPointerDown} role="separator" />
      <div className="split-second">{second}</div>
    </div>
  );
}
