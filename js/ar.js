
import { OBJECTS } from './objects.js';
import { $, loadScript, exists } from './utils.js';

/* ==========================================
   AR VISION - AR ENGINE
   MindAR + A-Frame + Touch Gestures
========================================== */


/* ==========================================
   LIBRARY URLS
========================================== */

const AFRAME =
  'https://aframe.io/releases/1.5.0/aframe.min.js';

const MINDAR =
  'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';

const ANIMATION_MIXER =
  'https://cdn.jsdelivr.net/npm/aframe-extras@7.5.4/dist/aframe-extras.min.js';

const TARGETS =
  'assets/targets/targets.mind';


/* ==========================================
   AR STATE
========================================== */

let scene = null;
let active = null;
let found = new Set();

let starting = false;
let sessionId = 0;

let availableObjects = [];
let missing = [];

let gestureCleanup = null;

const view = {};

const transformFrames = new WeakMap();


/* ==========================================
   DOM HELPERS
========================================== */

function say(message) {
  const status = $('#ar-status');

  if (status) {
    status.textContent = message;
  }
}

function show(selector, visible = true) {
  const element = $(selector);

  if (element) {
    element.classList.toggle('hidden', !visible);
  }
}

function resetLoading() {
  show('#ar-loading', false);
  show('#ar-prep', false);
  show('#ar-error', false);
}

function fail(message) {
  resetLoading();

  const errorMessage = $('#ar-error-msg');

  if (errorMessage) {
    errorMessage.textContent =
      message || 'Something went wrong. Please try again.';
  }

  show('#ar-error', true);

  console.error('[AR VISION]', message);
}


/* ==========================================
   VECTOR HELPERS
========================================== */

function parseVector(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value !== 'string') {
    return [...fallback];
  }

  const result = value.trim().split(/\s+/).map(Number);

  if (
    result.length !== 3 ||
    result.some(number => !Number.isFinite(number))
  ) {
    return [...fallback];
  }

  return result;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBaseTransform(object) {
  return {
    position: parseVector(object.position),
    rotation: parseVector(object.rotation),
    scale: parseVector(object.scale, [1, 1, 1])
  };
}


/* ==========================================
   LOAD AR LIBRARIES
========================================== */

async function loadARLibraries() {
  if (!window.AFRAME) {
    await loadScript(AFRAME);
  }

  if (!window.MINDAR?.IMAGE) {
    await loadScript(MINDAR);
  }

  if (!window.AFRAME?.components?.['animation-mixer']) {
    await loadScript(ANIMATION_MIXER);
  }

  if (!window.AFRAME) {
    throw new Error('A-Frame could not be initialized.');
  }

  if (!window.MINDAR?.IMAGE) {
    throw new Error('MindAR could not be initialized.');
  }

  if (!window.AFRAME.components['animation-mixer']) {
    throw new Error('The 3D animation component could not be loaded.');
  }
}


/* ==========================================
   CHECK REQUIRED FILES
========================================== */

async function checkModels() {
  missing = [];
  availableObjects = [];

  for (const object of OBJECTS) {
    const available = await exists(object.model);

    if (available) {
      availableObjects.push(object);
    } else {
      missing.push(object.name);
      console.warn(
        '[AR VISION] Missing model:',
        object.model
      );
    }
  }

  if (availableObjects.length === 0) {
    throw new Error(
      'No 3D models were found. Check your assets/models folder.'
    );
  }

  if (missing.length) {
    console.warn(
      '[AR VISION] Some models are missing:',
      missing.join(', ')
    );
  }
}


/* ==========================================
   CREATE TARGET ENTITIES
========================================== */

function createTargetEntities() {
  return availableObjects.map(object => {

    const target = document.createElement('a-entity');

    target.setAttribute(
      'mindar-image-target',
      `targetIndex: ${object.targetIndex}`
    );

    target.dataset.objectId = object.id;


    // Wrapper receives all user transformations.

    const wrapper = document.createElement('a-entity');

    wrapper.id = `w-${object.id}`;

    const base = getBaseTransform(object);

    wrapper.setAttribute(
      'position',
      base.position.join(' ')
    );

    wrapper.setAttribute(
      'rotation',
      base.rotation.join(' ')
    );

    wrapper.setAttribute(
      'scale',
      base.scale.join(' ')
    );


    // Actual 3D model.

    const model = document.createElement('a-entity');

    model.id = `model-${object.id}`;

    model.setAttribute(
      'gltf-model',
      object.model
    );

    model.setAttribute(
      'animation-mixer',
      'clip: *; loop: repeat; timeScale: 1'
    );

    wrapper.appendChild(model);
    target.appendChild(wrapper);

    return target;
  });
}


