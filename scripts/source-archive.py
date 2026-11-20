#!/usr/bin/env python3
"""Deterministic full source archive, including lockfile and offline tests."""
import gzip
import hashlib
import pathlib
import tarfile
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
output = root / 'mintropolis-random-picker-source-v1.tar.gz'
files = [root / name for name in ('.gitignore', 'package.json', 'package-lock.json', 'README.md', 'PROTOCOL.md', 'LICENSE')]
for directory in ('src', 'test', 'scripts', '.github', 'docs'):
    files.extend(path for path in (root / directory).rglob('*') if path.is_file() and '__pycache__' not in path.parts)

with output.open('wb') as raw:
    with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for path in sorted(files, key=lambda p: p.relative_to(root).as_posix()):
                info = archive.gettarinfo(str(path), 'mintropolis-random-picker/' + path.relative_to(root).as_posix())
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                info.mtime = 0
                info.mode = 0o755 if path.name == 'cli.mjs' else 0o644
                info.pax_headers = {}
                with path.open('rb') as data:
                    archive.addfile(info, data)
print(f'{hashlib.sha256(output.read_bytes()).hexdigest()}  {output.name}')
zip_output = root / 'random-picker-source-v1.zip'
with zipfile.ZipFile(zip_output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(files, key=lambda p: p.relative_to(root).as_posix()):
        name = 'mintropolis-random-picker/' + path.relative_to(root).as_posix()
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (0o100755 if path.name == 'cli.mjs' else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
print(f'{hashlib.sha256(zip_output.read_bytes()).hexdigest()}  {zip_output.name}')
