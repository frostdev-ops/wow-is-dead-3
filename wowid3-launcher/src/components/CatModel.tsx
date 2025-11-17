import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const CatModel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const headGroupRef = useRef<THREE.Group | null>(null);
  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Set up scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(45, 200 / 300, 0.1, 1000);
    camera.position.set(0, -8, 35); // Position camera at lower angle
    camera.lookAt(0, -5, 0); // Look at where the cat is positioned
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

    // Load texture - randomly select from available cat textures
    const catTextures = ['/tabby2.png', '/tabby3.png', '/ragdoll2.png', '/red2.png'];
    const randomTexture = catTextures[Math.floor(Math.random() * catTextures.length)];
    console.log('[CatModel] Selected random texture:', randomTexture);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(randomTexture, (texture) => {
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

          console.log('[CatModel] Body model:', bodyModel);

          // Create groups for head and body
          const headGroup = new THREE.Group();
          headGroupRef.current = headGroup;
          const headMeshes: THREE.Mesh[] = [];

          const bodyGroup = new THREE.Group();
          bodyGroupRef.current = bodyGroup;
          const bodyMeshes: THREE.Mesh[] = [];

          if (bodyModel && bodyModel.submodels) {
            const bodyRotation = bodyModel.submodels[0];
            console.log('[CatModel] Body rotation:', bodyRotation);

            if (bodyRotation && bodyRotation.submodels) {
              console.log('[CatModel] Number of submodels:', bodyRotation.submodels.length);

              bodyRotation.submodels.forEach((submodel: any, index: number) => {
                console.log(`[CatModel] Submodel ${index}:`, submodel.translate, 'boxes:', submodel.boxes?.length);

                if (submodel.boxes) {
                  const translate = submodel.translate || [0, 0, 0];
                  const isHead = translate[1] > 6; // Head is at highest Y position
                  // Body includes neck, torso, and legs (everything below head, excluding tail)
                  // Tail is typically at the far back (Z < -10) or has specific position
                  const isTail = translate[2] < -10 || (translate[2] < -8 && translate[1] < 2);
                  const isBody = translate[1] <= 6 && !isTail;

                  console.log(`[CatModel] Submodel ${index} translate:`, translate, 'isHead:', isHead, 'isBody:', isBody, 'isTail:', isTail);

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

                    // Store meshes for grouping
                    if (isHead) {
                      headMeshes.push(mesh);
                    } else if (isBody) {
                      bodyMeshes.push(mesh);
                    }

                    catGroup.add(mesh);
                  });
                }
              });
            }
          }

          // Calculate head pivot point and reorganize head meshes
          if (headMeshes.length > 0) {
            // Calculate the bounding box of all head meshes
            const headBox = new THREE.Box3();
            headMeshes.forEach(mesh => {
              const meshBox = new THREE.Box3().setFromObject(mesh);
              headBox.union(meshBox);
            });

            // Get center and bottom of head for pivot
            const headCenter = new THREE.Vector3();
            headBox.getCenter(headCenter);

            // Use bottom center as pivot (neck position)
            const pivotPoint = new THREE.Vector3(headCenter.x, headBox.min.y, headCenter.z);

            // Position the head group at the pivot point
            headGroup.position.copy(pivotPoint);

            // Move head meshes from catGroup to headGroup and adjust their positions
            headMeshes.forEach(mesh => {
              catGroup.remove(mesh);
              // Adjust position to be relative to pivot point
              mesh.position.sub(pivotPoint);
              headGroup.add(mesh);
            });

            // Add head group to cat group
            catGroup.add(headGroup);
            console.log('[CatModel] Head group created at pivot:', pivotPoint);
          }

          // Calculate body pivot point and reorganize body meshes
          if (bodyMeshes.length > 0) {
            // Calculate the bounding box of all body meshes
            const bodyBox = new THREE.Box3();
            bodyMeshes.forEach(mesh => {
              const meshBox = new THREE.Box3().setFromObject(mesh);
              bodyBox.union(meshBox);
            });

            // Get center of body for pivot
            const bodyCenter = new THREE.Vector3();
            bodyBox.getCenter(bodyCenter);

            // Use center as pivot
            const pivotPoint = new THREE.Vector3(bodyCenter.x, bodyCenter.y, bodyCenter.z);

            // Position the body group at the pivot point
            bodyGroup.position.copy(pivotPoint);

            // Move body meshes from catGroup to bodyGroup and adjust their positions
            bodyMeshes.forEach(mesh => {
              catGroup.remove(mesh);
              // Adjust position to be relative to pivot point
              mesh.position.sub(pivotPoint);
              bodyGroup.add(mesh);
            });

            // Add body group to cat group
            catGroup.add(bodyGroup);
            console.log('[CatModel] Body group created at pivot:', pivotPoint);
          }

          // Scale and position the cat
          catGroup.scale.set(0.7, 0.7, 0.7);
          catGroup.position.set(0, -5, 0);

          // Rotate 180 degrees so cat faces camera
          catGroup.rotation.y = Math.PI;

          scene.add(catGroup);
          console.log('[CatModel] Cat model loaded and rendered with breathing animation');
        })
        .catch((err) => {
          console.error('[CatModel] Error loading cat model:', err);
        });
    });

    // Mouse tracking for head rotation
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate normalized mouse position (-1 to 1)
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      mouseRef.current.x = Math.max(-1, Math.min(1, deltaX / (rect.width / 2)));
      mouseRef.current.y = Math.max(-1, Math.min(1, deltaY / (rect.height / 2)));
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop with breathing and gentle swaying
    let animationId: number;
    let time = 0;
    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        time += 0.01;

        if (sceneRef.current.children.length > 2) {
          const catGroup = sceneRef.current.children[2]; // Skip lights
          if (catGroup instanceof THREE.Group) {
            // Breathing animation - subtle scale change
            const breathScale = 0.7 + Math.sin(time * 1.5) * 0.01; // Oscillates between 0.69 and 0.71
            catGroup.scale.set(breathScale, breathScale, breathScale);

            // Gentle swaying - slight rotation on z-axis
            catGroup.rotation.z = Math.sin(time * 0.8) * 0.02; // Small sway

            // Rotate cat to face forward
            catGroup.rotation.y = Math.PI;

            // Rotate head and body groups to follow mouse
            if (headGroupRef.current) {
              const targetRotationY = mouseRef.current.x * 0.5; // Max ~28 degrees
              const targetRotationX = -mouseRef.current.y * 0.3; // Max ~17 degrees

              // Head moves fast - rotate the entire head group quickly
              headGroupRef.current.rotation.y += (targetRotationY - headGroupRef.current.rotation.y) * 0.15;
              headGroupRef.current.rotation.x += (targetRotationX - headGroupRef.current.rotation.x) * 0.15;

              // Body (including legs) follows head with less rotation and slower response
              if (bodyGroupRef.current) {
                const bodyTargetRotationY = targetRotationY * 0.3; // Body rotates 30% of head
                const bodyTargetRotationX = targetRotationX * 0.3;
                bodyGroupRef.current.rotation.y += (bodyTargetRotationY - bodyGroupRef.current.rotation.y) * 0.06; // Slower interpolation
                bodyGroupRef.current.rotation.x += (bodyTargetRotationX - bodyGroupRef.current.rotation.x) * 0.06;
              }
            }
          }
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
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
        width: '400px',
        height: '600px',
        pointerEvents: 'none',
      }}
    />
  );
};
