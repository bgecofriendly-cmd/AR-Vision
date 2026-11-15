
import { OBJECTS } from './objects.js';
import { $, loadScript, exists } from './utils.js';

// --------------------------------------------------
// 1. LIBRARY CONFIGURATION
// --------------------------------------------------

const AFRAME =
  'https://aframe.io/releases/1.5.0/aframe.min.js';

const MINDAR =
  'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';

const ANIMATION_MIXER =
  'https://cdn.jsdelivr.net/npm/aframe-extras@7.5.4/dist/aframe-extras.min.js';

const TARGETS = 'assets/targets/targets.mind';

// --------------------------------------------------
// 2. GLOBAL AR STATE
// --------------------------------------------------

let scene = null;
let active = null;

let found = new Set();
let view = {};
let missing = new Set();

let starting = false;
let sessionId = 0;

// --------------------------------------------------
// 3. UI HELPERS
// --------------------------------------------------

const say = (message) => {
  const status = $('#ar-status');

  if (status) {
    status.textContent = message;
  }
};

const show = (selector, visible) => {
  const element = $(selector);

  if (element) {
    element.classList.toggle('hidden', !visible);
  }
};

function resetLoading() {
  show('#ar-loading', false);
}

export function fail(message) {
  starting = false;

  resetLoading();

  const errorMessage = $('#ar-error-msg');

  if (errorMessage) {
    errorMessage.textContent = message;
  }

  show('#ar-error', true);

  console.error('[AR VISION]', message);
}

// --------------------------------------------------
// 4. LIBRARY INITIALISATION
// --------------------------------------------------

async function loadARLibraries() {
  console.log('[AR VISION] Loading AR libraries...');

  // A-Frame must load first.
  await loadScript(AFRAME);

  if (!window.AFRAME) {
    throw new Error('A-Frame failed to initialise.');
  }

  console.log('[AR VISION] A-Frame loaded.');

  // Load MindAR after A-Frame.
  await loadScript(MINDAR);

  if (!window.MINDAR?.IMAGE) {
    throw new Error('MindAR Image tracking was not initialised.');
  }

  console.log('[AR VISION] MindAR loaded.');

  // Load animation-mixer component.
  await loadScript(ANIMATION_MIXER);

  if (!window.AFRAME.components['animation-mixer']) {
    throw new Error('Animation mixer component was not registered.');
  }

  console.log('[AR VISION] Animation mixer loaded.');
}

// --------------------------------------------------
// 5. CHECK MODEL FILES
// --------------------------------------------------

async function checkModels() {
  missing.clear();

  for (const object of OBJECTS) {
    const available = await exists(object.model);

    if (!available) {
      missing.add(object.id);

      console.warn(
        `[AR VISION] Missing model: ${object.model}`
      );
    }
  }
}

// --------------------------------------------------
// 6. CREATE AR TARGET ENTITIES
// --------------------------------------------------

function createTargetEntities() {
  return OBJECTS.map(object => {

    const modelMarkup = missing.has(object.id)
      ? ''
      : `
        <a-entity
          id="model-${object.id}"
          gltf-model="url(${object.model})"
          animation-mixer="clip: *; loop: repeat; timeScale: 1">
        </a-entity>
      `;

    return `
      <a-entity
        id="t-${object.id}"
        mindar-image-target="targetIndex: ${object.targetIndex}">

        <a-entity
          id="w-${object.id}"
          position="${object.position}"
          rotation="${object.rotation}"
          scale="${object.scale}">

          ${modelMarkup}

        </a-entity>

      </a-entity>
    `;
  }).join('');
}

// --------------------------------------------------
// 7. CREATE AR SCENE
// --------------------------------------------------

