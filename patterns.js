function patternFromString(string) {
  return string
    .split('\n')
    .map((row) => row.split('').map((cell) => (cell === '1' ? 1 : 0)));
}

function getInversePattern(pattern) {
  return pattern.map((row) => row.map((cell) => (cell === 1 ? 0 : 1)));
}

// MEDIA LAB
const PATTERN_ML_STRING = `1111000
0001000
0001000
1001111
1000001
1000001
1111001`;
const PATTERN_ML = patternFromString(PATTERN_ML_STRING);
const PATTERN_ML_INV = getInversePattern(PATTERN_ML);

// AFFECTIVE COMPUTING
const PATTERN_AC_STRING = `1111111
1000001
1111111
1000001
1011101
1010001
1011101`;
const PATTERN_AC = patternFromString(PATTERN_AC_STRING);
const PATTERN_AC_INV = getInversePattern(PATTERN_AC);

// BIOMECHATRONICS
const PATTERN_B_STRING = `1111111
1000001
1000001
1001110
1000001
1000001
1111111`;
const PATTERN_B = patternFromString(PATTERN_B_STRING);
const PATTERN_B_INV = getInversePattern(PATTERN_B);

// CAMERA CULTURE
const PATTERN_CC_STRING = `1111111
1000000
1011111
1010000
1011111
1000000
1111111`;
const PATTERN_CC = patternFromString(PATTERN_CC_STRING);
const PATTERN_CC_INV = getInversePattern(PATTERN_CC);

// CONFORMABLE DECODERS
const PATTERN_CD_STRING = `1111111
1000000
1001110
1010001
1011111
1000000
1111111`;
const PATTERN_CD = patternFromString(PATTERN_CD_STRING);
const PATTERN_CD_INV = getInversePattern(PATTERN_CD);

// CRITICAL MATTER
const PATTERN_CM_STRING = `1111111
1000000
1111111
0000000
1111111
1001001
1001001`;
const PATTERN_CM = patternFromString(PATTERN_CM_STRING);
const PATTERN_CM_INV = getInversePattern(PATTERN_CM);

// CYBORG PSYCHOLOGY
const PATTERN_CP_STRING = `1101111
1001001
1001001
1001111
1001000
1000001
1111111`;
const PATTERN_CP = patternFromString(PATTERN_CP_STRING);
const PATTERN_CP_INV = getInversePattern(PATTERN_CP);

// FLUID INTERFACES
const PATTERN_FI_STRING = `1010111
1010010
1010010
1010010
1010111
1010000
1111111`;
const PATTERN_FI = patternFromString(PATTERN_FI_STRING);
const PATTERN_FI_INV = getInversePattern(PATTERN_FI);

// FUTURE SKETCHES
const PATTERN_FS_STRING = `1011111
1010000
1011111
1000001
1010011
1010000
1111111`;
const PATTERN_FS = patternFromString(PATTERN_FS_STRING);
const PATTERN_FS_INV = getInversePattern(PATTERN_FS);

// HUMAN DYNAMICS
const PATTERN_HD_STRING = `0111110
1000001
1111111
0000000
1111111
0001000
1111111`;
const PATTERN_HD = patternFromString(PATTERN_HD_STRING);
const PATTERN_HD_INV = getInversePattern(PATTERN_HD);

// LIFELONG KINDERGARTEN
const PATTERN_LK_STRING = `1010001
1010011
1011100
1010011
1010001
1000000
1111111`;
const PATTERN_LK = patternFromString(PATTERN_LK_STRING);
const PATTERN_LK_INV = getInversePattern(PATTERN_LK);

// MOLECULAR MACHINES
const PATTERN_MM_STRING = `1111111
1001001
1001001
0000000
1111111
1001001
1001001`;
const PATTERN_MM = patternFromString(PATTERN_MM_STRING);
const PATTERN_MM_INV = getInversePattern(PATTERN_MM);

// MULTISENSORY INTELLIGENCE
const PATTERN_MI_STRING = `11111111
1001001
1001001
1000001
1001001
1001001
1001001`;
const PATTERN_MI = patternFromString(PATTERN_MI_STRING);
const PATTERN_MI_INV = getInversePattern(PATTERN_MI);

// NANO-CYBERNETIC BIOTREK
const PATTERN_NCB_STRING = `1110111
1010100
1010111
1010000
1010111
0000101
1111111`;
const PATTERN_NCB = patternFromString(PATTERN_NCB_STRING);
const PATTERN_NCB_INV = getInversePattern(PATTERN_NCB);

// OPERA OF THE FUTURE
const PATTERN_OF_STRING = `1111111
0000101
1110101
1010101
1010101
1010101
1110101`;
const PATTERN_OF = patternFromString(PATTERN_OF_STRING);
const PATTERN_OF_INV = getInversePattern(PATTERN_OF);

