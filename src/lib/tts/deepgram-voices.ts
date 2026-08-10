/**
 * Deepgram Aura voice catalog — seeded from the official docs
 * (developers.deepgram.com/docs/tts-models, fetched 2026-08-10).
 *
 * Format: [model, name, gender, age, accent, characteristics, useCases]
 * gender: "feminine" | "masculine"
 * age: "Young Adult" | "Adult" | "Mature"
 */
export type DeepgramVoiceSeed = readonly [
  model: string,
  name: string,
  gender: "feminine" | "masculine",
  age: "Young Adult" | "Adult" | "Mature",
  accent: string,
  useCases: readonly string[],
];

/** 91 Aura-2 voices (41 en · 17 es · 9 nl · 2 fr · 7 de · 10 it · 5 ja) */
export const DEEPGRAM_AURA2_VOICES: DeepgramVoiceSeed[] = [
  // English (41)
  ["aura-2-amalthea-en", "amalthea", "feminine", "Young Adult", "en-ph", ["Casual chat"]],
  ["aura-2-andromeda-en", "andromeda", "feminine", "Adult", "en-us", ["Customer service", "IVR"]],
  ["aura-2-apollo-en", "apollo", "masculine", "Adult", "en-us", ["Casual chat"]],
  ["aura-2-arcas-en", "arcas", "masculine", "Adult", "en-us", ["Customer service", "Casual chat"]],
  ["aura-2-aries-en", "aries", "masculine", "Adult", "en-us", ["Warm", "Energetic"]],
  ["aura-2-asteria-en", "asteria", "feminine", "Adult", "en-us", ["Advertising"]],
  ["aura-2-athena-en", "athena", "feminine", "Mature", "en-us", ["Storytelling"]],
  ["aura-2-atlas-en", "atlas", "masculine", "Mature", "en-us", ["Advertising"]],
  ["aura-2-aurora-en", "aurora", "feminine", "Adult", "en-us", ["Interview"]],
  ["aura-2-callista-en", "callista", "feminine", "Adult", "en-us", ["IVR"]],
  ["aura-2-cora-en", "cora", "feminine", "Adult", "en-us", ["Storytelling"]],
  ["aura-2-cordelia-en", "cordelia", "feminine", "Young Adult", "en-us", ["Storytelling"]],
  ["aura-2-delia-en", "delia", "feminine", "Young Adult", "en-us", ["Interview"]],
  ["aura-2-draco-en", "draco", "masculine", "Adult", "en-gb", ["Storytelling"]],
  ["aura-2-electra-en", "electra", "feminine", "Adult", "en-us", ["IVR", "Advertising", "Customer service"]],
  ["aura-2-harmonia-en", "harmonia", "feminine", "Adult", "en-us", ["Customer service"]],
  ["aura-2-helena-en", "helena", "feminine", "Adult", "en-us", ["IVR", "Casual chat"]],
  ["aura-2-hera-en", "hera", "feminine", "Adult", "en-us", ["Informative"]],
  ["aura-2-hermes-en", "hermes", "masculine", "Adult", "en-us", ["Informative"]],
  ["aura-2-hyperion-en", "hyperion", "masculine", "Adult", "en-au", ["Interview"]],
  ["aura-2-iris-en", "iris", "feminine", "Young Adult", "en-us", ["IVR", "Advertising", "Customer service"]],
  ["aura-2-janus-en", "janus", "feminine", "Adult", "en-us", ["Storytelling"]],
  ["aura-2-juno-en", "juno", "feminine", "Adult", "en-us", ["Interview"]],
  ["aura-2-jupiter-en", "jupiter", "masculine", "Adult", "en-us", ["Informative"]],
  ["aura-2-luna-en", "luna", "feminine", "Young Adult", "en-us", ["IVR"]],
  ["aura-2-mars-en", "mars", "masculine", "Adult", "en-us", ["Customer service"]],
  ["aura-2-minerva-en", "minerva", "feminine", "Adult", "en-us", ["Storytelling"]],
  ["aura-2-neptune-en", "neptune", "masculine", "Adult", "en-us", ["Customer service"]],
  ["aura-2-odysseus-en", "odysseus", "masculine", "Adult", "en-us", ["Advertising"]],
  ["aura-2-ophelia-en", "ophelia", "feminine", "Adult", "en-us", ["Interview"]],
  ["aura-2-orion-en", "orion", "masculine", "Adult", "en-us", ["Informative"]],
  ["aura-2-orpheus-en", "orpheus", "masculine", "Adult", "en-us", ["Customer service", "Storytelling"]],
  ["aura-2-pandora-en", "pandora", "feminine", "Adult", "en-gb", ["IVR", "Informative"]],
  ["aura-2-phoebe-en", "phoebe", "feminine", "Adult", "en-us", ["Customer service"]],
  ["aura-2-pluto-en", "pluto", "masculine", "Adult", "en-us", ["Interview", "Storytelling"]],
  ["aura-2-saturn-en", "saturn", "masculine", "Adult", "en-us", ["Customer service"]],
  ["aura-2-selene-en", "selene", "feminine", "Adult", "en-us", ["Informative"]],
  ["aura-2-thalia-en", "thalia", "feminine", "Adult", "en-us", ["Casual chat", "Customer service", "IVR"]],
  ["aura-2-theia-en", "theia", "feminine", "Adult", "en-au", ["Informative"]],
  ["aura-2-vesta-en", "vesta", "feminine", "Adult", "en-us", ["Customer service", "Interview", "Storytelling"]],
  ["aura-2-zeus-en", "zeus", "masculine", "Adult", "en-us", ["IVR"]],
  // Spanish (17)
  ["aura-2-sirio-es", "sirio", "masculine", "Adult", "es-mx", ["Casual chat", "Interview"]],
  ["aura-2-nestor-es", "nestor", "masculine", "Adult", "es-es", ["Casual chat", "Customer service"]],
  ["aura-2-carina-es", "carina", "feminine", "Adult", "es-es", ["Interview", "Customer service", "IVR"]],
  ["aura-2-celeste-es", "celeste", "feminine", "Young Adult", "es-co", ["Casual chat", "Advertising", "IVR"]],
  ["aura-2-alvaro-es", "alvaro", "masculine", "Adult", "es-es", ["Interview", "Customer service"]],
  ["aura-2-diana-es", "diana", "feminine", "Adult", "es-es", ["Storytelling", "Advertising"]],
  ["aura-2-aquila-es", "aquila", "masculine", "Adult", "es-419", ["Casual chat", "Informative"]],
  ["aura-2-selena-es", "selena", "feminine", "Young Adult", "es-419", ["Customer service", "Informative"]],
  ["aura-2-estrella-es", "estrella", "feminine", "Mature", "es-mx", ["Casual chat", "Interview"]],
  ["aura-2-javier-es", "javier", "masculine", "Adult", "es-mx", ["Casual chat", "IVR", "Storytelling"]],
  ["aura-2-agustina-es", "agustina", "feminine", "Adult", "es-es", ["Interview", "Casual chat"]],
  ["aura-2-antonia-es", "antonia", "feminine", "Adult", "es-ar", ["Customer service", "Interview", "Casual chat"]],
  ["aura-2-gloria-es", "gloria", "feminine", "Young Adult", "es-co", ["Customer service", "Casual chat"]],
  ["aura-2-luciano-es", "luciano", "masculine", "Adult", "es-mx", ["Customer service", "Casual chat"]],
  ["aura-2-olivia-es", "olivia", "feminine", "Adult", "es-mx", ["Customer service", "Casual chat"]],
  ["aura-2-silvia-es", "silvia", "feminine", "Adult", "es-es", ["Customer service", "Casual chat"]],
  ["aura-2-valerio-es", "valerio", "masculine", "Adult", "es-mx", ["Customer service", "Informative"]],
  // Dutch (9)
  ["aura-2-beatrix-nl", "beatrix", "feminine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-daphne-nl", "daphne", "feminine", "Adult", "nl-nl", ["Healthcare", "Interview", "Casual chat", "Audiobook"]],
  ["aura-2-cornelia-nl", "cornelia", "feminine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-sander-nl", "sander", "masculine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-hestia-nl", "hestia", "feminine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-lars-nl", "lars", "masculine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-roman-nl", "roman", "masculine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-rhea-nl", "rhea", "feminine", "Adult", "nl-nl", ["Customer service"]],
  ["aura-2-leda-nl", "leda", "feminine", "Adult", "nl-nl", ["Sales"]],
  // French (2)
  ["aura-2-agathe-fr", "agathe", "feminine", "Adult", "fr-fr", ["Customer service"]],
  ["aura-2-hector-fr", "hector", "masculine", "Adult", "fr-fr", ["Customer service"]],
  // German (7)
  ["aura-2-elara-de", "elara", "feminine", "Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-aurelia-de", "aurelia", "feminine", "Young Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-lara-de", "lara", "feminine", "Young Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-julius-de", "julius", "masculine", "Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-fabian-de", "fabian", "masculine", "Mature", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-kara-de", "kara", "feminine", "Young Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  ["aura-2-viktoria-de", "viktoria", "feminine", "Adult", "de-de", ["Healthcare", "Customer service", "Sales"]],
  // Italian (10)
  ["aura-2-melia-it", "melia", "feminine", "Adult", "it-it", ["Casual chat", "Customer service", "Interview"]],
  ["aura-2-elio-it", "elio", "masculine", "Adult", "it-it", ["Interview", "Casual chat", "Customer service"]],
  ["aura-2-flavio-it", "flavio", "masculine", "Adult", "it-it", ["Casual chat", "Interview", "Customer service"]],
  ["aura-2-maia-it", "maia", "feminine", "Young Adult", "it-it", ["Interview", "Casual chat", "Customer service"]],
  ["aura-2-cinzia-it", "cinzia", "feminine", "Mature", "it-it", ["Customer service", "Interview", "Narration"]],
  ["aura-2-cesare-it", "cesare", "masculine", "Adult", "it-it", ["Casual chat", "Customer service", "Interview", "IVR"]],
  ["aura-2-livia-it", "livia", "feminine", "Adult", "it-it", ["Customer service", "Interview", "Audiobook"]],
  ["aura-2-perseo-it", "perseo", "masculine", "Young Adult", "it-it", ["Casual chat", "Customer service"]],
  ["aura-2-dionisio-it", "dionisio", "masculine", "Adult", "it-it", ["Interview", "Casual chat", "Customer service"]],
  ["aura-2-demetra-it", "demetra", "feminine", "Adult", "it-it", ["Casual chat", "Interview", "Narration"]],
  // Japanese (5)
  ["aura-2-uzume-ja", "uzume", "feminine", "Young Adult", "ja-jp", ["Customer service", "Interview", "IVR"]],
  ["aura-2-ebisu-ja", "ebisu", "masculine", "Young Adult", "ja-jp", ["Casual chat", "Customer service"]],
  ["aura-2-fujin-ja", "fujin", "masculine", "Adult", "ja-jp", ["Interview", "Casual chat", "IVR"]],
  ["aura-2-izanami-ja", "izanami", "feminine", "Adult", "ja-jp", ["Casual chat", "Customer service", "Interview", "IVR"]],
  ["aura-2-ama-ja", "ama", "feminine", "Adult", "ja-jp", ["Interview", "IVR"]],
];

/** 12 Aura-1 voices (English, cheaper tier) */
export const DEEPGRAM_AURA1_VOICES: DeepgramVoiceSeed[] = [
  ["aura-asteria-en", "asteria", "feminine", "Adult", "en-us", ["Advertising"]],
  ["aura-luna-en", "luna", "feminine", "Young Adult", "en-us", ["IVR"]],
  ["aura-stella-en", "stella", "feminine", "Adult", "en-us", ["Customer service"]],
  ["aura-athena-en", "athena", "feminine", "Mature", "en-gb", ["Storytelling"]],
  ["aura-hera-en", "hera", "feminine", "Adult", "en-us", ["Informative"]],
  ["aura-orion-en", "orion", "masculine", "Adult", "en-us", ["Informative"]],
  ["aura-arcas-en", "arcas", "masculine", "Adult", "en-us", ["Customer service", "Casual chat"]],
  ["aura-perseus-en", "perseus", "masculine", "Adult", "en-us", ["Customer service"]],
  ["aura-angus-en", "angus", "masculine", "Adult", "en-ie", ["Storytelling"]],
  ["aura-orpheus-en", "orpheus", "masculine", "Adult", "en-us", ["Customer service", "Storytelling"]],
  ["aura-helios-en", "helios", "masculine", "Adult", "en-gb", ["Customer service"]],
  ["aura-zeus-en", "zeus", "masculine", "Adult", "en-us", ["IVR"]],
];

export const ALL_DEEPGRAM_VOICES: DeepgramVoiceSeed[] = [
  ...DEEPGRAM_AURA2_VOICES,
  ...DEEPGRAM_AURA1_VOICES,
];
