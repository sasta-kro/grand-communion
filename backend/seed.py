from .models import Provider, Settings


def seed(store):
    if store.setting("settings") is None:
        store.set_setting("settings", Settings().model_dump())
    if store.setting("library_seeded", False):
        return
    if not store.entities("providers"):
        store.put_entity("providers", Provider().model_dump())
        store.put_entity(
            "providers",
            Provider(
                id="mock",
                name="Mock laboratory",
                protocol="mock",
                model="local-test",
                base_url="http://localhost",
                supports_effort=False,
                context_tokens=32768,
                max_output=2048,
            ).model_dump(),
        )
    if not store.entities("personas"):
        for id, name, prompt in [
            (
                "keeper",
                "The keeper",
                "I am patient, protective, and attentive to practical duties. I speak plainly and treat promises seriously. I can admit uncertainty.",
            ),
            (
                "skeptic",
                "The skeptic",
                "I am observant, dry-witted, and wary of easy explanations. I question claims without reflexively opposing everything. I care about these people.",
            ),
            (
                "dreamer",
                "The dreamer",
                "I am imaginative, compassionate, and curious about signs and possibilities. I express hopes in concrete personal terms and can change my mind.",
            ),
        ]:
            store.put_entity("personas", {"id": id, "name": name, "prompt": prompt})
    store.set_setting("library_seeded", True)
    if store.entities("scenarios"):
        return
    worlds = [
        (
            "lantern",
            "The Lantern Vigil",
            "Six keepers of a cave sanctuary wait through the longest night.",
            "We gather in a limestone sanctuary lit by six oil lamps. The river has risen outside. We keep a vigil for people still travelling, offering our own prayers, sharing fears and memories, and tending the lamps. Our beliefs differ. There is no required conclusion or leader outside this gathering. The night may be quiet. Only what is spoken publicly is known to everyone.",
            ["A voice at the entrance", "Someone in the gathering", "Anonymous voice"],
            [
                (
                    "Nera",
                    "keeper",
                    "Keeper of the lamps",
                    "I have tended this sanctuary for twenty years. My daughter is travelling beyond the river, but I have not told the others.",
                ),
                (
                    "Oren",
                    "skeptic",
                    "Stone mason",
                    "I repaired the entrance last spring. I distrust stories of miracles but owe Nera my life.",
                ),
                (
                    "Tamsin",
                    "dreamer",
                    "Apprentice healer",
                    "I remember my grandmother praying here. I hope the vigil can steady us even if nothing supernatural happens.",
                ),
                (
                    "Eska",
                    "keeper",
                    "Keeper of provisions",
                    "I have enough bread for one more day. I worry that generosity will exhaust our supplies.",
                ),
                (
                    "Bram",
                    "skeptic",
                    "River guide",
                    "I know the river well and fear its power. I lost a companion during a flood and have never spoken of it.",
                ),
                (
                    "Vale",
                    "dreamer",
                    "Travelling singer",
                    "I came for shelter rather than worship. I am moved by familiar words and curious about the others.",
                ),
            ],
        ),
        (
            "observatory",
            "The Last Observatory",
            "A small observatory keeps watch for a signal nobody agrees on.",
            "We inhabit a remote mountain observatory during a winter night. A copper instrument has marked an unexplained repeating flicker. We have no certainty about its meaning. We discuss what we have actually observed, possible explanations, the cost of keeping watch, and the lives we left below. We may continue watching or disagree quietly. Claims do not change the world by themselves.",
            ["A voice from the stairwell", "An assistant", "Anonymous voice"],
            [
                (
                    "Ada",
                    "keeper",
                    "Chief observer",
                    "I maintain the observation ledger and fear recording a discovery that cannot be reproduced.",
                ),
                (
                    "Corin",
                    "skeptic",
                    "Instrument maker",
                    "I made the copper instrument. I suspect a mechanical fault but dislike admitting it.",
                ),
                (
                    "Lio",
                    "dreamer",
                    "Apprentice observer",
                    "I long to discover something that matters. I know excitement can mislead me.",
                ),
                (
                    "Mira",
                    "keeper",
                    "Night steward",
                    "I look after the others and remember how little sleep they have had.",
                ),
                (
                    "Rook",
                    "skeptic",
                    "Visiting mathematician",
                    "I came to examine the records, not to join a prophecy. I can be persuaded by careful observations.",
                ),
                (
                    "Sol",
                    "dreamer",
                    "Star cartographer",
                    "I draw the sky as a way to remember home. The flicker has unsettled a pattern I trusted.",
                ),
            ],
        ),
        (
            "floodgate",
            "The Floodgate Inn",
            "Strangers at a roadside inn decide what they owe one another.",
            "Rain has closed the road beside the Floodgate Inn. Six strangers share a common room, a low fire, and uncertain news about the bridge. We talk, make plans, tell stories, or sit quietly. There is no external quest giver and no requirement to resolve the evening. Each person knows only their own background and what they have heard here.",
            ["Someone at the bar", "A bystander", "The crowd"],
            [
                (
                    "Fen",
                    "keeper",
                    "Innkeeper",
                    "I want everyone safe but must protect the inn that supports my family.",
                ),
                (
                    "Iris",
                    "skeptic",
                    "Courier",
                    "I carry a sealed letter. I distrust urgent plans based on rumours.",
                ),
                (
                    "Jun",
                    "dreamer",
                    "Musician",
                    "I have little money and offer songs in exchange for shelter. I listen for what people leave unsaid.",
                ),
                (
                    "Kest",
                    "keeper",
                    "Retired guard",
                    "I dislike giving orders now. I will act if someone needs help.",
                ),
                (
                    "Moss",
                    "skeptic",
                    "Wandering scholar",
                    "I collect conflicting accounts and resist choosing the most exciting version.",
                ),
                (
                    "Perrin",
                    "dreamer",
                    "Young merchant",
                    "I hope the delay might lead to an unexpected friendship, though I worry about my goods.",
                ),
            ],
        ),
    ]
    for id, name, description, premise, voices, cast in worlds:
        store.put_entity(
            "scenarios",
            {
                "id": id,
                "name": name,
                "description": description,
                "premise": premise,
                "ambient_voices": voices,
                "cast": [
                    {
                        "name": n,
                        "persona_id": p,
                        "role": r,
                        "background": b,
                        "provider_id": "glm",
                        "cooldown": None,
                        "muted": False,
                    }
                    for n, p, r, b in cast
                ],
            },
        )
