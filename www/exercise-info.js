// Step-by-step exercise instructions, text only, no images by design (keeps the
// app lightweight). Each entry has a short list of steps and one form tip.
// Custom exercises typed in freehand won't have an entry, the UI handles that
// with a fallback message rather than an error.
const EXERCISE_INFO = {

  // ---------- Machines and cables ----------
  "Leg Press": {
    steps: [
      "Set the seat so your knees sit at roughly ninety degrees when your feet are on the platform.",
      "Place your feet about shoulder width apart, mid-platform, heels flat.",
      "Release the safety catches and lower the platform until your knees reach about ninety degrees.",
      "Drive through the whole foot to push back out, stopping just short of locking your knees."
    ],
    tip: "Keep your lower back flat against the pad throughout. If your hips start to curl under at the bottom, you have gone too deep."
  },
  "Chest Press Machine": {
    steps: [
      "Set the seat height so the handles sit level with the middle of your chest.",
      "Sit back with your shoulder blades pinned against the pad and feet flat.",
      "Press the handles forward until your arms are almost straight, without snapping the elbows.",
      "Return under control until you feel a stretch across the chest, then press again."
    ],
    tip: "If the handles are above nipple height you will turn this into a shoulder press. Drop the seat a notch."
  },
  "Seated Cable Row": {
    steps: [
      "Sit facing the stack with feet braced and a slight bend in your knees.",
      "Take the handle with arms extended and your chest tall, torso close to upright.",
      "Pull the handle to your stomach, leading with your elbows and squeezing your shoulder blades together.",
      "Let the handle travel back out until your arms are straight, keeping your torso still."
    ],
    tip: "Resist the urge to rock backwards for extra weight. If your torso is swinging, the load is too heavy."
  },
  "Cable Lateral Raise": {
    steps: [
      "Set the pulley to the lowest position and stand side-on with the cable crossing in front of you.",
      "Take the handle in the hand furthest from the stack, arm hanging across your body.",
      "Raise your arm out to the side until your hand is roughly shoulder height, elbow slightly soft.",
      "Lower slowly all the way back across your body, then repeat."
    ],
    tip: "This is a small muscle, so progress will be slow. Light weight with a genuine pause at the top beats heavy swinging."
  },
  "Cable Triceps Pushdown": {
    steps: [
      "Attach a rope or bar to a high pulley and stand close, elbows tucked at your sides.",
      "Start with your forearms at about parallel to the floor.",
      "Push down until your arms are fully straight, keeping your elbows pinned in place.",
      "Let the weight return until your forearms are parallel again, without letting your elbows drift forward."
    ],
    tip: "Only the forearm should move. If your elbows are travelling, you are using your chest and shoulders."
  },
  "Seated Leg Curl": {
    steps: [
      "Set the back pad so your knees line up with the machine's pivot point.",
      "Place the shin pad just above your heels and secure the thigh pad.",
      "Curl your heels down and under as far as the machine allows.",
      "Return slowly until your legs are almost straight, keeping tension throughout."
    ],
    tip: "Point your toes up towards your shins. It shifts the work onto the hamstrings rather than the calves."
  },
  "Lat Pulldown": {
    steps: [
      "Set the thigh pad snug so you stay seated, and take a grip slightly wider than shoulder width.",
      "Sit tall with a very slight lean back, chest lifted.",
      "Pull the bar down to your upper chest, driving your elbows down towards your hips.",
      "Let the bar rise until your arms are straight and you feel your lats stretch, then repeat."
    ],
    tip: "Think about pulling your elbows into your back pockets rather than pulling with your hands."
  },
  "Shoulder Press Machine": {
    steps: [
      "Set the seat so the handles start at about shoulder or ear height.",
      "Sit with your back flat against the pad and feet planted.",
      "Press upwards until your arms are nearly straight overhead.",
      "Lower under control back to shoulder height."
    ],
    tip: "Keep your ribs down rather than arching your lower back to help the weight up."
  },
  "Cable Curl": {
    steps: [
      "Set the pulley low and stand a step back from the stack, holding the bar or handles.",
      "Keep your elbows at your sides and your upper arms still.",
      "Curl up towards your shoulders, squeezing at the top.",
      "Lower all the way until your arms are straight, resisting on the way down."
    ],
    tip: "The cable keeps tension at the top, unlike a dumbbell. Slow the lowering phase to make the most of it."
  },
  "Leg Extension": {
    steps: [
      "Set the seat so your knees align with the pivot and the shin pad sits just above your ankles.",
      "Hold the handles and keep your back against the pad.",
      "Straighten your legs until they are fully extended, pausing briefly at the top.",
      "Lower under control without letting the weight stack crash down."
    ],
    tip: "A one second hold at the top does more for the quads than adding a plate."
  },


  // ---------- Chest ----------
  "DB Bench Press": {
    steps: [
      "Lie on the bench with a dumbbell in each hand, resting on your thighs.",
      "Kick the weights up one at a time as you lie back, starting with them over your shoulders.",
      "Press both dumbbells straight up until your arms are extended, without locking the elbows hard.",
      "Lower under control until your upper arms are roughly parallel to the floor, then press back up."
    ],
    tip: "Keep your feet flat on the floor and a slight arch in your lower back, don't let the dumbbells drift forward or back."
  },
  "Incline DB Press": {
    steps: [
      "Set the bench to a 30 to 45 degree incline.",
      "Sit back with a dumbbell in each hand at shoulder height, palms facing forward.",
      "Press the dumbbells up and slightly inward until your arms are extended.",
      "Lower slowly back to shoulder height and repeat."
    ],
    tip: "A steeper incline shifts more work to the front shoulders, keep it at 30 to 45 degrees to stay chest focused."
  },
  "DB Decline Press": {
    steps: [
      "Secure your legs on a decline bench and lie back with a dumbbell in each hand.",
      "Start with the dumbbells over your chest, arms extended.",
      "Lower them slowly to the sides of your lower chest.",
      "Press back up to the starting position."
    ],
    tip: "Control the descent, decline pressing puts you at a mechanical disadvantage if the weights drop too fast."
  },
  "Flat DB Flye": {
    steps: [
      "Lie on a flat bench holding a dumbbell above each shoulder, palms facing in, elbows slightly bent.",
      "Lower the dumbbells out to the sides in a wide arc until you feel a stretch across your chest.",
      "Bring the dumbbells back up and together over your chest, as if hugging a barrel.",
      "Keep the same slight elbow bend throughout."
    ],
    tip: "This is a stretch and squeeze movement, not a press, keep the weight lighter than your bench press."
  },
  "DB Chest Fly": {
    steps: [
      "Same setup and movement as a flat dumbbell flye, lying on a flat bench.",
      "Lower the dumbbells out wide with a slight bend in the elbows.",
      "Squeeze your chest to bring the dumbbells back together above your chest.",
      "Avoid letting the elbows straighten or bend further during the movement."
    ],
    tip: "Go lighter than you think, the shoulder joint is vulnerable to a flye taken too heavy or too low."
  },
  "DB Incline Fly": {
    steps: [
      "Set the bench to a 30 to 45 degree incline and lie back with a dumbbell above each shoulder.",
      "With a slight bend in the elbows, lower the dumbbells out to the sides.",
      "Stop when you feel a stretch across the upper chest.",
      "Bring the dumbbells back together above your chest in a hugging motion."
    ],
    tip: "Targets the upper chest more than a flat flye, keep the incline moderate rather than steep."
  },
  "DB Squeeze Press": {
    steps: [
      "Lie on a flat bench holding two dumbbells pressed together above your chest.",
      "Keep the dumbbells squeezed against each other throughout the set.",
      "Lower them to your chest while maintaining the squeeze.",
      "Press back up without letting the dumbbells separate."
    ],
    tip: "The constant inward squeeze is the point of this exercise, use a lighter weight than your normal bench press."
  },
  "DB Single-Arm Press": {
    steps: [
      "Lie on a bench holding one dumbbell above one shoulder, the other hand braced or resting on your stomach.",
      "Press the dumbbell straight up until your arm is extended.",
      "Lower under control back to shoulder height.",
      "Complete all reps on one side before switching."
    ],
    tip: "Your core has to work harder to resist rotating, brace it as if about to take a light punch to the stomach."
  },
  "DB Floor Press": {
    steps: [
      "Lie on the floor with knees bent, a dumbbell in each hand at chest level.",
      "Press the dumbbells up until your arms are extended.",
      "Lower until your upper arms touch the floor, then pause briefly.",
      "Press back up to the top."
    ],
    tip: "The floor stops the descent early, useful if you want to train pressing power without shoulder strain from a full range bench press."
  },

  // ---------- Back ----------
  "Bent-Over DB Row": {
    steps: [
      "Hold a dumbbell in each hand, hinge at the hips until your torso is close to parallel with the floor.",
      "Let the dumbbells hang at arm's length, knees slightly bent.",
      "Pull both dumbbells up toward your ribs, leading with your elbows.",
      "Lower under control back to the starting hang."
    ],
    tip: "Keep your back flat, not rounded, throughout the hinge and the pull."
  },
  "One-Arm DB Row": {
    steps: [
      "Place one knee and the same-side hand on a bench for support.",
      "Hold a dumbbell in the other hand, arm hanging straight down.",
      "Pull the dumbbell up toward your hip, keeping your elbow close to your body.",
      "Lower under control and repeat, then switch sides."
    ],
    tip: "Avoid rotating your torso to help the pull, the row should come from your back, not momentum."
  },
  "DB Renegade Row": {
    steps: [
      "Get into a plank position with a hand on each dumbbell, feet spread wider than usual for stability.",
      "Row one dumbbell up to your ribs while balancing on the other arm.",
      "Lower it back down and place it on the floor.",
      "Repeat on the other side, alternating."
    ],
    tip: "Keep your hips as level as possible, resist the urge to twist toward the rowing side."
  },
  "DB Pullover": {
    steps: [
      "Lie flat on a bench, holding one dumbbell with both hands above your chest.",
      "Keeping a slight bend in your elbows, lower the dumbbell back over your head.",
      "Stop when you feel a stretch through your lats and chest.",
      "Pull the dumbbell back over your chest to the start."
    ],
    tip: "Move slowly, this exercise works best as a controlled stretch and pull rather than a fast lift."
  },
  "DB Chest-Supported Row": {
    steps: [
      "Lie face down on an incline bench, a dumbbell in each hand hanging below you.",
      "Row both dumbbells up toward your ribs, squeezing your shoulder blades together.",
      "Lower under control back to a full hang.",
      "Keep your chest in contact with the bench throughout."
    ],
    tip: "Because the bench supports your torso, there's no momentum to cheat with, focus on a full squeeze at the top."
  },
  "DB Kroc Row": {
    steps: [
      "Support yourself with one hand on a bench, similar to a one-arm row, but with a heavier weight.",
      "Row the dumbbell up using a slightly more relaxed form, allowing some hip drive.",
      "Pull for higher reps than a strict row, focusing on total back fatigue.",
      "Lower under control and repeat, then switch sides."
    ],
    tip: "This is a deliberately less strict row for volume and grip work, still keep the lower back safe by not overextending."
  },
  "DB Yates Row": {
    steps: [
      "Hold a dumbbell in each hand and hinge forward to about a 45 degree torso angle, more upright than a standard bent-over row.",
      "Let the dumbbells hang at arm's length.",
      "Pull them up toward your hips rather than your ribs, elbows tucked closer to your sides.",
      "Lower under control and repeat."
    ],
    tip: "The more upright torso angle shifts some emphasis toward the lower lats and biceps."
  },
  "DB Single Arm Row": {
    steps: [
      "Same setup as the one-arm dumbbell row, one knee and hand supported on a bench.",
      "Row the dumbbell up toward your hip, elbow close to your body.",
      "Lower under control.",
      "Complete all reps on one side before switching."
    ],
    tip: "Keep your neck neutral, don't crane it to look up or to the side."
  },
  "DB Seesaw Row": {
    steps: [
      "Sit or kneel with a dumbbell in each hand, torso hinged forward.",
      "Row one dumbbell up as you simultaneously lower the other.",
      "Alternate sides in a continuous seesaw motion.",
      "Keep your torso stable and avoid twisting."
    ],
    tip: "The alternating rhythm adds an anti-rotation core challenge on top of the back work."
  },
  "DB Floor T Raise": {
    steps: [
      "Lie face down on the floor with a light dumbbell in each hand, arms extended out to the sides.",
      "Lift both arms slightly off the floor, forming a T shape with your body.",
      "Squeeze your shoulder blades together at the top.",
      "Lower under control and repeat."
    ],
    tip: "Use light weight, this is a rear-delt and upper-back activation move, not a strength builder."
  },
  "DB Rolls": {
    steps: [
      "Lie face down on an incline bench, a light dumbbell in each hand hanging down.",
      "Roll your shoulders back and up, squeezing your shoulder blades together without bending your elbows much.",
      "Hold the squeeze briefly at the top.",
      "Lower under control and repeat."
    ],
    tip: "Keep the weight light, the movement is about scapular control, not how much you can lift."
  },
  "DB Romanian Deadlift": {
    steps: [
      "Stand holding a dumbbell in each hand in front of your thighs.",
      "Push your hips back while keeping a soft bend in your knees, lowering the dumbbells down the front of your legs.",
      "Stop when you feel a stretch in your hamstrings, usually around shin height.",
      "Drive your hips forward to stand back up."
    ],
    tip: "Keep the dumbbells close to your legs throughout, and keep your back flat rather than rounding."
  },
  "DB Deadlift": {
    steps: [
      "Stand with a dumbbell in each hand outside your feet, feet hip-width apart.",
      "Push your hips back and bend your knees to lower down and grip the dumbbells.",
      "Drive through your heels to stand up, keeping the dumbbells close to your legs.",
      "Lower back down under control to the floor between reps."
    ],
    tip: "Keep your chest up and back flat, this is a hip hinge with knee bend, not a squat."
  },

  // ---------- Legs ----------
  "Goblet Squat": {
    steps: [
      "Hold one dumbbell vertically against your chest with both hands, elbows pointing down.",
      "Stand with feet shoulder-width apart, toes slightly out.",
      "Squat down, keeping your chest up and elbows brushing the inside of your knees.",
      "Drive through your heels to stand back up."
    ],
    tip: "The dumbbell held at your chest acts as a counterbalance, helping keep your torso upright."
  },
  "DB Squat": {
    steps: [
      "Hold a dumbbell in each hand at your sides, arms straight.",
      "Stand with feet shoulder-width apart.",
      "Squat down until your thighs are roughly parallel to the floor.",
      "Drive through your heels to stand back up."
    ],
    tip: "Keep the dumbbells close to your legs throughout to avoid pulling your torso forward."
  },
  "DB Sumo Squat": {
    steps: [
      "Hold one dumbbell with both hands in front of you, feet set wider than shoulder-width, toes turned out.",
      "Squat straight down between your legs, keeping your chest up.",
      "Go as deep as comfortable while keeping your knees tracking over your toes.",
      "Drive through your heels to stand back up."
    ],
    tip: "The wide stance shifts more emphasis to your inner thighs, keep your knees pushed out, not caving in."
  },
  "DB Bulgarian Split Squat": {
    steps: [
      "Stand a couple of feet in front of a bench, resting the top of one foot on it behind you.",
      "Hold a dumbbell in each hand at your sides.",
      "Lower your back knee toward the floor, keeping most of your weight on the front leg.",
      "Push through the front heel to stand back up, then complete all reps before switching legs."
    ],
    tip: "Most of the work should be in the front leg, the back foot is just there for balance."
  },
  "DB Lunge (per leg)": {
    steps: [
      "Hold a dumbbell in each hand at your sides, standing tall.",
      "Step forward with one leg and lower your back knee toward the floor.",
      "Push back through the front foot to return to standing.",
      "Alternate legs or complete all reps on one side first, depending on your plan."
    ],
    tip: "Keep your front knee tracking over your foot rather than caving inward."
  },
  "DB Walking Lunge (per leg)": {
    steps: [
      "Hold a dumbbell in each hand at your sides.",
      "Step forward into a lunge, lowering your back knee toward the floor.",
      "Push off the back foot and bring it forward into the next lunge, rather than stepping back.",
      "Continue walking forward for the set number of steps per leg."
    ],
    tip: "Keep your torso upright throughout, don't lean forward to help momentum."
  },
  "DB Reverse Lunge": {
    steps: [
      "Hold a dumbbell in each hand at your sides, standing tall.",
      "Step backward with one leg and lower your back knee toward the floor.",
      "Push through your front heel to return to standing.",
      "Alternate legs or complete all reps on one side first."
    ],
    tip: "Stepping back is generally gentler on the front knee than stepping forward, a good option if lunges bother your joints."
  },
  "DB Side Lunge": {
    steps: [
      "Hold one dumbbell with both hands at your chest, or a dumbbell in each hand at your sides.",
      "Step out wide to one side and bend that knee, keeping the other leg straight.",
      "Push through the bent leg's heel to return to standing.",
      "Alternate sides or complete all reps on one side first."
    ],
    tip: "Keep your toes pointed forward on both feet, and push your hips back as you lower rather than letting your knee travel too far past your toes."
  },
  "DB Curtsy Lunge": {
    steps: [
      "Hold a dumbbell in each hand at your sides.",
      "Step one leg diagonally behind and across your body, like a curtsy.",
      "Bend both knees to lower down, keeping your hips facing forward.",
      "Push through your front heel to return to standing, then repeat on the other side."
    ],
    tip: "This targets the outer hip and glute more than a standard lunge, keep your torso upright throughout."
  },
  "DB Step-Up (per leg)": {
    steps: [
      "Hold a dumbbell in each hand at your sides, standing in front of a sturdy bench or box.",
      "Place one foot fully on the bench.",
      "Push through that foot to step up, bringing your other leg up to meet it.",
      "Step back down with control, then complete all reps before switching legs."
    ],
    tip: "Drive through the heel of the foot on the bench rather than pushing off your back foot."
  },
  "DB Box Step-Down": {
    steps: [
      "Stand on a bench or box holding a dumbbell in each hand, or bodyweight only.",
      "Slowly lower one leg down to lightly tap the floor.",
      "Push back up through the standing leg to return to the top.",
      "Complete all reps on one leg before switching."
    ],
    tip: "Control the descent, this is primarily an eccentric, single-leg control exercise."
  },
  "DB Single-Leg Deadlift": {
    steps: [
      "Hold a dumbbell in one or both hands, standing on one leg.",
      "Hinge at the hip, extending your free leg straight back as your torso lowers toward parallel with the floor.",
      "Keep the dumbbell close to your standing leg as you lower.",
      "Reverse the motion to stand back up, then complete all reps before switching legs."
    ],
    tip: "Focus on balance and control over range of motion at first, depth will improve as your balance does."
  },
  "DB Calf Raise": {
    steps: [
      "Hold a dumbbell in each hand, standing with the balls of your feet on a raised edge if available.",
      "Let your heels drop below the level of your toes for a stretch.",
      "Push through the balls of your feet to rise up onto your toes.",
      "Lower back down under control and repeat."
    ],
    tip: "Pause briefly at the top of each rep rather than bouncing through the movement."
  },
  "DB Hip Raise": {
    steps: [
      "Lie on your back, knees bent, feet flat on the floor, a dumbbell resting across your hips.",
      "Push through your heels to lift your hips up until your body forms a straight line from shoulders to knees.",
      "Squeeze your glutes at the top.",
      "Lower under control and repeat."
    ],
    tip: "Hold the dumbbell steady with both hands so it doesn't roll as your hips rise."
  },
  "DB Glute Bridge": {
    steps: [
      "Same starting position as a hip raise, lying on your back with knees bent and a dumbbell across your hips.",
      "Drive your heels into the floor to lift your hips.",
      "Pause and squeeze at the top for a moment.",
      "Lower slowly and repeat."
    ],
    tip: "Often used with a pause at the top, or single-leg, to increase the challenge without adding weight."
  },
  "DB Thruster": {
    steps: [
      "Hold a dumbbell in each hand at shoulder height.",
      "Squat down, keeping your chest up.",
      "As you stand up, use the momentum to press both dumbbells overhead in one fluid motion.",
      "Lower the dumbbells back to your shoulders as you descend into the next squat."
    ],
    tip: "This is a full-body, breath-demanding movement, start with a lighter weight than you'd use for a squat or press alone."
  },
  "DB Swing": {
    steps: [
      "Hold one dumbbell with both hands in front of you, feet shoulder-width apart.",
      "Hinge at your hips, swinging the dumbbell back between your legs.",
      "Drive your hips forward explosively to swing the dumbbell up to shoulder height.",
      "Let it swing back down and repeat in a continuous rhythm."
    ],
    tip: "The power comes from your hips snapping forward, not your arms lifting the weight."
  },

  // ---------- Shoulders ----------
  "DB Shoulder Press": {
    steps: [
      "Sit or stand holding a dumbbell in each hand at shoulder height, palms facing forward.",
      "Press both dumbbells straight overhead until your arms are extended.",
      "Lower under control back to shoulder height.",
      "Keep your core braced throughout, especially if standing."
    ],
    tip: "Avoid arching your lower back to get the weight up, if that's happening the weight is too heavy."
  },
  "DB Arnold Press": {
    steps: [
      "Hold a dumbbell in each hand at shoulder height, palms facing your body.",
      "As you press upward, rotate your palms to face forward by the top of the movement.",
      "At full extension, arms are straight and palms face away from you.",
      "Reverse the rotation as you lower back to the start."
    ],
    tip: "The added rotation works the shoulder through a fuller range, keep the weight moderate while you learn the timing."
  },
  "DB Push Press": {
    steps: [
      "Hold a dumbbell in each hand at shoulder height.",
      "Dip your knees slightly, then drive up through your legs.",
      "Use that leg drive to help press the dumbbells overhead.",
      "Lower back to shoulder height under control and repeat."
    ],
    tip: "This lets you move heavier weight than a strict press by using your legs, useful for overload work."
  },
  "DB Cuban Press": {
    steps: [
      "Hold a dumbbell in each hand at your sides.",
      "Raise your elbows out to the sides until your upper arms are parallel to the floor, forearms hanging down.",
      "Rotate your forearms upward until the dumbbells point overhead.",
      "Press the rest of the way overhead, then reverse the whole sequence to lower."
    ],
    tip: "This is a rehab and stability favorite, use light weight and focus on smooth, controlled rotation."
  },
  "DB Lateral Raise": {
    steps: [
      "Stand holding a dumbbell in each hand at your sides.",
      "With a slight bend in your elbows, raise both arms out to the sides until they reach shoulder height.",
      "Pause briefly at the top.",
      "Lower under control back to your sides."
    ],
    tip: "Lead with your elbows, not your hands, and avoid swinging the weight up with momentum."
  },
  "DB Side Raise": {
    steps: [
      "Same movement as a lateral raise, dumbbell in each hand at your sides.",
      "Raise your arms out to shoulder height with a slight elbow bend.",
      "Pause briefly at the top.",
      "Lower slowly back down."
    ],
    tip: "Keep the reps slow and controlled, this exercise loses most of its value if momentum takes over."
  },
  "DB Alternating Front Raise": {
    steps: [
      "Stand holding a dumbbell in each hand in front of your thighs.",
      "Raise one dumbbell straight out in front of you to shoulder height.",
      "Lower it back down as you raise the other arm.",
      "Continue alternating sides."
    ],
    tip: "Keep a slight bend in your elbow and avoid using your lower back to help swing the weight up."
  },
  "DB Reverse Fly": {
    steps: [
      "Hinge forward at the hips holding a dumbbell in each hand, arms hanging down.",
      "With a slight bend in your elbows, raise both arms out to the sides.",
      "Squeeze your shoulder blades together at the top.",
      "Lower under control back to the hang position."
    ],
    tip: "Keep your torso still, the motion should come entirely from your shoulders, not from rocking your body."
  },
  "DB Rear Delt Flye": {
    steps: [
      "Same setup as a reverse flye, hinged forward with a dumbbell in each hand.",
      "Raise your arms out to the sides with a slight elbow bend.",
      "Focus on squeezing your shoulder blades at the top.",
      "Lower slowly and repeat."
    ],
    tip: "This is a commonly under-trained area, use lighter weight and prioritize the squeeze over the load."
  },
  "DB Shoulder Shrug": {
    steps: [
      "Stand holding a dumbbell in each hand at your sides.",
      "Without bending your elbows, shrug your shoulders straight up toward your ears.",
      "Pause briefly at the top.",
      "Lower under control back down."
    ],
    tip: "Move your shoulders straight up and down, avoid rolling them forward or backward."
  },
  "DB Upright Row": {
    steps: [
      "Stand holding a dumbbell in each hand in front of your thighs.",
      "Pull both dumbbells straight up along your body toward chin height, leading with your elbows.",
      "Your elbows should stay higher than your wrists throughout.",
      "Lower under control back to the start."
    ],
    tip: "Keep the dumbbells close to your body, and don't pull higher than feels comfortable in your shoulders."
  },
  "DB W Raise": {
    steps: [
      "Hold a light dumbbell in each hand, arms bent to form a W shape in front of you.",
      "Raise your arms out and up, keeping the bent-elbow W shape throughout.",
      "Focus on squeezing your upper back and rear shoulders at the top.",
      "Lower under control and repeat."
    ],
    tip: "Use light weight, this is a shoulder health and posture exercise, not a strength builder."
  },

  // ---------- Arms ----------
  "DB Bicep Curl": {
    steps: [
      "Stand holding a dumbbell in each hand at your sides, palms facing forward.",
      "Curl both dumbbells up toward your shoulders, keeping your elbows close to your body.",
      "Squeeze at the top.",
      "Lower under control back to the start."
    ],
    tip: "Keep your elbows pinned at your sides, don't let them drift forward as the weight gets heavier."
  },
  "DB Hammer Curl": {
    steps: [
      "Stand holding a dumbbell in each hand at your sides, palms facing your body.",
      "Curl both dumbbells up toward your shoulders, keeping the palms facing inward throughout.",
      "Squeeze at the top.",
      "Lower under control back to the start."
    ],
    tip: "The neutral grip shifts some emphasis onto the forearm, useful alongside standard curls."
  },
  "DB Concentration Curl": {
    steps: [
      "Sit on a bench, elbow braced against the inside of your thigh, dumbbell hanging down.",
      "Curl the dumbbell up toward your shoulder.",
      "Squeeze at the top.",
      "Lower slowly back to a full stretch."
    ],
    tip: "Keeping the elbow braced removes momentum, making this a good isolation finisher."
  },
  "DB Incline Curl": {
    steps: [
      "Sit back on an incline bench, arms hanging straight down holding a dumbbell in each hand.",
      "Curl both dumbbells up toward your shoulders.",
      "Squeeze at the top.",
      "Lower slowly, allowing a full stretch at the bottom."
    ],
    tip: "The incline position stretches the bicep more at the bottom, keep the weight lighter than a standing curl."
  },
  "DB Preacher Curl": {
    steps: [
      "Rest the back of your upper arm against an angled surface, like the back of an incline bench, dumbbell in hand.",
      "Curl the dumbbell up toward your shoulder.",
      "Squeeze at the top.",
      "Lower slowly to a full stretch at the bottom."
    ],
    tip: "This position isolates the bicep well but is unforgiving on form, keep the weight moderate."
  },
  "DB Reverse Curl": {
    steps: [
      "Stand holding a dumbbell in each hand, palms facing down toward the floor.",
      "Curl both dumbbells up toward your shoulders keeping the palms-down grip throughout.",
      "Squeeze at the top.",
      "Lower under control back to the start."
    ],
    tip: "This grip shifts more work onto your forearms, expect to use lighter weight than a standard curl."
  },
  "DB Zottman Curl": {
    steps: [
      "Stand holding a dumbbell in each hand, palms facing forward.",
      "Curl the dumbbells up toward your shoulders as normal.",
      "At the top, rotate your palms to face down.",
      "Lower the dumbbells slowly with the palms-down grip, then rotate back to face forward at the bottom."
    ],
    tip: "The combination of curl and reverse curl in one rep works both the bicep and forearm in a single movement."
  },
  "DB Wrist Curl": {
    steps: [
      "Sit down, resting your forearm on your thigh or a bench, palm facing up, dumbbell in hand.",
      "Let your wrist drop back, lowering the dumbbell as far as comfortable.",
      "Curl your wrist upward, lifting the dumbbell using only your wrist.",
      "Lower under control and repeat."
    ],
    tip: "Keep the movement isolated to the wrist, your forearm should stay resting and still."
  },
  "DB Grip Curl": {
    steps: [
      "Hold a dumbbell in one hand, arm relaxed at your side or resting on a bench.",
      "Squeeze your hand around the handle as hard as you can for a few seconds.",
      "Release slowly.",
      "Repeat for the set, then switch hands."
    ],
    tip: "This is a static grip-strength hold rather than a moving rep, useful for grip endurance for rows and deadlifts."
  },
  "DB Overhead Tricep Extension": {
    steps: [
      "Stand or sit holding one dumbbell with both hands overhead, arms extended.",
      "Lower the dumbbell behind your head by bending your elbows.",
      "Stop when your forearms are roughly parallel to the floor.",
      "Extend your arms back up to the start."
    ],
    tip: "Keep your elbows pointing forward and relatively still, only your forearms should move."
  },
  "DB Tricep Kickback": {
    steps: [
      "Hinge forward at the hips, one hand on a bench for support, dumbbell in the other hand.",
      "Keep your upper arm parallel to the floor, elbow bent to 90 degrees.",
      "Extend your forearm straight back until your arm is fully straight.",
      "Bend back to 90 degrees under control and repeat, then switch sides."
    ],
    tip: "Keep your upper arm still throughout, the movement should come entirely from your elbow."
  },
  "DB Skull Crusher": {
    steps: [
      "Lie on a flat bench holding a dumbbell in each hand above your chest, arms extended.",
      "Bend your elbows to lower the dumbbells toward your forehead.",
      "Keep your upper arms still, pointing straight up throughout.",
      "Extend your arms back up to the start."
    ],
    tip: "Lower with control, this exercise gets its name for a reason if the weight gets away from you."
  },
  "DB Close-Grip Press": {
    steps: [
      "Lie on a flat bench holding a dumbbell in each hand, positioned close together above your chest.",
      "Lower the dumbbells slowly, keeping your elbows tucked close to your body.",
      "Press back up, keeping the dumbbells close together throughout.",
      "Focus on squeezing your triceps at the top."
    ],
    tip: "Keeping the elbows tucked shifts the emphasis from chest to triceps compared with a standard bench press."
  },
  "DB Tricep Dip": {
    steps: [
      "Sit on the edge of a bench, hands gripping the edge beside your hips.",
      "Slide your hips off the bench, supporting your weight on your arms, legs extended in front of you.",
      "Bend your elbows to lower your body toward the floor.",
      "Push back up through your palms to straighten your arms."
    ],
    tip: "Keep your elbows pointing backward rather than flaring out to the sides, and don't dip lower than feels comfortable in your shoulders."
  },
  "DB Tricep Extension": {
    steps: [
      "Same movement as the overhead tricep extension, holding one dumbbell with both hands overhead.",
      "Lower the dumbbell behind your head by bending your elbows.",
      "Keep your elbows pointing forward and still.",
      "Extend back up to the start."
    ],
    tip: "Can be done seated for more stability if you find it hard to keep your torso still standing."
  },

  // ---------- Core ----------
  "DB Russian Twist": {
    steps: [
      "Sit on the floor, knees bent, leaning back slightly, holding one dumbbell with both hands.",
      "Lift your feet off the floor if you can balance, or keep them down for an easier version.",
      "Rotate your torso to touch the dumbbell to the floor on one side.",
      "Rotate to the other side and repeat, alternating."
    ],
    tip: "Move slowly and with control, twisting fast with a weight in hand is a common way to tweak your lower back."
  },
  "DB Side Bend": {
    steps: [
      "Stand holding one dumbbell in one hand at your side, the other hand behind your head or resting on your hip.",
      "Bend directly sideways at the waist, lowering the dumbbell down the side of your leg.",
      "Bend as far as comfortable without twisting.",
      "Return to standing, then complete all reps before switching sides."
    ],
    tip: "Keep the motion straight side to side, avoid leaning forward or twisting your torso."
  },
  "DB Bow Extension": {
    steps: [
      "Lie face down holding a light dumbbell in each hand, arms extended in front of you.",
      "Simultaneously lift your arms, chest, and legs slightly off the floor.",
      "Hold briefly at the top, forming a gentle bow shape with your body.",
      "Lower under control and repeat."
    ],
    tip: "This works the whole posterior chain along with the core, keep the weight light since range of motion is small."
  },
  "DB V-Up": {
    steps: [
      "Lie flat on your back holding one dumbbell with both hands, arms extended overhead.",
      "Simultaneously lift your legs and upper body, reaching the dumbbell toward your feet.",
      "Your body should form a V shape at the top.",
      "Lower back down under control and repeat."
    ],
    tip: "If a full V-up is too difficult, bend your knees to shorten the lever until your core is strong enough for the straight-leg version."
  },
  "DB Sit-Up": {
    steps: [
      "Lie on your back, knees bent, feet flat, holding a dumbbell against your chest.",
      "Curl your torso up until you're sitting upright.",
      "Pause briefly at the top.",
      "Lower back down under control."
    ],
    tip: "Keep the dumbbell close to your chest rather than held out in front, to avoid straining your neck reaching for momentum."
  },
  "DB V-Sit Cross Jab": {
    steps: [
      "Sit on the floor in a V position, leaning back with feet off the floor, holding a light dumbbell in each hand.",
      "Throw alternating punches across your body as if jabbing forward.",
      "Keep your core braced and your V position held throughout.",
      "Continue alternating for the set."
    ],
    tip: "Keep the dumbbells light, this is a rotational core and conditioning move, not a strength builder for the arms."
  },
  "DB Woodchop": {
    steps: [
      "Stand holding one dumbbell with both hands, feet shoulder-width apart.",
      "Rotate your torso and bring the dumbbell diagonally from high on one side to low on the opposite side.",
      "Let your hips and feet pivot naturally with the motion.",
      "Reverse the motion back to the start, then complete all reps before switching sides."
    ],
    tip: "The movement should come from rotating your torso and hips together, not just swinging your arms."
  },
  "DB Dead Bug": {
    steps: [
      "Lie on your back holding one dumbbell with both hands straight up over your chest, knees bent at 90 degrees.",
      "Slowly extend one leg straight out while lowering the dumbbell overhead on the same side.",
      "Return to the start and repeat on the other side.",
      "Keep your lower back flat against the floor throughout."
    ],
    tip: "This is a slow, controlled core stability exercise, speed defeats the purpose."
  },
  "DB Plank T": {
    steps: [
      "Get into a push-up plank position, one dumbbell in each hand.",
      "Rotate your body to one side, raising that arm straight up so your body forms a T shape.",
      "Return to the plank position.",
      "Repeat on the other side, alternating."
    ],
    tip: "Keep your hips as square to the floor as possible when you're not actively rotating."
  },
  "Plank-To-Row": {
    steps: [
      "Get into a push-up plank position with a dumbbell in each hand.",
      "Row one dumbbell up toward your ribs while balancing on the other arm.",
      "Lower it back down to the floor.",
      "Repeat on the other side, alternating."
    ],
    tip: "Resist the urge to let your hips twist toward the side you're rowing on."
  },
  "DB Toe Touch": {
    steps: [
      "Lie on your back, legs extended straight up toward the ceiling, holding one dumbbell with both hands.",
      "Curl your upper body up, reaching the dumbbell toward your toes.",
      "Pause briefly at the top.",
      "Lower back down under control."
    ],
    tip: "Focus on curling through your upper abs rather than using momentum to fling yourself upward."
  },
  "DB Farmer's Walk": {
    steps: [
      "Hold a heavy dumbbell in each hand at your sides.",
      "Stand tall with your shoulders back and core braced.",
      "Walk forward for the set distance or time, keeping your steps controlled.",
      "Set the dumbbells down under control at the end."
    ],
    tip: "Keep your shoulders pulled back rather than letting the weight round them forward, this is as much a posture exercise as a grip one."
  },
  "DB Suitcase Carry": {
    steps: [
      "Hold one dumbbell in one hand at your side, like carrying a suitcase.",
      "Stand tall, resisting the urge to lean toward the loaded side.",
      "Walk forward for the set distance or time.",
      "Switch hands and repeat."
    ],
    tip: "The single-sided load makes your core work hard to keep you upright, that's the point of the exercise."
  },
  "DB Overhead Carry": {
    steps: [
      "Press one or two dumbbells overhead until your arms are fully extended.",
      "Stand tall with your core braced.",
      "Walk forward for the set distance or time, keeping the dumbbells locked out overhead.",
      "Lower the dumbbells under control at the end."
    ],
    tip: "Keep your ribs pulled down rather than flaring, an overextended lower back is the main risk with this carry."
  },

  // ---------- Total body / other ----------
  "Push-Up": { steps: ["Hands slightly wider than shoulders, body in one straight line from heels to head.", "Lower your chest to just above the floor, elbows tracking back at about 45 degrees.", "Press through the whole hand back to the top without letting your hips sag or pike."], tip: "Squeeze your glutes and brace your abs the whole set. The plank is half the exercise." },
  "Knee Push-Up": { steps: ["From kneeling, walk your hands forward until your body forms a straight line from knees to head.", "Lower your chest under control, elbows about 45 degrees from your sides.", "Press back up keeping hips locked in line."], tip: "Treat it exactly like a full push-up from the knees. Same line, same tempo." },
  "Incline Push-Up": { steps: ["Hands on a bench or countertop, body in a straight line.", "Lower your chest to the edge, then press back to straight arms.", "The higher the surface, the easier the rep. Lower it over time."], tip: "Progress by finding lower surfaces, not by rushing reps." },
  "Decline Push-Up": { steps: ["Feet elevated on a bench or step, hands on the floor slightly wider than shoulders.", "Lower until your forehead nearly touches the floor.", "Press back up without letting the hips drop."], tip: "The higher the feet, the more shoulder-dominant it becomes." },
  "Diamond Push-Up": { steps: ["Hands together under your chest, thumbs and index fingers forming a diamond.", "Lower with elbows brushing your ribs.", "Press up, feeling the triceps do most of the work."], tip: "Shorten the range or elevate hands if wrists or elbows complain." },
  "Archer Push-Up": { steps: ["Take a very wide hand position.", "Lower toward one hand, keeping the other arm nearly straight.", "Alternate sides, or complete one side then the other."], tip: "A stepping stone toward one-arm work. Keep the hips square." },
  "Pike Push-Up": { steps: ["From push-up position, walk feet in and lift hips high into an inverted V.", "Bend elbows to lower the top of your head toward the floor between your hands.", "Press back to the pike, keeping your legs as straight as you can."], tip: "The more vertical your torso, the more it becomes a shoulder press." },
  "Wall Handstand Push-Up": { steps: ["Kick up to a handstand with your back or chest to a wall.", "Lower under control until your head lightly touches the floor or a pad.", "Press back to straight arms."], tip: "Master pike push-ups with feet elevated before attempting these." },
  "Pull-Up": { steps: ["Hang from a bar with an overhand grip, hands just outside shoulders.", "Pull your chest toward the bar, driving elbows down and back.", "Lower all the way to a dead hang each rep."], tip: "Full range beats half reps. A dead hang start is the standard." },
  "Chin-Up": { steps: ["Hang with an underhand grip, hands about shoulder width.", "Pull until your chin clears the bar.", "Lower to a full hang under control."], tip: "Slightly easier than a pull-up and hits the biceps harder." },
  "Negative Pull-Up": { steps: ["Jump or step to the top position, chin over the bar.", "Lower yourself as slowly as you can, aiming for 3 to 5 seconds.", "Step back up and repeat."], tip: "The fastest route to your first full pull-up." },
  "Australian Row": { steps: ["Set a bar at waist height, hang underneath with heels on the floor, body straight.", "Pull your chest to the bar, squeezing shoulder blades together.", "Lower to straight arms without letting the hips sag."], tip: "The more horizontal your body, the harder the row." },
  "Dip": { steps: ["Support yourself on parallel bars, arms locked.", "Lower until your shoulders are just below your elbows, torso leaning slightly forward.", "Press back to lockout."], tip: "Stop the descent early if the front of the shoulder complains." },
  "Bench Dip": { steps: ["Hands on a bench behind you, legs extended in front, hips just off the edge.", "Bend your elbows to lower your hips toward the floor.", "Press back up to straight arms."], tip: "Keep hips close to the bench to protect the shoulders." },
  "Bodyweight Squat": { steps: ["Feet shoulder width, toes slightly out.", "Sit down between your hips, chest up, until thighs are at least parallel.", "Drive through the whole foot to stand tall."], tip: "Slow the descent to 3 seconds when high reps get easy." },
  "Split Squat": { steps: ["Take a long stride, back heel up.", "Lower the back knee toward the floor, torso upright.", "Drive through the front foot to stand. All reps one side, then switch."], tip: "The target reps are per leg." },
  "Shrimp Squat": { steps: ["Stand on one leg, grab the other ankle behind you.", "Lower until the back knee touches the floor.", "Drive back up through the standing leg."], tip: "A more knee-friendly path to single-leg strength than pistols for many people." },
  "Pistol Squat": { steps: ["Stand on one leg, the other extended in front.", "Sit all the way down on the standing leg, arms out for balance.", "Stand back up without touching the free foot down."], tip: "Hold a counterweight in front to make early reps possible." },
  "Glute Bridge": { steps: ["Lie on your back, knees bent, feet flat and close to your hips.", "Drive through the heels to lift hips until your body is straight from knees to shoulders.", "Squeeze the glutes at the top, lower with control."], tip: "Progress to single-leg bridges when two legs get easy." },
  "Nordic Curl": { steps: ["Kneel with your ankles anchored under something solid.", "Lower your torso forward as slowly as possible, hips extended.", "Catch yourself with your hands and push back to the start."], tip: "Even 2 or 3 slow negatives is productive work. Brutal but effective." },
  "Plank": { steps: ["Forearms on the floor, elbows under shoulders, body in one line.", "Brace your abs and squeeze your glutes.", "Hold. Target numbers are seconds, not reps."], tip: "A shaking 40 seconds done straight beats a saggy 90." },
  "Side Plank": { steps: ["Lie on one side, forearm under the shoulder, feet stacked.", "Lift hips until your body forms a straight line.", "Hold, then switch sides. Target numbers are seconds."], tip: "Push the floor away with the forearm so the shoulder stays active." },
  "Hollow Hold": { steps: ["Lie on your back, press your lower back into the floor.", "Lift shoulders and legs off the ground, arms extended overhead.", "Hold the shallow banana shape. Target numbers are seconds."], tip: "Bend the knees or bring arms to your sides to make it easier." },
  "L-Sit": { steps: ["Support yourself on parallettes or the floor, arms locked.", "Lift both legs straight out in front, parallel to the ground.", "Hold. Tucked knees is the starting progression. Targets are seconds."], tip: "Push the shoulders down away from the ears the whole hold." },
  "Hanging Knee Raise": { steps: ["Hang from a bar, shoulders active.", "Curl your knees up toward your chest without swinging.", "Lower under control to a full hang."], tip: "Exhale hard at the top to get the abs fully involved." },
  "Hanging Leg Raise": { steps: ["Hang from a bar with straight legs.", "Raise your legs together until they are at least parallel to the floor.", "Lower slowly without letting momentum build."], tip: "Toes-to-bar is the next step once these are strict and easy." },
  "Burpee": { steps: ["Squat down, place hands on the floor, jump feet back to a push-up position.", "Do a push-up, jump the feet back in.", "Jump vertically with arms overhead. That is one rep."], tip: "Pace them. Smooth and continuous beats fast and sloppy." },
};

