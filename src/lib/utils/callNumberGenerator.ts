/**
 * Enhanced Call Number Generator for Dewey Decimal Classification (DDC)
 * with Cutter-Sanborn Numbers - OCLC Standard Implementation
 * 
 * Features:
 * - Full DDC + Cutter number generation
 * - Support for serials/periodicals with volume/issue tracking
 * - Publication year integration
 * - Copy and edition number handling
 * - Enhanced book ID system
 * - Proper shelf-order sorting
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface CallNumberComponents {
	ddc: string;              // Dewey Decimal Classification (e.g., "650")
	cutter: string;           // Cutter number (e.g., "B22")
	year?: string;            // Publication year (e.g., "2025")
	volume?: string;          // Volume number (e.g., "64")
	issue?: string;           // Issue number (e.g., "8")
	copy?: string;            // Copy number (e.g., "c.1")
	edition?: string;         // Edition (e.g., "2nd ed.")
	part?: string;            // Part number (e.g., "pt.1")
}

export interface BookMetadata {
	title: string;
	authorLastName: string;
	authorFirstName?: string;
	category?: string;
	customDDC?: string;
	year?: number;
	volume?: number;
	issue?: number;
	edition?: string;
	copy?: number;
	isSerial?: boolean;       // Is this a journal/magazine/periodical?
	publisher?: string;
}

export interface GeneratedCallNumber {
	full: string;             // Complete call number as displayed on spine
	components: CallNumberComponents;
	bookId: string;           // Unique identifier for the library system
	shelfOrder: string;       // Normalized string for sorting
}

// ============================================================================
// CUTTER-SANBORN TABLE
// ============================================================================

const CUTTER_TABLE: Record<string, string> = {
	// Single letters
	'a': '2', 'b': '2', 'c': '2', 'd': '2', 'e': '2', 'f': '2', 'g': '2', 'h': '2',
	'i': '2', 'j': '2', 'k': '2', 'l': '2', 'm': '2', 'n': '2', 'o': '2', 'p': '2',
	'q': '2', 'r': '2', 's': '2', 't': '2', 'u': '2', 'v': '2', 'w': '2', 'x': '2',
	'y': '2', 'z': '2',
	
	// Two-letter combinations (comprehensive table)
	'ab': '3', 'ac': '4', 'ad': '6', 'ae': '8', 'af': '85', 'ag': '88', 'ah': '92',
	'ai': '94', 'aj': '95', 'ak': '96', 'al': '97', 'am': '98', 'an': '985', 'ao': '993',
	'ap': '995', 'aq': '996', 'ar': '97', 'as': '977', 'at': '978', 'au': '979',
	'av': '98', 'aw': '982', 'ax': '984', 'ay': '985', 'az': '986',
	
	'ba': '3', 'bb': '36', 'bc': '375', 'bd': '39', 'be': '42', 'bf': '43', 'bg': '44',
	'bh': '45', 'bi': '46', 'bj': '47', 'bk': '48', 'bl': '49', 'bm': '5', 'bn': '52',
	'bo': '53', 'bp': '54', 'bq': '545', 'br': '56', 'bs': '57', 'bt': '58', 'bu': '595',
	'bv': '596', 'bw': '597', 'bx': '6', 'by': '98', 'bz': '99',
	
	'ca': '3', 'cb': '36', 'cc': '4', 'cd': '44', 'ce': '46', 'cf': '47', 'cg': '48',
	'ch': '5', 'ci': '57', 'cj': '59', 'ck': '595', 'cl': '6', 'cm': '62', 'cn': '65',
	'co': '68', 'cp': '7', 'cq': '72', 'cr': '73', 'cs': '75', 'ct': '76', 'cu': '8',
	'cv': '82', 'cw': '84', 'cy': '9', 'cz': '95',
	
	'da': '3', 'db': '38', 'dc': '4', 'dd': '43', 'de': '4', 'df': '42', 'dg': '5',
	'dh': '59', 'di': '6', 'dj': '62', 'dk': '65', 'dl': '66', 'dm': '7', 'dn': '72',
	'do': '73', 'dp': '75', 'dq': '76', 'dr': '76', 'ds': '78', 'dt': '8', 'du': '8',
	'dv': '82', 'dw': '85', 'dy': '9', 'dz': '95',
	
	'ea': '3', 'eb': '36', 'ec': '4', 'ed': '44', 'ee': '45', 'ef': '46', 'eg': '47',
	'eh': '5', 'ei': '57', 'ej': '59', 'ek': '595', 'el': '6', 'em': '62', 'en': '65',
	'eo': '68', 'ep': '7', 'eq': '73', 'er': '75', 'es': '8', 'et': '86', 'eu': '9',
	'ev': '95', 'ew': '96', 'ex': '98', 'ey': '985', 'ez': '99',
	
	'fa': '3', 'fb': '36', 'fc': '38', 'fd': '4', 'fe': '42', 'ff': '45', 'fg': '47',
	'fh': '5', 'fi': '53', 'fj': '545', 'fk': '55', 'fl': '6', 'fm': '66', 'fn': '68',
	'fo': '7', 'fp': '73', 'fq': '74', 'fr': '75', 'fs': '8', 'ft': '86', 'fu': '87',
	'fv': '88', 'fw': '89', 'fy': '9', 'fz': '95',
	
	'ga': '3', 'gb': '36', 'gc': '4', 'gd': '45', 'ge': '46', 'gf': '47', 'gg': '48',
	'gh': '5', 'gi': '56', 'gj': '58', 'gk': '59', 'gl': '6', 'gm': '62', 'gn': '65',
	'go': '68', 'gp': '7', 'gq': '74', 'gr': '76', 'gs': '8', 'gt': '85', 'gu': '85',
	'gv': '87', 'gw': '88', 'gy': '9', 'gz': '95',
	
	'ha': '3', 'hb': '33', 'hc': '36', 'hd': '38', 'he': '4', 'hf': '44', 'hg': '46',
	'hh': '5', 'hi': '56', 'hj': '6', 'hk': '62', 'hl': '64', 'hm': '62', 'hn': '65',
	'ho': '68', 'hp': '7', 'hq': '73', 'hr': '74', 'hs': '8', 'ht': '85', 'hu': '86',
	'hv': '87', 'hw': '88', 'hy': '9', 'hz': '95',
	
	'ia': '3', 'ib': '35', 'ic': '4', 'id': '45', 'ie': '5', 'if': '52', 'ig': '55',
	'ih': '56', 'ii': '57', 'ij': '58', 'ik': '59', 'il': '6', 'im': '62', 'in': '65',
	'io': '68', 'ip': '7', 'iq': '73', 'ir': '75', 'is': '8', 'it': '87', 'iu': '88',
	'iv': '9', 'iw': '93', 'ix': '95', 'iy': '97', 'iz': '98',
	
	'ja': '3', 'jb': '37', 'jc': '4', 'jd': '43', 'je': '4', 'jf': '45', 'jg': '47',
	'jh': '5', 'ji': '56', 'jj': '58', 'jk': '59', 'jl': '6', 'jm': '62', 'jn': '65',
	'jo': '6', 'jp': '7', 'jq': '73', 'jr': '73', 'js': '75', 'jt': '78', 'ju': '8',
	'jv': '85', 'jw': '87', 'jy': '9', 'jz': '95',
	
	'ka': '3', 'kb': '35', 'kc': '4', 'kd': '43', 'ke': '43', 'kf': '45', 'kg': '47',
	'kh': '5', 'ki': '56', 'kj': '6', 'kk': '62', 'kl': '64', 'km': '68', 'kn': '7',
	'ko': '73', 'kp': '75', 'kq': '76', 'kr': '75', 'ks': '8', 'kt': '85', 'ku': '9',
	'kv': '93', 'kw': '95', 'ky': '97', 'kz': '98',
	
	'la': '3', 'lb': '36', 'lc': '38', 'ld': '4', 'le': '42', 'lf': '43', 'lg': '45',
	'lh': '5', 'li': '56', 'lj': '59', 'lk': '6', 'll': '62', 'lm': '6', 'ln': '63',
	'lo': '68', 'lp': '7', 'lq': '73', 'lr': '76', 'ls': '8', 'lt': '87', 'lu': '9',
	'lv': '93', 'lw': '95', 'ly': '97', 'lz': '98',
	
	'ma': '3', 'mb': '32', 'mc': '36', 'md': '38', 'me': '4', 'mf': '43', 'mg': '45',
	'mh': '5', 'mi': '54', 'mj': '555', 'mk': '56', 'ml': '6', 'mm': '62', 'mn': '64',
	'mo': '68', 'mp': '7', 'mq': '73', 'mr': '74', 'ms': '76', 'mt': '8', 'mu': '87',
	'mv': '88', 'mw': '89', 'my': '9', 'mz': '95',
	
	'na': '3', 'nb': '32', 'nc': '36', 'nd': '38', 'ne': '4', 'nf': '44', 'ng': '46',
	'nh': '5', 'ni': '54', 'nj': '59', 'nk': '6', 'nl': '62', 'nm': '6', 'nn': '63',
	'no': '68', 'np': '7', 'nq': '73', 'nr': '74', 'ns': '8', 'nt': '85', 'nu': '87',
	'nv': '88', 'nw': '89', 'ny': '9', 'nz': '95',
	
	'oa': '3', 'ob': '36', 'oc': '4', 'od': '44', 'oe': '45', 'of': '47', 'og': '5',
	'oh': '52', 'oi': '54', 'oj': '55', 'ok': '56', 'ol': '6', 'om': '62', 'on': '65',
	'oo': '68', 'op': '7', 'oq': '73', 'or': '73', 'os': '8', 'ot': '85', 'ou': '87',
	'ov': '88', 'ow': '9', 'ox': '93', 'oy': '95', 'oz': '97',
	
	'pa': '3', 'pb': '36', 'pc': '38', 'pd': '4', 'pe': '42', 'pf': '44', 'pg': '46',
	'ph': '5', 'pi': '55', 'pj': '57', 'pk': '6', 'pl': '62', 'pm': '66', 'pn': '68',
	'po': '7', 'pp': '73', 'pq': '74', 'pr': '76', 'ps': '8', 'pt': '85', 'pu': '87',
	'pv': '88', 'pw': '89', 'py': '9', 'pz': '95',
	
	'qa': '3', 'qb': '35', 'qc': '4', 'qd': '43', 'qe': '45', 'qf': '47', 'qg': '5',
	'qh': '52', 'qi': '54', 'qj': '56', 'qk': '58', 'ql': '6', 'qm': '62', 'qn': '65',
	'qo': '68', 'qp': '7', 'qq': '73', 'qr': '75', 'qs': '78', 'qt': '8', 'qu': '85',
	'qv': '87', 'qw': '89', 'qy': '9', 'qz': '95',
	
	'ra': '3', 'rb': '35', 'rc': '38', 'rd': '4', 're': '42', 'rf': '44', 'rg': '46',
	'rh': '5', 'ri': '56', 'rj': '59', 'rk': '6', 'rl': '62', 'rm': '6', 'rn': '63',
	'ro': '68', 'rp': '7', 'rq': '73', 'rr': '76', 'rs': '8', 'rt': '85', 'ru': '85',
	'rv': '87', 'rw': '88', 'ry': '9', 'rz': '95',
	
	'sa': '3', 'sb': '32', 'sc': '36', 'sd': '38', 'se': '4', 'sf': '42', 'sg': '44',
	'sh': '5', 'si': '54', 'sj': '55', 'sk': '56', 'sl': '585', 'sm': '59', 'sn': '6',
	'so': '62', 'sp': '68', 'sq': '7', 'sr': '75', 'ss': '8', 'st': '87', 'su': '9',
	'sv': '93', 'sw': '95', 'sy': '97', 'sz': '98',
	
	'ta': '3', 'tb': '34', 'tc': '36', 'td': '38', 'te': '4', 'tf': '42', 'tg': '44',
	'th': '5', 'ti': '54', 'tj': '55', 'tk': '56', 'tl': '6', 'tm': '62', 'tn': '63',
	'to': '68', 'tp': '7', 'tq': '73', 'tr': '76', 'ts': '8', 'tt': '85', 'tu': '87',
	'tv': '88', 'tw': '9', 'ty': '93', 'tz': '95',
	
	'ua': '3', 'ub': '35', 'uc': '4', 'ud': '44', 'ue': '45', 'uf': '47', 'ug': '5',
	'uh': '52', 'ui': '54', 'uj': '56', 'uk': '58', 'ul': '6', 'um': '62', 'un': '65',
	'uo': '68', 'up': '68', 'uq': '7', 'ur': '75', 'us': '8', 'ut': '87', 'uu': '88',
	'uv': '89', 'uw': '9', 'uy': '93', 'uz': '95',
	
	'va': '3', 'vb': '37', 'vc': '4', 'vd': '44', 've': '45', 'vf': '46', 'vg': '47',
	'vh': '5', 'vi': '55', 'vj': '57', 'vk': '59', 'vl': '6', 'vm': '62', 'vn': '65',
	'vo': '68', 'vp': '7', 'vq': '73', 'vr': '76', 'vs': '8', 'vt': '85', 'vu': '9',
	'vv': '93', 'vw': '95', 'vy': '97', 'vz': '98',
	
	'wa': '3', 'wb': '37', 'wc': '4', 'wd': '43', 'we': '43', 'wf': '45', 'wg': '46',
	'wh': '5', 'wi': '55', 'wj': '57', 'wk': '59', 'wl': '6', 'wm': '62', 'wn': '65',
	'wo': '68', 'wp': '7', 'wq': '73', 'wr': '76', 'ws': '8', 'wt': '85', 'wu': '9',
	'wv': '93', 'ww': '95', 'wy': '97', 'wz': '98',
	
	'xa': '3', 'xb': '35', 'xc': '4', 'xd': '43', 'xe': '45', 'xf': '47', 'xg': '5',
	'xh': '52', 'xi': '54', 'xj': '56', 'xk': '58', 'xl': '6', 'xm': '62', 'xn': '65',
	'xo': '68', 'xp': '7', 'xq': '73', 'xr': '75', 'xs': '8', 'xt': '85', 'xu': '87',
	'xv': '88', 'xw': '89', 'xy': '9', 'xz': '95',
	
	'ya': '3', 'yb': '35', 'yc': '4', 'yd': '43', 'ye': '4', 'yf': '45', 'yg': '47',
	'yh': '5', 'yi': '54', 'yj': '56', 'yk': '58', 'yl': '6', 'ym': '62', 'yn': '65',
	'yo': '68', 'yp': '7', 'yq': '73', 'yr': '75', 'ys': '78', 'yt': '8', 'yu': '9',
	'yv': '93', 'yw': '95', 'yy': '97', 'yz': '98',
	
	'za': '3', 'zb': '32', 'zc': '35', 'zd': '38', 'ze': '4', 'zf': '43', 'zg': '45',
	'zh': '5', 'zi': '54', 'zj': '56', 'zk': '58', 'zl': '6', 'zm': '62', 'zn': '65',
	'zo': '68', 'zp': '7', 'zq': '73', 'zr': '75', 'zs': '78', 'zt': '8', 'zu': '85',
	'zv': '87', 'zw': '89', 'zy': '9', 'zz': '95',
};

// ============================================================================
// COMPREHENSIVE DEWEY DECIMAL CLASSIFICATION MAP
// ============================================================================

const DEWEY_DECIMAL_MAP: Record<string, string> = {
	// 000 - Computer science, information & general works
	'general': '000',
	'knowledge': '001',
	'computer_science': '004',
	'computer': '004.2',
	'programming': '005.1',
	'software_engineering': '005.1',
	'software': '005.3',
	'data': '005.7',
	'database': '005.75',
	'network': '004.678',
	'internet': '004.678',
	'web_development': '006.7',
	'web': '006.76',
	'ai': '006.3',
	'artificial_intelligence': '006.3',
	'machine_learning': '006.31',
	'algorithm': '005.1',
	'reference': '030',
	'encyclopedia': '030',
	'bibliography': '010',
	'library_science': '020',
	'journalism': '070',
	'news': '070.4',
	'publishing': '070.5',

	// 100 - Philosophy & psychology
	'philosophy': '100',
	'metaphysics': '110',
	'epistemology': '121',
	'logic': '160',
	'ethics': '170',
	'ancient_philosophy': '180',
	'modern_philosophy': '190',
	'psychology': '150',
	'consciousness': '153',
	'emotions': '152.4',
	'child_psychology': '155.4',

	// 200 - Religion
	'religion': '200',
	'philosophy_of_religion': '210',
	'theology': '210',
	'bible': '220',
	'christianity': '230',
	'devotional': '242',
	'pastoral': '253',
	'christian_education': '268',
	'judaism': '296',
	'islam': '297',
	'buddhism': '294.3',
	'hinduism': '294.5',

	// 300 - Social sciences
	'social_science': '300',
	'sociology': '301',
	'statistics': '310',
	'political_science': '320',
	'politics': '320',
	'government': '320',
	'law': '340',
	'legal': '340',
	'public_administration': '350',
	'social_services': '361',
	'education': '370',
	'teaching': '371',
	'elementary_education': '372',
	'secondary_education': '373',
	'higher_education': '378',
	'commerce': '380',
	'trade': '380',
	'transportation': '385',
	'communication': '384',
	'customs': '390',
	'folklore': '398',
	'economics': '330',
	'finance': '332',
	'investment': '332.6',
	'banking': '332.1',
	'business': '650',
	'management': '658',
	'marketing': '658.8',
	'accounting': '657',
	'human_resources': '658.3',
	'entrepreneurship': '658.421',

	// 400 - Language
	'language': '400',
	'linguistics': '410',
	'etymology': '412',
	'dictionaries': '413',
	'english': '420',
	'english_grammar': '425',
	'english_writing': '428',
	'german': '430',
	'french': '440',
	'italian': '450',
	'spanish': '460',
	'latin': '470',
	'greek': '480',
	'other_languages': '490',

	// 500 - Natural sciences
	'science': '500',
	'mathematics': '510',
	'algebra': '512',
	'geometry': '516',
	'calculus': '515',
	'statistics_math': '519.5',
	'astronomy': '520',
	'cosmology': '523.1',
	'physics': '530',
	'mechanics': '531',
	'thermodynamics': '536',
	'optics': '535',
	'quantum_physics': '530.12',
	'chemistry': '540',
	'organic_chemistry': '547',
	'biochemistry': '572',
	'earth_sciences': '550',
	'geology': '551',
	'meteorology': '551.5',
	'paleontology': '560',
	'fossils': '560',
	'life_sciences': '570',
	'biology': '570',
	'botany': '580',
	'plants': '580',
	'zoology': '590',
	'animals': '590',
	'mammals': '599',
	'birds': '598',
	'marine_biology': '578.77',
	'ecology': '577',
	'genetics': '576.5',
	'evolution': '576.8',
	'microbiology': '579',

	// 600 - Technology & applied sciences
	'technology': '600',
	'medicine': '610',
	'anatomy': '611',
	'physiology': '612',
	'diseases': '616',
	'surgery': '617',
	'therapeutics': '615',
	'pharmacology': '615.1',
	'nursing': '610.73',
	'dentistry': '617.6',
	'veterinary': '636.089',
	'engineering': '620',
	'mechanical_engineering': '621',
	'electrical_engineering': '621.3',
	'civil_engineering': '624',
	'construction': '624',
	'architecture': '720',
	'environmental_engineering': '628',
	'agriculture': '630',
	'farming': '630',
	'gardening': '635',
	'food': '641',
	'cooking': '641.5',
	'recipes': '641.5',
	'nutrition': '613.2',
	'home_economics': '640',
	'home': '643',
	'child_care': '649',
	'manufacturing': '670',
	'production': '670',
	'chemical_engineering': '660',

	// 700 - Arts & recreation
	'arts': '700',
	'fine_arts': '700',
	'civic_planning': '711',
	'architecture_design': '720',
	'sculpture': '730',
	'drawing': '741',
	'painting': '750',
	'graphic_arts': '760',
	'photography': '770',
	'music': '780',
	'music_theory': '781',
	'musical_instruments': '784',
	'performing_arts': '790',
	'theater': '792',
	'dance': '792.8',
	'film': '791.43',
	'cinema': '791.43',
	'recreation': '790',
	'sports': '796',
	'football': '796.332',
	'basketball': '796.323',
	'baseball': '796.357',
	'soccer': '796.334',
	'athletics': '796.42',
	'games': '794',
	'chess': '794.1',
	'crafts': '745',
	'design': '745',

	// 800 - Literature
	'literature': '800',
	'rhetoric': '808',
	'creative_writing': '808.3',
	'essay': '808.4',
	'speech': '808.5',
	'american_literature': '810',
	'american_poetry': '811',
	'american_drama': '812',
	'american_fiction': '813',
	'american_essays': '814',
	'english_literature': '820',
	'english_poetry': '821',
	'english_drama': '822',
	'british_fiction': '823',
	'fiction': '823',
	'novel': '823',
	'english_essays': '824',
	'german_literature': '830',
	'french_literature': '840',
	'italian_literature': '850',
	'spanish_literature': '860',
	'russian_literature': '891.7',
	'juvenile_fiction': '823',
	'young_adult': '823',
	'science_fiction': '813.0876',
	'mystery': '813.0872',
	'fantasy': '813.0876',
	'poetry': '811',
	'drama': '812',

	// 900 - History & geography
	'history': '900',
	'travel': '910',
	'geography': '910',
	'world_history': '909',
	'ancient_history': '930',
	'archaeology': '930.1',
	'european_history': '940',
	'asian_history': '950',
	'african_history': '960',
	'north_american_history': '970',
	'american_history': '973',
	'us_history': '973',
	'south_american_history': '980',
	'australian_history': '994',
	'biography': '920',
	'genealogy': '929',
	'memoirs': '920',

	// Periodicals/Serials
	'journal': '050',
	'periodical': '050',
	'magazine': '050',
	'serial': '050',
	'newspaper': '070',
	'business_journal': '650',
	'scientific_journal': '500',
	'medical_journal': '610',
	'law_journal': '340',
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generates a Cutter number based on the Cutter-Sanborn table
 * @param authorLastName - Author's last name
 * @returns Cutter number (e.g., "S123")
 */
