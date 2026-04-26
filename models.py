from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, UniqueConstraint, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_admin = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)

    # Stripe subscription fields
    stripe_customer_id     = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status    = Column(String, default="free")   # free/active/past_due/canceled/incomplete
    current_period_end     = Column(DateTime, nullable=True)

    # Referral fields
    referral_code            = Column(String, unique=True, index=True, nullable=True)
    referred_by_user_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    referral_rewards_granted = Column(Integer, nullable=False, default=0)

    # Telegram Login fields
    telegram_id             = Column(String, unique=True, index=True, nullable=True)
    telegram_username       = Column(String, nullable=True)
    telegram_phone          = Column(String, nullable=True)
    telegram_phone_verified = Column(Boolean, nullable=False, default=False)
    telegram_connected_at   = Column(DateTime, nullable=True)

    # Profile fields
    avatar_path = Column(String, nullable=True)

    attempts = relationship("UserTestAttempt", back_populates="user")
    support_threads = relationship("SupportThread", back_populates="user")
    certificates = relationship("Certificate", back_populates="user", foreign_keys="Certificate.user_id")


class UserAvatar(Base):
    __tablename__ = "user_avatars"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    content_type = Column(String, nullable=False)
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")

    questions = relationship("Question", back_populates="test", order_by="Question.question_index")
    attempts = relationship("UserTestAttempt", back_populates="test")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, index=True)
    question_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    exam_style_text = Column(Text, nullable=True)
    explanation = Column(Text, default="")
    image_path = Column(String, default="")
    question_text_ru = Column(Text, nullable=True)
    explanation_ru = Column(Text, nullable=True)

    test = relationship("Test", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
    user_answers = relationship("UserAnswer", back_populates="question")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    exam_style_text = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    text_ru = Column(Text, nullable=True)

    question = relationship("Question", back_populates="answers")


class UserTestAttempt(Base):
    __tablename__ = "user_test_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    score = Column(Integer, nullable=True)
    passed = Column(Boolean, nullable=True)
    question_order_json = Column(Text, nullable=True, default="[]")
    wording_mode = Column(String, nullable=False, default="original")

    user = relationship("User", back_populates="attempts")
    test = relationship("Test", back_populates="attempts")
    user_answers = relationship("UserAnswer", back_populates="attempt")


class UserAnswer(Base):
    __tablename__ = "user_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("user_test_attempts.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    selected_answer_ids = Column(String, default="[]")  # JSON list
    is_correct = Column(Boolean, default=False)

    attempt = relationship("UserTestAttempt", back_populates="user_answers")
    question = relationship("Question", back_populates="user_answers")


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    attachment_name = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)


class SupportThread(Base):
    __tablename__ = "support_threads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String, nullable=False, default="Support")
    status = Column(String, nullable=False, default="open")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="support_threads")
    messages = relationship("SupportMessage", back_populates="thread", order_by="SupportMessage.created_at")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("support_threads.id"), nullable=False, index=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    sender_role = Column(String, nullable=False, default="user")  # user/admin/system
    sender_name = Column(String, nullable=True)
    body = Column(Text, nullable=False, default="")
    attachment_name = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_by_user = Column(Boolean, default=False)
    read_by_admin = Column(Boolean, default=False)

    thread = relationship("SupportThread", back_populates="messages")


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    code = Column(String, nullable=False)
    purpose = Column(String, nullable=False, default="register")
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    duration_days = Column(Integer, nullable=False, default=30)
    max_uses = Column(Integer, nullable=True)
    current_uses = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("Question")


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    event_type = Column(String, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)


class WordTranslation(Base):
    __tablename__ = "word_translations"

    id = Column(Integer, primary_key=True, index=True)
    word_en = Column(String, unique=True, index=True, nullable=False)  # always lowercased
    translation_ru = Column(String, nullable=False)
    pos = Column(String, nullable=True)  # part-of-speech / hint
    is_curated = Column(Boolean, default=False)  # true = handcrafted, false = auto
    updated_at = Column(DateTime, default=datetime.utcnow)


class LiveActivitySession(Base):
    __tablename__ = "live_activity_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    tab_id = Column(String, nullable=False, index=True)
    page_path = Column(String, nullable=False, default="/")
    is_authenticated = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    serial = Column(String, unique=True, index=True, nullable=False)  # e.g. WEX-XIV-001
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    verification_hash = Column(String, nullable=False)  # HMAC-SHA256(...)[:16]
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String, nullable=True)
    total_questions = Column(Integer, nullable=False, default=350)
    total_tests = Column(Integer, nullable=False, default=14)

    user = relationship("User", back_populates="certificates", foreign_keys=[user_id])


class Referral(Base):
    __tablename__ = "referrals"
    __table_args__ = (
        UniqueConstraint("referred_id", name="uq_referrals_referred_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    referred_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="rewarded")  # rewarded / blocked
    source = Column(String, nullable=False, default="link")       # link / code
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reward_days_referrer = Column(Integer, nullable=False, default=14)
    reward_days_referred = Column(Integer, nullable=False, default=7)
    blocked_reason = Column(String, nullable=True)  # self_referral / cap_exceeded / admin_blocked / null

    referrer = relationship("User", foreign_keys=[referrer_id])
    referred = relationship("User", foreign_keys=[referred_id])
