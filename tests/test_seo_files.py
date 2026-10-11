"""robots.txt and sitemap.xml list only public pages and point at the public domain."""
import asyncio
import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "seo-tests-secret-key-with-enough-entropy"
os.environ.pop("REDIS_URL", None)

import main
from starlette.requests import Request


def request():
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [],
                    "query_string": b"", "scheme": "https", "server": ("wextheory.cv", 443)})


class SeoFilesTests(unittest.TestCase):
    def test_robots_hides_private_areas_and_names_the_sitemap(self):
        with patch.dict(os.environ, {"BASE_URL": "https://wextheory.cv"}):
            text = asyncio.run(main.robots_txt(request())).body.decode()
        self.assertIn("Disallow: /admin", text)
        self.assertIn("Disallow: /api/", text)
        self.assertIn("Sitemap: https://wextheory.cv/sitemap.xml", text)

    def test_sitemap_lists_public_pages_only(self):
        with patch.dict(os.environ, {"BASE_URL": "https://wextheory.cv"}):
            xml = asyncio.run(main.sitemap_xml(request())).body.decode()
        self.assertIn("<loc>https://wextheory.cv/test/0</loc>", xml)
        self.assertIn("<loc>https://wextheory.cv/about</loc>", xml)
        self.assertNotIn("/admin", xml)
        self.assertNotIn("/dashboard", xml)


if __name__ == "__main__":
    unittest.main()