export function generateCutterNumber(authorLastName: string): string {
	if (!authorLastName || authorLastName.trim().length === 0) {
		return 'A2';
	}

	const cleanName = authorLastName
		.toLowerCase()
		.trim()
		.replace(/[^a-z]/g, '');

	if (cleanName.length === 0) {
		return 'A2';
	}

	const firstLetter = cleanName[0].toUpperCase();
	let cutterValue = '';

	// Progressive lookup: try 3 letters, then 2, then 1
	for (let len = Math.min(cleanName.length, 3); len >= 1; len--) {
		const prefix = cleanName.substring(0, len);
		if (CUTTER_TABLE[prefix]) {
			cutterValue = CUTTER_TABLE[prefix];
			break;
		}
	}

	// Fallback algorithm if not in table
	if (!cutterValue) {
		const secondChar = cleanName.length > 1 ? cleanName[1] : 'a';
		const vowels = 'aeiou';
		const baseValue = vowels.includes(secondChar) ? 2 : 3;
		cutterValue = baseValue.toString();
	}

	return `${firstLetter}${cutterValue}`;
}

/**
 * Gets Dewey Decimal Classification number from category
 * @param category - Category name or keyword
 * @param defaultDDC - Default if not found
 * @returns DDC number
 */
export function getDeweyDecimal(category: string, defaultDDC: string = '000'): string {
	if (!category) return defaultDDC;

	const normalized = category
		.toLowerCase()
		.replace(/[^a-z_]/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^_|_$/g, '');

	return DEWEY_DECIMAL_MAP[normalized] || defaultDDC;
}