/* ==========================================
   CREATE A-FRAME SCENE
========================================== */

function createScene() {
  const stage = $('#ar-stage');

  if (!stage) {
    throw new Error('AR camera stage was not found.');
  }

  stage.innerHTML = '';

  const arScene = document.createElement('a-scene');

  arScene.setAttribute(
    'mindar-image',
    `imageTargetSrc: ${TARGETS}; autoStart: false; uiScanning: false; uiLoading: no;`
  );

  arScene.setAttribute(
    'embedded',
    ''
  );

  arScene.setAttribute(
    'color-space',
    'sRGB'
  );

  arScene.setAttribute(
    'renderer',
    'colorManagement: true; physicallyCorrectLights: true; antialias: false;'
  );

  arScene.setAttribute(
    'vr-mode-ui',
    'enabled: false'
  );

  arScene.setAttribute(
    'device-orientation-permission-ui',
    'enabled: false'
  );


  // Camera.

  const camera = document.createElement('a-camera');

  camera.setAttribute('position', '0 0 0');

  camera.setAttribute('look-controls', 'enabled: false');

  arScene.appendChild(camera);


  // Lighting.

  const ambient = document.createElement('a-entity');

  ambient.setAttribute(
    'light',
    'type: ambient; intensity: 1.2'
  );

  arScene.appendChild(ambient);


  const directional = document.createElement('a-entity');

  directional.setAttribute(
    'light',
    'type: directional; intensity: 1.5'
  );

  directional.setAttribute(
    'position',
    '1 2 3'
  );

  arScene.appendChild(directional);


  // Image targets and models.

  for (const target of createTargetEntities()) {
    arScene.appendChild(target);
  }


  scene = arScene;

  stage.appendChild(arScene);

  return arScene;
}


/* ==========================================
   MODEL ANIMATION EVENTS
========================================== */

function registerModelEvents(object) {
  const model = $(`#model-${object.id}`);

  if (!model) return;

  model.addEventListener('model-loaded', event => {

    console.log(
      '[AR VISION] Model loaded:',
      object.name
    );

    const loadedModel = event.detail?.model;

    if (
      loadedModel &&
      loadedModel.animations &&
      loadedModel.animations.length
    ) {
      model.setAttribute(
        'animation-mixer',
        'clip: *; loop: repeat; timeScale: 1'
      );

      console.log(
        '[AR VISION] Animation enabled:',
        object.name
      );
    }

  });

  model.addEventListener('model-error', event => {

    console.error(
      '[AR VISION] Model loading error:',
      object.name,
      event
    );

    say(`Could not load ${object.name}.`);

  });
}


/* ==========================================
   INFORMATION PANEL
========================================== */

function renderInfo(object) {
  const title = $('#info-title');
  const body = $('#info-body');

  if (!title || !body) return;

  title.textContent = object.name;

  body.innerHTML = '';

  const description = document.createElement('p');

  description.textContent = object.blurb || '';

  body.appendChild(description);


  if (object.facts?.length) {

    const heading = document.createElement('h4');

    heading.textContent = 'Quick facts';

    body.appendChild(heading);

    const list = document.createElement('ul');

    for (const fact of object.facts) {

      const item = document.createElement('li');

      const label = document.createElement('strong');

      label.textContent = `${fact[0]}: `;

      item.appendChild(label);

      item.appendChild(
        document.createTextNode(fact[1])
      );

      list.appendChild(item);
    }

    body.appendChild(list);
  }


  if (object.trivia?.length) {

    const heading = document.createElement('h4');

    heading.textContent = 'Did you know?';

    body.appendChild(heading);

    const list = document.createElement('ul');

    for (const fact of object.trivia) {

      const item = document.createElement('li');

      item.textContent = fact;

      list.appendChild(item);
    }

    body.appendChild(list);
  }
}


/* ==========================================
   TARGET FOUND / LOST
========================================== */

function onFound(object) {
  active = object;

  found.add(object.id);

  renderInfo(object);

  show('#ar-guide', false);
  show('#ar-info', true);
  show('#ar-controls', true);

  const count = $('#ar-count');

  if (count) {
    count.textContent =
      `${found.size}/${OBJECTS.length} discovered`;
  }

  say(`${object.name} detected. Drag to explore!`);
}


function onLost(object) {
  if (active?.id === object.id) {
    active = null;
  }

  show('#ar-info', false);
  show('#ar-controls', false);
  show('#ar-guide', true);

  say('Point your camera at an AR Vision image.');
}


