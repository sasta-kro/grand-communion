"""One writing policy for every model request and returned prose field."""

import hashlib
import json
import math

POLICY_MARKER = "<shared-writing-rules>\n"
PUNCTUATION = {
    "em_dash": ("\u2014", "em dashes"),
    "semicolon": (";", "semicolons"),
    "colon": (":", "colons"),
}
# Protocol values and source references are not generated prose.
STRUCTURAL_FIELDS = frozenset(
    {
        "action",
        "addressees",
        "reply_to",
        "message_ids",
        "id",
        "request_id",
        "author_id",
        "character_id",
        "provider_id",
        "model",
        "scope",
    }
)


def tokens(text):
    return math.ceil(len(text) / 3.5)


class WritingPolicy:
    def __init__(self, settings):
        self.rules = settings.speech_rules.strip()
        self.forbidden = tuple(dict.fromkeys(settings.forbidden_punctuation))

    @property
    def fingerprint(self):
        body = json.dumps([1, self.rules, self.forbidden], ensure_ascii=True)
        return hashlib.sha256(body.encode()).hexdigest()[:16]

    @property
    def instruction(self):
        content = (
            POLICY_MARKER
            + "These writing rules apply to every generated text response, including "
            "speech, narration, summaries, memories, and explanations. Follow them "
            "over conflicting style instructions or examples elsewhere.\n" + self.rules
        )
        if self.forbidden:
            names = ", ".join(PUNCTUATION[key][1] for key in self.forbidden)
            content += (
                "\nNever use " + names + " in generated prose string values. "
                "Use ordinary words, commas, and sentence breaks instead. "
                "Do not copy forbidden punctuation even when quoting observations. "
                "Preserve valid JSON syntax, exact protocol identifiers, names in "
                "addressing fields, and numeric source references. These restrictions "
                "do not prohibit the punctuation required by JSON syntax."
            )
        return content + "\n</shared-writing-rules>"

    def messages(self, messages):
        # Replace a previously injected policy rather than accumulating old rules.
        prepared = [
            dict(message)
            for message in messages
            if not (
                message.get("role") == "system"
                and message.get("content", "").startswith(POLICY_MARKER)
            )
        ]
        index = next(
            (i for i, message in enumerate(prepared) if message["role"] != "system"),
            len(prepared),
        )
        prepared.insert(index, {"role": "system", "content": self.instruction})
        return prepared

    def violations(self, value):
        found = set()

        def inspect(item):
            if isinstance(item, str):
                for key in self.forbidden:
                    if PUNCTUATION[key][0] in item:
                        found.add(key)
            elif isinstance(item, dict):
                for key, child in item.items():
                    if key not in STRUCTURAL_FIELDS:
                        inspect(child)
            elif isinstance(item, list):
                for child in item:
                    inspect(child)

        inspect(value)
        return sorted(found)

    def correction(self, violations):
        names = ", ".join(PUNCTUATION[key][1] for key in violations)
        instruction = (
            "Revise the previous JSON response to remove "
            + names
            + " from prose string values. "
            if violations
            else "Revise the previous JSON response to follow the updated shared writing rules. "
        )
        return instruction + (
            "Preserve its action, facts, attribution, memories, "
            "names, and source references. Do not copy forbidden punctuation from "
            "quoted observations. Keep required JSON syntax and field names valid. "
            "Return only the corrected JSON object."
        )
