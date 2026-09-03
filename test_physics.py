"""Physics and local-server regression checks: python3 -m unittest -v"""

import json
import math
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from app import Handler, ThreadingHTTPServer
from physics import force_state, forces, projectile, vectors


class ProjectileTests(unittest.TestCase):
    def test_ground_launch_matches_closed_form(self):
        s = projectile({"speed": 20, "angle": 45})["summary"]
        self.assertAlmostEqual(s["range"], 400 / 9.81)
        self.assertAlmostEqual(s["flight_time"], 20 * math.sqrt(2) / 9.81)
        self.assertAlmostEqual(s["peak_height"], 100 / 9.81)

    def test_horizontal_launch_from_height(self):
        result = projectile({"speed": 15, "angle": 0, "height": 10})
        self.assertAlmostEqual(result["duration"], math.sqrt(20 / 9.81))
        self.assertAlmostEqual(result["summary"]["range"], 15 * math.sqrt(20 / 9.81))
        self.assertAlmostEqual(result["samples"][-1]["y"], 0)

    def test_complementary_angles_have_equal_range(self):
        self.assertAlmostEqual(projectile({"angle": 30})["summary"]["range"],
                               projectile({"angle": 60})["summary"]["range"])

    def test_drop_from_rest(self):
        result = projectile({"speed": 0, "height": 12})
        self.assertEqual(result["summary"]["range"], 0)
        self.assertAlmostEqual(result["duration"], math.sqrt(24 / 9.81))

    def test_ground_downward_and_zero_launches_end_immediately(self):
        for params in ({"angle": -45}, {"angle": 0}, {"speed": 0}):
            self.assertEqual(projectile(params)["duration"], 0)

    def test_vertical_launch_has_no_horizontal_drift(self):
        self.assertEqual(projectile({"angle": 90})["summary"]["range"], 0)

    def test_downward_launch_and_energy_conservation(self):
        result = projectile({"speed": 32, "angle": -60, "height": 25})
        initial_energy = 32 ** 2 / 2 + 9.81 * 25
        for s in result["samples"]:
            self.assertGreaterEqual(s["y"], 0)
            self.assertAlmostEqual((s["vx"] ** 2 + s["vy"] ** 2) / 2 + 9.81 * s["y"], initial_energy)
        self.assertAlmostEqual(result["samples"][-1]["y"], 0)


class ForceTests(unittest.TestCase):
    def test_frictionless_newtons_second_law(self):
        s = force_state(3, 2, 10, 0, 0, 0)
        self.assertEqual(s["a"], 5)
        self.assertEqual(s["v"], 15)
        self.assertEqual(s["x"], 22.5)

    def test_static_friction_balances_applied_force(self):
        s = force_state(8, 5, 5, 0.5, 0.4, 0)
        self.assertEqual(s["friction"], -5)
        self.assertEqual(s["net"], 0)
        self.assertEqual(s["x"], 0)
        self.assertEqual(s["regime"], "static")

    def test_breakaway_and_static_boundary(self):
        threshold = 0.5 * 2 * 9.81
        self.assertEqual(force_state(2, 2, threshold, 0.5, 0.3, 0)["v"], 0)
        self.assertGreater(force_state(2, 2, threshold + 0.01, 0.5, 0.3, 0)["v"], 0)

    def test_sliding_stops_without_spurious_reversal(self):
        t_stop = 8 / (0.2 * 9.81)
        s = force_state(8, 3, 0, 0.3, 0.2, 8)
        self.assertEqual(s["v"], 0)
        self.assertAlmostEqual(s["x"], 8 * t_stop / 2)
        self.assertEqual(s["regime"], "static")

    def test_opposing_force_reverses_direction(self):
        s = force_state(5, 2, -10, 0.3, 0.2, 8)
        self.assertLess(s["v"], 0)
        self.assertGreater(s["friction"], 0)
        self.assertAlmostEqual(s["a"], (-10 + 0.2 * 2 * 9.81) / 2)

    def test_negative_motion_is_symmetric(self):
        right = force_state(4, 2, 3, 0.3, 0.2, 8)
        left = force_state(4, 2, -3, 0.3, 0.2, -8)
        for key in ("x", "v", "a", "friction", "net"):
            self.assertAlmostEqual(right[key], -left[key])

    def test_constant_velocity_with_balanced_sliding_forces(self):
        s = force_state(4, 2, 0.2 * 2 * 9.81, 0.3, 0.2, 5)
        self.assertEqual(s["v"], 5)
        self.assertEqual(s["x"], 20)

    def test_stopping_event_is_included_and_position_is_continuous(self):
        params = {"mass": 2, "applied": -10, "mu_static": 0.3, "mu_kinetic": 0.2, "v0": 8}
        result = forces(params)
        stop = next(s for s in result["samples"] if s["v"] == 0)
        self.assertGreater(stop["t"], 0)
        before = force_state(stop["t"] - 1e-7, **params)
        after = force_state(stop["t"] + 1e-7, **params)
        self.assertAlmostEqual(before["x"], after["x"])

    def test_no_force_no_motion(self):
        s = force_state(30, 1, 0, 0, 0, 0)
        self.assertEqual(s["x"], 0)
        self.assertEqual(s["v"], 0)


