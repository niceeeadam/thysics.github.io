"use strict";

/** Dependency-free physics models. All inputs and outputs use SI units.
 * Kept separate from the UI so the same functions can be tested with Node.
 * Classic scripts also let the finished site work directly from index.html.
 */
const Physics = (() => {
  function number(values, key, fallback, min, max) {
    const raw = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
    if ((typeof raw !== "number" && typeof raw !== "string") ||
        (typeof raw === "string" && raw.trim() === "")) {
      throw new Error(`${key} must be a number.`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be between ${min} and ${max}.`);
    }
    return value;
  }

  /** Point projectile in uniform gravity, ending at first ground contact. */
  function projectile(values = {}) {
    const speed = number(values, "speed", 20, 0, 100);
    const angle = number(values, "angle", 45, -90, 90);
    const height = number(values, "height", 0, 0, 100);
    const gravity = number(values, "gravity", 9.81, 0.1, 30);
    let vx = speed * Math.cos(angle * Math.PI / 180);
    let vy = speed * Math.sin(angle * Math.PI / 180);
    if (Math.abs(vx) < 1e-12) vx = 0;
    if (Math.abs(vy) < 1e-12) vy = 0;
    const discriminant = Math.sqrt(vy * vy + 2 * gravity * height);
    // This root avoids cancellation when the projectile is launched downward.
    const flight = vy < 0 ? 2 * height / (discriminant - vy) : (vy + discriminant) / gravity;
    const peakTime = Math.max(0, vy / gravity);
    const peakHeight = height + Math.max(vy, 0) ** 2 / (2 * gravity);
    const samples = Array.from({length: 361}, (_, i) => {
      const t = flight * i / 360;
      return {t, x: vx * t, y: Math.max(0, height + vy * t - 0.5 * gravity * t * t),
              vx, vy: vy - gravity * t};
    });
    return {
      kind: "projectile", duration: flight,
      parameters: {speed, angle, height, gravity},
      summary: {flight_time: flight, range: vx * flight, peak_height: peakHeight,
                peak_time: peakTime, impact_speed: Math.hypot(vx, vy - gravity * flight)},
      samples
    };
  }

  /** Exact 1D motion with Coulomb friction and an analytic stopping event.
   * Positive is right. At rest, friction can balance the applied force up to
   * mu_static * N. Sliding friction opposes velocity. At a stop, the block
   * either stays put or restarts in the applied force's direction.
   */
  function forceState(t, {mass, applied, mu_static, mu_kinetic, v0, gravity = 9.81}) {
    const normal = mass * gravity;
    const kinetic = mu_kinetic * normal;
    const staticLimit = mu_static * normal;
    function restingBranch(elapsed, position) {
      if (Math.abs(applied) <= staticLimit) {
        return {x: position, v: 0, a: 0, friction: -applied, regime: "static"};
      }
      const friction = -Math.sign(applied) * kinetic;
      const acceleration = (applied + friction) / mass;
      return {x: position + 0.5 * acceleration * elapsed ** 2,
              v: acceleration * elapsed, a: acceleration, friction, regime: "sliding"};
    }
    let result;
    if (v0 === 0) {
      result = restingBranch(t, 0);
    } else {
      const friction = -Math.sign(v0) * kinetic;
      const acceleration = (applied + friction) / mass;
      const stopTime = v0 * acceleration < 0 ? -v0 / acceleration : Infinity;
      if (t >= stopTime) {
        const stopX = v0 * stopTime + 0.5 * acceleration * stopTime ** 2;
        result = restingBranch(t - stopTime, stopX);
      } else {
        result = {x: v0 * t + 0.5 * acceleration * t ** 2,
                  v: v0 + acceleration * t, a: acceleration, friction, regime: "sliding"};
      }
    }
    return {...result, t, normal, weight: normal, net: applied + result.friction};
  }

  function forces(values = {}) {
    const mass = number(values, "mass", 2, 0.1, 50);
    const applied = number(values, "applied", 10, -100, 100);
    const mu_static = number(values, "mu_static", 0.3, 0, 1.5);
    const mu_kinetic = number(values, "mu_kinetic", 0.2, 0, 1.5);
    if (mu_kinetic > mu_static) {
      throw new Error("Kinetic friction must be less than or equal to static friction.");
    }
    const v0 = number(values, "v0", 0, -20, 20);
    const duration = number(values, "duration", 8, 1, 30);
    const parameters = {mass, applied, mu_static, mu_kinetic, v0, gravity: 9.81};
    const times = Array.from({length: 361}, (_, i) => duration * i / 360);
    if (v0 !== 0) {
      const initialFriction = -Math.sign(v0) * mu_kinetic * mass * 9.81;
      const initialA = (applied + initialFriction) / mass;
      if (v0 * initialA < 0) {
        const stopTime = -v0 / initialA;
        if (stopTime > 0 && stopTime < duration) times.push(stopTime);
      }
    }
    const samples = [...new Set(times)].sort((a, b) => a - b).map(t => forceState(t, parameters));
    const last = samples[samples.length - 1];
    return {
      kind: "forces", duration, parameters: {...parameters, duration},
      summary: {static_limit: mu_static * mass * 9.81,
                kinetic_magnitude: mu_kinetic * mass * 9.81,
                final_position: last.x, final_velocity: last.v},
      samples
    };
  }

  function vector(x, y) {
    const magnitude = Math.hypot(x, y);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    return {x, y, magnitude, angle: magnitude ? (angle < 0 ? angle + 360 : angle) : null};
  }

  function vectors(values = {}) {
    const ax = number(values, "ax", 4, -20, 20);
    const ay = number(values, "ay", 3, -20, 20);
    const bx = number(values, "bx", -1, -20, 20);
    const by = number(values, "by", 4, -20, 20);
    const operation = Object.prototype.hasOwnProperty.call(values, "operation") ? values.operation : "add";
    if (operation !== "add" && operation !== "subtract") throw new Error("operation must be add or subtract.");
    const sign = operation === "add" ? 1 : -1;
    const a = vector(ax, ay), b = vector(bx, by);
    const dot = ax * bx + ay * by;
    const product = a.magnitude * b.magnitude;
    const separation = product ? Math.acos(Math.max(-1, Math.min(1, dot / product))) * 180 / Math.PI : null;
    return {kind: "vectors", parameters: {ax, ay, bx, by, operation}, a, b,
            effective_b: vector(sign * bx, sign * by),
            result: vector(ax + sign * bx, ay + sign * by), dot, separation};
  }

  return Object.freeze({projectile, forces, forceState, vectors});
})();

// Optional Node export for tests; the browser uses the Physics object above.
if (typeof module !== "undefined" && module.exports) module.exports = Physics;
