// HealingNet triage knowledge base (rules-v1).
//
// Plain data that drives the triage engine: symptoms (with the words patients
// use for them), conditions (how likely each symptom is in each condition),
// emergency red flags, urgency floors and the questions asked first.
//
// This is decision support for routing patients, not a diagnostic tool.
// Edit it with a clinician: every change should be reviewed and tested
// (engine_test.ts). Words in Yoruba, Igbo and Hausa need review by native
// speakers before launch.

export type Level = "self_care" | "consultation" | "consultation_24" | "emergency" | "emergency_ambulance";
export type Sex = "male" | "female";
export type Course = "acute" | "subacute" | "chronic" | "any";

export const LEVEL_RANK: Record<Level, number> = {
  self_care: 0,
  consultation: 1,
  consultation_24: 2,
  emergency: 3,
  emergency_ambulance: 4,
};

export interface Symptom {
  id: string;
  name: string;
  /** Yes/no question shown to the patient. */
  q: string;
  /** Short "why we ask" hint. */
  why?: string;
  /** Words or phrases that mean this symptom (any language; matched on whole words). */
  phrases: string[];
  /** [body-part words, complaint words]: matches when one word of each appears within 4 words. */
  combos?: [string[], string[]][];
  sex?: Sex;
  minAge?: number;
  maxAge?: number;
}

export interface Condition {
  id: string;
  name: string;
  /** Patient-friendly description. Never phrased as a diagnosis. */
  about: string;
  specialty: string;
  /** Usual urgency when this is the most likely match. */
  level: Level;
  /** May be managed at home when mild. */
  selfCare?: boolean;
  /** Relative frequency in Nigerian primary care (rough weight, not a statistic). */
  prior: number;
  /** Multiplier on the prior for children under 13. */
  childPrior?: number;
  sex?: Sex;
  minAge?: number;
  maxAge?: number;
  course: Course;
  /** Only considered when this symptom/fact is present (e.g. a sickle cell crisis needs known sickle cell disease). */
  requires?: string;
  /** Probability that each symptom is present in this condition (0-1). Unlisted symptoms are assumed rare. */
  s: Record<string, number>;
  /** General, safe self-help while waiting to be seen. No medicines or doses. */
  advice?: string;
}

/** Facts gathered so far, used by red flags, floors and screening questions. */
export interface Ctx {
  age: number;
  sex: Sex | "other";
  present: Set<string>;
  absent: Set<string>;
  severity?: number;
  durationDays?: number;
}

export interface RedFlag {
  id: string;
  label: string;
  level: "emergency" | "emergency_ambulance";
  when: (c: Ctx) => boolean;
  advice: string;
}

export interface Floor {
  id: string;
  label: string;
  level: Level;
  /** Show the label to the patient as a warning sign. */
  warn: boolean;
  when: (c: Ctx) => boolean;
}

const PAIN = ["pain", "pains", "paining", "painful", "ache", "aches", "aching", "hurt", "hurts", "hurting", "sore", "cramp", "cramps", "cramping", "dey pain"];