class VectorTests(unittest.TestCase):
    def test_three_four_five(self):
        result = vectors({"ax": 3, "ay": 0, "bx": 0, "by": 4})
        self.assertEqual(result["result"]["magnitude"], 5)
        self.assertAlmostEqual(result["result"]["angle"], 53.13010235415598)
        self.assertEqual(result["separation"], 90)
        self.assertEqual(result["dot"], 0)

    def test_subtraction(self):
        result = vectors({"ax": 4, "ay": 3, "bx": -1, "by": 4, "operation": "subtract"})
        self.assertEqual(result["result"]["x"], 5)
        self.assertEqual(result["result"]["y"], -1)
        self.assertGreater(result["result"]["angle"], 270)
        self.assertEqual(result["dot"], 8)

    def test_zero_result_has_no_angle(self):
        result = vectors({"ax": 4, "ay": 3, "bx": -4, "by": -3})
        self.assertEqual(result["result"]["magnitude"], 0)
        self.assertIsNone(result["result"]["angle"])
        self.assertEqual(result["separation"], 180)

    def test_zero_input_has_no_separation_angle(self):
        result = vectors({"ax": 0, "ay": 0})
        self.assertIsNone(result["a"]["angle"])
        self.assertIsNone(result["separation"])


class ValidationTests(unittest.TestCase):
    def test_invalid_input_is_rejected(self):
        for model, values in [(projectile, {"speed": "nan"}),
                              (projectile, {"gravity": 0}),
                              (projectile, {"height": -1}),
                              (forces, {"mass": 0}),
                              (forces, {"applied": "inf"}),
                              (forces, {"mu_static": 0.1, "mu_kinetic": 0.2}),
                              (vectors, {"ax": "hello"}),
                              (vectors, {"operation": "multiply"})]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                model(values)

    def test_boundary_values_are_finite_json(self):
        for model, values in [(projectile, {"speed": 100, "gravity": 0.1, "height": 100}),
                              (forces, {"mass": 0.1, "applied": 100, "duration": 30}),
                              (vectors, {"ax": 20, "ay": 20, "bx": 20, "by": 20})]:
            json.dumps(model(values), allow_nan=False)


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_static_assets_and_all_models(self):
        for path in ("/", "/styles.css", "/lab.js", "/api/projectile", "/api/forces", "/api/vectors"):
            with self.subTest(path=path), urlopen(self.base + path, timeout=3) as response:
                self.assertEqual(response.status, 200)
                self.assertTrue(response.read())

    def test_invalid_query_is_json_error(self):
        with self.assertRaises(HTTPError) as raised:
            urlopen(self.base + "/api/forces?mass=0", timeout=3)
        self.assertEqual(raised.exception.code, 400)
        self.assertIn("error", json.loads(raised.exception.read()))

    def test_unlisted_files_are_not_served(self):
        for path in ("/physics.py", "/../app.py", "/api/missing"):
            with self.subTest(path=path), self.assertRaises(HTTPError) as raised:
                urlopen(self.base + path, timeout=3)
            self.assertEqual(raised.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
