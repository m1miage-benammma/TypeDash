import ast
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


class CodeHygieneTests(unittest.TestCase):
    def test_application_has_no_ad_hoc_print_statements_or_unused_imports(self):
        root = Path(__file__).resolve().parents[1] / "app"
        for path in root.rglob("*.py"):
            with self.subTest(module=path.relative_to(root)):
                tree = ast.parse(path.read_text(encoding="utf-8-sig"))
                names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                        self.assertNotEqual(node.func.id, "print")
                    if isinstance(node, (ast.Import, ast.ImportFrom)):
                        for alias in node.names:
                            name = alias.asname or (alias.name.split(".")[0]
                                                    if isinstance(node, ast.Import) else alias.name)
                            if name != "*":
                                self.assertIn(name, names, f"Unused import: {name}")

    def test_ci_scripts_keep_failure_annotations_without_print_statements(self):
        root = Path(__file__).resolve().parents[2]
        environment = {**os.environ, "RENDER_API_KEY": "", "RENDER_SERVICE_ID": "",
                       "NETLIFY_AUTH_TOKEN": "", "NETLIFY_SITE_ID": ""}
        for filename in ("deploy-render.py", "check-netlify-access.py"):
            path = root / ".github" / "scripts" / filename
            with self.subTest(script=filename):
                tree = ast.parse(path.read_text(encoding="utf-8-sig"))
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                        self.assertNotEqual(node.func.id, "print")
                result = subprocess.run([sys.executable, str(path)], env=environment,
                                        capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 1)
                self.assertTrue(result.stderr.startswith("::error::"), result.stderr)

    def test_only_consumed_application_routes_are_exposed(self):
        with patch.dict(os.environ, {"TYPEDASH_STORAGE": "memory", "TYPEDASH_RUNTIME_ENVIRONMENT": "development"}):
            from app.main import app, typing_service
            from app.api.routers.typing import create_router
        actual = {(method.upper(), path) for path, methods in app.openapi()["paths"].items()
                  if path.startswith("/api/") for method in methods}
        actual.update(("WEBSOCKET", route.path) for route in create_router(typing_service).routes
                      if not hasattr(route, "methods"))
        self.assertEqual(actual, {
            ("GET", "/api/health"),
            ("GET", "/api/calculator"), ("POST", "/api/calculator"),
            ("POST", "/api/tests"), ("GET", "/api/tests/{test_id}"),
            ("WEBSOCKET", "/api/tests/{test_id}/stream"),
            ("GET", "/api/devices/{device_id}"),
            ("PUT", "/api/devices/{device_id}/registration"),
            ("PATCH", "/api/devices/{device_id}/username"),
            ("DELETE", "/api/devices/{device_id}/stats"),
            ("GET", "/api/devices/{device_id}/stats/{stat_id}"),
        })