/**
 * Enhanced call number generation with full metadata support
 * @param metadata - Complete book metadata
 * @returns Generated call number object
 */
export function generateCallNumber(metadata: BookMetadata): GeneratedCallNumber {
	// Generate DDC
	const ddc = metadata.customDDC || getDeweyDecimal(metadata.category || '', '000');
	
	// Generate Cutter number
	const cutter = generateCutterNumber(metadata.authorLastName);
	
	// Build components
	const components: CallNumberComponents = {
		ddc,
		cutter,
	};

	// Add year if provided
	if (metadata.year) {
		components.year = metadata.year.toString();
	}

	// Add volume/issue for serials
	if (metadata.isSerial) {
		if (metadata.volume) {
			components.volume = metadata.volume.toString();
		}
		if (metadata.issue) {
			components.issue = metadata.issue.toString();
		}
	}

	// Add copy number if provided
	if (metadata.copy && metadata.copy > 1) {
		components.copy = `c.${metadata.copy}`;
	}

	// Add edition if provided
	if (metadata.edition) {
		components.edition = metadata.edition;
	}

	// Format the full call number
	const full = formatCallNumber(components, metadata.isSerial);
	
	// Generate book ID
	const bookId = generateBookId(components, metadata.isSerial);
	
	// Generate shelf order string
	const shelfOrder = generateShelfOrder(components);

	return {
		full,
		components,
		bookId,
		shelfOrder,
	};
}

