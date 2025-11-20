/**
 * Type declarations for skin3d library
 */

declare module 'skin3d' {
  export interface ViewOptions {
    width: number;
    height: number;
    skin: string;
  }

  export interface PlayerPart {
    name: string;
    rotation: {
      x: number;
      y: number;
      z: number;
    };
  }

  export interface SkinObject {
    name: string;
    children?: PlayerPart[];
  }

  export interface PlayerObject {
    name?: string;
    children?: SkinObject[];
    rotation: {
      x: number;
      y: number;
      z: number;
    };
  }

  export interface Camera {
    position: {
      x: number;
      y: number;
      z: number;
    };
  }

  export class View {
    canvas: HTMLCanvasElement;
    zoom: number;
    fov: number;
    camera: Camera;
    playerObject?: PlayerObject;

    constructor(options: ViewOptions);
    dispose?(): void;
  }
}
