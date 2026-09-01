import { WORD_ANSWERS } from "./answers";

// Independently curated common five-letter words; see data/words/README.md.
const EXTRA_GUESSES = `
abase abate abbey abide abode abort acute admit adopt adore adult after again agent agile agree
aisle alarm album alert alike alive alley allow alone along alter amber amend angel anger angle
angry anime ankle apart apron argue arise aroma aside asset atlas audio audit avoid awake award
aware awful bacon badge badly bagel basic basin batch bathe baton beast began begin being below
bless blind blink bliss blown boast bonus boost booth bound boxer brace braid brake brand brass
break breed brief broom broth build built burst buyer cable cameo canal canoe carve cause cease
cedar cello champ chaos chart cheat cheek cheer chess chief choir chose civic civil claim class
clerk click cliff cloak close cloth clown coach color comet comic comma condo couch count court
cover crack crash crawl crazy crisp cross crowd crown curve cycle daily dairy daisy dealt death
debut delay delta depth diary digit diner dirty disco dizzy doubt dough dozen draft drama drawn
dress dried drive eager early elbow elder elect elite empty enemy enjoy entry equal error event
every exact exist extra fairy faith false fancy fault favor feast fence fever fewer fiber fifth
fifty fight final first fixed flash fleet flesh float flock flood fluid flush flute found foxes
funny gauge given globe glory glove grand grant great grief group grown guard guess guest guide
habit happy harsh haste haunt heavy hello hinge hobby hotel human ideal image index inner issue
ivory jelly joint judge juice known label large laser later laugh layer learn least leave legal
level limit linen liver lodge logic loose lucky lunch magic major maker march match maybe mayor
medal mercy merit merry meter might minor model motor mouse mouth movie naked nerve never night
noble noise north novel nurse offer olive opera orbit order other ounce outer owner panel panic
paper party pasta patch pause peace peach phone photo piece pilot pinch pitch place plain point
porch power press price print prize proof proud pulse punch pupil purse raise range rapid ratio
reach ready realm reply right robot rocky rough round route royal rural salad sauce scene scope
score scout screw serve seven shade shake shall sharp sheep sheet shelf shell shift shirt shock
shoot short shout sight since skill sleep slice slope small smart smoke snake solid solve south
space spare speak speed spell spend spent split spray staff stage stair stake stand start state
steam steel steep stick still stock store story straw strip study stuff style sugar suite sweet
sword taste teach thank their theme there thick thing think third those three throw tight timer
tired title today topic total touch tower trace track trade treat trend trial trick truck truly
trust truth under union unity until upper upset urban usage usual value video visit voice waste
watch weary weird wheel where which white whole woman women worry worth would write wrong youth
zebra
`.trim().split(/\s+/);

export const ALLOWED_GUESSES = [...WORD_ANSWERS, ...EXTRA_GUESSES];
export const ALLOWED_GUESS_SET = new Set(ALLOWED_GUESSES);
