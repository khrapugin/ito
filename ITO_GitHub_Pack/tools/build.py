"""Build the public release with Python's standard library; no network or Git.

The exact, reviewed allowlist lives in release-files.txt. Existing files outside
that list are ignored, including databases created by local app/test runs.
"""
import argparse
import hashlib
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_NAME = 'ITO_GitHub_Pack_0.6.1.zip'
FORBIDDEN_DIRS = {'dist', 'runtime', 'backups', 'uploads', 'exports', '.git', '.venv', '__pycache__', 'node_modules'}


def collect(root):
    names = (root / 'release-files.txt').read_text(encoding='utf-8-sig').splitlines()
    if not names or len(names) != len(set(names)):
        raise ValueError('Empty or duplicate release file list')
    files = {}
    for name in names:
        path = PurePosixPath(name)
        if not name or path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
            raise ValueError('Unsafe release path: ' + name)
        lower = name.lower()
        if set(part.lower() for part in path.parts) & FORBIDDEN_DIRS or any(part.lower().startswith('.env') for part in path.parts) or any(ext in lower for ext in ('.sqlite', '.db', '.zip', '.pyc', '.log')):
            raise ValueError('Private/runtime file is not permitted: ' + name)
        target = (root / name).resolve()
        if not target.is_relative_to(root.resolve()) or not target.is_file():
            raise ValueError('Missing file or path outside the package: ' + name)
        files[name] = target.read_bytes()
    if 'MANIFEST.sha256' in files:
        raise ValueError('MANIFEST.sha256 is generated; remove it from release-files.txt')
    return files


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs if key in ('href', 'src') and value)


def check_links(root, files):
    checked = 0
    for name, content in files.items():
        if not name.startswith('docs/') or not name.endswith('.html'):
            continue
        parser = Links()
        parser.feed(content.decode('utf-8'))
        for link in parser.links:
            url = urlsplit(link)
            if url.scheme or url.netloc or not url.path:
                continue
            target = (root / name).parent.joinpath(unquote(url.path)).resolve()
            docs = (root / 'docs').resolve()
            if not target.is_relative_to(docs) or target.relative_to(root.resolve()).as_posix() not in files:
                raise ValueError('Missing or non-portable demo link: ' + name + ' -> ' + link)
            checked += 1
    return checked


def manifest_for(files):
    return ''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n' for name, data in sorted(files.items()))


def build(root=ROOT, check_only=False):
    root = root.resolve()
    files = collect(root)
    links = check_links(root, files)
    manifest = manifest_for(files)
    if check_only:
        if (root / 'MANIFEST.sha256').read_text(encoding='utf-8') != manifest:
            raise ValueError('Files differ from the delivered manifest. Review edits, then run build.py to rebuild.')
        return len(files), links, None
    destination = root / 'dist'
    destination.mkdir(exist_ok=True)
    archive = destination / ARCHIVE_NAME
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for name, content in sorted({**files, 'MANIFEST.sha256': manifest.encode('utf-8')}.items()):
            info = zipfile.ZipInfo('ITO_GitHub_Pack/' + name, date_time=(2026, 10, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            output.writestr(info, content)
    (root / 'MANIFEST.sha256').write_text(manifest, encoding='utf-8', newline='\n')
    return len(files), links, archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check files, hashes and demo links without writing anything')
    args = parser.parse_args()
    try:
        count, links, archive = build(check_only=args.check)
    except (ValueError, OSError) as error:
        raise SystemExit('Build failed: ' + str(error)) from error
    print(f'OK: {count} source files; {links} local demo links.')
    if archive:
        print('Archive: ' + str(archive))
        print('Nothing has been uploaded or published.')
