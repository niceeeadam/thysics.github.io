# Physics Lab — GitHub Pages edition

Interactive projectile motion, forces and motion, and vector visualizations. This edition runs entirely in your browser: **no Python server, packages, API keys, build step, or external services are required**.

## Publish on GitHub Pages

1. Extract `Physics_Lab_GitHub_Pages.zip`.
2. Create a public GitHub repository, for example `physics-lab`.
3. Upload the **contents** of the extracted folder to the repository's top level and commit them to `main`. Do not upload the ZIP itself or put the website inside another folder.
4. Open the repository's **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
6. Select **main**, choose **/ (root)**, and click **Save**.
7. Wait for deployment to finish, then open the website link shown in the Pages settings. It normally has the form `https://YOUR-USERNAME.github.io/physics-lab/`.

Your repository should look like this:

```text
index.html
styles.css
physics.js
lab.js
.nojekyll
README.md
tests/
  physics.test.cjs
```

The four website files (`index.html`, `styles.css`, `physics.js`, and `lab.js`) are required. The included empty `.nojekyll` file skips Jekyll processing; it may be hidden by your file manager. The site also works with the default processing if your upload omits it. The README and tests are optional for hosting.

No GitHub Actions workflow is needed for this branch-based setup. The website uses relative asset paths, so it works both at a project URL such as `/physics-lab/` and at a site's root. You can name the repository something else without editing the code.

[GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Try it locally

Double-click **index.html** to open it in a modern browser. The extracted files work offline without starting a server. Keep the four website files together.

You can also preview with any static HTTP server if you prefer. Python is optional for that:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Use the lab

- Use the **− / + buttons** or type a value directly into a number field.
- Green switches enable plot overlays. The title-bar arrow resets the current experiment.
- Pick a preset from **Experiment** to explore a worked scenario.
- For motion, play/pause, rewind, scrub time, or change playback speed.
- Open **Graphs & equations** for motion graphs and model assumptions.
- Open **Components & equations** in the vector view for the component table and formulas.

### Models

**Projectile motion:** a point object under uniform gravity, with no air resistance and level ground at y = 0. Input angles are measured above +x; negative angles point downward. The flight stops at ground contact. A horizontal or downward ground-level launch has zero flight time. Spatial axes use equal scales; velocity arrows have a separate scale.

**Forces and motion:** one-dimensional motion on a horizontal surface with constant applied force and gravity of 9.81 m/s². Position starts at zero; positive means right. Static friction can balance force up to μsN. Sliding friction opposes velocity and has magnitude μkN, with 0 ≤ μk ≤ μs. Stopping and reversal are solved analytically. Force arrows share a scale; the position strip has a separate scale.

**Vectors:** two-dimensional addition and subtraction in arbitrary, consistent units. Directions are counterclockwise from +x, in [0°, 360°). A zero vector has no direction, and the angle between two vectors is undefined if either is zero. The dot product and angle-between readouts always refer to the original A and B, including in subtraction mode.

## Files and tests

- `physics.js`: pure JavaScript calculations, ported from the original Python models.
- `lab.js`: controls, plots, animation, and interpolation between sampled results.
- `index.html` and `styles.css`: the minimal cream-and-black interface.
- `tests/physics.test.cjs`: independent numerical regression tests.

The calculations happen directly in the browser. There are no `/api/` requests, remote libraries, analytics, or CDN assets. Python is not included in this edition and is not required to run it.

Optional developer tests, with Node.js 18 or newer:

```sh
node --test tests/physics.test.cjs
```

Node is only needed for these optional tests; visitors need only a browser.
