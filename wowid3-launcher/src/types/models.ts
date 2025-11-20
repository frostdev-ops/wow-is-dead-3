/**
 * 3D Model Types
 *
 * Types for 3D model data (cat model, etc.)
 */

/**
 * Box coordinates [x, y, z, width, height, depth]
 */
export type BoxCoordinates = [number, number, number, number, number, number];

/**
 * Texture offset [u, v]
 */
export type TextureOffset = [number, number];

/**
 * Texture size [width, height]
 */
export type TextureSize = [number, number];

/**
 * Box definition in model
 */
export interface ModelBox {
  coordinates: BoxCoordinates;
  textureOffset: TextureOffset;
  sizeAdd?: number;
}

/**
 * Submodel definition
 */
export interface ModelSubmodel {
  id?: string;
  translate?: [number, number, number];
  rotate?: [number, number, number];
  boxes?: ModelBox[];
  submodels?: ModelSubmodel[];
}

/**
 * Model definition
 */
export interface ModelDefinition {
  part: string;
  id?: string;
  translate?: [number, number, number];
  rotate?: [number, number, number];
  boxes?: ModelBox[];
  submodels?: ModelSubmodel[];
}

/**
 * Complete model data structure (e.g., cat.jem)
 */
export interface ModelData {
  textureSize: TextureSize;
  models: ModelDefinition[];
}

/**
 * Type guard for ModelData
 */
export function isModelData(data: unknown): data is ModelData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'textureSize' in data &&
    'models' in data &&
    Array.isArray((data as ModelData).textureSize) &&
    Array.isArray((data as ModelData).models)
  );
}

/**
 * Assert ModelData
 */
export function assertModelData(data: unknown): asserts data is ModelData {
  if (!isModelData(data)) {
    throw new Error('Invalid ModelData structure');
  }
}
