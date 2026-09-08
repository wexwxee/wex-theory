"""Read-only environment checks; no imports of the app, database writes or mail."""
import os
from urllib.parse import urlsplit


def check_environment(env):
    errors = []
    for name in ('DATABASE_URL', 'SECRET_KEY', 'BASE_URL', 'RESEND_API_KEY', 'PRIMARY_SUPER_ADMIN_EMAIL'):
        if not str(env.get(name, '')).strip():
            errors.append(f'{name}: missing')
    database = str(env.get('DATABASE_URL', ''))
    if database and not database.startswith(('postgres://', 'postgresql://', 'postgresql+psycopg2://')):
        errors.append('DATABASE_URL: production requires PostgreSQL')
    base = urlsplit(str(env.get('BASE_URL', '')))
    if base.scheme != 'https' or not base.hostname or base.hostname in ('localhost', '127.0.0.1', '::1') or base.username or base.query or base.fragment or base.path not in ('', '/'):
        errors.append('BASE_URL: use the public HTTPS origin without credentials, path or query')
    if len(str(env.get('SECRET_KEY', ''))) < 32:
        errors.append('SECRET_KEY: use a persistent random value of at least 32 characters')
    for name in ('COOKIE_SECURE', 'SESSION_COOKIE_SECURE'):
        if str(env.get(name, '')).lower() not in ('true', '1', 'yes', 'on'):
            errors.append(f'{name}: must be true for HTTPS production')
    return errors


if __name__ == '__main__':
    problems = check_environment(os.environ)
    for problem in problems:
        print('FAIL ' + problem)
    if not problems:
        print('PASS required environment settings (values hidden)')
    print('External checks still required: verified Resend sender mail.wextheory.cv, delivery, persistent database and restore test.')
    raise SystemExit(bool(problems))