function registerTargetEvents() {
  for (const object of availableObjects) {

    const target = $(
      `[data-object-id="${object.id}"]`,
      scene
    );

    if (!target) continue;

    view[object.id] = {
      rotation: 0,
      zoom: 1,
      vertical: 0
    };

    target.addEventListener('targetFound', () => {
      onFound(object);
    });

    target.addEventListener('targetLost', () => {
      onLost(object);
    });

    registerModelEvents(object);
  }
}


/* ==========================================
   SMOOTH MODEL TRANSFORM
========================================== */

function smoothTransform(
  wrapper,
  targetRotation,
  targetScale,
  targetPosition,
  duration = 180
) {
  if (!wrapper?.object3D) return;

  const object3D = wrapper.object3D;

  const previousFrame = transformFrames.get(wrapper);

  if (previousFrame) {
    cancelAnimationFrame(previousFrame);
  }

  const startRotation = {
    x: object3D.rotation.x,
    y: object3D.rotation.y,
    z: object3D.rotation.z
  };

  const startScale = {
    x: object3D.scale.x,
    y: object3D.scale.y,
    z: object3D.scale.z
  };

  const startPosition = {
    x: object3D.position.x,
    y: object3D.position.y,
    z: object3D.position.z
  };

  const rotationRadians = targetRotation.map(
    value => value * Math.PI / 180
  );

  const startTime = performance.now();

  function animate(now) {
    const progress = clamp(
      (now - startTime) / duration,
      0,
      1
    );

    const eased = 1 - Math.pow(1 - progress, 3);

    object3D.rotation.set(
      startRotation.x +
        (rotationRadians[0] - startRotation.x) * eased,

      startRotation.y +
        (rotationRadians[1] - startRotation.y) * eased,

      startRotation.z +
        (rotationRadians[2] - startRotation.z) * eased
    );

    object3D.scale.set(
      startScale.x +
        (targetScale[0] - startScale.x) * eased,

      startScale.y +
        (targetScale[1] - startScale.y) * eased,

      startScale.z +
        (targetScale[2] - startScale.z) * eased
    );

    object3D.position.set(
      startPosition.x +
        (targetPosition[0] - startPosition.x) * eased,

      startPosition.y +
        (targetPosition[1] - startPosition.y) * eased,

      startPosition.z +
        (targetPosition[2] - startPosition.z) * eased
    );

    if (progress < 1) {
      const frame = requestAnimationFrame(animate);

      transformFrames.set(wrapper, frame);
    } else {
      transformFrames.delete(wrapper);
    }
  }

  const frame = requestAnimationFrame(animate);

  transformFrames.set(wrapper, frame);
}


/* ==========================================
   GET CURRENT MODEL TRANSFORM
========================================== */

function getCurrentTransform(object) {
  const wrapper = $(`#w-${object.id}`);

  if (!wrapper) return null;

  const base = getBaseTransform(object);

  const state = view[object.id] || {
    rotation: 0,
    zoom: 1,
    vertical: 0
  };

  return {
    wrapper,

    rotation: [
      base.rotation[0],
      base.rotation[1] + state.rotation,
      base.rotation[2]
    ],

    scale: base.scale.map(
      value => value * state.zoom
    ),

    position: [
      base.position[0],
      base.position[1] + state.vertical,
      base.position[2]
    ]
  };
}


/* ==========================================
   APPLY GESTURE TRANSFORM
========================================== */

function applyGestureTransform(object) {
  const transform = getCurrentTransform(object);

  if (!transform) return;

  const object3D = transform.wrapper.object3D;

  if (!object3D) return;

  // Direct updates during gestures prevent
  // repeated animation restarts and input lag.

  object3D.rotation.set(
    transform.rotation[0] * Math.PI / 180,
    transform.rotation[1] * Math.PI / 180,
    transform.rotation[2] * Math.PI / 180
  );

  object3D.scale.set(
    ...transform.scale
  );

  object3D.position.set(
    ...transform.position
  );
}


/* ==========================================
   RESET / LEGACY TRANSFORM CONTROLS
========================================== */

export function transform(action) {
  if (!active) return;

  const object = active;

  const state = view[object.id];

  if (!state) return;

  const base = getBaseTransform(object);

  const wrapper = $(`#w-${object.id}`);

  if (!wrapper) return;


  switch (action) {

    case 'left':
      state.rotation -= 15;
      break;

    case 'right':
      state.rotation += 15;
      break;

    case 'in':
      state.zoom = clamp(
        state.zoom + 0.15,
        0.25,
        4
      );
      break;

    case 'out':
      state.zoom = clamp(
        state.zoom - 0.15,
        0.25,
        4
      );
      break;

    case 'reset':
      state.rotation = 0;
      state.zoom = 1;
      state.vertical = 0;
      break;

    default:
      return;
  }


  const result = getCurrentTransform(object);

  if (!result) return;

  smoothTransform(
    wrapper,
    result.rotation,
    result.scale,
    result.position
  );
}