// PERSONAL ROBOTS
const PATTERN_PR_STRING = `1111111
1000001
1111111
1000000
1011011
1010100
1011111`;
const PATTERN_PR = patternFromString(PATTERN_PR_STRING);
const PATTERN_PR_INV = getInversePattern(PATTERN_PR);

// RESPONSIVE ENVIRONMENTS
const PATTERN_RE_STRING = `1111111
1000000
1011111
1010000
1011111
1010000
1011111`;
const PATTERN_RE = patternFromString(PATTERN_RE_STRING);
const PATTERN_RE_INV = getInversePattern(PATTERN_RE);

// SCULPTING EVOLUTION
const PATTERN_SE_STRING = `1000001
1001001
0111110
1000000
1001111
1001001
1111001`;
const PATTERN_SE = patternFromString(PATTERN_SE_STRING);
const PATTERN_SE_INV = getInversePattern(PATTERN_SE);

// SIGNAL KINETICS
const PATTERN_SK_STRING = `1110111
0001000
1111111
0000000
1001111
1001001
1111001`;
const PATTERN_SK = patternFromString(PATTERN_SK_STRING);
const PATTERN_SK_INV = getInversePattern(PATTERN_SK);

// SPACE ENABLED
const PATTERN_SE2_STRING = `1010101
1010101
1011111
1000000
1011111
1010001
1110001`;
const PATTERN_SE2 = patternFromString(PATTERN_SE_STRING);
const PATTERN_SE2_INV = getInversePattern(PATTERN_SE);

// TANGIBLE MEDIA
const PATTERN_TM_STRING = `1111100
0000100
1000111
1000001
1111101
1000001
1000001`;
const PATTERN_TM = patternFromString(PATTERN_TM_STRING);
const PATTERN_TM_INV = getInversePattern(PATTERN_TM);

// VIRAL COMMUNICATIONS
const PATTERN_VC_STRING = `1010111
1010100
1010100
1010100
1010100
1010100
0100111`;
const PATTERN_VC = patternFromString(PATTERN_VC_STRING);
const PATTERN_VC_INV = getInversePattern(PATTERN_VC);

const GROUP_PATTERNS = {
  'Affective Computing': {
    default: PATTERN_AC,
    inverse: PATTERN_AC_INV,
  },
  Biomechatronics: {
    default: PATTERN_B,
    inverse: PATTERN_B_INV,
  },
  'Camera Culture': {
    default: PATTERN_CC,
    inverse: PATTERN_CC_INV,
  },
  'Conformable Decoders': {
    default: PATTERN_CD,
    inverse: PATTERN_CD_INV,
  },
  'Critical Matter': {
    default: PATTERN_CM,
    inverse: PATTERN_CM_INV,
  },
  'Cyborg Psychology': {
    default: PATTERN_CP,
    inverse: PATTERN_CP_INV,
  },
  'Fluid Interfaces': {
    default: PATTERN_FI,
    inverse: PATTERN_FI_INV,
  },
  'Future Sketches': {
    default: PATTERN_FS,
    inverse: PATTERN_FS_INV,
  },
  'Human Dynamics': {
    default: PATTERN_HD,
    inverse: PATTERN_HD_INV,
  },
  'Lifelong Kindergarten': {
    default: PATTERN_LK,
    inverse: PATTERN_LK_INV,
  },
  'Molecular Machines': {
    default: PATTERN_MM,
    inverse: PATTERN_MM_INV,
  },
  'Multisensory Intelligence': {
    default: PATTERN_MI,
    inverse: PATTERN_MI_INV,
  },
  'Nano-Cybernetic Biotrek': {
    default: PATTERN_NCB,
    inverse: PATTERN_NCB_INV,
  },
  'Opera of the Future': {
    default: PATTERN_OF,
    inverse: PATTERN_OF_INV,
  },
  'Personal Robots': {
    default: PATTERN_PR,
    inverse: PATTERN_PR_INV,
  },
  'Responsive Environments': {
    default: PATTERN_RE,
    inverse: PATTERN_RE_INV,
  },
  'Sculpting Evolution': {
    default: PATTERN_SE,
    inverse: PATTERN_SE_INV,
  },
  'Signal Kinetics': {
    default: PATTERN_SK,
    inverse: PATTERN_SK_INV,
  },
  'Space Enabled': {
    default: PATTERN_SE2,
    inverse: PATTERN_SE2_INV,
  },
  'Tangible Media': {
    default: PATTERN_TM,
    inverse: PATTERN_TM_INV,
  },
  'Viral Communications': {
    default: PATTERN_VC,
    inverse: PATTERN_VC_INV,
  },
};

const GROUP_NAMES = Object.keys(GROUP_PATTERNS);
