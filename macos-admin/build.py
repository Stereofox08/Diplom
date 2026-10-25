"""Build a standalone macOS app using the existing admin assets and Apple SDK."""
from pathlib import Path
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent
default_source = root.parent if (root.parent / 'index.html').exists() else root.parent / 'site'
source = Path(sys.argv[1]) if len(sys.argv) > 1 else default_source
assert (source / 'admin.html').is_file(), 'Pass the ByteStore source directory as the first argument'
destination = root / 'dist' / 'ByteStore Admin.app'
# Sign outside cloud-synced Documents: Finder metadata can otherwise race codesign.
staging = tempfile.TemporaryDirectory(prefix='bytestore-build-', dir='/private/tmp')
app = Path(staging.name) / 'ByteStore Admin.app'
contents = app / 'Contents'
web = contents / 'Resources' / 'Web'
web.mkdir(parents=True, exist_ok=True)
(contents / 'MacOS').mkdir(exist_ok=True)
for directory in ('css', 'js'):
    shutil.copytree(source / directory, web / directory, dirs_exist_ok=True, copy_function=shutil.copyfile)
html = (source / 'admin.html').read_text()
html = html.replace('  <script src="js/app.js"></script>', '  <script src="desktop.js"></script>\n  <script src="js/app.js"></script>')
html = html.replace('</head>', '<style>a[href="index.html"]{display:none!important}</style></head>')
(web / 'admin.html').write_text(html)
shutil.copyfile(source / 'brand-icon.svg', web / 'brand-icon.svg')
shutil.copyfile(root / 'desktop.js', web / 'desktop.js')
shutil.copyfile(root / 'Assets' / 'AppIcon.icns', contents / 'Resources' / 'AppIcon.icns')
with (contents / 'Info.plist').open('wb') as file:
    plistlib.dump({
        'CFBundleExecutable': 'ByteStoreAdmin',
        'CFBundleIdentifier': 'kz.bytestore.admin',
        'CFBundleName': 'ByteStore Admin',
        'CFBundleDisplayName': 'ByteStore Admin',
        'CFBundlePackageType': 'APPL',
        'CFBundleIconFile': 'AppIcon',
        'CFBundleShortVersionString': '0.2.0',
        'CFBundleVersion': '2',
        'LSMinimumSystemVersion': '13.0',
        'NSHighResolutionCapable': True,
    }, file)
env = dict(os.environ, CLANG_MODULE_CACHE_PATH='/tmp/bytestore-clang-cache')
subprocess.run(['xcrun', 'swiftc', str(root / 'Sources' / 'main.swift'), str(root / 'Sources' / 'BrandTheme.swift'),
                '-module-cache-path', '/tmp/bytestore-swift-cache',
                '-target', 'arm64-apple-macosx13.0', '-framework', 'AppKit', '-framework', 'WebKit',
                '-o', str(contents / 'MacOS' / 'ByteStoreAdmin')], check=True, env=env)
subprocess.run(['xattr', '-cr', str(app)], check=True)
subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(app)], check=True)
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
# Archive the signed staging bundle before cloud storage adds Finder metadata.
archive = root / 'dist' / 'ByteStore-Admin-macOS.zip'
archive.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=5) as bundle:
    for file in app.rglob('*'):
        if file.is_file():
            bundle.write(file, str(Path(app.name) / file.relative_to(app)))
if destination.exists():
    shutil.rmtree(destination)
shutil.copytree(app, destination, copy_function=shutil.copyfile)
os.chmod(destination / 'Contents' / 'MacOS' / 'ByteStoreAdmin', 0o755)
subprocess.run(['xattr', '-cr', str(destination)], check=True)
staging.cleanup()
print(destination)