/* ==========================================
   POINTER / TOUCH GESTURE SYSTEM
========================================== */

const gesturePointers = new Map();

let gestureStart = null;


function getPointerDistance(first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;

  return Math.sqrt(dx * dx + dy * dy);
}


function getPointerCenter(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}


function createOneFingerBaseline(pointer) {
  if (!active) return null;

  const state = view[active.id];

  return {
    type: 'rotate',

    x: pointer.x,
    y: pointer.y,

    rotation: state.rotation,
    vertical: state.vertical
  };
}


function createPinchBaseline() {
  const pointers = [...gesturePointers.values()];

  if (pointers.length < 2 || !active) return null;

  const first = pointers[0];
  const second = pointers[1];

  const state = view[active.id];

  return {
    type: 'pinch',

    distance: Math.max(
      getPointerDistance(first, second),
      1
    ),

    zoom: state.zoom,

    center: getPointerCenter(first, second)
  };
}


/* ==========================================
   INSTALL TOUCH CONTROLS
========================================== */

function installTouchControls() {
  const stage = $('#ar-stage');

  if (!stage) return;

  // Avoid duplicate listeners.

  if (gestureCleanup) {
    gestureCleanup();
  }

  gesturePointers.clear();

  gestureStart = null;

  stage.style.touchAction = 'none';


  function onPointerDown(event) {
    if (!active) return;

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (
      event.target.closest(
        '#ar-info, #ar-controls, button'
      )
    ) {
      return;
    }

    event.preventDefault();

    try {
      stage.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may not be available
      // on every browser implementation.
    }

    gesturePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });


    if (gesturePointers.size === 1) {

      const pointer = gesturePointers.get(event.pointerId);

      gestureStart = createOneFingerBaseline(pointer);

    } else if (gesturePointers.size === 2) {

      gestureStart = createPinchBaseline();

    }
  }


  function onPointerMove(event) {
    if (!gesturePointers.has(event.pointerId)) return;

    if (!active || !gestureStart) return;

    event.preventDefault();

    const pointer = gesturePointers.get(event.pointerId);

    pointer.x = event.clientX;
    pointer.y = event.clientY;


    const state = view[active.id];

    if (!state) return;


    // ONE FINGER: ROTATE + VERTICAL MOVEMENT.

    if (
      gesturePointers.size === 1 &&
      gestureStart.type === 'rotate'
    ) {

      const dx = event.clientX - gestureStart.x;
      const dy = event.clientY - gestureStart.y;

      state.rotation =
        gestureStart.rotation + dx * 0.6;

      state.vertical = clamp(
        gestureStart.vertical - dy * 0.003,
        -1.5,
        1.5
      );

      applyGestureTransform(active);

    }


    // TWO FINGERS: PINCH ZOOM.

    else if (
      gesturePointers.size === 2 &&
      gestureStart.type === 'pinch'
    ) {

      const pointers = [...gesturePointers.values()];

      const distance = Math.max(
        getPointerDistance(pointers[0], pointers[1]),
        1
      );

      const zoomFactor =
        distance / gestureStart.distance;

      state.zoom = clamp(
        gestureStart.zoom * zoomFactor,
        0.25,
        4
      );

      applyGestureTransform(active);

    }
  }


  function onPointerUp(event) {
    if (!gesturePointers.has(event.pointerId)) return;

    gesturePointers.delete(event.pointerId);

    if (gesturePointers.size === 0) {

      gestureStart = null;

    } else if (gesturePointers.size === 1) {

      // Continue smoothly with the remaining finger.

      const remaining = [
        ...gesturePointers.values()
      ][0];

      gestureStart = createOneFingerBaseline(remaining);

    }
  }


  function onPointerCancel(event) {
    onPointerUp(event);
  }


  stage.addEventListener(
    'pointerdown',
    onPointerDown,
    { passive: false }
  );

  stage.addEventListener(
    'pointermove',
    onPointerMove,
    { passive: false }
  );

  stage.addEventListener(
    'pointerup',
    onPointerUp
  );

  stage.addEventListener(
    'pointercancel',
    onPointerCancel
  );


  // Save cleanup function.

  gestureCleanup = () => {

    stage.removeEventListener(
      'pointerdown',
      onPointerDown
    );

    stage.removeEventListener(
      'pointermove',
      onPointerMove
    );

    stage.removeEventListener(
      'pointerup',
      onPointerUp
    );

    stage.removeEventListener(
      'pointercancel',
      onPointerCancel
    );

    gesturePointers.clear();

    gestureStart = null;

    gestureCleanup = null;
  };
}


