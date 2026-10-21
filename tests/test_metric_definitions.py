import json
import unittest
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]

class MetricDefinitionTests(unittest.TestCase):
    def test_canonical_metrics_state_delivery_scope_and_latency(self):
        roles = json.loads((ROOT / 'career-data.json').read_text())['roles']
        delivery = next(r for r in roles if r['company'] == 'CDAI')
        latency = next(r for r in roles if r['company'] == 'Arteria AI' and r['title'] == 'Senior MLOps Engineer')
        for view in ['website_bullets', 'resume_bullets']:
            self.assertIn('feature and product delivery velocity', ' '.join(delivery[view]))
            self.assertIn('model latency by a factor of 10', ' '.join(latency[view]))

    def test_actual_public_consumers_use_explicit_metric_definitions(self):
        with pymupdf.open(ROOT / 'public/tugrul-guner-resume.pdf') as doc:
            self.assertEqual(len(doc), 1)
            pdf = ' '.join(doc[0].get_text().split())
        for text in [pdf, (ROOT / 'public/index.html').read_text(), (ROOT / 'public/llms.txt').read_text()]:
            self.assertIn('feature and product delivery velocity', text)
            self.assertIn('model latency by a factor of 10', text)
            self.assertNotIn('improved model performance', text.lower())
            self.assertNotIn('2.5× increase in delivery velocity', text)
        html = (ROOT / 'public/index.html').read_text()
        self.assertIn('2.5× faster feature and product delivery', html)
        self.assertIn('2.5×</dt><dd>feature/product delivery', html)

if __name__ == '__main__':
    unittest.main()
