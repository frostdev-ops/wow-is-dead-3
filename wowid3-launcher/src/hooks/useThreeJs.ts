import type * as THREE from 'three';

let threeInstance: typeof THREE | null = null;

export async function getThreeJs() {
  if (!threeInstance) {
    threeInstance = await import('three');
  }
  return threeInstance;
}