function createScene() {

  const stage = $('#ar-stage');

  if (!stage) {
    throw new Error('AR stage element #ar-stage was not found.');
  }

  stage.innerHTML = `
    <a-scene
      mindar-image="
        imageTargetSrc: ${TARGETS};
        autoStart: false;
        uiLoading: no;
        uiScanning: no;
        uiError: no
      "

      color-space="sRGB"

      renderer="
        colorManagement: true;
        physicallyCorrectLights: true;
        antialias: false
      "

      vr-mode-ui="enabled: false"

      device-orientation-permission-ui="enabled: false">

      <a-camera
        position="0 0 0"
        look-controls="enabled: false">
      </a-camera>

      <a-light
        type="ambient"
        intensity="1.1">
      </a-light>

      <a-light
        type="directional"
        intensity="1.4"
        position="1 2 1">
      </a-light>

      ${createTargetEntities()}

    </a-scene>
  `;

  scene = $('#ar-stage a-scene');

  if (!scene) {
    throw new Error('Could not create the A-Frame scene.');
  }

  return scene;
}

// --------------------------------------------------
// 8. MODEL LOADING AND ANIMATION
// --------------------------------------------------

function registerModelEvents(object) {
  if (missing.has(object.id)) return;

  const model = $('#model-' + object.id);

  if (!model) {
    console.warn(
      '[AR VISION] Model entity not found:',
      object.id
    );
    return;
  }

  model.addEventListener('model-loaded', event => {
    const gltf = event.detail?.model;
    const animations = gltf?.animations || [];

    console.log(
      `[AR VISION] ${object.name}: ${animations.length} animation(s) found.`,
      animations.map(animation => animation.name)
    );

    if (animations.length > 0) {
      // Restart all embedded clips from the beginning.
      model.setAttribute('animation-mixer', {
        clip: '*',
        loop: 'repeat',
        timeScale: 1
      });

      console.log(
        `[AR VISION] Animation enabled for ${object.name}`
      );
    } else {
      console.info(
        `[AR VISION] ${object.name} has no embedded animations.`
      );
    }
  });

  model.addEventListener('model-error', event => {
    console.error(
      `[AR VISION] Failed to load ${object.name}:`,
      event.detail
    );

    if (active?.id === object.id) {
      say(`${object.name} model failed to load.`);
    }
  });
}

// --------------------------------------------------
// 9. REGISTER TARGET EVENTS
// --------------------------------------------------

function registerTargetEvents() {

  OBJECTS.forEach(object => {

    const target = $('#t-' + object.id);

    if (!target) {
      console.error(
        '[AR VISION] Target entity not found:',
        object.id
      );

      return;
    }

    view[object.id] = {
      ry: 0,
      z: 1
    };

    target.addEventListener('targetFound', () => {
      onFound(object);
    });

    target.addEventListener('targetLost', () => {
      onLost(object);
    });

    registerModelEvents(object);
  });
}

// --------------------------------------------------
// 10. START AR EXPERIENCE
// --------------------------------------------------

