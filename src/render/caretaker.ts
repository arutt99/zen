// Placeholder caretaker (Phase 0): a capsule body, a head, and a little basket so facing reads.
// Phase 2 replaces this with the real model (robe, bun, wicker basket that fills).

import * as THREE from 'three';
import { addOutline, paintMaterial } from './materials';

export class CaretakerView {
  readonly root = new THREE.Group();
  private body: THREE.Group;
  private bob = 0;

  constructor(palette: { paper: string; cedar: string; lightWood: string }) {
    this.root.name = 'caretaker';
    this.body = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 12), paintMaterial({ color: palette.paper }));
    robe.position.y = 0.55;
    addOutline(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), paintMaterial({ color: '#F1D3B5' }));
    head.position.y = 1.18;
    addOutline(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), paintMaterial({ color: '#3A2E28' }));
    hair.position.set(0, 1.44, -0.08);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.38, 10), paintMaterial({ color: palette.lightWood }));
    basket.position.set(0, 0.75, -0.3);
    addOutline(basket);
    this.body.add(robe, head, hair, basket);
    this.body.traverse((o) => { if (o instanceof THREE.Mesh && o.name !== 'outline') o.castShadow = true; });
    this.root.add(this.body);
    // Soft blob shadow so the caretaker stays grounded on Low (no shadow maps).
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({ color: '#3B3226', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.root.add(blob);
  }

  update(dt: number, x: number, y: number, z: number, heading: number, speed: number): void {
    this.root.position.set(x, y, z);
    // Turn smoothly toward the heading, taking the short way around.
    let d = heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 12);
    this.bob += dt * (4 + speed * 2.5);
    const amp = Math.min(1, speed / 3) * 0.05;
    this.body.position.y = Math.abs(Math.sin(this.bob)) * amp;
    this.body.rotation.z = Math.sin(this.bob) * amp * 0.6;
  }
}
