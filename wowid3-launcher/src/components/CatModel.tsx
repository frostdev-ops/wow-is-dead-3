import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const CatModel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set up scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(45, 200 / 300, 0.1, 1000);
    camera.position.set(0, 15, 35);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(400, 600);
    renderer.setClearColor(0x000000, 0); // Transparent background
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Load texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('/tabby2.png', (texture) => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;

      // Load and parse the cat model
      fetch('/cat.jem')
        .then((res) => res.json())
        .then((modelData) => {
          const catGroup = new THREE.Group();

          // Function to create a box from model data with proper Minecraft UV mapping
          const createBox = (boxData: any, textureSize: number[]) => {
            const [x, y, z, width, height, depth] = boxData.coordinates;
            const [u, v] = boxData.textureOffset;

            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({
              map: texture,
              transparent: true,
              alphaTest: 0.5
            });

            const texWidth = textureSize[0];
            const texHeight = textureSize[1];

            // Minecraft box UV layout:
            // Top:    [u+depth, v] -> [u+depth+width, v+depth]
            // Bottom: [u+depth+width, v] -> [u+depth+width+width, v+depth]
            // Front:  [u+depth, v+depth] -> [u+depth+width, v+depth+height]
            // Back:   [u+depth+width+depth, v+depth] -> [u+depth+width+depth+width, v+depth+height]
            // Right:  [u+depth+width, v+depth] -> [u+depth+width+depth, v+depth+height]
            // Left:   [u, v+depth] -> [u+depth, v+depth+height]

            const toUV = (x: number, y: number) => [x / texWidth, 1 - y / texHeight];
            const toUVNoFlip = (x: number, y: number) => [x / texWidth, y / texHeight];

            const uvs: number[] = [];

            // THREE.js BoxGeometry face order: right, left, top, bottom, front, back
            // Each face needs 4 UV coordinates in this order: bottom-left, bottom-right, top-left, top-right

            // Right face (+X) - flipped vertically
            const r0 = toUV(u + depth + width, v + depth);
            const r1 = toUV(u + depth + width + depth, v + depth);
            const r2 = toUV(u + depth + width, v + depth + height);
            const r3 = toUV(u + depth + width + depth, v + depth + height);
            uvs.push(r0[0], r0[1], r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]);

            // Left face (-X) - flipped vertically
            const l0 = toUV(u + depth, v + depth);
            const l1 = toUV(u, v + depth);
            const l2 = toUV(u + depth, v + depth + height);
            const l3 = toUV(u, v + depth + height);
            uvs.push(l0[0], l0[1], l1[0], l1[1], l2[0], l2[1], l3[0], l3[1]);

            // Top face (+Y)
            const t0 = toUV(u + depth, v + depth);
            const t1 = toUV(u + depth + width, v + depth);
            const t2 = toUV(u + depth, v);
            const t3 = toUV(u + depth + width, v);
            uvs.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1], t3[0], t3[1]);

            // Bottom face (-Y)
            const b0 = toUV(u + depth + width, v + depth);
            const b1 = toUV(u + depth + width + width, v + depth);
            const b2 = toUV(u + depth + width, v);
            const b3 = toUV(u + depth + width + width, v);
            uvs.push(b0[0], b0[1], b1[0], b1[1], b2[0], b2[1], b3[0], b3[1]);

            // Check if this is the whiskers/nose box (textureOffset [25, 23])
            const isWhiskers = (u === 25 && v === 23);

            if (isWhiskers) {
              // Nose/whiskers box - swap front and back to show pink nose
              // Front face (+Z) - whiskers at (1, 27-30)
              const f0 = toUV(1, 30);
              const f1 = toUV(1 + width, 30);
              const f2 = toUV(1, 27);
              const f3 = toUV(1 + width, 27);
              uvs.push(f0[0], f0[1], f1[0], f1[1], f2[0], f2[1], f3[0], f3[1]);

              // Back face (-Z) - pink nose at (26, 24) - vertically flipped
              const bk0 = toUV(26, 24);
              const bk1 = toUV(26 + width, 24);
              const bk2 = toUV(26, 24 + height);
              const bk3 = toUV(26 + width, 24 + height);
              uvs.push(bk0[0], bk0[1], bk1[0], bk1[1], bk2[0], bk2[1], bk3[0], bk3[1]);
            } else {
              // Main face uses swapped front/back mapping
              // Front face (+Z) - swapped with back
              const f0 = toUV(u + depth + width + depth, v + depth);
              const f1 = toUV(u + depth + width + depth + width, v + depth);
              const f2 = toUV(u + depth + width + depth, v + depth + height);
              const f3 = toUV(u + depth + width + depth + width, v + depth + height);
              uvs.push(f0[0], f0[1], f1[0], f1[1], f2[0], f2[1], f3[0], f3[1]);

              // Back face (-Z) - swapped with front
              const bk0 = toUV(u + depth, v + depth);
              const bk1 = toUV(u + depth + width, v + depth);
              const bk2 = toUV(u + depth, v + depth + height);
              const bk3 = toUV(u + depth + width, v + depth + height);
              uvs.push(bk0[0], bk0[1], bk1[0], bk1[1], bk2[0], bk2[1], bk3[0], bk3[1]);
            }

            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x + width / 2, y + height / 2, z + depth / 2);
            return mesh;
          };

          // Parse the body model (simplified - just rendering main parts)
          const bodyModel = modelData.models.find((m: any) => m.part === 'body');
          if (bodyModel && bodyModel.submodels) {
            const bodyRotation = bodyModel.submodels[0];
            if (bodyRotation && bodyRotation.submodels) {
              bodyRotation.submodels.forEach((submodel: any) => {
                if (submodel.boxes) {
                  submodel.boxes.forEach((box: any) => {
                    const mesh = createBox(box, modelData.textureSize);

                    // Apply submodel transforms
                    if (submodel.translate) {
                      mesh.position.add(
                        new THREE.Vector3(
                          submodel.translate[0],
                          submodel.translate[1],
                          submodel.translate[2]
                        )
                      );
                    }

                    catGroup.add(mesh);
                  });
                }
              });
            }
          }

          // Scale and position the cat
          catGroup.scale.set(0.7, 0.7, 0.7);
          catGroup.position.set(0, -5, 0);

          scene.add(catGroup);
          console.log('[CatModel] Cat model loaded and rendered');
        })
        .catch((err) => {
          console.error('[CatModel] Error loading cat model:', err);
        });
    });

    // Animation loop
    let animationId: number;
    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Slowly rotate the cat
        if (sceneRef.current.children.length > 2) {
          const catGroup = sceneRef.current.children[2]; // Skip lights
          if (catGroup instanceof THREE.Group) {
            catGroup.rotation.y += 0.005;
          }
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    />
  );
};