// More specific than the app's six broad recovery categories (chest, back, legs,
// shoulders, arms, core), this lists the actual muscles each exercise trains,
// shown as a "Works" line above the steps.
const EXERCISE_MUSCLES = {
  // Machines and cables
  "Leg Press": "Quads, glutes, hamstrings",
  "Chest Press Machine": "Chest, front shoulders, triceps",
  "Seated Cable Row": "Mid back, lats, biceps, rear shoulders",
  "Cable Lateral Raise": "Side shoulders",
  "Cable Triceps Pushdown": "Triceps",
  "Seated Leg Curl": "Hamstrings",
  "Lat Pulldown": "Lats, mid back, biceps",
  "Shoulder Press Machine": "Front and side shoulders, triceps",
  "Cable Curl": "Biceps, forearms",
  "Leg Extension": "Quads",

  // Chest
  "DB Bench Press": "Chest, front shoulders, triceps",
  "Incline DB Press": "Upper chest, front shoulders, triceps",
  "DB Decline Press": "Lower chest, triceps",
  "Flat DB Flye": "Chest",
  "DB Chest Fly": "Chest",
  "DB Incline Fly": "Upper chest",
  "DB Squeeze Press": "Chest, inner chest",
  "DB Single-Arm Press": "Chest, triceps, core",
  "DB Floor Press": "Chest, triceps, front shoulders",

  // Back
  "Bent-Over DB Row": "Lats, mid-back, biceps",
  "One-Arm DB Row": "Lats, mid-back, biceps",
  "DB Renegade Row": "Lats, mid-back, core",
  "DB Pullover": "Lats, chest",
  "DB Chest-Supported Row": "Mid-back, lats, rear shoulders",
  "DB Kroc Row": "Lats, mid-back, grip",
  "DB Yates Row": "Lower lats, biceps",
  "DB Single Arm Row": "Lats, mid-back, biceps",
  "DB Seesaw Row": "Lats, mid-back, core",
  "DB Floor T Raise": "Rear shoulders, mid-back",
  "DB Rolls": "Rear shoulders, mid-back",
  "DB Romanian Deadlift": "Hamstrings, glutes, lower back",
  "DB Deadlift": "Hamstrings, glutes, lower back, grip",

  // Legs
  "Goblet Squat": "Quads, glutes, core",
  "DB Squat": "Quads, glutes",
  "DB Sumo Squat": "Inner thighs, glutes, quads",
  "DB Bulgarian Split Squat": "Quads, glutes, hamstrings",
  "DB Lunge (per leg)": "Quads, glutes, hamstrings",
  "DB Walking Lunge (per leg)": "Quads, glutes, hamstrings",
  "DB Reverse Lunge": "Quads, glutes, hamstrings",
  "DB Side Lunge": "Inner thighs, glutes, quads",
  "DB Curtsy Lunge": "Glutes, outer hip",
  "DB Step-Up (per leg)": "Quads, glutes",
  "DB Box Step-Down": "Quads, glutes",
  "DB Single-Leg Deadlift": "Hamstrings, glutes, core stability",
  "DB Calf Raise": "Calves",
  "DB Hip Raise": "Glutes, hamstrings",
  "DB Glute Bridge": "Glutes, hamstrings",
  "DB Thruster": "Quads, glutes, shoulders, triceps",
  "DB Swing": "Glutes, hamstrings, lower back",

  // Shoulders
  "DB Shoulder Press": "Front and side shoulders, triceps",
  "DB Arnold Press": "Front and side shoulders, triceps",
  "DB Push Press": "Shoulders, triceps, legs",
  "DB Cuban Press": "Shoulders, rotator cuff",
  "DB Lateral Raise": "Side shoulders",
  "DB Side Raise": "Side shoulders",
  "DB Alternating Front Raise": "Front shoulders",
  "DB Reverse Fly": "Rear shoulders, mid-back",
  "DB Rear Delt Flye": "Rear shoulders, mid-back",
  "DB Shoulder Shrug": "Traps",
  "DB Upright Row": "Side shoulders, traps",
  "DB W Raise": "Rear shoulders, rotator cuff",

  // Arms
  "DB Bicep Curl": "Biceps",
  "DB Hammer Curl": "Biceps, forearms",
  "DB Concentration Curl": "Biceps",
  "DB Incline Curl": "Biceps",
  "DB Preacher Curl": "Biceps",
  "DB Reverse Curl": "Forearms, biceps",
  "DB Zottman Curl": "Biceps, forearms",
  "DB Wrist Curl": "Forearms",
  "DB Grip Curl": "Forearms, grip",
  "DB Overhead Tricep Extension": "Triceps",
  "DB Tricep Kickback": "Triceps",
  "DB Skull Crusher": "Triceps",
  "DB Close-Grip Press": "Triceps, chest",
  "DB Tricep Dip": "Triceps, chest, shoulders",
  "DB Tricep Extension": "Triceps",

  // Core
  "DB Russian Twist": "Obliques, abs",
  "DB Side Bend": "Obliques",
  "DB Bow Extension": "Lower back, glutes, rear shoulders",
  "DB V-Up": "Abs, hip flexors",
  "DB Sit-Up": "Abs, hip flexors",
  "DB V-Sit Cross Jab": "Abs, obliques",
  "DB Woodchop": "Obliques, abs",
  "DB Dead Bug": "Deep core, abs",
  "DB Plank T": "Core, shoulders",
  "Plank-To-Row": "Core, lats, mid-back",
  "DB Toe Touch": "Abs",
  "DB Farmer's Walk": "Core, traps, grip",
  "DB Suitcase Carry": "Obliques, core, grip",
  "DB Overhead Carry": "Core, shoulders, stability",
};