/* ==========================================
   START AR EXPERIENCE
========================================== */

export async function startAR() {
  if (starting) return;

  starting = true;

  const currentSession = ++sessionId;

  try {

    resetLoading();

    show('#ar', true);
    show('#ar-loading', true);

    show('#ar-info', false);
    show('#ar-controls', false);
    show('#ar-guide', true);

    active = null;

    found.clear();

    if (!window.isSecureContext) {
      throw new Error(
        'Camera access requires HTTPS or localhost. Open the deployed HTTPS website on your phone.'
      );
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Camera access is not supported by this browser.'
      );
    }


    // Check target file.

    if (!(await exists(TARGETS))) {
      throw new Error(
        'The image target file is missing. Check assets/targets/targets.mind.'
      );
    }


    // Load AR libraries.

    await loadARLibraries();

    if (currentSession !== sessionId) return;


    // Check model files.

    await checkModels();

    if (currentSession !== sessionId) return;


    // Create scene.

    createScene();

    registerTargetEvents();

    installTouchControls();


    // Handle MindAR errors.

    scene.addEventListener('arError', event => {

      if (currentSession !== sessionId) return;

      console.error(
        '[AR VISION] MindAR error:',
        event
      );

      fail(
        'Camera or image tracking error. Check camera permission and try again.'
      );

    });


    scene.addEventListener('arReady', () => {

      if (currentSession !== sessionId) return;

      console.log('[AR VISION] Image tracking ready.');

      say(
        'Camera ready. Point it at an AR Vision image.'
      );

    });


    // Wait until the A-Frame scene has loaded.

    if (!scene.hasLoaded) {
      await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {
          reject(
            new Error('AR scene loading timed out.')
          );
        }, 20000);

        scene.addEventListener('loaded', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

      });
    }

    if (currentSession !== sessionId) return;


    // Start image tracking.

    const mindarSystem =
      scene.systems['mindar-image-system'];

    if (!mindarSystem) {
      throw new Error(
        'MindAR image tracking system was not found.'
      );
    }

    await mindarSystem.start();

    if (currentSession !== sessionId) return;


    show('#ar-loading', false);

    show('#ar-guide', true);

    say(
      'Point your camera at an AR Vision image.'
    );


    if (missing.length) {
      console.warn(
        '[AR VISION] Some objects are unavailable:',
        missing.join(', ')
      );
    }

  } catch (error) {

    if (currentSession !== sessionId) return;

    console.error(
      '[AR VISION] Start error:',
      error
    );

    await stopAR();

    show('#ar', true);

    fail(
      error.message || 'Unable to start the AR experience.'
    );

  } finally {

    if (currentSession === sessionId) {
      starting = false;
    }

  }
}


/* ==========================================
   STOP AR EXPERIENCE
========================================== */

export async function stopAR() {
  // Invalidate previous asynchronous startup work.

  sessionId++;

  starting = false;


  // Remove gesture listeners.

  if (gestureCleanup) {
    gestureCleanup();
  }


  // Stop MindAR tracking.

  if (scene) {

    try {

      const mindarSystem =
        scene.systems?.['mindar-image-system'];

      if (mindarSystem) {
        await mindarSystem.stop();
      }

    } catch (error) {

      console.warn(
        '[AR VISION] Camera cleanup warning:',
        error
      );

    }
  }


  // Cancel model animations.

  for (const object of OBJECTS) {

    const wrapper = $(`#w-${object.id}`);

    if (!wrapper) continue;

    const frame = transformFrames.get(wrapper);

    if (frame) {
      cancelAnimationFrame(frame);
      transformFrames.delete(wrapper);
    }
  }


  // Remove AR scene.

  const stage = $('#ar-stage');

  if (stage) {
    stage.innerHTML = '';
  }


  // Reset state.

  scene = null;

  active = null;

  found.clear();

  missing = [];

  availableObjects = [];

  for (const key of Object.keys(view)) {
    delete view[key];
  }


  // Hide AR UI.

  show('#ar-loading', false);
  show('#ar-info', false);
  show('#ar-controls', false);
  show('#ar-guide', true);
}


/* ==========================================
   END OF AR ENGINE
========================================== */