export async function startAR() {

  // Prevent duplicate camera sessions.
  if (starting || scene) {
    console.warn('[AR VISION] AR session already active.');
    return;
  }

  starting = true;

  const currentSession = ++sessionId;

  show('#ar-error', false);
  show('#ar-loading', true);
  show('#ar-guide', false);
  show('#ar-info', false);
  show('#ar-controls', false);

  say('Preparing camera…');

  // Reset session information.
  active = null;
  found.clear();
  view = {};
  missing.clear();

  const count = $('#ar-count');

  if (count) {
    count.textContent = `0/${OBJECTS.length} discovered`;
  }

  // Camera permission and secure-context check.
  if (
    !window.isSecureContext ||
    !navigator.mediaDevices?.getUserMedia
  ) {

    starting = false;

    return fail(
      'Camera needs a secure connection. Open this site over HTTPS (or localhost) in Chrome.'
    );
  }

  try {

    // Check tracking file.
    if (!(await exists(TARGETS))) {
      throw new Error(
        'Tracking file missing: assets/targets/targets.mind'
      );
    }

    if (currentSession !== sessionId) return;

    // Load libraries.
    await loadARLibraries();

    if (currentSession !== sessionId) return;

    // Check GLB models.
    await checkModels();

    if (currentSession !== sessionId) return;

    // Create the scene.
    const arScene = createScene();

    // Register target and model events.
    registerTargetEvents();

    // Handle camera/tracker errors.
    arScene.addEventListener('arError', (event) => {

      console.error(
        '[AR VISION] AR camera error:',
        event.detail
      );

      fail(
        'The camera could not start. Allow camera permission, close other apps using it, then tap Restart.'
      );
    });

    // MindAR ready event.
    arScene.addEventListener('arReady', () => {

      if (currentSession !== sessionId) return;

      starting = false;

      resetLoading();

      say('Searching for your image…');

      show('#ar-guide', true);

      console.log(
        '[AR VISION] Camera and image tracker ready.'
      );
    });

    // Wait for A-Frame scene loading.
    await new Promise((resolve) => {

      if (arScene.hasLoaded) {
        resolve();
        return;
      }

      arScene.addEventListener(
        'loaded',
        resolve,
        { once: true }
      );
    });

    if (currentSession !== sessionId) return;

    // Start MindAR.
    const tracker = arScene.systems['mindar-image-system'];

    if (!tracker) {
      throw new Error(
        'MindAR image tracking system was not found.'
      );
    }

    console.log('[AR VISION] Starting image tracker...');

    await tracker.start();

    if (currentSession !== sessionId) return;

    console.log('[AR VISION] Tracker start requested.');

  } catch (error) {

    if (currentSession !== sessionId) return;

    console.error(
      '[AR VISION] Startup error:',
      error
    );

    const message =
      error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow it in your browser settings, then tap Restart.'

        : error?.name === 'NotFoundError'
        ? 'No camera found on this device. Try 3D preview instead.'

        : error?.name === 'NotReadableError'
        ? 'The camera is in use by another app. Close it and tap Restart.'

        : error?.name === 'OverconstrainedError'
        ? 'The requested camera configuration is not supported by this device.'

        : error?.message?.includes('Tracking file missing')
        ? 'Tracking file missing: add assets/targets/targets.mind.'

        : 'Could not start AR: ' + (error?.message || error);

    // Clean up a failed session before showing the error.
    stopAR();

    fail(message);
  }
}

// --------------------------------------------------
// 11. IMAGE TARGET FOUND
// --------------------------------------------------

function onFound(object) {

  active = object;

  show('#ar-guide', false);

  // Update discovered count.
  if (!found.has(object.id)) {

    found.add(object.id);

    const count = $('#ar-count');

    if (count) {
      count.textContent =
        `${found.size}/${OBJECTS.length} discovered`;
    }
  }

  say(
    missing.has(object.id)
      ? `${object.name} detected, but its 3D model file is missing.`
      : 'Object detected! Explore in 3D.'
  );

  // Display object information.
  const title = $('#info-title');
  const body = $('#info-body');

  if (title) {
    title.textContent = object.name;
  }

  if (body) {

    body.innerHTML =
      '<dl>' +

      object.facts
        .map(fact =>
          `<dt>${fact[0]}</dt><dd>${fact[1]}</dd>`
        )
        .join('') +

      '</dl><ul>' +

      object.trivia
        .map(item => `<li>${item}</li>`)
        .join('') +

      '</ul>';
  }

  show('#ar-info', true);
  show('#ar-controls', true);

  console.log(
    '[AR VISION] Target detected:',
    object.name
  );
}

// --------------------------------------------------
// 12. IMAGE TARGET LOST
// --------------------------------------------------

function onLost(object) {

  if (active !== object) return;

  active = null;

  show('#ar-controls', false);
  show('#ar-info', false);
  show('#ar-guide', true);

  say(
    'Image not visible. Point your camera at the target again.'
  );

  console.log(
    '[AR VISION] Target lost:',
    object.name
  );
}

// --------------------------------------------------
// 13. ROTATE AND ZOOM CONTROLS
// --------------------------------------------------