// ---------------------------------------------------------------------------
// Symptoms
// ---------------------------------------------------------------------------
export const SYMPTOMS: Symptom[] = [
  // General
  { id: "fever", name: "Fever", q: "Do you have a fever or feel hot?", why: "Fever points to an infection such as malaria.",
    phrases: ["fever", "feverish", "high temperature", "temperature", "feeling hot", "feel hot", "body hot", "hot body", "body dey hot", "body dey hot me", "malaria", "typhoid", "iba", "ahu oku", "zazzabi", "zazzaɓi"] },
  { id: "high_fever", name: "Very high fever", q: "Is the fever very high (above 39°C), or does your body feel extremely hot?",
    phrases: ["very high fever", "high fever", "extremely hot", "burning hot", "body dey hot well well"] },
  { id: "chills", name: "Chills or shivering", q: "Are you having chills or shivering?",
    phrases: ["chills", "chill", "shivering", "shiver", "shivers", "rigors", "feeling cold", "dey shake", "cold dey catch me"] },
  { id: "sweating", name: "Sweating", q: "Are you sweating a lot?",
    phrases: ["sweating", "sweat", "sweats", "sweaty", "dey sweat", "cold sweat"] },
  { id: "night_sweats", name: "Night sweats", q: "Do you wake up at night soaked in sweat?",
    phrases: ["night sweats", "night sweat", "sweating at night", "sweat at night", "soaked at night"] },
  { id: "fatigue", name: "Tiredness or weakness", q: "Do you feel unusually tired or weak?",
    phrases: ["tired", "tiredness", "fatigue", "fatigued", "weak", "weakness", "exhausted", "no strength", "body weak", "body dey weak", "weak body", "lethargic"] },
  { id: "body_aches", name: "Body aches", q: "Do you have general body or muscle aches?",
    phrases: ["body aches", "body ache", "body pain", "body pains", "muscle pain", "muscle aches", "muscle ache", "aching body", "body dey pain", "body dey pain me", "joint and body pain"] },
  { id: "loss_of_appetite", name: "Loss of appetite", q: "Have you lost your appetite?",
    phrases: ["no appetite", "loss of appetite", "lost appetite", "lost my appetite", "not eating", "cant eat", "can t eat", "poor appetite", "food no dey sweet", "i no fit chop"] },
  { id: "bitter_taste", name: "Bitter taste in the mouth", q: "Do you have a bitter taste in your mouth?",
    phrases: ["bitter taste", "bitter mouth", "mouth bitter", "mouth dey bitter"] },
  { id: "weight_loss", name: "Weight loss", q: "Have you lost weight without trying?",
    phrases: ["weight loss", "losing weight", "lost weight", "lose weight", "slimming", "i don slim", "getting thin"] },
  { id: "dizziness", name: "Dizziness", q: "Do you feel dizzy or light-headed?",
    phrases: ["dizzy", "dizziness", "lightheaded", "light headed", "head dey turn", "head dey spin", "giddy", "jiri", "vertigo"] },
  { id: "fainting", name: "Fainting", q: "Have you fainted or passed out?",
    phrases: ["fainted", "fainting", "faint", "passed out", "pass out", "collapsed", "blacked out"] },
  { id: "pale_skin", name: "Pale skin or pale palms", q: "Have you or others noticed that your skin, palms or eyelids look pale?",
    phrases: ["pale", "paleness", "pale palms", "no blood", "low blood", "blood low", "low pcv", "pcv low"] },
  { id: "signs_dehydration", name: "Signs of dehydration", q: "Are you passing very little urine, very thirsty with a dry mouth, or feeling faint when you stand?",
    why: "Losing a lot of fluid can become dangerous quickly.",
    phrases: ["dehydrated", "dehydration", "dry mouth", "sunken eyes", "not passing urine", "little urine", "no urine"] },
  { id: "excessive_thirst", name: "Excessive thirst", q: "Are you unusually thirsty all the time?",
    phrases: ["very thirsty", "always thirsty", "excessive thirst", "thirsty all the time", "drinking a lot of water"] },

  // Head and nerves
  { id: "headache", name: "Headache", q: "Do you have a headache?",
    phrases: ["headache", "headaches", "head ache", "migraine", "back of my head", "back of the head", "ori fifo", "isi owuwa", "ciwon kai"],
    combos: [[["head"], PAIN]] },
  { id: "severe_sudden_headache", name: "Sudden, severe headache", q: "Did a very severe headache start suddenly, like the worst headache of your life?",
    why: "A sudden, very severe headache needs emergency care.",
    phrases: ["worst headache", "sudden severe headache", "thunderclap", "worst headache of my life", "sudden headache"] },
  { id: "stiff_neck", name: "Stiff neck", q: "Is your neck stiff, so it is hard or painful to bend your chin to your chest?",
    why: "Fever with a stiff neck can be a sign of meningitis.",
    phrases: ["stiff neck", "neck stiff", "neck is stiff", "cant bend my neck", "can t bend my neck", "neck dey stiff"] },
  { id: "neck_pain", name: "Neck pain", q: "Do you have neck or shoulder tension or pain?",
    phrases: ["neck pain", "neck ache", "neck hurts", "neck dey pain"], combos: [[["neck"], PAIN]] },
  { id: "light_sensitivity", name: "Sensitivity to light", q: "Does bright light hurt your eyes or make the headache worse?",
    phrases: ["light hurts", "sensitive to light", "light sensitivity", "photophobia", "cant stand light", "can t stand light"] },
  { id: "confusion", name: "Confusion", q: "Is the person confused, not making sense, or unusually agitated?",
    why: "Confusion can be a sign of severe infection or another emergency.",
    phrases: ["confusion", "disoriented", "not making sense", "talking rubbish", "delirious", "dey talk anyhow"] },
  { id: "very_drowsy", name: "Very drowsy or hard to wake", q: "Is the person very drowsy, hard to wake up, or unconscious?",
    phrases: ["unconscious", "hard to wake", "cant wake", "can t wake", "not responding", "unresponsive", "very drowsy", "coma"] },
  { id: "seizure", name: "Seizure or convulsion", q: "Has there been a seizure, fit or convulsion?",
    phrases: ["seizure", "seizures", "convulsion", "convulsions", "convulsing", "having fits", "had a fit", "jerking", "epilepsy attack"] },
  { id: "one_sided_weakness", name: "Weakness on one side of the body", q: "Is there sudden weakness or numbness of the face, arm or leg on one side of the body?",
    why: "Sudden one-sided weakness can be a stroke.",
    phrases: ["one side weak", "weakness on one side", "one sided weakness", "cant move my arm", "can t move my arm", "cant move my leg", "can t move my leg", "paralysis", "paralysed", "paralyzed", "stroke", "half of my body"] },
  { id: "face_drooping", name: "Face drooping", q: "Is one side of the face drooping?",
    phrases: ["face drooping", "face droop", "drooping face", "mouth twisted", "face twisted", "mouth don turn", "mouth is crooked"] },
  { id: "slurred_speech", name: "Slurred speech", q: "Is speech suddenly slurred or hard to understand?",
    phrases: ["slurred speech", "slurring", "slurred", "cant talk properly", "can t talk properly", "speech is unclear", "difficulty speaking"] },
  { id: "numbness", name: "Numbness or tingling", q: "Do you have numbness, tingling or pins and needles?",
    phrases: ["numbness", "numb", "tingling", "pins and needles", "burning feet", "hands dey sleep", "leg dey sleep"] },
  { id: "vision_changes", name: "Blurred or changed vision", q: "Has your vision become blurred, or are you seeing spots or flashing lights?",
    phrases: ["blurred vision", "blurry vision", "blurry", "blurred", "cant see well", "can t see well", "vision problem", "seeing spots", "flashing lights", "eye dey blur", "double vision"] },

  // Eyes
  { id: "red_eye", name: "Red eye", q: "Are one or both eyes red?",
    phrases: ["red eye", "red eyes", "eyes are red", "eye is red", "apollo", "pink eye", "eye dey red"] },
  { id: "eye_discharge", name: "Eye discharge", q: "Is there sticky discharge or crusting from the eye?",
    phrases: ["eye discharge", "discharge from eye", "discharge from my eye", "sticky eye", "eye crust", "eye dey bring water", "watery eyes", "watering eyes", "eye dey bring matter", "eyes with discharge", "eye with discharge", "discharge from the eye", "discharge from the eyes", "discharge from my eyes"],
    combos: [[["eye", "eyes"], ["discharge", "pus", "matter", "crust", "crusting", "sticky"]]] },
  { id: "eye_pain", name: "Eye pain", q: "Do you have pain in the eye?",
    phrases: ["eye pain", "eye hurts", "eye dey pain"], combos: [[["eye", "eyes"], PAIN]] },
  { id: "yellow_eyes", name: "Yellow eyes or skin", q: "Are the whites of your eyes or your skin yellow?",
    why: "Yellow eyes can point to a liver problem, severe malaria or a sickle cell crisis.",
    phrases: ["yellow eyes", "eyes are yellow", "eye yellow", "yellowish eyes", "jaundice", "yellow skin", "eye dey yellow"] },
  { id: "dark_urine", name: "Dark urine", q: "Is your urine very dark, like tea or cola?",
    phrases: ["dark urine", "urine is dark", "tea coloured urine", "cola coloured urine", "coke coloured urine", "urine dey dark"] },

  // Ear, nose, throat, mouth
  { id: "sore_throat", name: "Sore throat", q: "Do you have a sore throat?",
    phrases: ["sore throat", "throat pain", "painful throat", "throat dey pain", "throat hurts", "ciwon makogwaro"],
    combos: [[["throat"], PAIN]] },
  { id: "difficulty_swallowing", name: "Pain or difficulty swallowing", q: "Is it painful or difficult to swallow?",
    phrases: ["difficulty swallowing", "painful swallowing", "hard to swallow", "cant swallow", "can t swallow", "swallowing hurts", "pain when swallowing", "i no fit swallow"] },
  { id: "hoarse_voice", name: "Hoarse voice", q: "Has your voice become hoarse or lost?",
    phrases: ["hoarse", "hoarseness", "lost my voice", "voice is gone", "voice don go", "losing my voice"] },
  { id: "runny_nose", name: "Runny nose or catarrh", q: "Do you have a runny nose or catarrh?",
    phrases: ["runny nose", "running nose", "catarrh", "nose dey run", "nasal discharge", "mucus", "cold", "flu", "mura"] },
  { id: "blocked_nose", name: "Blocked nose", q: "Is your nose blocked or stuffy?",
    phrases: ["blocked nose", "stuffy nose", "nose blocked", "congested", "congestion", "nasal congestion", "nose dey block", "sinus"] },
  { id: "sneezing", name: "Sneezing", q: "Are you sneezing a lot?", phrases: ["sneezing", "sneeze", "sneezes", "dey sneeze"] },
  { id: "facial_pain", name: "Face or sinus pain", q: "Do you have pain or pressure around your cheeks, eyes or forehead?",
    phrases: ["facial pain", "face pain", "sinus pain", "pressure in my face", "cheek pain", "forehead pain"], combos: [[["face", "cheek", "cheeks", "forehead", "sinus"], PAIN]] },
  { id: "ear_pain", name: "Ear pain", q: "Do you have ear pain?",
    phrases: ["ear pain", "earache", "ear ache", "ear dey pain", "ciwon kunne"], combos: [[["ear", "ears"], PAIN]] },
  { id: "ear_discharge", name: "Ear discharge", q: "Is there discharge or pus coming from the ear?",
    phrases: ["ear discharge", "discharge from ear", "discharge from my ear", "pus from ear", "ear dey bring water", "ear is leaking"] },
  { id: "hearing_loss", name: "Reduced hearing", q: "Has your hearing reduced?",
    phrases: ["hearing loss", "cant hear", "can t hear", "hard of hearing", "muffled hearing", "ear is blocked", "ear blocked", "i no dey hear well"] },
  { id: "toothache", name: "Toothache", q: "Do you have toothache or pain in the gums?",
    phrases: ["toothache", "tooth ache", "tooth pain", "teeth pain", "gum pain", "swollen gum", "eyin dun mi", "ciwon hakori", "my tooth dey pain me"],
    combos: [[["tooth", "teeth", "gum", "gums", "molar"], PAIN]] },

  // Chest and breathing
  { id: "cough", name: "Cough", q: "Do you have a cough?",
    phrases: ["cough", "coughing", "coughs", "dey cough", "iko", "ukwara", "tari"] },
  { id: "productive_cough", name: "Cough with phlegm", q: "Are you coughing up phlegm (thick mucus)?",
    phrases: ["phlegm", "sputum", "catarrh cough", "coughing mucus", "green mucus", "yellow mucus", "chesty cough"] },
  { id: "cough_blood", name: "Coughing up blood", q: "Have you coughed up blood?",
    why: "Coughing up blood always needs a doctor.",
    phrases: ["coughing blood", "cough blood", "coughing up blood", "blood in sputum", "blood in phlegm", "cough out blood", "dey cough blood"] },
  { id: "shortness_of_breath", name: "Shortness of breath", q: "Are you short of breath or finding it hard to breathe?",
    phrases: ["shortness of breath", "short of breath", "breathless", "breathlessness", "difficulty breathing", "hard to breathe", "cant breathe", "can t breathe", "breathing problem", "breath no dey reach", "breath dey cut", "catching my breath", "chest tight"] },
  { id: "severe_breathing", name: "Struggling to breathe", q: "Is the person struggling to breathe, unable to finish a sentence, or turning blue or grey around the lips?",
    why: "Severe breathing difficulty is an emergency.",
    phrases: ["struggling to breathe", "gasping", "cant catch my breath", "can t catch my breath", "lips are blue", "blue lips", "turning blue", "choking"] },
  { id: "wheezing", name: "Wheezing", q: "Is there a whistling or wheezing sound when breathing?",
    phrases: ["wheeze", "wheezing", "whistling", "asthma attack", "chest dey whistle"] },
  { id: "fast_breathing", name: "Fast breathing", q: "Is the breathing much faster than normal?",
    phrases: ["fast breathing", "breathing fast", "rapid breathing", "breathing quickly"] },
  { id: "chest_pain", name: "Chest pain", q: "Do you have chest pain, pressure or tightness?",
    phrases: ["chest pain", "chest pains", "chest tightness", "pressure in my chest", "chest pressure", "chest dey pain", "ciwon kirji"],
    combos: [[["chest", "heart"], PAIN]] },
  { id: "chest_pain_radiating", name: "Chest pain spreading to the arm, jaw or back", q: "Does the chest pain spread to your arm, jaw, neck or back?",
    why: "Chest pain that spreads can be a heart attack.",
    phrases: ["left arm", "spreading to my arm", "spreads to my arm", "radiating", "radiates", "to my jaw", "jaw pain", "arm pain", "spreading to my back"] },
  { id: "palpitations", name: "Palpitations", q: "Do you feel your heart racing, pounding or beating irregularly?",
    phrases: ["palpitations", "palpitation", "heart racing", "racing heart", "heart pounding", "heart beating fast", "fast heartbeat", "heart dey beat fast", "irregular heartbeat"] },
  { id: "leg_swelling", name: "Swollen legs or feet", q: "Are your legs, ankles or feet swollen?",
    phrases: ["swollen legs", "swollen leg", "swollen feet", "swollen ankles", "leg swelling", "feet swelling", "leg don swell", "my leg dey swell"],
    combos: [[["leg", "legs", "feet", "foot", "ankle", "ankles"], ["swollen", "swelling", "swell", "swelled", "swollen up"]]] },

  // Stomach and bowels
  { id: "abdominal_pain", name: "Stomach pain", q: "Do you have stomach (abdominal) pain?",
    phrases: ["stomach ache", "stomachache", "abdominal pain", "tummy ache", "belly ache", "inu rirun", "ciwon ciki", "afo mgbu"],
    combos: [[["stomach", "belly", "belle", "abdomen", "abdominal", "tummy"], PAIN]] },
  { id: "upper_abdominal_pain", name: "Upper stomach pain", q: "Is the pain in the upper middle part of your stomach, just below the ribs?",
    phrases: ["upper abdominal pain", "upper stomach pain", "upper abdomen", "epigastric", "pain below my chest", "ulcer pain", "ulcer"] },
  { id: "lower_right_abdominal_pain", name: "Pain in the lower right of the stomach", q: "Is the pain mainly in the lower right side of your stomach?",
    why: "Pain in the lower right side can be appendicitis.",
    phrases: ["lower right abdomen", "lower right side", "right lower abdomen", "right side of my stomach", "appendix", "appendicitis"] },
  { id: "heartburn", name: "Heartburn", q: "Do you get a burning feeling in your chest or throat, especially after eating?",
    phrases: ["heartburn", "heart burn", "acid reflux", "reflux", "burning chest", "chest burning", "acid in my throat", "sour taste"] },
  { id: "bloating", name: "Bloating", q: "Do you feel bloated or full of gas?",
    phrases: ["bloating", "bloated", "gas", "gassy", "flatulence", "belle dey full", "stomach is full", "belching"] },
  { id: "nausea", name: "Nausea", q: "Do you feel like vomiting (nausea)?",
    phrases: ["nausea", "nauseous", "nauseated", "feel like vomiting", "feeling like vomiting", "queasy", "wan vomit", "e be like say i wan vomit"] },
  { id: "vomiting", name: "Vomiting", q: "Have you been vomiting?",
    phrases: ["vomit", "vomiting", "vomited", "throwing up", "threw up", "dey vomit", "eebi", "amai"] },
  { id: "vomiting_blood", name: "Vomiting blood", q: "Have you vomited blood or something that looks like coffee grounds?",
    why: "Vomiting blood is an emergency.",
    phrases: ["vomiting blood", "vomit blood", "vomited blood", "blood in vomit", "coffee ground vomit", "dey vomit blood"] },
  { id: "gi_bleed_signs", name: "Vomiting blood or black stool", q: "Have you vomited blood (or something like coffee grounds), or are your stools black like tar?",
    why: "These can be signs of bleeding in the stomach, which is an emergency.",
    phrases: ["internal bleeding"] },
  { id: "diarrhoea", name: "Diarrhoea", q: "Do you have diarrhoea (loose or watery stools)?",
    phrases: ["diarrhoea", "diarrhea", "loose stool", "loose stools", "watery stool", "running stomach", "purging", "dey purge", "stooling", "igbe gburu", "afo osisa", "gudawa"] },
  { id: "watery_diarrhoea_profuse", name: "Large amounts of watery diarrhoea", q: "Are you passing large amounts of watery stool, like rice water, many times a day?",
    why: "Very watery diarrhoea can cause dangerous dehydration (for example in cholera).",
    phrases: ["rice water", "rice water stool", "profuse diarrhoea", "profuse diarrhea", "watery diarrhoea many times", "cholera"] },
  { id: "bloody_stool", name: "Blood in stool", q: "Is there blood in your stool?",
    phrases: ["blood in stool", "bloody stool", "bloody diarrhoea", "bloody diarrhea", "stool with blood", "blood in my poo", "passing blood"] },
  { id: "black_stool", name: "Black, tarry stool", q: "Are your stools black and sticky like tar?",
    why: "Black stool can mean bleeding in the stomach.",
    phrases: ["black stool", "black stools", "tarry stool", "stool is black", "black poo"] },
  { id: "constipation", name: "Constipation", q: "Are you constipated (hard or infrequent stools)?",
    phrases: ["constipation", "constipated", "hard stool", "cant pass stool", "can t pass stool", "no stool", "i never stool"] },

  // Urine and private parts
  { id: "painful_urination", name: "Pain or burning when passing urine", q: "Do you have pain or burning when passing urine?",
    phrases: ["painful urination", "burning urine", "burning urination", "pain when urinating", "pain when i urinate", "pain when i pee", "burning when i pee", "urine dey pepper", "dysuria"],
    combos: [[["urine", "urinate", "urinating", "urination", "pee", "peeing", "wee", "piss"], ["pain", "painful", "burn", "burns", "burning", "sting", "stings", "hurts", "pepper"]]] },
  { id: "frequent_urination", name: "Passing urine often", q: "Are you passing urine much more often than usual, including at night?",
    phrases: ["frequent urination", "urinating frequently", "passing urine often", "always urinating", "pee a lot", "urinating a lot", "urine dey press me", "dey urinate well well"] },
  { id: "weak_urine_stream", name: "Weak urine flow", q: "Is your urine flow weak, or do you struggle to start or finish passing urine?",
    sex: "male", minAge: 35,
    phrases: ["weak stream", "weak urine", "poor flow", "dribbling", "difficulty passing urine", "hard to urinate", "urine no dey comot well"] },
  { id: "blood_in_urine", name: "Blood in urine", q: "Is there blood in your urine, or is it red or pink?",
    phrases: ["blood in urine", "bloody urine", "red urine", "pink urine", "urine with blood", "haematuria", "hematuria"] },
  { id: "flank_pain", name: "Pain in the side or lower back near the ribs", q: "Do you have pain in your side or back, just below the ribs?",
    phrases: ["flank pain", "side pain", "kidney pain", "pain in my side", "loin pain"], combos: [[["flank", "kidney", "kidneys", "loin"], PAIN]] },
  { id: "genital_discharge", name: "Unusual discharge from the penis or vagina", q: "Is there an unusual discharge from the penis or vagina?",
    minAge: 12, phrases: ["discharge from my penis", "penile discharge", "gonorrhoea", "gonorrhea", "sti", "std", "staph", "toilet infection"],
    combos: [[["penis", "manhood", "private part", "private parts", "vagina", "genital", "genitals"], ["discharge", "pus", "discharging"]]] },
  { id: "vaginal_discharge", name: "Unusual vaginal discharge", q: "Do you have unusual vaginal discharge (colour, smell or amount)?", sex: "female", minAge: 10,
    phrases: ["vaginal discharge", "white discharge", "smelly discharge", "fishy smell", "candida", "yeast infection", "infection for my private part"] },
  { id: "genital_sores", name: "Sores on the private parts", q: "Do you have sores, blisters or ulcers on your private parts?", minAge: 12,
    phrases: ["genital sores", "genital ulcer", "sore on my penis", "sore on my vagina", "genital warts", "blisters on my private part"] },
  { id: "pelvic_pain", name: "Lower belly or pelvic pain", q: "Do you have pain low in your belly (pelvis)?",
    phrases: ["pelvic pain", "lower abdominal pain", "lower belly pain", "lower stomach pain", "pain under my belly", "waist and belly pain"],
    combos: [[["pelvic", "pelvis", "lower belly", "lower abdomen"], PAIN]] },
  { id: "period_pain", name: "Painful periods", q: "Is the pain linked to your monthly period?", sex: "female", minAge: 10, maxAge: 55,
    phrases: ["period pain", "menstrual pain", "menstrual cramps", "period cramps", "painful period", "painful periods", "dysmenorrhoea", "dysmenorrhea"] },
  { id: "vaginal_bleeding", name: "Vaginal bleeding outside a normal period", q: "Do you have vaginal bleeding that is not your normal period?", sex: "female", minAge: 10,
    phrases: ["vaginal bleeding", "bleeding from my vagina", "spotting", "bleeding after sex", "heavy bleeding", "irregular bleeding"] },
  { id: "missed_period", name: "Missed period", q: "Have you missed a period?", sex: "female", minAge: 10, maxAge: 55,
    phrases: ["missed period", "missed my period", "period is late", "late period", "no period", "i never see my period", "i no see my period"] },
  { id: "pregnant", name: "Pregnant", q: "Are you pregnant, or could you be pregnant?", sex: "female", minAge: 10, maxAge: 55,
    why: "Some symptoms in pregnancy need urgent care.",
    phrases: ["pregnant", "pregnancy", "i am pregnant", "with child", "expecting a baby", "carrying baby", "oyun"] },
  { id: "reduced_fetal_movement", name: "Baby moving less", q: "Is the baby moving less than usual, or not moving?", sex: "female", minAge: 10, maxAge: 55,
    phrases: ["baby not moving", "baby is not moving", "baby moving less", "reduced fetal movement", "no fetal movement", "pikin no dey move"] },
  { id: "leaking_fluid", name: "Fluid leaking from the vagina in pregnancy", q: "Is water or fluid leaking from your vagina?", sex: "female", minAge: 10, maxAge: 55,
    phrases: ["water broke", "waters broke", "leaking fluid", "water is leaking", "water dey comot"] },

  // Skin
  { id: "rash", name: "Rash", q: "Do you have a skin rash or spots?",
    phrases: ["rash", "rashes", "spots", "skin rash", "bumps on my skin", "pimples", "skin dey bring out", "rashes all over"] },
  { id: "itching", name: "Itching", q: "Is your skin itchy?",
    phrases: ["itch", "itching", "itchy", "scratching", "dey scratch", "body dey scratch me", "kaikayi"] },
  { id: "ring_patches", name: "Round, scaly patches", q: "Are there round or ring-shaped scaly patches on the skin?",
    phrases: ["ringworm", "ring worm", "ring shaped", "circle on my skin", "round patch", "scaly patch", "eczema patch", "tinea", "craw craw"] },
  { id: "blisters", name: "Fluid-filled blisters", q: "Are there small fluid-filled blisters on the skin?",
    phrases: ["blisters", "blister", "water spots", "chicken pox", "chickenpox", "fluid filled spots"] },
  { id: "hives", name: "Raised itchy welts (hives)", q: "Do you have raised, itchy welts that come and go?",
    phrases: ["hives", "welts", "urticaria", "allergic rash", "allergy", "allergic reaction"] },
  { id: "face_swelling", name: "Swelling of the face, lips or tongue", q: "Is your face, lips, tongue or throat swelling?",
    why: "Swelling of the lips, tongue or throat can block breathing.",
    phrases: ["swollen lips", "lips swelling", "swollen face", "face swelling", "swollen tongue", "tongue swelling", "throat swelling", "face don swell", "mouth don swell"] },
  { id: "nonblanching_rash", name: "Rash that does not fade when pressed", q: "Is there a rash of small red or purple spots that does not fade when you press a glass on it?",
    why: "A rash that does not fade when pressed can be a sign of a serious blood infection.",
    phrases: ["rash does not fade", "rash doesnt fade", "rash doesn t fade", "purple spots", "purple rash", "non blanching"] },

  // Bones, joints and injuries
  { id: "back_pain", name: "Back or waist pain", q: "Do you have back or waist pain?",
    phrases: ["back pain", "backache", "back ache", "waist pain", "lower back pain", "my back dey pain", "my waist dey pain", "ciwon baya"],
    combos: [[["back", "waist", "spine"], PAIN]] },
  { id: "joint_pain", name: "Joint pain", q: "Do you have pain in your joints (knees, hips, ankles, wrists, fingers)?",
    phrases: ["joint pain", "joint pains", "arthritis", "knee pain", "joints dey pain"],
    combos: [[["joint", "joints", "knee", "knees", "ankle", "ankles", "wrist", "wrists", "elbow", "elbows", "hip", "hips", "shoulder", "shoulders", "finger", "fingers", "toe", "toes"], PAIN]] },
  { id: "joint_swelling", name: "Swollen joint", q: "Are any joints swollen?",
    phrases: ["swollen joint", "swollen joints", "swollen knee", "swollen ankle", "joint swelling", "knee swelling", "knee don swell"],
    combos: [[["joint", "joints", "knee", "knees", "wrist", "elbow", "finger", "fingers", "toe"], ["swollen", "swelling", "swell", "swelled"]]] },
  { id: "red_hot_joint", name: "Red, hot joint", q: "Is the painful joint red and hot to touch?",
    phrases: ["red joint", "hot joint", "joint is hot", "red and hot", "gout"] },
  { id: "bone_pain", name: "Severe bone pain", q: "Do you have severe pain in your bones, chest, back or limbs (like a sickle cell crisis)?",
    phrases: ["bone pain", "bones pain", "bones dey pain", "sickle cell crisis", "pain crisis"], combos: [[["bone", "bones"], PAIN]] },
  { id: "injury", name: "Injury or accident", q: "Did this start after an injury, fall or accident?",
    phrases: ["injury", "injured", "fell down", "fall down", "fell off", "had a fall", "accident", "twisted my", "sprain", "sprained", "fracture", "broken bone", "broke my", "hit my"] },
  { id: "severe_bleeding", name: "Bleeding that will not stop", q: "Is there heavy bleeding that will not stop with firm pressure?",
    phrases: ["bleeding heavily", "heavy bleeding", "wont stop bleeding", "won t stop bleeding", "bleeding wont stop", "bleeding won t stop", "blood no gree stop", "losing a lot of blood"] },
  { id: "unusual_bleeding", name: "Unusual bleeding from gums, nose or eyes", q: "Is there unusual bleeding from the gums, nose, eyes or skin?",
    why: "Fever with unusual bleeding can be Lassa fever or another serious infection.",
    phrases: ["bleeding gums", "gums bleeding", "nose bleeding", "nosebleed", "bleeding from nose", "bleeding from my eyes", "bleeding from my mouth", "blood from my nose", "unusual bleeding", "bruising easily"],
    combos: [[["gum", "gums", "nose", "eye", "eyes", "ear", "ears"], ["bleeding", "bleed", "bleeds", "bled"]]] },

  // Mind and sleep
  { id: "low_mood", name: "Low mood", q: "Have you been feeling down, sad or hopeless most days?",
    phrases: ["depressed", "depression", "sad", "sadness", "hopeless", "low mood", "feeling down", "no joy", "unhappy", "i no happy"] },
  { id: "anxiety", name: "Anxiety or worry", q: "Have you been feeling very anxious, worried or panicky?",
    phrases: ["anxiety", "anxious", "worried", "worry", "panic", "panic attack", "nervous", "fear", "restless", "overthinking", "thinking too much"] },
  { id: "sleep_problems", name: "Sleep problems", q: "Are you having trouble sleeping?",
    phrases: ["cant sleep", "can t sleep", "insomnia", "trouble sleeping", "no sleep", "not sleeping", "sleepless", "i no dey sleep"] },
  { id: "suicidal_thoughts", name: "Thoughts of suicide or self-harm", q: "Have you had thoughts of ending your life or harming yourself?",
    why: "If so, you deserve support right away.",
    phrases: ["suicide", "suicidal", "kill myself", "end my life", "want to die", "self harm", "harm myself", "hurt myself", "take my life", "i wan die"] },

  // Poisoning and bites
  { id: "poisoning", name: "Poisoning or overdose", q: "Has the person swallowed poison, chemicals, too many tablets or something harmful?",
    phrases: ["poison", "poisoned", "poisoning", "overdose", "swallowed chemical", "drank chemical", "drank kerosene", "sniper", "rat poison", "took too many tablets"] },
  { id: "snake_bite", name: "Snake bite", q: "Were you bitten by a snake?", phrases: ["snake bite", "snakebite", "bitten by a snake", "snake bit", "snake don bite"] },
  { id: "animal_bite", name: "Dog or animal bite", q: "Were you bitten or scratched by a dog or another animal?",
    phrases: ["dog bite", "dog bit", "bitten by a dog", "monkey bite", "animal bite", "cat bite", "dog don bite"] },

  // Known long-term conditions
  { id: "sickle_cell_known", name: "Has sickle cell disease", q: "Do you have sickle cell disease (genotype SS or SC)?",
    phrases: ["sickle cell", "sickler", "genotype ss", "genotype sc", "i am ss", "my genotype is ss", "sickle"] },
  { id: "diabetes_known", name: "Has diabetes", q: "Have you been told you have diabetes (high blood sugar)?",
    phrases: ["diabetic", "diabetes", "sugar level", "blood sugar", "high sugar", "sugar disease"] },
  { id: "hypertension_known", name: "Has high blood pressure", q: "Have you been told you have high blood pressure?",
    phrases: ["high blood pressure", "hypertension", "hypertensive", "bp is high", "bp high", "high bp", "my bp"] },
  { id: "asthma_known", name: "Has asthma", q: "Have you been told you have asthma?",
    phrases: ["asthma", "asthmatic", "inhaler"] },
];

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------
export const CONDITIONS: Condition[] = [
  { id: "malaria", name: "Malaria", specialty: "General Practice", level: "consultation_24", prior: 10, childPrior: 1.3, course: "acute",
    about: "An infection spread by mosquitoes that causes fever, chills and body aches. It should be confirmed with a test (a rapid test or a blood film) before treatment.",
    advice: "Rest, drink plenty of fluids and get tested. Do not start malaria medicines without a test result or a health worker's advice.",
    s: { fever: 0.95, high_fever: 0.4, chills: 0.7, sweating: 0.5, headache: 0.75, body_aches: 0.65, fatigue: 0.7, loss_of_appetite: 0.5, bitter_taste: 0.3, nausea: 0.35, vomiting: 0.3, abdominal_pain: 0.15, diarrhoea: 0.1, cough: 0.1, dizziness: 0.2, joint_pain: 0.25, back_pain: 0.15 } },
  { id: "typhoid", name: "Typhoid fever", specialty: "General Practice", level: "consultation_24", prior: 3, course: "subacute",
    about: "A bacterial infection from contaminated food or water. It usually causes a fever that builds up over several days, with stomach symptoms.",
    advice: "Drink safe water and plenty of fluids. Typhoid needs proper testing and treatment from a doctor.",
    s: { fever: 0.95, high_fever: 0.35, headache: 0.6, abdominal_pain: 0.55, constipation: 0.3, diarrhoea: 0.3, fatigue: 0.7, loss_of_appetite: 0.6, body_aches: 0.4, vomiting: 0.2, nausea: 0.3, cough: 0.2, chills: 0.3 } },
  { id: "common_cold", name: "Common cold", specialty: "General Practice", level: "self_care", selfCare: true, prior: 12, childPrior: 1.3, course: "acute",
    about: "A mild viral infection of the nose and throat. It usually gets better on its own within 7 to 10 days.",
    advice: "Rest, drink warm fluids and use steam or saline to ease a blocked nose.",
    s: { runny_nose: 0.9, blocked_nose: 0.7, sneezing: 0.7, sore_throat: 0.5, cough: 0.6, headache: 0.3, fever: 0.2, fatigue: 0.3, body_aches: 0.2, hoarse_voice: 0.2 } },
  { id: "flu", name: "Flu-like illness", specialty: "General Practice", level: "consultation", selfCare: true, prior: 5, course: "acute",
    about: "A viral infection that causes fever, body aches, cough and tiredness. Most people recover in about a week.",
    advice: "Rest, drink plenty of fluids and stay away from others while you have a fever.",
    s: { fever: 0.85, high_fever: 0.3, body_aches: 0.8, cough: 0.7, headache: 0.6, fatigue: 0.8, sore_throat: 0.5, chills: 0.5, runny_nose: 0.4, loss_of_appetite: 0.4 } },
  { id: "tonsillitis", name: "Throat infection (tonsillitis or pharyngitis)", specialty: "ENT", level: "consultation", selfCare: true, prior: 5, childPrior: 1.4, course: "acute",
    about: "An infection of the throat or tonsils that causes a sore throat and pain when swallowing.",
    advice: "Drink warm fluids and gargle with warm salt water.",
    s: { sore_throat: 0.95, difficulty_swallowing: 0.7, fever: 0.6, headache: 0.3, ear_pain: 0.2, cough: 0.15, hoarse_voice: 0.2, fatigue: 0.3 } },
  { id: "sinusitis", name: "Sinusitis", specialty: "ENT", level: "consultation", selfCare: true, prior: 3, course: "subacute",
    about: "Swelling of the sinuses, often after a cold, causing a blocked nose and pressure in the face.",
    advice: "Steam inhalation and saline nose rinses can help.",
    s: { blocked_nose: 0.8, facial_pain: 0.7, headache: 0.6, runny_nose: 0.6, fever: 0.3, cough: 0.3, sneezing: 0.2 } },
  { id: "otitis", name: "Ear infection", specialty: "ENT", level: "consultation", prior: 3, childPrior: 2, course: "acute",
    about: "An infection of the ear, common in children, causing ear pain and sometimes fever or discharge.",
    advice: "Keep the ear dry and do not put anything inside it.",
    s: { ear_pain: 0.9, fever: 0.4, hearing_loss: 0.4, ear_discharge: 0.3, runny_nose: 0.3, headache: 0.15 } },
  { id: "pneumonia", name: "Chest infection (pneumonia)", specialty: "Pulmonology", level: "consultation_24", prior: 3, childPrior: 1.3, course: "acute",
    about: "An infection of the lungs that causes cough, fever and difficulty breathing. It needs prompt medical care.",
    s: { cough: 0.9, productive_cough: 0.6, fever: 0.85, high_fever: 0.4, shortness_of_breath: 0.6, fast_breathing: 0.5, chest_pain: 0.4, fatigue: 0.6, chills: 0.5, loss_of_appetite: 0.4 } },
  { id: "asthma", name: "Asthma flare-up", specialty: "Pulmonology", level: "consultation_24", prior: 2, course: "acute",
    about: "Narrowing of the airways that causes wheezing, coughing and shortness of breath.",
    advice: "If you have a reliever inhaler prescribed for you, use it as your doctor told you. Sit upright and stay calm.",
    s: { wheezing: 0.85, shortness_of_breath: 0.85, cough: 0.6, chest_pain: 0.3, asthma_known: 0.6, fast_breathing: 0.3 } },
  { id: "tuberculosis", name: "Tuberculosis (TB)", specialty: "Pulmonology", level: "consultation", prior: 1.5, course: "chronic", minAge: 1,
    about: "A lung infection that causes a long-lasting cough (2 weeks or more), night sweats and weight loss. It is curable with treatment.",
    advice: "Cover your mouth when coughing and get tested soon.",
    s: { cough: 0.95, productive_cough: 0.5, night_sweats: 0.6, weight_loss: 0.6, fever: 0.6, cough_blood: 0.25, fatigue: 0.6, loss_of_appetite: 0.5, chest_pain: 0.3, shortness_of_breath: 0.3 } },
  { id: "gastroenteritis", name: "Stomach infection (gastroenteritis)", specialty: "General Practice", level: "consultation", selfCare: true, prior: 8, childPrior: 1.3, course: "acute",
    about: "An infection of the gut, often from food or water, that causes diarrhoea and vomiting. It usually settles in a few days.",
    advice: "Drink oral rehydration solution (ORS) or clean fluids in small, frequent sips, and keep eating light food.",
    s: { diarrhoea: 0.9, vomiting: 0.6, nausea: 0.6, abdominal_pain: 0.6, fever: 0.3, loss_of_appetite: 0.4, fatigue: 0.3, signs_dehydration: 0.15, watery_diarrhoea_profuse: 0.1 } },
  { id: "cholera", name: "Cholera", specialty: "General Practice", level: "consultation_24", prior: 0.4, course: "acute",
    about: "A gut infection from contaminated water that causes large amounts of watery diarrhoea and can quickly lead to severe dehydration.",
    advice: "Start oral rehydration solution (ORS) right away and keep drinking while you go to a health facility.",
    s: { diarrhoea: 0.97, watery_diarrhoea_profuse: 0.9, vomiting: 0.7, signs_dehydration: 0.7, abdominal_pain: 0.2, fatigue: 0.5, fever: 0.05 } },
  { id: "dysentery", name: "Dysentery (bloody diarrhoea)", specialty: "General Practice", level: "consultation_24", prior: 1.2, course: "acute",
    about: "A gut infection that causes diarrhoea with blood, stomach cramps and often fever.",
    advice: "Drink oral rehydration solution (ORS) and see a doctor.",
    s: { bloody_stool: 0.9, diarrhoea: 0.9, abdominal_pain: 0.7, fever: 0.5, nausea: 0.3, fatigue: 0.4 } },
  { id: "gastritis", name: "Gastritis or stomach ulcer", specialty: "Gastroenterology", level: "consultation", prior: 6, course: "chronic", minAge: 12,
    about: "Irritation or a sore in the lining of the stomach, causing upper stomach pain, often linked to meals.",
    advice: "Eat small regular meals and avoid alcohol, smoking and very spicy food.",
    s: { upper_abdominal_pain: 0.85, abdominal_pain: 0.8, heartburn: 0.5, nausea: 0.45, bloating: 0.5, vomiting: 0.2, loss_of_appetite: 0.3, black_stool: 0.05 } },
  { id: "gerd", name: "Acid reflux", specialty: "Gastroenterology", level: "consultation", selfCare: true, prior: 4, course: "chronic", minAge: 12,
    about: "Stomach acid coming back up into the food pipe, causing heartburn, especially after meals or when lying down.",
    advice: "Eat smaller meals, avoid eating late at night and raise the head of your bed.",
    s: { heartburn: 0.9, upper_abdominal_pain: 0.5, abdominal_pain: 0.4, chest_pain: 0.3, cough: 0.15, hoarse_voice: 0.1, nausea: 0.2, bloating: 0.3 } },
  { id: "appendicitis", name: "Appendicitis", specialty: "General Surgery", level: "emergency", prior: 0.8, course: "acute", minAge: 2,
    about: "Swelling of the appendix that causes stomach pain moving to the lower right side. It often needs surgery.",
    s: { abdominal_pain: 0.95, lower_right_abdominal_pain: 0.85, nausea: 0.6, vomiting: 0.5, fever: 0.5, loss_of_appetite: 0.7, constipation: 0.2, diarrhoea: 0.1 } },
  { id: "constipation", name: "Constipation", specialty: "General Practice", level: "self_care", selfCare: true, prior: 3, course: "subacute",
    about: "Hard or infrequent stools, often linked to diet, low fluid intake or low activity.",
    advice: "Drink more water and eat more fruit, vegetables and fibre such as beans and oats.",
    s: { constipation: 0.95, bloating: 0.5, abdominal_pain: 0.5, loss_of_appetite: 0.15 } },
  { id: "uti", name: "Urinary tract infection (UTI)", specialty: "General Practice", level: "consultation", prior: 4, course: "acute", minAge: 1,
    about: "An infection of the bladder that causes burning when passing urine and needing to go often. It is common in women.",
    advice: "Drink plenty of water and don't hold your urine.",
    s: { painful_urination: 0.9, frequent_urination: 0.8, pelvic_pain: 0.4, blood_in_urine: 0.2, fever: 0.15, flank_pain: 0.1 } },
  { id: "pyelonephritis", name: "Kidney infection", specialty: "Urology", level: "consultation_24", prior: 0.8, course: "acute",
    about: "An infection that has spread to the kidneys, causing fever, pain in the side and feeling very unwell.",
    s: { fever: 0.85, flank_pain: 0.85, painful_urination: 0.6, frequent_urination: 0.5, vomiting: 0.4, chills: 0.6, nausea: 0.5, back_pain: 0.4 } },
  { id: "kidney_stone", name: "Kidney stone", specialty: "Urology", level: "consultation_24", prior: 0.8, course: "acute", minAge: 12,
    about: "A small hard stone in the urinary tract that causes severe pain in the side, often coming in waves.",
    advice: "Drink plenty of water.",
    s: { flank_pain: 0.9, back_pain: 0.5, blood_in_urine: 0.5, nausea: 0.5, vomiting: 0.4, painful_urination: 0.3, abdominal_pain: 0.4 } },
  { id: "prostate", name: "Enlarged prostate", specialty: "Urology", level: "consultation", prior: 1.5, course: "chronic", sex: "male", minAge: 40,
    about: "A common condition in older men where the prostate grows and makes passing urine harder.",
    s: { weak_urine_stream: 0.85, frequent_urination: 0.85, painful_urination: 0.1, blood_in_urine: 0.05 } },
  { id: "sti", name: "Sexually transmitted infection (STI)", specialty: "General Practice", level: "consultation", prior: 2, course: "subacute", minAge: 12,
    about: "An infection passed on through sex. It is common and treatable, and testing is confidential.",
    advice: "Avoid sex until you have been checked and treated.",
    s: { genital_discharge: 0.85, painful_urination: 0.6, pelvic_pain: 0.3, genital_sores: 0.3, itching: 0.2, vaginal_discharge: 0.5 } },
  { id: "vaginal_infection", name: "Vaginal infection (yeast or bacterial)", specialty: "Gynaecology", level: "consultation", prior: 3, course: "subacute", sex: "female", minAge: 10,
    about: "A common imbalance or infection in the vagina that causes itching or unusual discharge.",
    advice: "Wear cotton underwear and avoid douching or perfumed products.",
    s: { vaginal_discharge: 0.9, genital_discharge: 0.6, itching: 0.7, painful_urination: 0.3, pelvic_pain: 0.1 } },
  { id: "period_pain", name: "Painful periods", specialty: "Gynaecology", level: "self_care", selfCare: true, prior: 3, course: "acute", sex: "female", minAge: 10, maxAge: 55,
    about: "Cramping pain in the lower belly around the time of a period. Very painful or heavy periods should be checked.",
    advice: "A warm compress on the lower belly and gentle exercise can help.",
    s: { period_pain: 0.95, pelvic_pain: 0.85, abdominal_pain: 0.6, back_pain: 0.4, nausea: 0.2, headache: 0.2 } },
  { id: "pregnancy", name: "Pregnancy-related symptoms", specialty: "Obstetrics", level: "consultation", prior: 2, course: "any", sex: "female", minAge: 12, maxAge: 55, requires: "pregnant",
    about: "Common early pregnancy symptoms include a missed period, nausea and tiredness. Antenatal care helps keep mother and baby healthy.",
    advice: "Book antenatal care. Eat small, frequent meals if you feel sick.",
    s: { pregnant: 0.95, missed_period: 0.8, nausea: 0.6, vomiting: 0.4, fatigue: 0.5, dizziness: 0.2, frequent_urination: 0.3 } },
  { id: "hypertension", name: "High blood pressure", specialty: "Cardiology", level: "consultation", prior: 4, course: "chronic", minAge: 18,
    about: "Blood pressure that is too high. It often has no symptoms but can cause headaches and dizziness, and raises the risk of stroke.",
    advice: "Get your blood pressure checked, cut down on salt and keep taking any blood pressure medicine you have been prescribed.",
    s: { hypertension_known: 0.6, headache: 0.5, dizziness: 0.4, vision_changes: 0.15, palpitations: 0.2, neck_pain: 0.2, chest_pain: 0.1 } },
  { id: "diabetes", name: "High blood sugar (diabetes)", specialty: "Endocrinology", level: "consultation", prior: 2, course: "chronic", minAge: 5,
    about: "Blood sugar that is too high. It causes thirst, passing urine often, tiredness and weight loss.",
    advice: "Get your blood sugar checked soon. Drink water rather than sugary drinks.",
    s: { excessive_thirst: 0.85, frequent_urination: 0.8, weight_loss: 0.4, fatigue: 0.6, vision_changes: 0.3, diabetes_known: 0.4, numbness: 0.3 } },
  { id: "migraine", name: "Migraine", specialty: "Neurology", level: "consultation", selfCare: true, prior: 4, course: "acute", minAge: 6,
    about: "Repeated headaches, often on one side, with sensitivity to light and nausea.",
    advice: "Rest in a quiet, dark room and drink water.",
    s: { headache: 0.97, light_sensitivity: 0.7, nausea: 0.6, vomiting: 0.3, vision_changes: 0.3, dizziness: 0.2 } },
  { id: "tension_headache", name: "Tension headache", specialty: "General Practice", level: "self_care", selfCare: true, prior: 6, course: "any", minAge: 6,
    about: "A common headache that feels like a tight band around the head, often linked to stress, tiredness or poor sleep.",
    advice: "Rest, drink water, take breaks from screens and try to sleep well.",
    s: { headache: 0.97, neck_pain: 0.4, fatigue: 0.3, sleep_problems: 0.25, anxiety: 0.2 } },
  { id: "meningitis", name: "Meningitis", specialty: "Neurology", level: "emergency", prior: 0.3, childPrior: 2, course: "acute",
    about: "A serious infection of the lining of the brain. It causes fever, headache and a stiff neck, and needs emergency treatment.",
    s: { fever: 0.9, high_fever: 0.5, stiff_neck: 0.8, headache: 0.9, light_sensitivity: 0.5, confusion: 0.4, vomiting: 0.5, nonblanching_rash: 0.2, rash: 0.2, very_drowsy: 0.3, seizure: 0.15 } },
  { id: "lassa", name: "Lassa fever", specialty: "General Practice", level: "consultation_24", prior: 0.15, course: "acute",
    about: "A viral illness spread by rats. It starts like malaria and can cause bleeding. Early care improves survival, so it should be checked at a hospital.",
    s: { fever: 0.9, sore_throat: 0.5, body_aches: 0.6, fatigue: 0.7, headache: 0.6, vomiting: 0.4, abdominal_pain: 0.4, diarrhoea: 0.3, chest_pain: 0.2, cough: 0.2, unusual_bleeding: 0.3, face_swelling: 0.1 } },
  { id: "hepatitis", name: "Liver infection (hepatitis)", specialty: "Gastroenterology", level: "consultation_24", prior: 1, course: "subacute",
    about: "Swelling of the liver, often from a virus, which can make the eyes and skin yellow.",
    advice: "Avoid alcohol and herbal mixtures until a doctor has checked you.",
    s: { yellow_eyes: 0.85, dark_urine: 0.6, fatigue: 0.7, loss_of_appetite: 0.6, nausea: 0.5, upper_abdominal_pain: 0.4, abdominal_pain: 0.4, fever: 0.3, vomiting: 0.3 } },
  { id: "sickle_crisis", name: "Sickle cell pain crisis", specialty: "Haematology", level: "consultation_24", prior: 1, childPrior: 1.5, course: "acute", requires: "sickle_cell_known",
    about: "In people with sickle cell disease, blocked blood flow can cause sudden, severe pain in the bones, chest, back or joints.",
    advice: "Drink plenty of fluids, keep warm and rest.",
    s: { sickle_cell_known: 0.95, bone_pain: 0.85, joint_pain: 0.5, back_pain: 0.4, chest_pain: 0.2, fever: 0.3, fatigue: 0.5, yellow_eyes: 0.3, pale_skin: 0.3 } },
  { id: "anaemia", name: "Anaemia (low blood)", specialty: "General Practice", level: "consultation", prior: 2, course: "chronic",
    about: "Not enough red blood cells, which causes tiredness, dizziness and pale skin. It has several causes that a doctor can test for.",
    advice: "Eat iron-rich foods such as beans, leafy greens, eggs, fish and meat.",
    s: { fatigue: 0.85, pale_skin: 0.6, dizziness: 0.5, shortness_of_breath: 0.3, palpitations: 0.3, headache: 0.2, fainting: 0.1 } },
  { id: "angina", name: "Heart-related chest pain", specialty: "Cardiology", level: "consultation_24", prior: 1, course: "subacute", minAge: 30,
    about: "Chest pain caused by reduced blood flow to the heart, often brought on by effort and eased by rest. It needs prompt assessment.",
    s: { chest_pain: 0.9, shortness_of_breath: 0.5, chest_pain_radiating: 0.35, sweating: 0.3, palpitations: 0.3, dizziness: 0.2, hypertension_known: 0.3, diabetes_known: 0.2 } },
  { id: "heart_failure", name: "Heart failure", specialty: "Cardiology", level: "consultation_24", prior: 0.6, course: "chronic", minAge: 30,
    about: "The heart not pumping as well as it should, causing breathlessness, tiredness and swollen legs.",
    s: { shortness_of_breath: 0.85, leg_swelling: 0.8, fatigue: 0.7, cough: 0.3, palpitations: 0.3, hypertension_known: 0.4 } },
  { id: "fungal_skin", name: "Fungal skin infection", specialty: "Dermatology", level: "consultation", selfCare: true, prior: 4, course: "chronic",
    about: "A common skin infection that causes itchy, scaly or ring-shaped patches.",
    advice: "Keep the skin clean and dry and don't share towels or clothes.",
    s: { ring_patches: 0.75, itching: 0.85, rash: 0.7 } },
  { id: "eczema", name: "Eczema or skin allergy", specialty: "Dermatology", level: "consultation", selfCare: true, prior: 3, childPrior: 1.5, course: "chronic",
    about: "Dry, itchy, inflamed skin that comes and goes and can be set off by soaps, heat or allergies.",
    advice: "Use mild, unscented soap and moisturise the skin often.",
    s: { itching: 0.9, rash: 0.8, ring_patches: 0.15 } },
  { id: "urticaria", name: "Allergic skin reaction (hives)", specialty: "Dermatology", level: "consultation", selfCare: true, prior: 2, course: "acute",
    about: "Raised, itchy welts caused by an allergic reaction to food, medicine, insect bites or other triggers.",
    advice: "Avoid anything you think may have caused it.",
    s: { hives: 0.9, itching: 0.9, rash: 0.6, face_swelling: 0.15, sneezing: 0.15 } },
  { id: "scabies", name: "Scabies", specialty: "Dermatology", level: "consultation", prior: 2, childPrior: 1.3, course: "subacute",
    about: "Tiny mites in the skin that cause intense itching, worse at night, and often affect several people in one house.",
    advice: "Wash bedding and clothes in hot water. Everyone in the house may need treatment.",
    s: { itching: 0.95, rash: 0.8 } },
  { id: "chickenpox", name: "Chickenpox", specialty: "General Practice", level: "consultation", prior: 1, childPrior: 3, course: "acute",
    about: "A viral infection that causes an itchy rash of fluid-filled blisters, often with fever.",
    advice: "Keep fingernails short, stay away from pregnant women and babies, and keep the skin cool.",
    s: { blisters: 0.9, rash: 0.9, itching: 0.8, fever: 0.6, fatigue: 0.4, headache: 0.2 } },
  { id: "measles", name: "Measles", specialty: "Pediatrics", level: "consultation_24", prior: 0.4, childPrior: 4, course: "acute",
    about: "A highly contagious viral illness in children that causes fever, cough, red eyes and a rash spreading from the face.",
    advice: "Keep the child away from others and give plenty of fluids.",
    s: { rash: 0.9, fever: 0.9, high_fever: 0.5, cough: 0.7, red_eye: 0.7, runny_nose: 0.7, loss_of_appetite: 0.4 } },
  { id: "conjunctivitis", name: "Eye infection (conjunctivitis / Apollo)", specialty: "Ophthalmology", level: "consultation", prior: 3, course: "acute",
    about: "Redness and irritation of the eye, often with discharge. It spreads easily.",
    advice: "Wash your hands often, don't share towels and don't put anything in the eye that a health worker has not given you.",
    s: { red_eye: 0.95, eye_discharge: 0.7, itching: 0.4, eye_pain: 0.2, vision_changes: 0.05 } },
  { id: "back_strain", name: "Back strain", specialty: "Orthopedics", level: "self_care", selfCare: true, prior: 6, course: "any", minAge: 12,
    about: "Pain from the muscles of the back or waist, often after lifting, long sitting or strain.",
    advice: "Keep gently active, use a warm compress and avoid heavy lifting.",
    s: { back_pain: 0.95, neck_pain: 0.15, injury: 0.2 } },
  { id: "osteoarthritis", name: "Joint wear (osteoarthritis)", specialty: "Orthopedics", level: "consultation", selfCare: true, prior: 3, course: "chronic", minAge: 40,
    about: "Wear of the joints, often the knees and hips, causing pain and stiffness that gets worse with use.",
    advice: "Gentle exercise and keeping a healthy weight help the joints.",
    s: { joint_pain: 0.9, joint_swelling: 0.3, back_pain: 0.2 } },
  { id: "arthritis", name: "Inflamed joint (gout or arthritis)", specialty: "Orthopedics", level: "consultation", prior: 1.2, course: "acute", minAge: 15,
    about: "A joint that suddenly becomes painful, swollen, red and hot.",
    advice: "Rest the joint and raise it.",
    s: { joint_pain: 0.9, joint_swelling: 0.8, red_hot_joint: 0.6, fever: 0.2 } },
  { id: "injury", name: "Injury (sprain or possible fracture)", specialty: "Orthopedics", level: "consultation_24", prior: 3, course: "acute",
    about: "Damage to muscles, ligaments or bones after a fall or accident. An X-ray may be needed.",
    advice: "Rest, apply a cold compress wrapped in cloth, and raise the injured part.",
    s: { injury: 0.95, joint_pain: 0.5, joint_swelling: 0.6, back_pain: 0.2 } },
  { id: "dental", name: "Tooth or gum problem", specialty: "Dentistry", level: "consultation", prior: 3, course: "any",
    about: "Tooth decay or gum infection causing toothache or swelling.",
    advice: "Keep the mouth clean, rinse with warm salt water and avoid very hot, cold or sugary food.",
    s: { toothache: 0.95, face_swelling: 0.15, fever: 0.1, ear_pain: 0.1 } },
  { id: "depression", name: "Depression", specialty: "Psychiatry", level: "consultation", prior: 2, course: "chronic", minAge: 10,
    about: "A common, treatable condition where low mood, loss of interest and tiredness last for weeks.",
    advice: "Talk to someone you trust and keep a regular daily routine.",
    s: { low_mood: 0.9, sleep_problems: 0.6, fatigue: 0.6, loss_of_appetite: 0.4, anxiety: 0.4, weight_loss: 0.15, suicidal_thoughts: 0.1 } },
  { id: "anxiety", name: "Anxiety", specialty: "Psychiatry", level: "consultation", prior: 2, course: "chronic", minAge: 10,
    about: "Worry or fear that is hard to control, sometimes with a racing heart, fast breathing or poor sleep. It is common and treatable.",
    advice: "Slow breathing, regular exercise and cutting down on caffeine can help.",
    s: { anxiety: 0.9, palpitations: 0.5, sleep_problems: 0.5, shortness_of_breath: 0.2, dizziness: 0.3, chest_pain: 0.15, headache: 0.2, low_mood: 0.3 } },
];

