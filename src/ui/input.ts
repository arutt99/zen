// Turns keyboard, gamepad and touch into the game's one move vector + one context action.
// Also tracks whether the last input was a finger, for prompt wording (plan 6).

import { applyDeadZone, combineMoves, type MoveInput, type PlayerIntent } from '../sim/input';

export type InputKind = 'keyboard' | 'gamepad' | 'touch';

export class InputController {
  lastKind: InputKind = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
  onZoom: ((dir: 1 | -1) => void) | null = null;
  onMenu: (() => void) | null = null;

  private keys = new Set<string>();
  private contextQueued = false;
  private padContextWas = false;
  private padMenuWas = false;
  private padZoomWas = false;
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private pinch: { a: number; b: number; start: number; fired: boolean } | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private readonly stickRadius = 56;

  constructor(surface: HTMLElement, private readonly stickEl: HTMLElement, private readonly knobEl: HTMLElement) {
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    surface.addEventListener('wheel', (e) => { e.preventDefault(); this.onZoom?.(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    surface.addEventListener('pointerdown', (e) => this.pointerDown(e));
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
    window.addEventListener('pointercancel', (e) => this.pointerUp(e));
  }

  /** Called by the on-screen context button. */
  pressContext(): void {
    this.contextQueued = true;
  }

  poll(): PlayerIntent {
    const kb: MoveInput = { x: 0, z: 0 };
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kb.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kb.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kb.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kb.z += 1;

    let pad: MoveInput = { x: 0, z: 0 };
    let padContext = false, padMenu = false, padZoom = false;
    const gp = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    if (gp) {
      pad = applyDeadZone({ x: gp.axes[0] ?? 0, z: gp.axes[1] ?? 0 });
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      if (b(12)) pad.z = -1;
      if (b(13)) pad.z = 1;
      if (b(14)) pad.x = -1;
      if (b(15)) pad.x = 1;
      padContext = b(0);
      padMenu = b(9);
      padZoom = b(4) || b(5);
      if (padContext && !this.padContextWas) this.contextQueued = true;
      if (padMenu && !this.padMenuWas) this.onMenu?.();
      if (padZoom && !this.padZoomWas) this.onZoom?.(b(5) ? 1 : -1);
      if (Math.hypot(pad.x, pad.z) > 0 || padContext) this.lastKind = 'gamepad';
    }
    this.padContextWas = padContext;
    this.padMenuWas = padMenu;
    this.padZoomWas = padZoom;

    let touch: MoveInput = { x: 0, z: 0 };
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      touch = applyDeadZone({ x: dx / this.stickRadius, z: dy / this.stickRadius }, 0.12);
    }

    const intent: PlayerIntent = { move: combineMoves(kb, pad, touch), contextPressed: this.contextQueued };
    this.contextQueued = false;
    return intent;
  }

  private keyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    this.lastKind = 'keyboard';
    this.keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { this.contextQueued = true; e.preventDefault(); }
    if (e.code === 'Escape') this.onMenu?.();
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.onZoom?.(1);
    if (e.code === 'Equal' || e.code === 'NumpadAdd') this.onZoom?.(-1);
  }

  private pointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') { this.lastKind = 'keyboard'; return; }
    this.lastKind = 'touch';
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      // Second finger: start a pinch, cancel the stick.
      const [a, b] = [...this.touches.keys()] as [number, number];
      this.pinch = { a, b, start: this.touchDist(a, b), fired: false };
      this.releaseStick();
      return;
    }
    // Floating joystick anywhere on the left 60% of the screen (plan 6).
    if (!this.stick && e.clientX < window.innerWidth * 0.6) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.stickEl.style.left = `${e.clientX}px`;
      this.stickEl.style.top = `${e.clientY}px`;
      this.stickEl.classList.add('show');
      this.knobEl.style.transform = 'translate(0px, 0px)';
    }
  }

  private pointerMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && !this.pinch.fired && this.touches.has(this.pinch.a) && this.touches.has(this.pinch.b)) {
      const ratio = this.touchDist(this.pinch.a, this.pinch.b) / Math.max(1, this.pinch.start);
      if (ratio > 1.25) { this.onZoom?.(-1); this.pinch.fired = true; }
      if (ratio < 0.8) { this.onZoom?.(1); this.pinch.fired = true; }
    }
    if (this.stick && e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      // Drag the base along if the finger goes past the edge, so the stick never "sticks".
      if (len > this.stickRadius) {
        const k = (len - this.stickRadius) / len;
        this.stick.ox += dx * k;
        this.stick.oy += dy * k;
        dx = e.clientX - this.stick.ox;
        dy = e.clientY - this.stick.oy;
        this.stickEl.style.left = `${this.stick.ox}px`;
        this.stickEl.style.top = `${this.stick.oy}px`;
      }
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  private pointerUp(e: PointerEvent): void {
    this.touches.delete(e.pointerId);
    if (this.pinch && (e.pointerId === this.pinch.a || e.pointerId === this.pinch.b)) this.pinch = null;
    if (this.stick && e.pointerId === this.stick.id) this.releaseStick();
  }

  private releaseStick(): void {
    this.stick = null;
    this.stickEl.classList.remove('show');
  }

  private touchDist(a: number, b: number): number {
    const p = this.touches.get(a), q = this.touches.get(b);
    return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
  }
}
