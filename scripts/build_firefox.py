#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
GECKO_ID = 'jorodox-tool-firefox@jorodox-tool'
GECKO_ID_PATTERN = re.compile(r'^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$')
RUNTIME_FILES = (
	'index.html',
	'errorModal.html',
	'messageModal.html',
	'background.js',
	'LICENSE',
)
# Only runtime dependencies referenced by the packaged pages and styles are included.
RUNTIME_DIRECTORIES = ('css', 'img', 'js')
TEXT_SUFFIXES = frozenset(('.css', '.html', '.js', '.json', '.svg', '.txt'))
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
CSS_URL_PATTERN = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", re.IGNORECASE)
CSS_IMPORT_PATTERN = re.compile(r"""@import\s+(['"])(.*?)\1""", re.IGNORECASE)


def parse_args():
	parser = argparse.ArgumentParser(description='Build a deterministic Firefox extension ZIP.')
	parser.add_argument(
		'--gecko-id',
		default=GECKO_ID,
		help='Stable Firefox add-on ID (default: ' + GECKO_ID + ').',
	)
	parser.add_argument(
		'--output',
		type=Path,
		help='Output ZIP path (default: dist/JoroDoxTools-<version>-firefox.zip).',
	)
	return parser.parse_args()


def validate_gecko_id(extension_id):
	if len(extension_id) > 80 or not GECKO_ID_PATTERN.fullmatch(extension_id):
		raise ValueError('Gecko ID must be an email-like ID of at most 80 characters.')


def normalize_package_content(path, content):
	if path.name == 'LICENSE' or path.suffix.lower() in TEXT_SUFFIXES:
		content = content.replace(b'\r\n', b'\n')
	return content


def read_package_file(path):
	return normalize_package_content(path, path.read_bytes())


def build_manifest(extension_id):
	manifest_path = ROOT / 'manifest.json'
	manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
	if manifest.get('manifest_version') != 3:
		raise ValueError('Firefox manifest must use Manifest V3.')
	if 'service_worker' in manifest.get('background', {}):
		raise ValueError('Firefox background must not declare a service worker.')

	gecko = manifest.setdefault('browser_specific_settings', {}).setdefault('gecko', {})
	gecko['id'] = extension_id
	manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode('utf-8')
	return manifest, manifest_bytes


class BowerReferenceParser(HTMLParser):
	def __init__(self):
		super().__init__()
		self.references = []

	def handle_starttag(self, tag, attrs):
		for name, value in attrs:
			if name in ('src', 'href') and value:
				if urlsplit(value).path.startswith('bower_components/'):
					self.references.append(value)


def bower_asset_path(reference, base_path):
	url = urlsplit(reference.strip())
	if url.scheme or not url.path:
		return None

	candidate = (base_path / unquote(url.path)).resolve()
	bower_root = (ROOT / 'bower_components').resolve()
	try:
		candidate.relative_to(bower_root)
	except ValueError:
		try:
			candidate.relative_to(ROOT)
		except ValueError:
			raise ValueError('Asset reference escapes the repository: ' + reference)
		if not candidate.is_file():
			raise FileNotFoundError('Referenced runtime asset is missing: ' + reference)
		return None
	if not candidate.is_file():
		raise FileNotFoundError('Referenced Bower asset is missing: ' + reference)
	return candidate


def collect_bower_files(html_paths, css_paths):
	references = []
	for html_path in html_paths:
		parser = BowerReferenceParser()
		parser.feed(html_path.read_text(encoding='utf-8'))
		references.extend((ROOT, reference) for reference in parser.references)

	for css_path in css_paths:
		css = css_path.read_text(encoding='utf-8')
		references.extend((css_path.parent, match.group(2)) for match in CSS_URL_PATTERN.finditer(css))
		references.extend((css_path.parent, match.group(2)) for match in CSS_IMPORT_PATTERN.finditer(css))

	files = {}
	pending = list(references)
	while pending:
		base_path, reference = pending.pop()
		asset_path = bower_asset_path(reference, base_path)
		if asset_path is None:
			continue
		relative_path = asset_path.relative_to(ROOT).as_posix()
		if relative_path in files:
			continue
		content = read_package_file(asset_path)
		files[relative_path] = content
		if asset_path.suffix.lower() == '.css':
			css = content.decode('utf-8')
			pending.extend(
				(asset_path.parent, match.group(2))
				for match in CSS_URL_PATTERN.finditer(css)
			)
			pending.extend(
				(asset_path.parent, match.group(2))
				for match in CSS_IMPORT_PATTERN.finditer(css)
			)
	return files


def collect_package_files():
	files = {}
	for relative_path in RUNTIME_FILES:
		path = ROOT / relative_path
		if not path.is_file():
			raise FileNotFoundError('Required package input is missing: ' + relative_path)
		files[relative_path] = read_package_file(path)

	for path in sorted(ROOT.glob('content*.html')):
		files[path.relative_to(ROOT).as_posix()] = read_package_file(path)

	html_paths = [ROOT / name for name in RUNTIME_FILES if name.endswith('.html')]
	html_paths.extend(sorted(ROOT.glob('content*.html')))
	css_paths = []
	for directory in RUNTIME_DIRECTORIES:
		root = ROOT / directory
		if not root.is_dir():
			raise FileNotFoundError('Required runtime directory is missing: ' + directory)
		for path in sorted(root.rglob('*')):
			if path.is_file():
				files[path.relative_to(ROOT).as_posix()] = read_package_file(path)
				if path.suffix.lower() == '.css':
					css_paths.append(path)

	files.update(collect_bower_files(html_paths, css_paths))
	return files


def make_zip(output_path, files):
	output_path.parent.mkdir(parents=True, exist_ok=True)
	temporary_path = None
	try:
		with tempfile.NamedTemporaryFile(
			prefix=output_path.name + '.',
			suffix='.tmp',
			dir=output_path.parent,
			delete=False,
		) as temporary_file:
			temporary_path = Path(temporary_file.name)

		with zipfile.ZipFile(temporary_path, mode='w', compression=zipfile.ZIP_STORED) as archive:
			for name in sorted(files):
				entry = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
				entry.create_system = 3
				entry.external_attr = 0o100644 << 16
				entry.compress_type = zipfile.ZIP_STORED
				archive.writestr(entry, files[name])

		with zipfile.ZipFile(temporary_path, mode='r') as archive:
			if archive.testzip() is not None:
				raise ValueError('Generated package failed ZIP integrity verification.')
			if 'manifest.json' not in archive.namelist():
				raise ValueError('Generated package is missing manifest.json.')
		os.replace(temporary_path, output_path)
	finally:
		if temporary_path and temporary_path.exists():
			temporary_path.unlink()


def main():
	args = parse_args()
	validate_gecko_id(args.gecko_id)
	manifest, manifest_bytes = build_manifest(args.gecko_id)
	files = collect_package_files()
	files['manifest.json'] = manifest_bytes

	output_path = args.output
	if output_path is None:
		output_path = ROOT / 'dist' / ('JoroDoxTools-' + manifest['version'] + '-firefox.zip')
	elif not output_path.is_absolute():
		output_path = ROOT / output_path

	make_zip(output_path, files)
	digest = hashlib.sha256(output_path.read_bytes()).hexdigest()
	print('Built:', output_path)
	print('Files:', len(files))
	print('SHA-256:', digest)


if __name__ == '__main__':
	main()