// ---------------------------------------------------------------------------
// Emergency red flags: any match stops the interview at once.
// ---------------------------------------------------------------------------
const P = (c: Ctx, id: string) => c.present.has(id);
const any = (c: Ctx, ...ids: string[]) => ids.some((id) => c.present.has(id));

export const RED_FLAGS: RedFlag[] = [
  { id: "stroke", label: "Possible stroke (face drooping, one-sided weakness or slurred speech)", level: "emergency_ambulance",
    when: (c) => any(c, "one_sided_weakness", "face_drooping", "slurred_speech"),
    advice: "Note the time the symptoms started and get to a hospital immediately. Do not give anything to eat or drink." },
  { id: "heart_attack", label: "Chest pain with spreading pain, sweating or breathlessness", level: "emergency_ambulance",
    when: (c) => P(c, "chest_pain") && any(c, "chest_pain_radiating", "sweating", "shortness_of_breath", "fainting"),
    advice: "Stop all activity, sit down and get to a hospital immediately." },
  { id: "breathing", label: "Severe difficulty breathing", level: "emergency_ambulance",
    when: (c) => P(c, "severe_breathing") || (P(c, "shortness_of_breath") && (c.severity ?? 0) >= 8),
    advice: "Sit upright and get to a hospital immediately." },
  { id: "anaphylaxis", label: "Swelling of the face, lips or throat with breathing difficulty", level: "emergency_ambulance",
    when: (c) => P(c, "face_swelling") && any(c, "shortness_of_breath", "wheezing", "severe_breathing", "difficulty_swallowing"),
    advice: "This may be a severe allergic reaction. Get to a hospital immediately." },
  { id: "unconscious", label: "Very drowsy, hard to wake or unconscious", level: "emergency_ambulance",
    when: (c) => P(c, "very_drowsy"),
    advice: "Lay the person on their side and get them to a hospital immediately." },
  { id: "seizure", label: "Seizure or convulsion", level: "emergency_ambulance",
    when: (c) => P(c, "seizure"),
    advice: "Keep the person safe from injury, lay them on their side and do not put anything in their mouth. Get to a hospital immediately." },
  { id: "severe_bleeding", label: "Bleeding that will not stop", level: "emergency_ambulance",
    when: (c) => P(c, "severe_bleeding"),
    advice: "Press firmly on the wound with a clean cloth and get to a hospital immediately." },
  { id: "poisoning", label: "Poisoning or overdose", level: "emergency_ambulance",
    when: (c) => P(c, "poisoning"),
    advice: "Do not make the person vomit. Take the container or tablets with you to the hospital immediately." },
  { id: "snake_bite", label: "Snake bite", level: "emergency_ambulance",
    when: (c) => P(c, "snake_bite"),
    advice: "Keep still and calm, keep the bitten limb still and below heart level, remove rings or tight items, and get to a hospital immediately. Do not cut the wound or apply a tight tourniquet." },
  { id: "thunderclap", label: "Sudden, very severe headache", level: "emergency",
    when: (c) => P(c, "severe_sudden_headache"),
    advice: "Go to the nearest emergency department now." },
  { id: "meningitis", label: "Fever with stiff neck, confusion or a rash that does not fade", level: "emergency",
    when: (c) => (P(c, "fever") && any(c, "stiff_neck", "confusion", "nonblanching_rash")) || P(c, "nonblanching_rash"),
    advice: "Go to the nearest emergency department now." },
  { id: "confusion", label: "New confusion", level: "emergency",
    when: (c) => P(c, "confusion"),
    advice: "Go to the nearest emergency department now." },
  { id: "gi_bleed", label: "Vomiting blood or black, tarry stool", level: "emergency",
    when: (c) => any(c, "vomiting_blood", "black_stool", "gi_bleed_signs"),
    advice: "Go to the nearest emergency department now." },
  { id: "haemorrhagic_fever", label: "Fever with unusual bleeding", level: "emergency",
    when: (c) => P(c, "fever") && P(c, "unusual_bleeding"),
    advice: "Go to the nearest hospital now and tell staff about the fever and bleeding so they can protect you and others." },
  { id: "pregnancy_danger", label: "Danger sign in pregnancy", level: "emergency",
    when: (c) => P(c, "pregnant") && (any(c, "vaginal_bleeding", "reduced_fetal_movement", "leaking_fluid", "vision_changes", "severe_sudden_headache", "fainting") ||
      (P(c, "headache") && (c.severity ?? 0) >= 7) || (any(c, "abdominal_pain", "pelvic_pain") && (c.severity ?? 0) >= 7) || (P(c, "fever") && (c.severity ?? 0) >= 7)),
    advice: "Go to the nearest hospital with a maternity unit now." },
  { id: "suicide", label: "Thoughts of suicide or self-harm", level: "emergency",
    when: (c) => P(c, "suicidal_thoughts"),
    advice: "You deserve help right now. Please go to the nearest emergency department, or ask someone you trust to stay with you and take you there. You do not have to face this alone." },
  { id: "dehydration", label: "Severe dehydration risk", level: "emergency",
    when: (c) => P(c, "signs_dehydration") && (P(c, "watery_diarrhoea_profuse") || c.age < 5 || c.age >= 65 || (c.severity ?? 0) >= 8),
    advice: "Keep sipping oral rehydration solution (ORS) and go to the nearest hospital now." },
  { id: "sickle_emergency", label: "Sickle cell disease with chest pain, breathlessness, high fever, one-sided weakness or severe pain", level: "emergency",
    when: (c) => P(c, "sickle_cell_known") && (any(c, "chest_pain", "shortness_of_breath", "high_fever", "one_sided_weakness") || (any(c, "bone_pain", "abdominal_pain") && (c.severity ?? 0) >= 8)),
    advice: "Go to the nearest emergency department now and tell them you have sickle cell disease." },
  { id: "infant_fever", label: "Fever in a baby under 1 year with poor feeding, drowsiness or fast breathing", level: "emergency",
    when: (c) => c.age < 1 && P(c, "fever") && any(c, "loss_of_appetite", "fast_breathing", "vomiting", "rash"),
    advice: "Take the baby to the nearest hospital now." },
  { id: "acute_abdomen", label: "Severe stomach pain", level: "emergency",
    when: (c) => any(c, "abdominal_pain", "lower_right_abdominal_pain") && (c.severity ?? 0) >= 8,
    advice: "Do not eat or drink until a doctor sees you. Go to the nearest emergency department now." },
];

