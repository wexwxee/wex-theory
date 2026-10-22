"""Theory Test 4 — exam-style wording (free mode)."""
from __future__ import annotations

from _exam_style_common import apply_rewrites

TEST_ID = 4

REWRITES: dict[int, dict] = {
    76: {
        "q": "You are in a hurry and driving at 70 km/h. How will you continue?",
        "answers": {
            273: "I continue at an unchanged speed of approximately 70 km/h.",
            274: "I increase my speed to approximately 80 km/h.",
            275: "I reduce my speed to a maximum of 60 km/h.",
            276: "I reduce my speed to a maximum of 50 km/h.",
        },
    },
    77: {
        "q": "You are driving at approximately 40 km/h, the same as the oncoming traffic. How will you continue?",
        "answers": {
            277: "I continue at an unchanged speed of approximately 40 km/h.",
            278: "I pull over as far as possible to the right of the roadway.",
            279: "I apply my service brake.",
            280: "I give a flashing light signal with my high-beam headlights or a short horn signal.",
        },
    },
    78: {
        "q": "You are driving at 30 to 40 km/h and are required to continue straight ahead on the road. How do you proceed?",
        "answers": {
            281: "I continue at an unchanged speed between 30 and 40 km/h.",
            282: "I give a signal with the horn or a flashing light signal with my high-beam headlights.",
            283: "I apply my service brake.",
        },
    },
    79: {
        "q": "You are driving at approximately 50 km/h when the oncoming passenger car suddenly appears. How will you continue?",
        "answers": {
            284: "I pull over to the left side of the traffic lane.",
            285: "I brake hard.",
            286: "I brake gently.",
            287: "I hold back for the oncoming traffic.",
        },
    },
    80: {
        "q": "You are driving at approximately 80 km/h. How will you continue?",
        "answers": {
            288: "I continue at an unchanged speed of approximately 80 km/h.",
            289: "I reduce my speed.",
            290: "I am particularly mindful of the traffic signs.",
            291: "I am particularly mindful of the shape of the road ahead.",
        },
    },
    81: {
        "q": "Which legal provisions apply to the use of the emergency telephone on a motorway?",
        "answers": {
            292: "The emergency telephone is permitted to be used for particularly important messages to family members or to the workplace.",
            293: "The emergency telephone is permitted to be used only to call for assistance, for example in the event of a crash or similar incident.",
            294: "The emergency telephone is permitted to be used if my own mobile phone is not working.",
            295: "When I use the emergency telephone lawfully, I have a duty to stop the passenger car outside the traffic lane wherever possible.",
        },
    },
    82: {
        "q": "You have reduced your speed to approximately 30 km/h in order to turn right at the intersection. There are no road users behind you. How will you continue?",
        "answers": {
            296: "I am particularly mindful of the road condition in the traffic lane.",
            297: "I turn right at an unchanged speed of approximately 30 km/h.",
            298: "I am particularly mindful of the reduced traction.",
            299: "I reduce my speed further before turning right.",
        },
    },
    83: {
        "q": "You are driving at approximately 40 km/h. How will you continue?",
        "answers": {
            300: "I am particularly mindful of the pedestrian.",
            301: "I continue at an unchanged speed of approximately 40 km/h.",
            302: "I warn the pedestrian with a short horn signal.",
            303: "I stop before the crosswalk.",
        },
    },
    84: {
        "q": "You are driving at approximately 80 km/h. How will you continue?",
        "answers": {
            304: "I continue at an unchanged speed of approximately 80 km/h.",
            305: "I reduce my speed.",
            306: "I am particularly mindful of wild animals.",
            307: "I am particularly mindful of horseback riders.",
        },
    },
    85: {
        "q": "You are driving on the right-hand side of a road with one-way traffic. What must you be particularly mindful of a bit further ahead?",
        "answers": {
            308: "Oncoming traffic may appear.",
            309: "I hold back for the oncoming traffic.",
            310: "The oncoming traffic has a duty to hold back for me.",
            311: "I am particularly mindful of the oncoming traffic.",
        },
    },
    86: {
        "q": "You are driving at approximately 40 km/h and are required to pass the stationary vehicle. There are no road users behind you. How will you continue?",
        "answers": {
            312: "I continue at an unchanged speed of approximately 40 km/h.",
            313: "I drive past the stationary vehicle immediately.",
            314: "I apply my service brake.",
            315: "I hold back for the bicyclists.",
        },
    },
    87: {
        "q": "You are required to continue straight ahead on the road, which contains a bend. The two passenger cars are parked at the roadside. How will you continue?",
        "answers": {
            316: "I drive past the two passenger cars immediately.",
            317: "I drive in between the two passenger cars and make space for the oncoming traffic.",
            318: "I stop before the two passenger cars and hold back for the oncoming traffic.",
        },
    },
    88: {
        "q": "You are driving at approximately 50 km/h. There are no road users behind you. How will you continue?",
        "answers": {
            319: "I continue at an unchanged speed of approximately 50 km/h.",
            320: "I overtake the bicyclist.",
            321: "I reduce my speed.",
            322: "I remain behind the bicyclist for the time being.",
        },
    },
    89: {
        "q": "You have caught up with the two passenger cars with caravans that are driving slowly. There are no road users behind you. How will you continue?",
        "answers": {
            323: "I overtake both caravans immediately.",
            324: "I overtake the first caravan and pull in in front of it.",
            325: "I remain behind both caravans and wait before overtaking.",
            326: "I pull over as far as possible to the right of the roadway.",
        },
    },
    90: {
        "q": "You are required to continue straight ahead through the intersection. How will you continue?",
        "answers": {
            327: "I am particularly mindful of the pedestrian.",
            328: "I give a signal with the horn or a flashing light signal with my high-beam headlights.",
            329: "I increase my speed slightly.",
            330: "I brake and hold back for the pedestrian.",
        },
    },
    91: {
        "q": "You intend to turn right onto the side road. The lane on the right is clear. How do you proceed?",
        "answers": {
            331: "I count on the bicyclist holding back for me.",
            332: "I turn right immediately.",
            333: "I hold back for the bicyclist.",
        },
    },
    92: {
        "q": "You intend to turn left here. There are no road users approaching from the right. How will you continue?",
        "answers": {
            334: "I increase my speed.",
            335: "I turn left immediately.",
            336: "I hold back for the tractor approaching from the left.",
        },
    },
    93: {
        "q": "You are driving at approximately 30 to 40 km/h and are required to continue straight ahead through the intersection. How will you continue?",
        "answers": {
            337: "I am particularly mindful of whether the grey passenger car is holding back for me.",
            338: "I continue across the intersection at an unchanged speed between 30 and 40 km/h.",
            339: "I move my foot over to the brake pedal.",
            340: "I am ready to hold back for vehicles approaching from the right side of the intersection.",
        },
    },
    94: {
        "q": "You intend to turn right at this intersection. The lane on the left is clear and there are no bicyclists behind you. How will you continue?",
        "answers": {
            341: "I am particularly mindful of the bicyclist approaching from the right.",
            342: "I warn the bicyclist with a short horn signal or a flashing light signal with my high-beam headlights.",
            343: "I turn right immediately.",
            344: "I hold back for the bicyclist approaching from the right.",
        },
    },
    95: {
        "q": "You are required to continue straight ahead through the intersection. There are no bicyclists behind you. How will you continue?",
        "answers": {
            345: "I drive up to the stopline and stop.",
            346: "I drive forward to the passenger car at the intersection and wait behind it.",
            347: "I overtake the passenger car at the intersection on the right, going around it.",
        },
    },
    96: {
        "q": "According to the statutory requirements, what is the maximum permitted length of a vehicle with its load?",
        "answers": {
            348: "A maximum length of 10 metres.",
            349: "A maximum length of 12 metres.",
            350: "A maximum length of 15 metres.",
        },
    },
    97: {
        "q": "You have stepped out of the passenger car here. According to the legal provisions on stopping and parking, which of the following applies here on a Saturday morning at 7 a.m.?",
        "answers": {
            351: "I am permitted to park the passenger car here for one hour.",
            352: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
        },
    },
    98: {
        "q": "The passenger car in front of you is driving so slowly that the truck overtakes it. How do you proceed?",
        "answers": {
            353: "I am particularly mindful of the shape of the road ahead.",
            354: "I give a flashing light signal with my high-beam headlights.",
            355: "I remain behind the passenger car.",
            356: "I follow the truck and overtake together with it.",
        },
    },
    99: {
        "q": "What does the hand signal given by the police officer mean for you?",
        "answers": {
            357: "I am permitted to drive straight through the intersection.",
            358: "I have a duty to turn right at the intersection immediately.",
            359: "I have a duty to turn left at the intersection immediately.",
            360: "I have a duty to stop.",
        },
    },
    100: {
        "q": "You have stepped out of the passenger car here. According to the legal provisions, which of the following applies here?",
        "answers": {
            361: "I am permitted to park the passenger car here.",
            362: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            363: "Stopping and parking are both prohibited here.",
        },
    },
}

if __name__ == "__main__":
    apply_rewrites(TEST_ID, REWRITES)
