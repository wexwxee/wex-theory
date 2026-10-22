"""
Theory Test 1 — exam-style wording (free mode).

Rewrites every question + answer to match the tone of the real Danish
driving theory test taken in English. Uses glossary terms from the
official Færdselsstyrelsen dictionary AND standard Danish exam phrasings
observed on dtp.fstyr.dk (the official practice player).

Core patterns reused throughout:
  - Questions usually end with "How will you continue?" / "How do you
    proceed?" / "What must you be particularly mindful of here?"
  - Answers always start with "I ..." (mirrors Danish "Jeg ...")
  - "I continue at an unchanged speed"   (Jeg fortsætter med uændret hastighed)
  - "I hold back for ..."                (Jeg holder tilbage for ...)
  - "I am particularly mindful of ..."   (Jeg er særligt opmærksom på ...)
  - "I have a duty to ..."               (Jeg har pligt til ...)
  - "I am permitted to ..."              (Jeg må ...)
  - "vehicle in front" / "roadway" / "bicyclist" / "bicycle path" /
    "crosswalk" / "oncoming traffic" / "traffic light-controlled
    intersection" / "high beam" / "low-beam headlights" / "solid side line"

Run:
    python scripts/apply_test1_exam_style.py
"""
from __future__ import annotations

from _exam_style_common import apply_rewrites

TEST_ID = 1

