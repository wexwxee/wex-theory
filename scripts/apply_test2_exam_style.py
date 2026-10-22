"""Theory Test 2 — exam-style wording (free mode)."""
from __future__ import annotations

from _exam_style_common import apply_rewrites

TEST_ID = 2

REWRITES: dict[int, dict] = {
    26: {
        "q": "You have caught up with the moped and there are no road users behind you. How will you continue?",
        "answers": {
            87: "I move out towards the broken line in order to overtake the moped.",
            88: "I overtake the moped immediately.",
            89: "I reduce my speed.",
            90: "I remain behind the moped for the time being.",
        },
    },
    27: {
        "q": "You are driving at approximately 40 km/h and are continuing straight ahead through the intersection. How will you continue?",
        "answers": {
            91: "I am particularly mindful of whether the moped rider is holding back.",
            92: "I continue across the intersection at an unchanged speed of approximately 40 km/h.",
            93: "I move my foot over to the brake pedal.",
            94: "I am ready to hold back for vehicles approaching from the right side of the intersection.",
        },
    },
    28: {
        "q": "You are driving at approximately 40 km/h and are continuing straight ahead through the intersection. How will you continue?",
        "answers": {
            95: "I continue at an unchanged speed of approximately 40 km/h.",
            96: "I stop before the crosswalk.",
            97: "I am particularly mindful of the traffic ahead.",
            98: "I pull over to the right side of the traffic lane.",
        },
    },
    29: {
        "q": "You are driving at approximately 50 km/h when, in the rear view mirror, you suddenly notice an emergency vehicle responding to a call. How will you continue?",
        "answers": {
            99: "I continue at an unchanged speed of approximately 50 km/h.",
            100: "I reduce my speed and keep to the left.",
            101: "I reduce my speed, stop if necessary and let the emergency vehicle pass.",
            102: "I increase my speed.",
        },
    },
    30: {
        "q": "What must you be particularly mindful of in this situation?",
        "answers": {
            103: "I am particularly mindful of the shape of the road.",
            104: "I am particularly mindful that I must change to the far left lane as soon as possible.",
            105: "I proceed in accordance with the merge rule.",
            106: "I proceed in accordance with the rule for changing traffic lanes.",
        },
    },
    31: {
        "q": "You wish to overtake the vehicle in front, which is driving slowly. How do you proceed?",
        "answers": {
            107: "I give a flashing light signal with my high-beam headlights.",
            108: "I overtake the vehicle in front.",
            109: "I move my foot over to the brake pedal.",
        },
    },
    32: {
        "q": "You are driving at approximately 50 km/h. There are no road users behind you. How will you continue?",
        "answers": {
            110: "I continue at an unchanged speed of approximately 50 km/h.",
            111: "I reduce my speed.",
            112: "I stop before the crosswalk.",
        },
    },
    33: {
        "q": "You intend to turn right at the intersection, just like the vehicle in front. It has stopped. What must you be particularly mindful of?",
        "answers": {
            113: "I have a duty to give way to all traffic at the intersection.",
            114: "I stop for traffic from both sides of the intersection.",
            115: "I have a duty to stop at the stopline before driving out into the intersection.",
            116: "If I am able to follow the vehicle in front, I am permitted to do so without stopping at the stopline.",
        },
    },
    34: {
        "q": "The passenger car on the left has stopped. You are to continue straight ahead. How will you continue?",
        "answers": {
            117: "I proceed slowly.",
            118: "I stop.",
            119: "I pull over as far as possible to the right of the roadway.",
        },
    },
    35: {
        "q": "You are driving at approximately 30 to 40 km/h, the same as the vehicle in front. How will you continue?",
        "answers": {
            120: "I continue at an unchanged speed of approximately 30 to 40 km/h.",
            121: "I am particularly mindful of the shape of the road ahead.",
            122: "I brake gently.",
        },
    },
    36: {
        "q": "You are required to continue straight ahead. How will you continue?",
        "answers": {
            123: "I am particularly mindful of the traffic sign.",
            124: "I continue slowly straight ahead on the road.",
            125: "I stop.",
            126: "I reverse or turn around and find another route.",
        },
    },
    37: {
        "q": "You have caught up with the passenger car. It is driving at approximately 50 km/h. How will you continue?",
        "answers": {
            127: "I reduce my speed.",
            128: "I give a flashing light signal with my high-beam headlights.",
            129: "I increase my speed and overtake the passenger car immediately.",
            130: "I remain behind the passenger car for the time being.",
        },
    },
    38: {
        "q": "You need to pass through this town. How will you continue?",
        "answers": {
            131: "I am particularly mindful of the traffic lights.",
            132: "I continue straight ahead into the intersection.",
            133: "I turn either right or left at the intersection.",
            134: "Entry is prohibited for motor vehicles here.",
        },
    },
    39: {
        "q": "What must you be particularly mindful of in this situation?",
        "answers": {
            135: "I have a duty to give way to all traffic.",
            136: "There is a priority to the right rule at this T-junction.",
            137: "I can count on the vehicle from the left holding back.",
            138: "I hold back for the sake of safety.",
        },
    },
    40: {
        "q": "You are driving at approximately 40 km/h and are continuing straight ahead through the intersection. How will you continue?",
        "answers": {
            139: "I count on the bicyclist holding back.",
            140: "I increase my speed.",
            141: "I hold back for the bicyclist.",
            142: "I look to see what is happening on both sides before I drive into the intersection.",
        },
    },
    41: {
        "q": "You are driving at 40 km/h and are continuing straight ahead through the intersection. How will you continue?",
        "answers": {
            143: "I continue across the intersection at an unchanged speed of approximately 40 km/h.",
            144: "I count on the bicyclist from the right side holding back for me.",
            145: "I hold back for the bicyclist.",
            146: "I look to see what is happening on both sides before I drive into the intersection.",
        },
    },
    42: {
        "q": "You are driving at approximately 40 km/h, the same as the vehicle in front. You are to continue straight ahead. How do you proceed?",
        "answers": {
            147: "I continue at an unchanged speed of approximately 40 km/h.",
            148: "I follow the vehicle in front.",
            149: "I stop before the crosswalk.",
        },
    },
    43: {
        "q": "You intend to turn right at this intersection. How will you proceed?",
        "answers": {
            150: "I hold back at the yield line if there is traffic crossing.",
            151: "I turn right if the lane is clear of traffic.",
            152: "I must turn left at this intersection instead.",
        },
    },
    44: {
        "q": "You intend to turn right here at the intersection. There are no bicyclists or pedestrians behind you on the bicycle path. How will you continue?",
        "answers": {
            153: "I follow the bicyclist who is turning.",
            154: "I am particularly mindful of the traffic lights.",
            155: "I stop before the crosswalk on the side road.",
        },
    },
    45: {
        "q": "You are driving at approximately 80 km/h and are continuing straight ahead. How will you continue?",
        "answers": {
            156: "I continue at an unchanged speed of approximately 80 km/h.",
            157: "I increase my speed from approximately 100 to 130 km/h.",
            158: "I change to the right traffic lane immediately.",
            159: "I remain in my own traffic lane for the time being.",
        },
    },
    46: {
        "q": "You are driving at approximately 80 km/h and are about to enter the motorway. How do you proceed?",
        "answers": {
            160: "I drive onto the motorway immediately.",
            161: "I turn my head to check what is happening behind me.",
            162: "I enter when the roadway behind me is clear.",
            163: "I proceed in accordance with the merge rule.",
        },
    },
    47: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            164: "I am permitted to park the passenger car here.",
            165: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            166: "Stopping is prohibited here.",
        },
    },
    48: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            167: "I am permitted to park the passenger car here.",
            168: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            169: "Stopping and parking are both prohibited on this side of the road.",
        },
    },
    49: {
        "q": "You are driving at approximately 30 km/h. How will you continue?",
        "answers": {
            170: "I continue at an unchanged speed of approximately 30 km/h.",
            171: "I move my foot over to the brake pedal.",
            172: "I pull over as far as possible to the right of the roadway.",
            173: "I warn the young children with a short horn signal.",
        },
    },
    50: {
        "q": "Which speed limit must you be particularly mindful of here?",
        "answers": {
            174: "The maximum speed limit of 50 km/h begins here.",
            175: "The maximum speed limit of 50 km/h ends here.",
            176: "The maximum speed limit of 80 km/h begins here.",
            177: "I am particularly mindful of the traffic sign.",
        },
    },
}

if __name__ == "__main__":
    apply_rewrites(TEST_ID, REWRITES)
