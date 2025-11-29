
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

        // --- DynoGraph Class ---
        class DynoGraph {
            constructor(canvasId, config = {}) {
                this.canvas = document.getElementById(canvasId);
                if (!this.canvas) {
                    console.error(`DynoGraph: Canvas with id '${canvasId}' not found.`);
                    return;
                }
                this.ctx = this.canvas.getContext('2d');
                this.width = this.canvas.width = this.canvas.offsetWidth;
                this.height = this.canvas.height = this.canvas.offsetHeight;

                this.history = [];
                this.maxPoints = 200;

                // Configurable curve parameters
                this.peakTorqueRPM = config.peakTorqueRPM || 5000;
                this.maxTorque = config.maxTorque || 400;
                this.maxRPM = config.maxRPM || 8000;
            }

            calculatePower(rpm) {
                if (rpm < 10) return { hp: 0, torque: 0 };

                // Flat torque curve for Turbo W16
                const range = this.maxRPM / 2;
                let torque = this.maxTorque;

                // Turbo lag simulation
                if (rpm < 2000) {
                    torque = this.maxTorque * (rpm / 2000);
                }
                // Drop off after peak
                else if (rpm > 6500) {
                    const dev = (rpm - 6500) / 2000;
                    torque = this.maxTorque * (1 - dev * dev * 0.5);
                }

                if (torque < 0) torque = 0;

                // HP = Torque * RPM / 5252
                let hp = (torque * rpm) / 5252;

                return { hp, torque };
            }

            update(rpm) {
                if (!this.ctx) return;

                const data = this.calculatePower(rpm);
                this.history.push({ rpm, ...data });
                if (this.history.length > this.maxPoints) this.history.shift();

                this.draw();
            }

            draw() {
                this.ctx.clearRect(0, 0, this.width, this.height);

                // Background Grid
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const y = (this.height / 5) * i;
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.width, y);
                }
                this.ctx.stroke();

                if (this.history.length < 2) return;

                const maxScale = 2000; // 1500HP+
                const addThrow = (angle, zPos) => {
                    const throwGroup = new THREE.Group();
                    // Pin length accommodates 2 rods
                    const pinLen = rodWidth * 2 + 0.2;
                    const pinGeo = new THREE.CylinderGeometry(pinRadius, pinRadius, pinLen, 32);
                    const pin = new THREE.Mesh(pinGeo, pinMat);
                    pin.rotation.x = Math.PI / 2;
                    pin.position.set(0, crankRadius, 0);
                    throwGroup.add(pin);

                    const web1 = new THREE.Mesh(webGeo, mat);
                    web1.position.set(0, 0, -pinLen / 2 - webThickness / 2 + 0.1);
                    web1.rotation.z = Math.PI;
                    throwGroup.add(web1);

                    const web2 = new THREE.Mesh(webGeo, mat);
                    web2.position.set(0, 0, pinLen / 2 + webThickness / 2 - 0.1);
                    web2.rotation.z = Math.PI;
                    throwGroup.add(web2);

                    throwGroup.rotation.z = angle;
                    throwGroup.position.z = zPos;
                    this.group.add(throwGroup);
                };

                // 8 Pins
                // Z-positions: 4 main bays, each split into 2 sub-bays
                // We have 4 "rows" of cylinders.
                // Row 1: Pin 1 (LL, RL), Pin 2 (LR, RR)
                // Spacing: 
                // Pin 1 at -1.5 * spacing
                // Pin 2 at -1.5 * spacing + 0.5 * spacing = -1.0 * spacing
                // ...

                const startZ = -1.75 * cylinderSpacing;
                const step = 0.5 * cylinderSpacing;

                const pinCenters = [];
                for (let i = 0; i < 8; i++) {
                    pinCenters.push(startZ + i * step);
                }

                // Angles: 0, 90, 180, 270, 270, 180, 90, 0 (Balanced 8-throw)
                const angles = [
                    0, Math.PI / 2, Math.PI, Math.PI * 1.5,
                    Math.PI * 1.5, Math.PI, Math.PI / 2, 0
                ];

                for (let i = 0; i < 8; i++) {
                    addThrow(angles[i], pinCenters[i]);
                }

                // Snout
                const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 32), mat);
                snout.rotation.x = Math.PI / 2;
                snout.position.z = pinCenters[0] - 2;
                this.group.add(snout);

                // Flange
                const flange = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 32), mat);
                flange.rotation.x = Math.PI / 2;
                flange.position.z = pinCenters[7] + 2;
                this.group.add(flange);

                // Main Bearings (Simplified)
                const mainLocs = [
                    pinCenters[0] - 1.5,
                    (pinCenters[1] + pinCenters[2]) / 2,
                    (pinCenters[3] + pinCenters[4]) / 2,
                    (pinCenters[5] + pinCenters[6]) / 2,
                    pinCenters[7] + 1.5
                ];

                mainLocs.forEach(z => {
                    const m = new THREE.Mesh(new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, 1.0, 32), mat);
                    m.rotation.x = Math.PI / 2;
                    m.position.z = z;
                    this.group.add(m);
                });
            }

            update(angle) {
                this.group.rotation.z = angle;
            }
        }

        class PistonAssembly {
            constructor(scene, cylinderIndex, bankIndex, zOffset, pinIndex, pinAngleOffset) {
                this.scene = scene;
                this.index = cylinderIndex;
                this.bankIndex = bankIndex; // 0 to 3
                this.zOffset = zOffset;
                this.pinIndex = pinIndex;
                this.pinAngleOffset = pinAngleOffset;

                this.group = new THREE.Group();
                this.rodGroup = new THREE.Group();
                this.pistonGroup = new THREE.Group();

                this.scene.add(this.group);
                this.group.add(this.rodGroup);
                this.group.add(this.pistonGroup);

                // this.group.position.z = zOffset; // Handled by parent CylinderUnit

                this.createGeometry();
            }

            createGeometry() {
                // Piston Head
                const pistonMat = MATERIALS.aluminum;
                const pistonGeo = new THREE.CylinderGeometry(SPECS.bore / 2, SPECS.bore / 2, 2.0, 32);
                const piston = new THREE.Mesh(pistonGeo, pistonMat);
                piston.position.y = 0;
                this.pistonGroup.add(piston);

                // Rings
                const ringGeo = new THREE.TorusGeometry(SPECS.bore / 2 + 0.02, 0.04, 8, 64);
                for (let i = 0; i < 3; i++) {
                    const ring = new THREE.Mesh(ringGeo, MATERIALS.chrome);
                    ring.rotation.x = Math.PI / 2;
                    ring.position.y = 0.4 - i * 0.25;
                    this.pistonGroup.add(ring);
                }

                // Connecting Rod
                const rodLen = SPECS.rodLength;
                const rodGeo = new THREE.BoxGeometry(0.5, rodLen, 0.3);
                const rod = new THREE.Mesh(rodGeo, MATERIALS.steel);
                rod.position.y = rodLen / 2;

                const bigEndGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.6, 32);
                const bigEnd = new THREE.Mesh(bigEndGeo, MATERIALS.steel);
                bigEnd.rotation.z = Math.PI / 2;
                bigEnd.position.y = 0;

                const smallEndGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 32);
                const smallEnd = new THREE.Mesh(smallEndGeo, MATERIALS.steel);
                smallEnd.rotation.z = Math.PI / 2;
                smallEnd.position.y = rodLen;

                this.rodGroup.add(rod);
                this.rodGroup.add(bigEnd);
                this.rodGroup.add(smallEnd);
            }

            update(crankAngle) {
                const r = SPECS.crankRadius;
                const l = SPECS.rodLength;
                const theta = crankAngle + this.pinAngleOffset;
                const bankAngle = SPECS.bankAngles[this.bankIndex];

                // Kinematics
                const localTheta = theta - bankAngle;
                const sinA = Math.sin(localTheta);
                const cosA = Math.cos(localTheta);

                const pistonY = r * cosA + Math.sqrt(l * l - r * r * sinA * sinA);
                this.pistonGroup.position.y = pistonY;

                const pinLocalX = -r * sinA;
                const pinLocalY = r * cosA;
                this.rodGroup.position.set(pinLocalX, pinLocalY, 0);

                const dx = -pinLocalX;
                const dy = pistonY - pinLocalY;
                const rodAngle = Math.atan2(dy, dx) - Math.PI / 2;
                this.rodGroup.rotation.z = rodAngle;
            }
        }

        class CylinderUnit {
            constructor(scene, config) {
                this.scene = scene;
                this.config = config;

                this.group = new THREE.Group();
                this.scene.add(this.group);

                const bankAngle = SPECS.bankAngles[config.bankIndex];
                this.group.rotation.z = bankAngle;
                this.group.position.z = config.z;

                this.pistonAssembly = new PistonAssembly(
                    this.group,
                    config.index,
                    config.bankIndex,
                    0,
                    config.pinIndex,
                    config.pinAngle
                );

                this.createGeometry();
            }

            createGeometry() {
                // Glass Cylinder Liner
                const glassGeo = new THREE.CylinderGeometry(SPECS.bore / 2 + 0.1, SPECS.bore / 2 + 0.1, SPECS.stroke + 2, 32, 1, true);
                this.glass = new THREE.Mesh(glassGeo, MATERIALS.glass);
                this.glass.position.y = SPECS.deckHeight - (SPECS.stroke + 2) / 2;
                this.group.add(this.glass);

                // Combustion Flash
                const flashGeo = new THREE.CylinderGeometry(SPECS.bore / 2, SPECS.bore / 2, 1, 32);
                this.flash = new THREE.Mesh(flashGeo, MATERIALS.combustion);
                this.flash.position.y = SPECS.deckHeight - 0.5;
                this.group.add(this.flash);

                this.combustionLight = new THREE.PointLight(0xff5500, 0, 4);
                this.combustionLight.position.y = SPECS.deckHeight - 0.5;
                this.group.add(this.combustionLight);

                // Head & Exhaust
                this.createHead();
            }

            createHead() {
                this.headGroup = new THREE.Group();
                this.headGroup.position.y = SPECS.deckHeight;
                this.group.add(this.headGroup);

                // Individual Head Block (Simplified for W16 complexity)
                const headSize = SPECS.bore + 0.5;
                const headHeight = 1.5;
                const headGeo = new THREE.BoxGeometry(headSize, headHeight, headSize);
                const head = new THREE.Mesh(headGeo, MATERIALS.headMaterial);
                head.position.y = headHeight / 2;
                this.headGroup.add(head);

                // Valve Cover
                const coverGeo = new THREE.BoxGeometry(headSize - 0.2, 0.5, headSize - 0.2);
                const cover = new THREE.Mesh(coverGeo, MATERIALS.valveCoverRed);
                cover.position.y = headHeight + 0.25;
                this.headGroup.add(cover);
            }

            update(crankAngle, explodedAmount) {
                this.pistonAssembly.update(crankAngle);

                // Firing Animation
                let cycleAngle = (crankAngle * (180 / Math.PI) + this.config.fireOffset) % 720;
                if (cycleAngle < 0) cycleAngle += 720;

                if (cycleAngle >= 0 && cycleAngle < 60) {
                    const intensity = 1 - cycleAngle / 60;
                    this.flash.material.opacity = 0.8 * intensity;
                    this.combustionLight.intensity = 6.0 * intensity;
                } else {
                    this.flash.material.opacity = 0;
                    this.combustionLight.intensity = 0;
                }

                if (this.headGroup) {
                    this.headGroup.position.y = SPECS.deckHeight + explodedAmount * 2;
                }
            }
        }

        class EngineBlock {
            constructor(scene) {
                this.scene = scene;
                this.createGeometry();
            }

            createGeometry() {
                // W-Block Geometry
                // 4 banks.
                const length = 8 * (SPECS.cylinderSpacing / 2) + 2;

                const shape = new THREE.Shape();
                shape.moveTo(0, -3); // Bottom center

                // We need to trace the decks for the 4 banks
                const angles = SPECS.bankAngles;
                const deckH = SPECS.deckHeight;

                // Right side (Banks 2 & 3 - indices 2,3) -> Angles +37.5, +52.5
                // Wait, indices are 0,1 (Left), 2,3 (Right)
                // 0: -52.5, 1: -37.5, 2: 37.5, 3: 52.5

                // Outer Right (Bank 3)
                const ar3 = angles[3];
                const x3 = deckH * Math.sin(ar3);
                const y3 = deckH * Math.cos(ar3);

                // Inner Right (Bank 2)
                const ar2 = angles[2];
                const x2 = deckH * Math.sin(ar2);
                const y2 = deckH * Math.cos(ar2);

                // Outer Left (Bank 0)
                const ar0 = angles[0];
                const x0 = deckH * Math.sin(ar0);
                const y0 = deckH * Math.cos(ar0);

                // Inner Left (Bank 1)
                const ar1 = angles[1];
                const x1 = deckH * Math.sin(ar1);
                const y1 = deckH * Math.cos(ar1);

                // Draw
                shape.lineTo(x3 + 2, y3 - 1); // Outer Right Bottom
                shape.lineTo(x3 + 2, y3 + 1); // Outer Right Top
                shape.lineTo(x2 - 1, y2 + 1); // Inner Right Top

                // Valley between Inner Right and Inner Left
                shape.lineTo(0, 4);

                shape.lineTo(x1 + 1, y1 + 1); // Inner Left Top
                shape.lineTo(x0 - 2, y0 + 1); // Outer Left Top
                shape.lineTo(x0 - 2, y0 - 1); // Outer Left Bottom

                shape.lineTo(0, -3); // Close

                const extrudeSettings = { depth: length, bevelEnabled: false };
                const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.translate(0, 0, -length / 2 + 1.5); // Center roughly

                const mesh = new THREE.Mesh(geo, MATERIALS.engineBlock);
                this.scene.add(mesh);
            }
        }

        class EngineSimulation {
            constructor() {
                this.params = {
                    rpm: 90,
                    exploded: 0,
                    opacity: 0.15,
                    autoRotate: false,
                    wireframe: false
                };
                this.crankAngle = 0;
                this.lastTime = 0;
                this.container = document.body;

                this.initScene();
                this.initLights();
                this.initPostProcessing();
                this.initObjects();
                this.initUI();

                this.dyno = new DynoGraph('dyno-canvas', { peakTorqueRPM: 3000, maxTorque: 1180, maxRPM: 8000 });

                document.getElementById('loading').style.opacity = 0;
                this.animate(0);
            }

            initScene() {
                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x050505);

                this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.set(30, 25, 30);

                this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 0.8;
                this.container.appendChild(this.renderer.domElement);

                this.controls = new OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.target.set(0, 5, 0);

                window.addEventListener('resize', this.onWindowResize.bind(this));
            }

            initLights() {
                const ambientLight = new THREE.AmbientLight(0x222222);
                this.scene.add(ambientLight);

                const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
                this.scene.add(hemiLight);

                const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
                dirLight.position.set(15, 20, 15);
                dirLight.castShadow = true;
                dirLight.shadow.mapSize.width = 2048;
                dirLight.shadow.mapSize.height = 2048;
                this.scene.add(dirLight);

                const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
                dirLight2.position.set(-15, 20, -10);
                this.scene.add(dirLight2);

                const grid = new THREE.GridHelper(200, 200, 0x333333, 0x111111);
                grid.position.y = -5;
                this.scene.add(grid);
            }

            initPostProcessing() {
                this.composer = new EffectComposer(this.renderer);
                const renderPass = new RenderPass(this.scene, this.camera);
                this.composer.addPass(renderPass);

                const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
                bloomPass.threshold = 0.7;
                bloomPass.strength = 0.6;
                bloomPass.radius = 0.5;
                this.composer.addPass(bloomPass);
            }

            initObjects() {
                this.crankshaft = new Crankshaft(this.scene);
                this.block = new EngineBlock(this.scene);
                this.cylinders = [];

                const { cylinderSpacing, rodWidth } = SPECS;

                // Z-positions for the 8 pins
                const startZ = -1.75 * cylinderSpacing;
                const step = 0.5 * cylinderSpacing;
                const pinZ = [];
                for (let i = 0; i < 8; i++) pinZ.push(startZ + i * step);

                // Pin Angles
                const pinAngles = [
                    0, Math.PI / 2, Math.PI, Math.PI * 1.5,
                    Math.PI * 1.5, Math.PI, Math.PI / 2, 0
                ];

                // Cylinder Configs
                // 16 Cylinders.
                // Mapping:
                // Pin 0: Bank 0 (LL), Bank 2 (RL)
                // Pin 1: Bank 1 (LR), Bank 3 (RR)
                // Pin 2: Bank 0, Bank 2
                // ...

                // Banks: 0=LL, 1=LR, 2=RL, 3=RR

                const configs = [];

                // Firing Order: 1-14-9-4-7-12-15-6-13-8-3-16-11-2-5-10
                // We need to assign fire offsets.
                // 720 degrees / 16 = 45 degrees per fire.
                // Order indices:
                // 1: 0 deg
                // 14: 45 deg
                // 9: 90 deg
                // ...

                const fireOrder = [1, 14, 9, 4, 7, 12, 15, 6, 13, 8, 3, 16, 11, 2, 5, 10];
                const fireOffsets = {};
                fireOrder.forEach((cylNum, i) => {
                    fireOffsets[cylNum] = i * 45;
                });

                // Generate cylinders
                let cylCount = 1;
                for (let i = 0; i < 4; i++) { // 4 Groups of 4 cylinders
                    // Group i covers Pins 2*i and 2*i+1

                    // Pin 2*i: Outer Banks (0 & 3) ? Or 0 & 2?
                    // Let's stick to:
                    // Pin Even: Bank 0 (LL) & Bank 2 (RL)
                    // Pin Odd: Bank 1 (LR) & Bank 3 (RR)

                    const pinEven = 2 * i;
                    const pinOdd = 2 * i + 1;

                    // Cyl 1, 2, 3, 4 (Front Row)
                    // Let's assign IDs based on position for the firing order map
                    // Row 1: LL=1, LR=2, RL=3, RR=4 ?
                    // Row 2: LL=5...
                    // This matches my previous assumption.

                    const rowBase = i * 4;

                    // LL (Bank 0) -> Pin Even
                    configs.push({
                        index: rowBase + 1,
                        bankIndex: 0,
                        z: pinZ[pinEven],
                        pinIndex: pinEven,
                        pinAngle: pinAngles[pinEven],
                        fireOffset: fireOffsets[rowBase + 1]
                    });

                    // LR (Bank 1) -> Pin Odd
                    configs.push({
                        index: rowBase + 2,
                        bankIndex: 1,
                        z: pinZ[pinOdd],
                        pinIndex: pinOdd,
                        pinAngle: pinAngles[pinOdd],
                        fireOffset: fireOffsets[rowBase + 2]
                    });

                    // RL (Bank 2) -> Pin Even
                    configs.push({
                        index: rowBase + 3,
                        bankIndex: 2,
                        z: pinZ[pinEven] + rodWidth, // Offset on pin
                        pinIndex: pinEven,
                        pinAngle: pinAngles[pinEven],
                        fireOffset: fireOffsets[rowBase + 3]
                    });

                    // RR (Bank 3) -> Pin Odd
                    configs.push({
                        index: rowBase + 4,
                        bankIndex: 3,
                        z: pinZ[pinOdd] + rodWidth, // Offset on pin
                        pinIndex: pinOdd,
                        pinAngle: pinAngles[pinOdd],
                        fireOffset: fireOffsets[rowBase + 4]
                    });
                }

                configs.forEach(cfg => {
                    this.cylinders.push(new CylinderUnit(this.scene, cfg));
                });
            }

            initUI() {
                const gui = new GUI({ title: 'W16 Controls' });
                gui.add(this.params, 'rpm', 0, 8000).name('RPM');
                gui.add(this.params, 'exploded', 0, 5).name('Exploded View');
                gui.add(this.params, 'opacity', 0, 1).name('Glass Opacity').onChange(v => {
                    MATERIALS.glass.opacity = v;
                    MATERIALS.engineBlock.opacity = v;
                });
                gui.add(this.params, 'autoRotate').name('Auto Rotate');
                gui.add(this.params, 'wireframe').name('Wireframe').onChange(v => {
                    this.scene.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.wireframe = v;
                        }
                    });
                });
            }

            onWindowResize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.composer.setSize(window.innerWidth, window.innerHeight);
                if (this.dyno) this.dyno.resize();
            }

            animate(time) {
                requestAnimationFrame(this.animate.bind(this));

                const dt = (time - this.lastTime) / 1000;
                this.lastTime = time;

                const angularVelocity = (this.params.rpm * Math.PI * 2) / 60;
                this.crankAngle += angularVelocity * dt;
                this.crankAngle %= (Math.PI * 4);

                if (this.crankshaft) this.crankshaft.update(this.crankAngle);

                this.cylinders.forEach(cyl => {
                    cyl.update(this.crankAngle, this.params.exploded);
                });

                if (this.dyno) this.dyno.update(this.params.rpm);

                this.controls.autoRotate = this.params.autoRotate;
                this.controls.autoRotateSpeed = 2.0;
                this.controls.update();
                this.composer.render();
            }
        }

        new EngineSimulation();

    