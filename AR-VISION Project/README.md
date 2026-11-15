# AR VISION
Image-target WebAR (MindAR 1.2.5 + A-Frame 1.5.0, pinned). Vanilla JS, no build step.

## Run locally
    cd AR-VISION
    npx serve .        # or: python -m http.server 8080
Open http://localhost:3000 in Chrome. (ES modules need a server; file:// will not work.)

## 1. Target images (you supply)
Print 3 high-contrast, detailed pictures (no large flat areas, no repeating patterns), matte paper, at least A5.
Save them as assets/images/dinosaur-card.jpg, heart-card.jpg, solar-system-card.jpg (also used as card thumbnails).

## 2. GLB models (you supply)
assets/models/dinosaur.glb, heart.glb, solar-system.glb. Keep each under ~5 MB (Draco/meshopt compressed).
Check licences (CC0 / CC-BY with credit): Sketchfab (downloadable, filter by licence), Poly Pizza, NASA 3D Resources (public domain), Smithsonian 3D.
Missing models are reported honestly in the UI; no placeholder shapes are shown.

## 3. Compile targets.mind
Open https://hiukim.github.io/mind-ar-js-doc/tools/compile , upload the 3 images IN THIS ORDER:
dinosaur (index 0), heart (1), solar system (2). Download targets.mind to assets/targets/.
Target indices come from upload order; if you change it, update targetIndex in js/objects.js.
Tune each model's scale/position/rotation in js/objects.js.

## Deploy (Netlify)
Drag the AR-VISION folder to app.netlify.com/drop. HTTPS is automatic. Make a QR code of the site URL.

## Test on Android
Open the URL in Chrome > Start AR > allow camera > point at the printed image. Test target loss, switching targets, Exit then Start AR again (camera light should turn off after Exit).

## Not included yet
Sound/narration, KTX2 textures, per-model animation controls, offline caching.