/**
 * Formats call number components into display string
 * @param components - Call number components
 * @param isSerial - Whether this is a serial/periodical
 * @returns Formatted call number string
 */
export function formatCallNumber(
	components: CallNumberComponents,
	isSerial: boolean = false
): string {
	const parts: string[] = [];

	// Line 1: DDC + Cutter
	parts.push(`${components.ddc} ${components.cutter}`);

	// Line 2: Volume/Issue (for serials) or Year
	if (isSerial) {
		const volumePart: string[] = [];
		if (components.volume) {
			volumePart.push(`Vol.${components.volume}`);
		}
		if (components.issue) {
			volumePart.push(`/${components.issue}`);
		}
		if (volumePart.length > 0) {
			parts.push(volumePart.join(''));
		}
	}

	// Line 3: Year
	if (components.year) {
		parts.push(components.year);
	}

	// Line 4: Copy/Edition
	if (components.copy) {
		parts.push(components.copy);
	} else if (components.edition) {
		parts.push(components.edition);
	}

	return parts.join('\n');
}

/**
 * Generates a unique book ID for the library system
 * @param components - Call number components
 * @param isSerial - Whether this is a serial
 * @returns Book ID string
 */
export function generateBookId(
	components: CallNumberComponents,
	isSerial: boolean = false
): string {
	const parts: string[] = [
		components.ddc.replace(/\./g, '-'),
		components.cutter,
	];

	if (isSerial) {
		if (components.volume) {
			parts.push(`V${components.volume}`);
		}
		if (components.issue) {
			parts.push(`I${components.issue}`);
		}
		if (components.year) {
			parts.push(components.year);
		}
	} else {
		if (components.year) {
			parts.push(components.year);
		}
		if (components.copy) {
			parts.push(components.copy.replace('.', ''));
		}
	}

	return parts.join('.');
}