export function transform(action) {
  if (!active || !scene) return;

  const state = view[active.id];
  const wrapper = $('#w-' + active.id);

  if (!state || !wrapper) return;

  const scale = active.scale.trim().split(/\s+/).map(Number);
  const rotation = active.rotation.trim().split(/\s+/).map(Number);

  if (
    scale.length !== 3 ||
    rotation.length !== 3 ||
    scale.some(Number.isNaN) ||
    rotation.some(Number.isNaN)
  ) {
    console.error(
      '[AR VISION] Invalid scale or rotation:',
      active.id
    );
    return;
  }

  switch (action) {
    case 'left':
      state.ry -= 30;
      break;

    case 'right':
      state.ry += 30;
      break;

    case 'in':
      state.z = Math.min(state.z * 1.15, 4);
      break;

    case 'out':
      state.z = Math.max(state.z / 1.15, 0.25);
      break;

    case 'reset':
      state.ry = 0;
      state.z = 1;
      break;

    default:
      return;
  }

  const targetRotation = [
    rotation[0],
    rotation[1] + state.ry,
    rotation[2]
  ];

  const targetScale = scale.map(value => value * state.z);

  smoothTransform(wrapper, targetRotation, targetScale);
}


// --------------------------------------------------
// 14. STOP AR AND CLEAN UP CAMERA
// --------------------------------------------------

export function stopAR() {

  // Invalidate any pending asynchronous startup.
  sessionId++;

  starting = false;

  // Stop MindAR tracker.
  try {

    const tracker =
      scene?.systems?.['mindar-image-system'];

    tracker?.stop();

  } catch (error) {

    console.warn(
      '[AR VISION] Camera cleanup warning:',
      error
    );
  }

  // Stop camera video streams.
  document.querySelectorAll('video').forEach(video => {

    if (video.srcObject) {

      video.srcObject
        .getTracks()
        .forEach(track => track.stop());

      video.srcObject = null;
    }

    video.remove();
  });

  // Remove old AR scene.
  const stage = $('#ar-stage');

  if (stage) {
    stage.innerHTML = '';
  }

  // Reset application state.
  scene = null;
  active = null;

  found.clear();
  missing.clear();
  view = {};

  const count = $('#ar-count');

  if (count) {
    count.textContent = `0/${OBJECTS.length} discovered`;
  }

  console.log('[AR VISION] AR session stopped and cleaned up.');
}



const transformFrames = new WeakMap();

function smoothTransform(wrapper, targetRotation, targetScale) {
  const object3D = wrapper.object3D;

  if (!object3D) return;

  // Cancel an unfinished transformation if another button is pressed.
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

  const toRadians = degrees => degrees * Math.PI / 180;

  const endRotation = {
    x: toRadians(targetRotation[0]),
    y: toRadians(targetRotation[1]),
    z: toRadians(targetRotation[2])
  };

  const endScale = {
    x: targetScale[0],
    y: targetScale[1],
    z: targetScale[2]
  };

  const startTime = performance.now();
  const duration = 220;

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);

    // Ease-out: quick response, gentle finish.
    const eased = 1 - Math.pow(1 - progress, 3);

    object3D.rotation.set(
      startRotation.x + (endRotation.x - startRotation.x) * eased,
      startRotation.y + (endRotation.y - startRotation.y) * eased,
      startRotation.z + (endRotation.z - startRotation.z) * eased
    );

    object3D.scale.set(
      startScale.x + (endScale.x - startScale.x) * eased,
      startScale.y + (endScale.y - startScale.y) * eased,
      startScale.z + (endScale.z - startScale.z) * eased
    );

    if (progress < 1) {
      transformFrames.set(
        wrapper,
        requestAnimationFrame(animate)
      );
    } else {
      transformFrames.delete(wrapper);
    }
  }

  transformFrames.set(
    wrapper,
    requestAnimationFrame(animate)
  );
}
