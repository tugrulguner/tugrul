import json
import re
import subprocess
import sys
import unittest
from pathlib import Path
import pymupdf
ROOT = Path(__file__).resolve().parents[1]

class QuotographProfileTests(unittest.TestCase):
    def test_profile_link_and_current_modepot_projects(self):
        subprocess.run([sys.executable, 'scripts/build-resume.py'], cwd=ROOT, check=True)
        doc = pymupdf.open(ROOT / 'public/tugrul-guner-resume.pdf')
        self.assertEqual(len(doc), 1)
        text = ' '.join(doc[0].get_text().split())
        self.assertIn('tugrul.modepot.io', text)
        uris = {link.get('uri') for link in doc[0].get_links()}
        self.assertIn('https://tugrul.modepot.io/', uris)
        self.assertIn('https://modepot.io/', uris)
        self.assertIn('https://x.com/Tugrul_Guner', uris)
        self.assertIn('articles on X and Medium', text)
        html = (ROOT / 'public/index.html').read_text()
        llms = (ROOT / 'public/llms.txt').read_text()
        self.assertIn('I also publish articles on X', html)
        self.assertIn('He also publishes articles on X', llms)
        for name in ['Dexpot', 'Intpot', 'Summonpot', 'LifePot', 'RefPot', 'UtilityPot']:
            self.assertIn(name, text)
            destination = f'https://{name.lower()}.modepot.io/'
            self.assertIn(f'data-posthog-project="{name.lower()}"', html)
            self.assertIn(destination, llms)
        projects = re.findall(r'<a class="project ph-no-autocapture"', html)
        self.assertEqual(len(projects), 6)

    def test_confirmed_scope_and_collaborative_attribution(self):
        roles = json.loads((ROOT / 'career-data.json').read_text())['roles']
        q = {r['title']: r for r in roles if r['company'] == 'Quotograph.io'}
        self.assertEqual(q['Chief Technology Officer']['dates'], 'Jan 2024 – Jul 2025')
        self.assertEqual(q['Senior Tech Lead']['dates'], 'Jul 2025 – Present')
        for view in ['website_bullets', 'resume_bullets']:
            cto = ' '.join(q['Chief Technology Officer'][view])
            for term in ['marketplace', 'instant quotes from photos and images', 'B2B', 'Quoto Report', 'Quoto Measure', 'PermitX', 'chatbot']:
                self.assertIn(term, cto)
            self.assertIn('Contributed', cto)
            self.assertIn('advisory', ' '.join(q['Senior Tech Lead'][view]))
            for term in ['from scratch', 'photo-to-quote', 'unfunded', 'CEO']:
                self.assertNotIn(term, cto)

    def test_grouped_roles_render_their_own_evidence(self):
        subprocess.run([sys.executable, 'scripts/build-career.py'], cwd=ROOT, check=True)
        html = (ROOT / 'public/index.html').read_text()
        roles = re.findall(r'<section class="timeline-role">(.*?)</section>', html, flags=re.S)
        self.assertEqual(len(roles), 2)
        advisory = next(r for r in roles if '<h3>Senior Tech Lead</h3>' in r)
        cto = next(r for r in roles if '<h3>Chief Technology Officer</h3>' in r)
        self.assertIn('advisory', advisory)
        self.assertNotIn('Quoto Report', advisory)
        self.assertIn('<li>Designed and developed', cto)
        self.assertIn('instant quotes from photos and images', cto)
        self.assertIn('PermitX', cto)

    def test_actual_resume_readability_and_quotograph_evidence(self):
        subprocess.run([sys.executable, 'scripts/build-resume.py'], cwd=ROOT, check=True)
        doc = pymupdf.open(ROOT / 'public/tugrul-guner-resume.pdf')
        self.assertEqual(len(doc), 1)
        text = ' '.join(doc[0].get_text().split())
        for term in ['marketplace', 'photos and images', 'Quoto Report', 'Quoto Measure', 'PermitX', 'advisory', 'Chief Technology Officer', 'Senior Tech Lead']:
            self.assertIn(term, text)
        spans = [s for b in doc[0].get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if s['text'].strip()]
        # Career and capability body text must be larger, never squeezed to add evidence.
        body = [s for s in spans if s['font'] == 'Helvetica' and s['bbox'][1] < 750 and not s['text'].startswith('Toronto, ON')]
        self.assertTrue(body)
        self.assertGreaterEqual(min(s['size'] for s in body), 8.25)
        for s in spans:
            self.assertGreaterEqual(s['bbox'][0], 0)
            self.assertLessEqual(s['bbox'][2], doc[0].rect.width)
            self.assertLess(s['bbox'][3], doc[0].rect.height)

if __name__ == '__main__':
    unittest.main()