// Shorter technique cues for conditioning activities, a single paragraph rather
// than numbered steps since these are machine/movement patterns, not discrete reps.
const CARDIO_INFO = {
  "Concept2 RowErg": "Drive with your legs first, then lean back slightly and pull the handle to your ribs, finishing with your arms. Reverse the order on the way back: arms out, then lean forward, then let your legs bend. Legs, body, arms on the drive, arms, body, legs on the return.",
  "Concept2 SkiErg": "Stand with a slight bend in your knees, handles overhead. Hinge at your hips and pull the handles down past your thighs, driving through your core and lats. Let your arms and hips reset together on the way back up.",
  "Concept2 BikeErg": "Adjust the seat so your knee has a slight bend at the bottom of the pedal stroke. Keep a steady cadence rather than mashing hard and coasting, and use the arm handles to add upper body work if your model has them.",
  "Sled Tow": "Lean into the harness or straps at a consistent angle and drive through your legs with short, controlled steps. Avoid leaning so far forward that your hands nearly touch the floor.",
  "Sled Push": "Keep your arms extended and locked, hips low, and drive through the balls of your feet in short powerful steps. Keep your back flat rather than rounding over the handles.",
  "Assault Bike": "Push and pull evenly with both arms and legs rather than favoring one. Keep a stable seated position, using your core to stop yourself bouncing with each stroke.",
  "Running": "Keep your cadence quick and your foot strike underneath your body rather than reaching out in front, which reduces braking force with each step.",
  "Cycling": "Keep a steady, sustainable cadence rather than alternating between mashing and coasting, and adjust seat height so your knee has a slight bend at full extension.",
  "Jump Rope": "Keep your jumps low, just enough to clear the rope, and turn the rope from your wrists rather than your whole arms.",
  "Stair Climber": "Keep your torso upright rather than leaning on the handrails, which lets your legs take the intended load.",
  "Push-Up": "Chest, shoulders, triceps, core",
  "Knee Push-Up": "Chest, shoulders, triceps",
  "Incline Push-Up": "Chest, shoulders, triceps",
  "Decline Push-Up": "Upper chest, shoulders, triceps",
  "Diamond Push-Up": "Triceps, chest",
  "Archer Push-Up": "Chest, shoulders, triceps",
  "Pike Push-Up": "Shoulders, triceps, upper chest",
  "Wall Handstand Push-Up": "Shoulders, triceps, traps",
  "Pull-Up": "Lats, upper back, biceps, grip",
  "Chin-Up": "Lats, biceps, upper back",
  "Negative Pull-Up": "Lats, biceps, grip",
  "Australian Row": "Upper back, lats, biceps",
  "Dip": "Chest, triceps, shoulders",
  "Bench Dip": "Triceps, chest",
  "Bodyweight Squat": "Quads, glutes, core",
  "Split Squat": "Quads, glutes",
  "Shrimp Squat": "Quads, glutes, balance",
  "Pistol Squat": "Quads, glutes, core, balance",
  "Glute Bridge": "Glutes, hamstrings",
  "Nordic Curl": "Hamstrings, glutes",
  "Plank": "Core, shoulders",
  "Side Plank": "Obliques, core, shoulders",
  "Hollow Hold": "Abs, hip flexors",
  "L-Sit": "Abs, hip flexors, triceps",
  "Hanging Knee Raise": "Abs, hip flexors, grip",
  "Hanging Leg Raise": "Abs, hip flexors, grip",
  "Burpee": "Full body, conditioning",
};
