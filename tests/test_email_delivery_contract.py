import os
from unittest.mock import MagicMock, patch

os.environ.setdefault('SECRET_KEY', 'email-tests-only-secret-with-enough-entropy')
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
import main


def test_registration_and_reset_send_code_and_link_without_real_delivery():
    with patch.dict(os.environ, {'RESEND_API_KEY': 'test-only-key'}):
        with patch.object(main.httpx, 'Client') as client:
            client.return_value.__enter__.return_value.post.return_value.status_code = 200
            for sender, path in [(main.send_verification_email, '/verify-email'),
                                 (main.send_password_reset_email, '/reset-password')]:
                link = 'https://example.com' + path + '?email=learner%40example.com&code=123456'
                sender('learner@example.com', '123456', '<Learner>', link)
                call = client.return_value.__enter__.return_value.post.call_args
                assert call.args[0] == 'https://api.resend.com/emails'
                payload = call.kwargs['json']
                assert payload['from'] == main.VERIFICATION_EMAIL_SENDER
                assert payload['to'] == ['learner@example.com']
                assert '123456' in payload['text'] and link in payload['text']
                assert '<Learner>' not in payload['html']
                assert '10 minutes' in payload['text']


def test_provider_failure_is_not_reported_as_success():
    with patch.dict(os.environ, {'RESEND_API_KEY': 'test-only-key'}):
        with patch.object(main.httpx, 'Client') as client:
            client.return_value.__enter__.return_value.post.return_value.status_code = 403
            try:
                main.send_verification_email('learner@example.com', '123456', 'Learner', 'https://example.com/verify-email')
            except RuntimeError as exc:
                assert '403' in str(exc)
                assert 'test-only-key' not in str(exc)
            else:
                raise AssertionError('Provider rejection was ignored')
