
import { OBJECTS } from './objects.js';
import { $, loadScript, exists } from './utils.js';

const MODEL_VIEWER =
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';

let viewerLoading = null;

async function loadModelViewer() {
  if (customElements.get('model-viewer')) return;

  if (!viewerLoading) {
    viewerLoading = loadScript(MODEL_VIEWER, 'module')
      .then(() => customElements.whenDefined('model-viewer'))
      .catch(error => {
        viewerLoading = null;
        throw error;
      });
  }

  await viewerLoading;
}

// Non-AR 3D preview
export async function openPreview(id) {
  const object = OBJECTS.find(item => item.id === id) || OBJECTS[0];

  const box = $('#preview-stage');
  const title = $('#preview-title');

  if (!box || !title) {
    console.error('[AR VISION] Preview elements were not found.');
    return;
  }

  title.textContent = object.name;
  box.innerHTML = '<p class="note">Loading 3D viewer…</p>';

  try {
    if (!(await exists(object.model))) {
      box.innerHTML = `
        <p class="note">
          The model file <code>${object.model}</code> has not been added yet.
          Check your assets/models folder.
        </p>
      `;
      return;
    }

    await loadModelViewer();

    // Avoid inserting a viewer if the preview was closed or changed
    // while the library was loading.
    if (!box.isConnected) return;

    box.innerHTML = `
      <model-viewer
        src="${object.model}"
        alt="3D model of ${object.name}"
        camera-controls
        autoplay
        auto-rotate
        rotation-per-second="20deg"
        shadow-intensity="1"
        interaction-prompt="auto"
        style="
          display: block;
          width: 100%;
          height: 100%;
          background: transparent;
        ">
      </model-viewer>
    `;

    const viewer = box.querySelector('model-viewer');

    viewer.addEventListener('error', event => {
      console.error('[AR VISION] Preview model error:', event);
      box.innerHTML = '<p class="note">Could not load this 3D model.</p>';
    }, { once: true });

  } catch (error) {
    console.error('[AR VISION] 3D preview error:', error);

    box.innerHTML = `
      <p class="note">
        Could not load the 3D viewer. Check your internet connection
        and try again.
      </p>
    `;
  }
}
