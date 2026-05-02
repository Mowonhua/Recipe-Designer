/**
 * Wheel handler for n-input-number — use in template:
 *   @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => val, (v) => val = v, min, step, e)"
 * Works with both standalone refs and reactive object properties.
 */
export function onNumberWheel(
  get: () => number,
  set: (v: number) => void,
  min: number,
  step: number,
  e: WheelEvent,
) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -step : step;
  const next = +(get() + delta).toFixed(10);
  if (next >= min) {
    set(next);
  }
}