/**
 * Generates a normalized string for proper shelf ordering
 * @param components - Call number components
 * @returns Shelf order string
 */
export function generateShelfOrder(components: CallNumberComponents): string {
	// Pad DDC parts for proper numeric sorting
	const ddcParts = components.ddc.split('.');
	const ddcMain = ddcParts[0].padStart(3, '0');
	const ddcDecimal = ddcParts[1] ? ddcParts[1].padEnd(6, '0') : '000000';
	
	// Normalize cutter: letter + padded number
	const cutterLetter = components.cutter[0];
	const cutterNumber = components.cutter.substring(1).padStart(4, '0');
	
	const parts = [
		ddcMain,
		ddcDecimal,
		cutterLetter,
		cutterNumber,
	];

	// Add year for chronological ordering
	if (components.year) {
		parts.push(components.year.padStart(4, '0'));
	}

	// Add volume/issue for serials
	if (components.volume) {
		parts.push(components.volume.padStart(4, '0'));
	}
	if (components.issue) {
		parts.push(components.issue.padStart(4, '0'));
	}

	// Add copy number
	if (components.copy) {
		const copyNum = components.copy.replace(/[^0-9]/g, '');
		parts.push(copyNum.padStart(2, '0'));
	}

	return parts.join('|');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parses a call number string back into components
 * @param callNumber - Call number string
 * @returns Components object
 */
export function parseCallNumber(callNumber: string): CallNumberComponents {
	const lines = callNumber.trim().split('\n');
	const components: CallNumberComponents = {
		ddc: '',
		cutter: '',
	};

	if (lines.length === 0) return components;

	// First line: DDC + Cutter
	const firstLine = lines[0].trim().split(/\s+/);
	components.ddc = firstLine[0] || '';
	components.cutter = firstLine[1] || '';

	// Subsequent lines could be volume, year, copy, etc.
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		
		// Check for volume/issue (e.g., "Vol.64/8")
		if (line.match(/^Vol\.\d+/i)) {
			const volumeMatch = line.match(/Vol\.(\d+)/i);
			if (volumeMatch) {
				components.volume = volumeMatch[1];
			}
			const issueMatch = line.match(/\/(\d+)/);
			if (issueMatch) {
				components.issue = issueMatch[1];
			}
		}
		// Check for year (4 digits)
		else if (line.match(/^\d{4}$/)) {
			components.year = line;
		}
		// Check for copy number (e.g., "c.2")
		else if (line.match(/^c\.\d+/i)) {
			components.copy = line;
		}
		// Check for edition
		else if (line.match(/ed\./i)) {
			components.edition = line;
		}
	}

	return components;
}