REWRITES: dict[int, dict] = {
    1: {
        "q": "You are to turn right at the traffic light-controlled intersection. There are no road users directly behind you. How do you proceed?",
        "answers": {
            1: "I stay in my own traffic lane all the way up to the crosswalk.",
            2: "I pull into the bus lane and remain in it all the way up to the crosswalk.",
            3: "I cross the bus lane and position myself close to the kerb in front of the bicycle path.",
        },
    },
    2: {
        "q": "You are driving at the maximum permitted speed. What must you be particularly mindful of in this situation?",
        "answers": {
            4: "I am particularly mindful that the motorway is coming to an end.",
            5: "I am particularly mindful that the expressway is coming to an end.",
            6: "I am particularly mindful that driving a passenger car here is prohibited.",
            7: "I continue at a maximum of 80 km/h after passing the traffic sign.",
        },
    },
    3: {
        "q": "You are to turn right here. There are no bicyclists on the bicycle path behind you. How do you proceed?",
        "answers": {
            8: "I turn right immediately.",
            9: "I give a flashing light signal with my high-beam headlights.",
            10: "I hold back for the oncoming bicyclist before turning.",
            11: "I am particularly mindful that I am about to cross a double-lane bicycle path.",
        },
    },
    4: {
        "q": "You are driving at approximately 50 km/h, the same as the vehicle in front. How will you continue?",
        "answers": {
            12: "I continue at an unchanged speed of approximately 50 km/h.",
            13: "I increase my safety distance to the vehicle in front.",
            14: "I am particularly mindful of the condition of the roadway.",
        },
    },
    5: {
        "q": "According to the legal provisions, what must you be particularly mindful of in this situation?",
        "answers": {
            15: "I am particularly mindful of the danger of animals on the roadway.",
            16: "I am particularly mindful that overtaking is prohibited here.",
            17: "I am particularly mindful of a rider on the roadway ahead.",
            18: "I am particularly mindful of the shape of the road ahead.",
        },
    },
    6: {
        "q": "You are to turn left here at the intersection. How will you continue?",
        "answers": {
            19: "I am particularly mindful of the oncoming traffic.",
            20: "I proceed forward to the centre of the intersection.",
            21: "I turn left immediately.",
            22: "I hold back for any oncoming traffic.",
        },
    },
    7: {
        "q": "Which lights are you required to drive with here according to the legal provisions?",
        "answers": {
            23: "I drive without any lights.",
            24: "I drive with position lights and indicators.",
            25: "I drive with low-beam headlights or high beam.",
            26: "I drive with automatic daytime driving lights.",
        },
    },
    8: {
        "q": "You are stationary and are about to set off from the kerb. How do you proceed?",
        "answers": {
            27: "I set off immediately.",
            28: "I am particularly mindful of the oncoming traffic.",
            29: "I turn my head and check that the roadway is clear behind me.",
            30: "I hold back for a while before setting off.",
        },
    },
    9: {
        "q": "You are to continue straight ahead. There are no road users behind you. How will you continue?",
        "answers": {
            31: "I drive around the truck once the oncoming traffic has passed.",
            32: "I hold back until the truck has unloaded and driven off.",
            33: "I find another route that is not obstructed.",
        },
    },
    10: {
        "q": "You are driving at approximately 50 km/h. How will you continue?",
        "answers": {
            34: "I continue at an unchanged speed of approximately 50 km/h.",
            35: "I am particularly mindful of reduced traction ahead.",
            36: "I move my foot over to the brake pedal.",
        },
    },
    11: {
        "q": "You have caught up with two caravans that are driving slowly ahead of you. There are no road users behind you. How will you continue?",
        "answers": {
            37: "I overtake both caravans immediately.",
            38: "I overtake the nearest caravan and pull in in front of it.",
            39: "I reduce my speed.",
            40: "I pull over to the right side of the traffic lane.",
        },
    },
    12: {
        "q": "You have caught up with the vehicle in front, which is driving slowly. There are no road users behind you. How will you continue?",
        "answers": {
            41: "I overtake the vehicle in front.",
            42: "I move my foot over to the brake pedal.",
            43: "I am particularly mindful of the shape of the road ahead.",
        },
    },
    13: {
        "q": "You are stationary and are about to set off from the kerb. How do you proceed?",
        "answers": {
            44: "I set off immediately.",
            45: "I am particularly mindful of the black passenger car that has just passed.",
            46: "I turn my head to check what is happening behind me.",
            47: "I remain stationary for a while longer.",
        },
    },
    14: {
        "q": "You are driving at 50 km/h in a built-up area and are about to overtake the grey passenger car driving slowly ahead of you. How will you continue?",
        "answers": {
            48: "I increase my speed and overtake the passenger car.",
            49: "I continue at an unchanged speed of 50 km/h and overtake the passenger car.",
            50: "I reduce my speed and abandon the overtaking manoeuvre.",
            51: "I pull in behind the grey passenger car I was about to overtake.",
        },
    },
    15: {
        "q": "You are driving at approximately 70 km/h. How will you continue?",
        "answers": {
            52: "I continue at an unchanged speed between 60 and 70 km/h.",
            53: "I move out to the solid side line on the right-hand side of the roadway.",
            54: "I cross over the solid side line on the right-hand side of the roadway.",
        },
    },
    16: {
        "q": "You are driving at approximately 40 km/h. How will you continue?",
        "answers": {
            55: "I continue at an unchanged speed of approximately 40 km/h.",
            56: "I increase my speed.",
            57: "I stop before the crosswalk.",
        },
    },
    17: {
        "q": "You are driving at approximately 40 km/h. How will you continue?",
        "answers": {
            58: "I continue at an unchanged speed of approximately 40 km/h.",
            59: "I give a flashing light signal with my high-beam headlights.",
            60: "I pull over as far as possible to the right of the roadway.",
            61: "I apply my service brake.",
        },
    },
    18: {
        "q": "You are driving at approximately 40 km/h and are required to continue straight ahead. How will you continue?",
        "answers": {
            62: "I continue at an unchanged speed of approximately 40 km/h.",
            63: "I increase my speed.",
            64: "I brake firmly.",
        },
    },
    19: {
        "q": "You are driving at approximately 50 km/h. How will you continue?",
        "answers": {
            65: "I continue at an unchanged speed of approximately 50 km/h.",
            66: "I reduce my speed.",
            67: "I pull further over to the right of the roadway.",
        },
    },
    20: {
        "q": "You are driving on a one-way road and are about to catch up with the truck driving slowly ahead of you. How will you continue?",
        "answers": {
            68: "I overtake the truck on its right side.",
            69: "I remain behind the truck.",
            70: "I am particularly mindful of the shape of the road ahead.",
            71: "I prepare to change to the far left lane.",
        },
    },
    21: {
        "q": "You wish to overtake the slow-moving tractor, but there has been oncoming traffic the entire way. There are no road users behind you. How do you proceed?",
        "answers": {
            72: "I am particularly mindful of the oncoming traffic.",
            73: "I overtake the tractor since there are no road users behind me.",
            74: "I remain behind the tractor.",
        },
    },
    22: {
        "q": "What does the hand signal given by the police officer mean for you?",
        "answers": {
            75: "I am permitted to drive straight through the intersection.",
            76: "I have a duty to stop.",
            77: "I am permitted to turn left at the intersection.",
            78: "I am permitted to turn right at the intersection.",
        },
    },
    23: {
        "q": "What must you be particularly mindful of in this situation?",
        "answers": {
            79: "I am particularly mindful of the shape of the road.",
            80: "I am particularly mindful of the surroundings of the road.",
            81: "I am particularly mindful of a slippery roadway ahead.",
        },
    },
    24: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            82: "I am permitted to park the passenger car here.",
            83: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
        },
    },
    25: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            84: "I am permitted to park the passenger car here.",
            85: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            86: "I am not permitted to either stop or park here.",
        },
    },
}


if __name__ == "__main__":
    apply_rewrites(TEST_ID, REWRITES)
