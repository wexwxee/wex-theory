import re


def extract_tags(text: str) -> list[str]:
    return re.findall(r"#[\wЀ-ӿ]+", text)


def strip_tags(text: str) -> str:
    return re.sub(r"#[\wЀ-ӿ]+", "", text).strip()


def detect_done_intent(text: str) -> bool:
    patterns = [
        r"\bсделал\b",
        r"\bвыполнил\b",
        r"\bготово\b",
        r"\bзакрыть\b",
        r"\bзакрой\b",
    ]
    lower = text.lower()
    return any(re.search(p, lower) for p in patterns)