/**
 * Validates a call number format
 * @param callNumber - Call number to validate
 * @returns True if valid
 */
export function isValidCallNumber(callNumber: string): boolean {
	const lines = callNumber.trim().split('\n');
	if (lines.length === 0) return false;

	// First line must have DDC + Cutter format
	const pattern = /^\d{1,3}(?:\.\d+)?\s+[A-Z]\d+$/;
	return pattern.test(lines[0].trim());
}

/**
 * Compares two call numbers for shelf ordering
 * @param a - First call number
 * @param b - Second call number
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareCallNumbers(
	a: GeneratedCallNumber,
	b: GeneratedCallNumber
): number {
	return a.shelfOrder.localeCompare(b.shelfOrder);
}

/**
 * Sorts an array of call numbers in proper shelf order
 * @param callNumbers - Array of call numbers
 * @returns Sorted array
 */
export function sortCallNumbers(
	callNumbers: GeneratedCallNumber[]
): GeneratedCallNumber[] {
	return [...callNumbers].sort(compareCallNumbers);
}

/**
 * Generates call number label for printing (compact format)
 * @param components - Call number components
 * @param isSerial - Whether this is a serial
 * @returns Compact label string
 */
export function generateLabel(
	components: CallNumberComponents,
	isSerial: boolean = false
): string {
	const lines: string[] = [];
	
	// DDC
	lines.push(components.ddc);
	
	// Cutter
	lines.push(components.cutter);
	
	// Volume/Issue for serials
	if (isSerial && (components.volume || components.issue)) {
		let volumeLine = '';
		if (components.volume) {
			volumeLine += `V.${components.volume}`;
		}
		if (components.issue) {
			volumeLine += `/${components.issue}`;
		}
		if (volumeLine) {
			lines.push(volumeLine);
		}
	}
	
	// Year
	if (components.year) {
		lines.push(components.year);
	}
	
	// Copy
	if (components.copy) {
		lines.push(components.copy);
	}
	
	return lines.join('\n');
}

/**
 * Quick helper to generate call number from simple inputs
 * @param authorLastName - Author's last name
 * @param category - Category or subject
 * @param year - Publication year (optional)
 * @returns Generated call number
 */
export function quickCallNumber(
	authorLastName: string,
	category: string = '',
	year?: number
): GeneratedCallNumber {
	return generateCallNumber({
		title: '',
		authorLastName,
		category,
		year,
	});
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
	generateCallNumber,
	generateCutterNumber,
	getDeweyDecimal,
	formatCallNumber,
	generateBookId,
	generateShelfOrder,
	parseCallNumber,
	isValidCallNumber,
	compareCallNumbers,
	sortCallNumbers,
	generateLabel,
	quickCallNumber,
};