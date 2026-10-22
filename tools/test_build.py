import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('release_builder', Path(__file__).with_name('build.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'docs').mkdir()
        (self.root / 'docs/index.html').write_text('<script src="demo.js"></script>', encoding='utf-8')
        (self.root / 'docs/demo.js').write_text('/* synthetic data */', encoding='utf-8')
        (self.root / 'release-files.txt').write_text('docs/index.html\ndocs/demo.js\nrelease-files.txt\n', encoding='utf-8')

    def test_archive_ignores_unlisted_databases_and_checks_manifest(self):
        (self.root / 'private.sqlite3').write_bytes(b'private data')
        count, links, archive = builder.build(self.root)
        self.assertEqual((count, links), (3, 1))
        with zipfile.ZipFile(archive) as z:
            self.assertEqual(len(z.namelist()), 4)
            self.assertFalse(any('private' in name for name in z.namelist()))
        self.assertEqual(builder.build(self.root, check_only=True), (3, 1, None))
        (self.root / 'docs/demo.js').write_text('/* changed */', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'differ'):
            builder.build(self.root, check_only=True)

    def test_rejects_private_paths_even_if_allowlisted(self):
        for name in ['private.sqlite3', 'runtime/a.json', '.env', '../outside.txt']:
            with self.subTest(name=name):
                (self.root / 'release-files.txt').write_text(name+'\n', encoding='utf-8')
                with self.assertRaises(ValueError):
                    builder.build(self.root)

    def test_missing_demo_dependency_stops_build(self):
        (self.root / 'docs/index.html').write_text('<script src="missing.js"></script>', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Missing'):
            builder.build(self.root)

    def test_repeated_build_is_reproducible(self):
        _, _, archive = builder.build(self.root)
        before = archive.read_bytes()
        builder.build(self.root)
        self.assertEqual(archive.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