// ---------------------------------------------------------------------------
// Urgency floors: the final level is never lower than these.
// ---------------------------------------------------------------------------
export const FLOORS: Floor[] = [
  { id: "chest_pain", label: "Chest pain", level: "consultation_24", warn: true, when: (c) => P(c, "chest_pain") },
  { id: "cough_blood", label: "Coughing up blood", level: "consultation_24", warn: true, when: (c) => P(c, "cough_blood") },
  { id: "bloody_stool", label: "Blood in stool", level: "consultation_24", warn: true, when: (c) => P(c, "bloody_stool") },
  { id: "blood_urine", label: "Blood in urine", level: "consultation", warn: true, when: (c) => P(c, "blood_in_urine") },
  { id: "jaundice", label: "Yellow eyes or skin", level: "consultation_24", warn: true, when: (c) => P(c, "yellow_eyes") },
  { id: "dehydration", label: "Signs of dehydration", level: "consultation_24", warn: true, when: (c) => P(c, "signs_dehydration") },
  { id: "fainting", label: "Fainting", level: "consultation_24", warn: true, when: (c) => P(c, "fainting") },
  { id: "face_swelling", label: "Swelling of the face, lips or tongue", level: "consultation_24", warn: true, when: (c) => P(c, "face_swelling") },
  { id: "animal_bite", label: "Animal bite (rabies risk)", level: "consultation_24", warn: true, when: (c) => P(c, "animal_bite") },
  { id: "breathless", label: "Shortness of breath", level: "consultation_24", warn: true, when: (c) => any(c, "shortness_of_breath", "wheezing", "fast_breathing") },
  { id: "high_fever", label: "Very high fever", level: "consultation_24", warn: true, when: (c) => P(c, "high_fever") },
  { id: "rlq", label: "Pain in the lower right stomach with fever or vomiting", level: "emergency", warn: true,
    when: (c) => P(c, "lower_right_abdominal_pain") && any(c, "fever", "vomiting") },
  { id: "infant", label: "Baby under 1 year", level: "consultation_24", warn: false, when: (c) => c.age < 1 },
  { id: "young_child_fever", label: "Fever in a child under 5", level: "consultation_24", warn: false, when: (c) => c.age < 5 && P(c, "fever") },
  { id: "pregnant", label: "Pregnancy", level: "consultation", warn: false, when: (c) => P(c, "pregnant") },
  { id: "pregnant_fever", label: "Fever in pregnancy", level: "consultation_24", warn: true, when: (c) => P(c, "pregnant") && P(c, "fever") },
  { id: "older_adult", label: "Age 65 or over", level: "consultation", warn: false, when: (c) => c.age >= 65 },
  { id: "older_fever", label: "Fever at age 65 or over", level: "consultation_24", warn: false, when: (c) => c.age >= 65 && P(c, "fever") },
  { id: "chronic_condition", label: "Long-term condition", level: "consultation", warn: false,
    when: (c) => any(c, "sickle_cell_known", "diabetes_known") },
  { id: "sickle_fever", label: "Fever with sickle cell disease", level: "consultation_24", warn: true, when: (c) => P(c, "sickle_cell_known") && P(c, "fever") },
  { id: "diabetes_vomiting", label: "Vomiting with diabetes", level: "consultation_24", warn: true, when: (c) => P(c, "diabetes_known") && P(c, "vomiting") },
  { id: "severe", label: "Severe symptoms", level: "consultation_24", warn: false, when: (c) => (c.severity ?? 0) >= 8 },
  { id: "moderate", label: "Moderate symptoms", level: "consultation", warn: false, when: (c) => (c.severity ?? 0) >= 5 },
  { id: "long_fever", label: "Fever lasting more than 3 days", level: "consultation_24", warn: true,
    when: (c) => P(c, "fever") && (c.durationDays ?? 0) > 3 },
  { id: "long_cough", label: "Cough for 2 weeks or more", level: "consultation", warn: true,
    when: (c) => P(c, "cough") && (c.durationDays ?? 0) >= 14 },
  { id: "long_symptoms", label: "Symptoms for more than 2 weeks", level: "consultation", warn: false, when: (c) => (c.durationDays ?? 0) > 14 },
  { id: "weight_loss", label: "Unexplained weight loss", level: "consultation", warn: true, when: (c) => P(c, "weight_loss") },
];

