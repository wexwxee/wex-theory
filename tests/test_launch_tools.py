import sqlite3
from contextlib import closing
import tempfile
from pathlib import Path

from scripts.backup_local import backup
from scripts.check_launch import check_environment


def test_production_settings_require_mail_and_public_https():
    env = dict(DATABASE_URL='postgresql://example/db', SECRET_KEY='x' * 48,
               BASE_URL='https://example.com', RESEND_API_KEY='test-only',
               PRIMARY_SUPER_ADMIN_EMAIL='admin@example.com', COOKIE_SECURE='true',
               SESSION_COOKIE_SECURE='true')
    assert check_environment(env) == []
    env['BASE_URL'] = 'http://localhost:8010'
    env['RESEND_API_KEY'] = ''
    env['DATABASE_URL'] = 'sqlite:///local.db'
    errors = check_environment(env)
    assert any('BASE_URL' in error for error in errors)
    assert any('RESEND_API_KEY' in error for error in errors)
    assert any('PostgreSQL' in error for error in errors)


def test_snapshot_can_be_restored_and_never_overwrites_source():
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / 'source.db'
        target = Path(directory) / 'backup.db'
        with closing(sqlite3.connect(source)) as db:
            db.execute('CREATE TABLE sample (value TEXT)')
            db.execute("INSERT INTO sample VALUES ('saved progress')")
            db.commit()
        backup(source, target)
        with closing(sqlite3.connect(target)) as restored:
            assert restored.execute('SELECT value FROM sample').fetchone()[0] == 'saved progress'
        for existing in (source, target):
            try:
                backup(source, existing)
            except FileExistsError:
                pass
            else:
                raise AssertionError('Existing database was overwritten')
