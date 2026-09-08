"""Consistent SQLite snapshot of the local preview; never overwrites a backup."""
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


def backup(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file():
        raise FileNotFoundError('Source database does not exist')
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also prevents accidentally overwriting the source.
    with destination.open('xb'):
        pass
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
        with closing(sqlite3.connect(destination)) as snapshot:
            original.backup(snapshot)
            if snapshot.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')
    return destination


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    result = backup(root / '.local/preview.db', root / '.local/backups' / f'preview-{stamp}.db')
    print(f'Backup verified: {result}')
