"""Pure, dependency-free physics models. All inputs and outputs use SI units."""

import math


def _number(values, key, default, minimum, maximum):
    try:
        value = float(values.get(key, default))
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a number.") from None
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f"{key} must be between {minimum} and {maximum}.")
    return value


def projectile(values):
    """Point projectile under uniform gravity, ending at first ground contact."""
    speed = _number(values, "speed", 20, 0, 100)
    angle = _number(values, "angle", 45, -90, 90)
    height = _number(values, "height", 0, 0, 100)
    gravity = _number(values, "gravity", 9.81, 0.1, 30)
    vx = speed * math.cos(math.radians(angle))
    vy = speed * math.sin(math.radians(angle))
    vx = 0.0 if abs(vx) < 1e-12 else vx
    vy = 0.0 if abs(vy) < 1e-12 else vy
    discriminant = math.sqrt(vy * vy + 2 * gravity * height)
    # The alternative root avoids cancellation for a downward launch.
    flight = (2 * height / (discriminant - vy) if vy < 0
              else (vy + discriminant) / gravity)
    peak_time = max(0, vy / gravity)
    peak_height = height + max(vy, 0) ** 2 / (2 * gravity)
    samples = []
    for i in range(361):
        t = flight * i / 360
        y = max(0, height + vy * t - 0.5 * gravity * t * t)
        samples.append({"t": t, "x": vx * t, "y": y,
                        "vx": vx, "vy": vy - gravity * t})
    return {
        "kind": "projectile", "duration": flight,
        "parameters": {"speed": speed, "angle": angle, "height": height,
                       "gravity": gravity},
        "summary": {"flight_time": flight, "range": vx * flight,
                    "peak_height": peak_height, "peak_time": peak_time,
                    "impact_speed": math.hypot(vx, vy - gravity * flight)},
        "samples": samples,
    }


def force_state(t, mass, applied, mu_static, mu_kinetic, v0, gravity=9.81):
    """Exact 1D solution with Coulomb friction and an analytic stopping event.

    Positive is right. Static friction cancels the applied force at rest up to
    mu_static * N. While sliding, friction is opposite velocity. A stopped
    object either stays at rest or restarts in the applied force's direction.
    """
    normal = mass * gravity
    kinetic = mu_kinetic * normal
    static_limit = mu_static * normal

    def resting_branch(elapsed, position):
        if abs(applied) <= static_limit:
            return {"x": position, "v": 0.0, "a": 0.0,
                    "friction": -applied, "regime": "static"}
        friction = -math.copysign(kinetic, applied)
        acceleration = (applied + friction) / mass
        return {"x": position + 0.5 * acceleration * elapsed ** 2,
                "v": acceleration * elapsed, "a": acceleration,
                "friction": friction, "regime": "sliding"}

    if v0 == 0:
        result = resting_branch(t, 0.0)
    else:
        friction = -math.copysign(kinetic, v0)
        acceleration = (applied + friction) / mass
        stop_time = -v0 / acceleration if v0 * acceleration < 0 else math.inf
        if t >= stop_time:
            stop_x = v0 * stop_time + 0.5 * acceleration * stop_time ** 2
            result = resting_branch(t - stop_time, stop_x)
        else:
            result = {"x": v0 * t + 0.5 * acceleration * t ** 2,
                      "v": v0 + acceleration * t, "a": acceleration,
                      "friction": friction, "regime": "sliding"}
    result.update({"t": t, "normal": normal, "weight": normal,
                   "net": applied + result["friction"]})
    return result


def forces(values):
    mass = _number(values, "mass", 2, 0.1, 50)
    applied = _number(values, "applied", 10, -100, 100)
    mu_static = _number(values, "mu_static", 0.3, 0, 1.5)
    mu_kinetic = _number(values, "mu_kinetic", 0.2, 0, 1.5)
    if mu_kinetic > mu_static:
        raise ValueError("Kinetic friction must be less than or equal to static friction.")
    v0 = _number(values, "v0", 0, -20, 20)
    duration = _number(values, "duration", 8, 1, 30)
    parameters = {"mass": mass, "applied": applied, "mu_static": mu_static,
                  "mu_kinetic": mu_kinetic, "v0": v0, "gravity": 9.81}
    times = [duration * i / 360 for i in range(361)]
    if v0:
        initial_friction = -math.copysign(mu_kinetic * mass * 9.81, v0)
        initial_a = (applied + initial_friction) / mass
        if v0 * initial_a < 0:
            stop_time = -v0 / initial_a
            if 0 < stop_time < duration:
                times.append(stop_time)
    samples = [force_state(t, **parameters) for t in sorted(set(times))]
    return {"kind": "forces", "duration": duration,
            "parameters": {**parameters, "duration": duration},
            "summary": {"static_limit": mu_static * mass * 9.81,
                        "kinetic_magnitude": mu_kinetic * mass * 9.81,
                        "final_position": samples[-1]["x"],
                        "final_velocity": samples[-1]["v"]},
            "samples": samples}


def _vector(x, y):
    magnitude = math.hypot(x, y)
    return {"x": x, "y": y, "magnitude": magnitude,
            "angle": math.degrees(math.atan2(y, x)) % 360 if magnitude else None}


def vectors(values):
    ax = _number(values, "ax", 4, -20, 20)
    ay = _number(values, "ay", 3, -20, 20)
    bx = _number(values, "bx", -1, -20, 20)
    by = _number(values, "by", 4, -20, 20)
    operation = values.get("operation", "add")
    if operation not in ("add", "subtract"):
        raise ValueError("operation must be add or subtract.")
    sign = 1 if operation == "add" else -1
    a, b = _vector(ax, ay), _vector(bx, by)
    dot = ax * bx + ay * by
    product = a["magnitude"] * b["magnitude"]
    separation = (math.degrees(math.acos(max(-1, min(1, dot / product))))
                  if product else None)
    return {"kind": "vectors", "parameters": {"ax": ax, "ay": ay, "bx": bx,
            "by": by, "operation": operation}, "a": a, "b": b,
            "effective_b": _vector(sign * bx, sign * by),
            "result": _vector(ax + sign * bx, ay + sign * by),
            "dot": dot, "separation": separation}
