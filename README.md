# Physics Lab

A Python program for exploring **projectile motion, forces and motion, and vectors** with interactive plots, animations, and numerical results.

## Run it

You need **Python 3.9 or newer** and a modern browser. No extra Python packages, downloads, accounts, or internet connection are needed after Python is installed.

1. Extract the ZIP and open a terminal in the `physics_lab` folder.
2. Run:

   ```sh
   python3 app.py
   ```

   On Windows, use `py app.py` if `python3` is unavailable.

3. The app opens in your default browser. If it does not, visit **http://127.0.0.1:8765**.
4. Keep the terminal running while you use the app. Press **Ctrl+C** in the terminal to stop it.

If the port is already in use, run `python3 app.py --port 0` to choose an available port. To start without opening a browser, add `--no-browser`.

## Explore the three views

Use the **− / + buttons** to adjust a setting, or type a value directly into its number field. Square green switches turn plot overlays on. The arrow in the black title bar resets the current experiment.

The main view keeps the plot and key results visible. Open **Graphs & equations** for motion graphs and model assumptions, or **Components & equations** in the vector view for the component table and formulas.

### Projectile motion

- Adjust launch speed, angle, starting height, and gravity.
- Play/pause the flight, rewind, scrub to a time, or adjust playback speed.
- View the trajectory, velocity arrow, and horizontal/vertical velocity components.
- Read horizontal range, maximum height above ground, flight time, and impact speed.
- Compare height and vertical velocity graphs with a synchronized time marker.
- Try ground launches, horizontal launches from a ledge, and Moon gravity.

Angles are measured above +x; negative angles point downward. Gravity is a positive downward acceleration. The projectile is a point object with no air resistance; the ground is level at y = 0. A ground-level horizontal/downward launch has zero flight time. The app stops at ground contact and does not model bouncing. Spatial axes use equal scales; velocity arrows use their own scale.

### Forces and motion

- Change mass, a signed horizontal applied force, friction coefficients, initial velocity, and duration.
- See the applied force, friction, normal force, and weight in a free-body diagram.
- Follow the block on a position scale and inspect synchronized position and velocity graphs.
- Read net force, acceleration, velocity, and position at the selected time.
- Try static friction, sliding to a stop, and motion that reverses direction.

This is a **one-dimensional model on a horizontal surface**, with constant applied force and Earth gravity (9.81 m/s²). It starts at x = 0. Positive means rightward. At rest, static friction balances the applied force up to μsN. During sliding, friction has magnitude μkN and opposes velocity. The coefficients must satisfy 0 ≤ μk ≤ μs. Stopping and reversal are solved analytically, so friction does not make a stopped block oscillate. All force arrows in the free-body diagram share one scale; the position strip uses a separate scale.

### Vectors

- Edit the x and y components of two vectors.
- Switch between A + B and A − B.
- See the head-to-tail construction, resultant, and optional resultant components.
- Read components, magnitude, direction, dot product, and the angle between A and B.
- Test perpendicular vectors and equal-and-opposite cancellation.

The vector plot uses equal-scale axes and arbitrary, consistent units. Directions are counterclockwise from +x in [0°, 360°). A zero vector has no defined direction; the angle between two vectors is undefined if either is zero. The dot product and angle-between readouts always use the original A and B, even in subtraction mode.

## Files and customization

- `app.py`: standard-library local HTTP server and launcher. Listens only on 127.0.0.1.
- `physics.py`: documented Python calculation functions, independent of the interface.
- `index.html`, `styles.css`, `lab.js`: browser interface and canvas rendering. No external libraries, fonts, analytics, or CDNs.
- `test_physics.py`: numerical and HTTP regression checks.

The Python models produce exact sampled solutions. The browser interpolates position between samples and draws the results; it does not require a separate JavaScript physics engine. Stopping events are included as additional samples to preserve the transition between sliding and rest or reversal.

You can use the models directly from another Python script:

```python
from physics import projectile, forces, vectors

flight = projectile({"speed": 20, "angle": 45, "height": 0, "gravity": 9.81})
print(flight["summary"])

motion = forces({"mass": 2, "applied": 10, "mu_static": 0.3,
                 "mu_kinetic": 0.2, "v0": 0, "duration": 8})
print(motion["samples"][-1])

result = vectors({"ax": 3, "ay": 0, "bx": 0, "by": 4, "operation": "add"})
print(result["result"])  # magnitude 5; direction approximately 53.13 degrees
```

Run the included tests from the program folder:

```sh
python3 -B -m unittest -v
```

The HTTP tests briefly open a loopback port on your computer. Invalid, out-of-range, or non-finite inputs are rejected with clear error messages.