// ---------------------------------------------------------------------------
// Screening questions: asked first (in this order) when the trigger is met,
// so dangerous causes are ruled out before anything else.
// ---------------------------------------------------------------------------
export interface Screen {
  when: (c: Ctx) => boolean;
  ask: string[];
}

const womanOfChildbearingAge = (c: Ctx) => c.sex === "female" && c.age >= 12 && c.age <= 50;

export const SCREENS: Screen[] = [
  { when: (c) => P(c, "chest_pain"), ask: ["chest_pain_radiating", "shortness_of_breath", "sweating"] },
  { when: (c) => P(c, "headache"), ask: ["severe_sudden_headache"] },
  { when: (c) => P(c, "fever") && any(c, "headache", "vomiting"), ask: ["stiff_neck"] },
  { when: (c) => P(c, "fever") && c.age < 16, ask: ["very_drowsy"] },
  { when: (c) => any(c, "shortness_of_breath", "wheezing"), ask: ["severe_breathing"] },
  { when: (c) => P(c, "fever") && any(c, "rash"), ask: ["nonblanching_rash"] },
  { when: (c) => P(c, "hives"), ask: ["face_swelling"] },
  { when: (c) => womanOfChildbearingAge(c) && any(c, "abdominal_pain", "pelvic_pain", "vaginal_bleeding", "nausea", "vomiting", "missed_period", "headache", "fever", "back_pain", "dizziness", "fainting"), ask: ["pregnant"] },
  { when: (c) => P(c, "pregnant"), ask: ["vaginal_bleeding", "reduced_fetal_movement"] },
  { when: (c) => any(c, "vomiting", "diarrhoea"), ask: ["signs_dehydration", "gi_bleed_signs"] },
  { when: (c) => P(c, "diarrhoea"), ask: ["bloody_stool"] },
  { when: (c) => P(c, "toothache"), ask: ["face_swelling", "fever"] },
  { when: (c) => any(c, "abdominal_pain", "upper_abdominal_pain"), ask: ["gi_bleed_signs"] },
  { when: (c) => P(c, "fever") && any(c, "body_aches", "sore_throat", "vomiting", "fatigue"), ask: ["unusual_bleeding"] },
  { when: (c) => any(c, "bone_pain", "joint_pain") || (P(c, "fever") && P(c, "fatigue") && P(c, "yellow_eyes")), ask: ["sickle_cell_known"] },
];

// ---------------------------------------------------------------------------
// The first question when the patient's own words didn't match any symptom.
// ---------------------------------------------------------------------------
export const MAIN_COMPLAINT_OPTIONS: Array<{ label: string; ids: string[] }> = [
  { label: "Fever or feeling hot", ids: ["fever"] },
  { label: "Headache", ids: ["headache"] },
  { label: "Cough, chest or breathing problem", ids: ["cough"] },
  { label: "Chest pain", ids: ["chest_pain"] },
  { label: "Stomach pain, vomiting or diarrhoea", ids: ["abdominal_pain"] },
  { label: "Urine or private parts", ids: ["painful_urination"] },
  { label: "Skin rash or itching", ids: ["rash"] },
  { label: "Back, joint or bone pain", ids: ["joint_pain"] },
  { label: "Ear, nose, throat or teeth", ids: ["sore_throat"] },
  { label: "Eyes", ids: ["red_eye"] },
  { label: "Pregnancy", ids: ["pregnant"] },
  { label: "Injury or accident", ids: ["injury"] },
  { label: "Mood, stress or sleep", ids: ["low_mood"] },
  { label: "Tiredness or weakness", ids: ["fatigue"] },
];
