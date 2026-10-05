import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


class CareerPipelineTests(unittest.TestCase):
    def test_generated_html_escapes_career_source(self):
        data_path = ROOT / "career-data.json"
        original = data_path.read_text()
        try:
            data = json.loads(original)
            data["roles"][0]["title"] = "AI <script>Engineering</script> Manager"
            data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
            subprocess.run([PYTHON, "scripts/build-career.py"], cwd=ROOT, check=True)
            html = (ROOT / "public/index.html").read_text()
            self.assertIn("AI &lt;script&gt;Engineering&lt;/script&gt; Manager", html)
            self.assertNotIn("<script>Engineering</script>", html)
        finally:
            data_path.write_text(original)
            subprocess.run([PYTHON, "scripts/build-career.py"], cwd=ROOT, check=True)
            subprocess.run([PYTHON, "scripts/build-resume.py"], cwd=ROOT, check=True)

    def test_career_drift_is_rejected(self):
        data_path = ROOT / "career-data.json"
        original = data_path.read_text()
        try:
            for old, new in [("AI Engineering Manager", "AI Manager"), ("Jan 2026–present", "Feb 2026–present"), ("2.5×", "9×")]:
                data_path.write_text(original.replace(old, new, 1))
                result = subprocess.run([PYTHON, "scripts/check-career-sync.py"], cwd=ROOT, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0, f"checker accepted drift: {old}")
        finally:
            data_path.write_text(original)

    def test_canonical_data_renders_site_machine_text_and_resume(self):
        subprocess.run([PYTHON, "scripts/build-career.py"], cwd=ROOT, check=True)
        subprocess.run([PYTHON, "scripts/build-resume.py"], cwd=ROOT, check=True)
        subprocess.run([PYTHON, "scripts/check-career-sync.py"], cwd=ROOT, check=True)
        data = json.loads((ROOT / "public/career.json").read_text())
        html = (ROOT / "public/index.html").read_text()
        llms = (ROOT / "public/llms.txt").read_text()
        resume_text = subprocess.run([PYTHON, "-c", "import pymupdf; print(pymupdf.open('public/tugrul-guner-resume.pdf')[0].get_text())"], cwd=ROOT, check=True, capture_output=True, text=True).stdout
        for role in data["roles"]:
            self.assertIn(role["title"], html)
            self.assertIn(role["title"], llms)
            self.assertIn(role["title"], resume_text)
        self.assertIn("&lt;", html)

    def test_resume_is_one_page_and_contains_condensed_roles(self):
        result = subprocess.run([PYTHON, "scripts/validate-resume.py"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
