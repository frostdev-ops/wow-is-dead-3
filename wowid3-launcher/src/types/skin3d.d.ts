/**
 * Type declarations for skin3d library
 */

declare module 'skin3d' {
  export interface ViewOptions {
    width: number;
    height: number;
    skin: string;
  }

  export interface BodyPart {
    visible: boolean;
    rotation: {
      x: number;
      y: number;
      z: number;
    };
  }

  export interface SkinObject {
    head: BodyPart;
    body: BodyPart;
    leftArm: BodyPart;
    rightArm: BodyPart;
    leftLeg: BodyPart;
    rightLeg: BodyPart;
  }

  export interface PlayerObject {
    skin: SkinObject;
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
