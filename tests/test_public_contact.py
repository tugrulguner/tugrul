import unittest
from pathlib import Path
import pymupdf as fitz
ROOT = Path(__file__).resolve().parents[1]
EMAIL = 'tugrul@modepot.io'
OLD_EMAIL = 'tugrulgunr@gmail.com'

class PublicContactTests(unittest.TestCase):
    def test_site_uses_new_public_email_without_changing_tracking(self):
        html = (ROOT / 'public/index.html').read_text()
        self.assertIn(f'href="mailto:{EMAIL}" data-posthog-event="email_clicked" data-posthog-surface="contact">{EMAIL}</a>', html)
        self.assertNotIn(OLD_EMAIL, html)

    def test_generated_resume_uses_new_clickable_email_on_one_page(self):
        with fitz.open(ROOT / 'public/tugrul-guner-resume.pdf') as doc:
            self.assertEqual(len(doc), 1)
            text = doc[0].get_text()
            self.assertIn(EMAIL, text)
            self.assertNotIn(OLD_EMAIL, text)
            self.assertIn(f'mailto:{EMAIL}', [link.get('uri') for link in doc[0].get_links()])

if __name__ == '__main__':
    unittest.main()
