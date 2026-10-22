"""Theory Test 3 — exam-style wording (free mode)."""
from __future__ import annotations

from _exam_style_common import apply_rewrites

TEST_ID = 3

REWRITES: dict[int, dict] = {
    51: {
        "q": "What is the highest permitted blood alcohol concentration when you drive a vehicle?",
        "answers": {
            178: "A blood alcohol concentration of 0.2.",
            179: "A blood alcohol concentration of 0.5.",
            180: "A blood alcohol concentration of 1.2.",
            181: "A blood alcohol concentration of 2.0.",
        },
    },
    52: {
        "q": "The vehicle in front is driving at approximately 40 km/h. There are no road users behind you. How will you continue?",
        "answers": {
            182: "I am particularly mindful of the road markings on the traffic lane.",
            183: "I remain behind the vehicle in front.",
            184: "I give a flashing light signal with my high-beam headlights.",
            185: "I overtake the vehicle in front immediately.",
        },
    },
    53: {
        "q": "You are driving at 50 km/h when you enter a built-up area and are approaching a bus. How will you continue?",
        "answers": {
            186: "I continue at an unchanged speed of 50 km/h.",
            187: "I reduce my speed and hold back for the bus.",
            188: "I warn the bus driver with a short horn signal.",
            189: "I increase my speed and drive around the bus.",
        },
    },
    54: {
        "q": "You are driving at approximately 40 km/h and there are no road users behind you. How do you proceed?",
        "answers": {
            190: "I give a signal with the horn.",
            191: "I continue at an unchanged speed of approximately 40 km/h.",
            192: "I move my foot over to the brake pedal.",
            193: "I pull towards the centre of the traffic lane.",
        },
    },
    55: {
        "q": "You are required to continue straight ahead on the road. How do you proceed?",
        "answers": {
            194: "I continue driving slowly.",
            195: "I turn around, as the road is too narrow for passenger cars.",
            196: "I am particularly mindful of whether any oncoming traffic appears.",
            197: "I am particularly mindful of the shape of the road ahead.",
        },
    },
    56: {
        "q": "What must you be particularly mindful of in this situation?",
        "answers": {
            198: "I am particularly mindful of bicyclists in the traffic lane.",
            199: "I am particularly mindful of pedestrians crossing ahead.",
            200: "I am particularly mindful of the oncoming traffic.",
        },
    },
    57: {
        "q": "You are driving at approximately 50 km/h. There are no road users behind you. How will you continue?",
        "answers": {
            201: "I continue at an unchanged speed of approximately 50 km/h.",
            202: "I reduce my speed.",
            203: "I pull towards the centre of the traffic lane.",
            204: "I am particularly mindful of the pedestrian.",
        },
    },
    58: {
        "q": "You have reduced your speed to approximately 20 km/h and moved your foot onto the brake pedal before the difficult bend. There are no road users behind you. How will you continue?",
        "answers": {
            205: "I am particularly mindful of the oncoming truck.",
            206: "I increase my speed.",
            207: "I brake in order to give the turning truck space.",
            208: "I pull over as far as possible to the right of the roadway.",
        },
    },
    59: {
        "q": "You are driving at approximately 50 km/h. How will you continue?",
        "answers": {
            209: "I give a flashing light signal with my high-beam headlights.",
            210: "I continue at an unchanged speed of approximately 50 km/h.",
            211: "I pull all the way out to the kerb on the right-hand side.",
            212: "I apply my service brake.",
        },
    },
    60: {
        "q": "You are driving at 40 km/h and the roadway is very slippery. How will you continue?",
        "answers": {
            213: "I am particularly mindful of the oncoming traffic.",
            214: "I am particularly mindful of the shape of the road ahead.",
            215: "I pull over as far as possible to the right of the roadway.",
            216: "I move my foot over to the brake pedal.",
        },
    },
    61: {
        "q": "You are driving at 50 km/h and have caught up with the passenger car that is driving very slowly. How will you continue?",
        "answers": {
            217: "I continue at an unchanged speed of approximately 50 km/h.",
            218: "I overtake the passenger car.",
            219: "I am particularly mindful of the side road.",
            220: "I move my foot over to the brake pedal.",
        },
    },
    62: {
        "q": "You have caught up with the bicyclists and there are no road users behind you. How will you continue?",
        "answers": {
            221: "I give a signal with the horn.",
            222: "I cross the centre line and begin overtaking the first bicyclist.",
            223: "I overtake immediately without crossing the centre line.",
            224: "I reduce my speed and remain behind the bicyclists for the time being.",
        },
    },
    63: {
        "q": "You are driving at approximately 40 km/h and are required to continue straight ahead. There are no road users behind you. How will you continue?",
        "answers": {
            225: "I continue at an unchanged speed of approximately 40 km/h.",
            226: "I overtake the passenger car on the right immediately.",
            227: "I pull out towards the kerb on the right-hand side.",
            228: "I brake and remain behind the passenger car.",
        },
    },
    64: {
        "q": "You wish to turn left as soon as possible. How do you proceed?",
        "answers": {
            229: "I activate my left-turn indicator immediately.",
            230: "I wait a while before signalling with my indicator.",
            231: "I turn left at the first side road once the lane is clear.",
            232: "I wait until the next side road before turning.",
        },
    },
    65: {
        "q": "You are driving at 30 to 40 km/h and are required to continue straight ahead on the road. There are no road users behind you. How will you continue?",
        "answers": {
            233: "I continue at an unchanged speed between 30 and 40 km/h.",
            234: "I keep my foot ready on the brake pedal.",
            235: "I am particularly mindful of the pedestrians.",
            236: "I apply my service brake.",
        },
    },
    66: {
        "q": "You have reduced your speed to 30 km/h in order to turn right. How will you continue?",
        "answers": {
            237: "I continue at an unchanged speed of approximately 30 km/h.",
            238: "I reduce my speed.",
            239: "I turn right immediately.",
            240: "I hold back for the bicyclist and check my blind spot before turning.",
        },
    },
    67: {
        "q": "What must you be particularly mindful of a bit further ahead?",
        "answers": {
            241: "I am particularly mindful of a dangerous bend in the road.",
            242: "I am particularly mindful of the merge rule where the traffic lanes come together.",
            243: "I am particularly mindful of the rule for changing traffic lanes.",
            244: "I am particularly mindful that the motorway is coming to an end.",
        },
    },
    68: {
        "q": "You are driving on a motorway. What must you be particularly mindful of a bit further ahead?",
        "answers": {
            245: "Drivers wishing to enter the motorway have a duty to give way to all traffic.",
            246: "I have a duty to give way to all traffic.",
            247: "Drivers are having difficulty entering the motorway.",
            248: "I can assist them by changing to the far left lane.",
        },
    },
    69: {
        "q": "What must you be particularly mindful of in this situation?",
        "answers": {
            249: "I am particularly mindful of areas with speed bumps.",
            250: "I am particularly mindful that this is a residential area.",
            251: "I am particularly mindful that young children are permitted to play in the roadway.",
        },
    },
    70: {
        "q": "You are driving at approximately 60 km/h and are about to enter the motorway. How will you continue?",
        "answers": {
            252: "I increase my speed.",
            253: "I merge in immediately after the black passenger car.",
            254: "I move my foot over to the brake pedal.",
            255: "I hold back until the roadway behind me is clear before entering the motorway.",
        },
    },
    71: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            256: "I am permitted to park the passenger car here.",
            257: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            258: "Stopping the passenger car is prohibited here.",
        },
    },
    72: {
        "q": "You are stationary and are about to set off from the kerb. How do you proceed?",
        "answers": {
            259: "I set off immediately.",
            260: "I turn my head and check that the roadway is clear behind me.",
            261: "Once the lane behind me is clear, I drive out from the kerb slowly.",
            262: "I am particularly mindful of the oncoming traffic.",
        },
    },
    73: {
        "q": "You are driving at approximately 20 to 30 km/h, the same as the motorcyclist in front. You are required to continue straight ahead on the road, which contains a bend. How will you continue?",
        "answers": {
            263: "I continue at an unchanged speed between 20 and 30 km/h.",
            264: "I increase my speed.",
            265: "I brake gently.",
            266: "I am particularly mindful of the road condition.",
        },
    },
    74: {
        "q": "You have stepped out of the red passenger car. According to the legal provisions, which of the following applies here?",
        "answers": {
            267: "I am permitted to park the passenger car here.",
            268: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            269: "Stopping and parking are both prohibited here.",
        },
    },
    75: {
        "q": "You have stepped out of the red passenger car to run an errand. According to the legal provisions on stopping and parking, which of the following applies here?",
        "answers": {
            270: "I am permitted to park the passenger car here.",
            271: "I am permitted to stop the passenger car here for 2 to 3 minutes.",
            272: "Stopping is prohibited here.",
        },
    },
}

if __name__ == "__main__":
    apply_rewrites(TEST_ID, REWRITES)
