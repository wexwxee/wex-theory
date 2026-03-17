from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
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

    # Stripe subscription fields
    stripe_customer_id     = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status    = Column(String, default="free")   # free/active/past_due/canceled/incomplete
    current_period_end     = Column(DateTime, nullable=True)

    attempts = relationship("UserTestAttempt", back_populates="user")


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
    explanation = Column(Text, default="")
    image_path = Column(String, default="")

    test = relationship("Test", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
    user_answers = relationship("UserAnswer", back_populates="question")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)

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


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("Question")
