export declare const RESTATEMENT_REASON: string;
export declare const COMMENT_SPOOF_REASON: string;
export declare const NEGATION_MISMATCH_REASON: string;
export declare const NO_CONTRADICTION_KEYWORDS_REASON: string;
export declare const STOPWORDS: Set<string>;

export declare function normalize(s: string): string;
export declare function tokenize(s: string): string[];
export declare function normalizeForLineMatch(s: string): string;
export declare function findLineNumber(docText: string, quote: string): number;
export declare function isExecutableCodeLine(lineText: string, filePath?: string): boolean;
export declare function hasNegationMismatch(claimText: string, lineText: string): boolean;
export declare function isRestatement(claimText: string, quote: string, lineText: string): boolean;
export declare function hasContradictionKeywords(claimText: string, contradictingLine: string): boolean;
export declare function calculateCodeRelevanceBonus(lineText: string): number;
