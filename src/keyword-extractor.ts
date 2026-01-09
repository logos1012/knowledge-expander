/**
 * Keyword extraction logic for generating tags from note content
 * Ported from obsidian-keyword-tag-generator
 */

interface KeywordCount {
    [key: string]: number;
}

export class KeywordExtractor {
    private maxTags: number;
    private stopwordsKo: Set<string>;
    private stopwordsEn: Set<string>;

    constructor(maxTags: number = 20) {
        this.maxTags = maxTags;

        // Korean stopwords
        this.stopwordsKo = new Set([
            '이', '그', '저', '것', '수', '등', '및', '의', '가', '을', '를',
            '에', '에서', '으로', '로', '와', '과', '도', '만', '하다',
            '있다', '없다', '되다', '이다', '아니다', '하고', '한다'
        ]);

        // English stopwords
        this.stopwordsEn = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
            'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was',
            'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
        ]);
    }

    /**
     * Extract keywords from text and title
     */
    extractKeywords(text: string, title: string = ''): string[] {
        const keywords: string[] = [];

        // 1. Extract from title (weight 3x)
        if (title) {
            const titleKeywords = this.extractGeneralKeywords(title);
            keywords.push(...titleKeywords, ...titleKeywords, ...titleKeywords);
        }

        // 2. Extract proper nouns (weight 2x)
        const properNouns = this.extractProperNouns(text);
        keywords.push(...properNouns, ...properNouns);

        // 3. Extract general keywords from body
        const bodyKeywords = this.extractGeneralKeywords(text);
        keywords.push(...bodyKeywords);

        // 4. Extract numbers (amounts, dates)
        const numbers = this.extractNumbers(text);
        keywords.push(...numbers);

        // 5. Count frequency and select top keywords
        const keywordFreq = this.countFrequency(keywords);
        const topKeywords = this.getTopKeywords(keywordFreq, this.maxTags);

        return topKeywords;
    }

    /**
     * Extract general keywords (Korean and English)
     */
    private extractGeneralKeywords(text: string): string[] {
        const keywords: string[] = [];

        // Korean keywords (2+ characters)
        const koPattern = /[가-힣]{2,}/g;
        const koMatches = text.match(koPattern) || [];
        const koFiltered = koMatches.filter(w => !this.stopwordsKo.has(w));
        keywords.push(...koFiltered);

        // English keywords (3+ characters, starts with uppercase or all uppercase)
        const enPattern = /\b[A-Z][a-zA-Z]{2,}\b|\b[A-Z]{2,}\b/g;
        const enMatches = text.match(enPattern) || [];
        const enFiltered = enMatches.filter(w => !this.stopwordsEn.has(w.toLowerCase()));
        keywords.push(...enFiltered);

        return keywords;
    }

    /**
     * Extract proper nouns (company names, acronyms, etc.)
     */
    private extractProperNouns(text: string): string[] {
        const properNouns: string[] = [];

        // Company names (주식회사, (주))
        const companyPattern = /(?:주식회사|㈜)?\s*([가-힣A-Za-z]+(?:\s+[가-힣A-Za-z]+)?)/g;
        let match;
        while ((match = companyPattern.exec(text)) !== null) {
            const company = match[1].trim();
            if (company.length >= 2) {
                properNouns.push(company);
            }
        }

        // Capitalized consecutive words (likely proper nouns)
        const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
        const capitalizedMatches = text.match(capitalizedPattern) || [];
        properNouns.push(...capitalizedMatches);

        // Acronyms (2+ uppercase letters)
        const acronymPattern = /\b[A-Z]{2,}\b/g;
        const acronymMatches = text.match(acronymPattern) || [];
        properNouns.push(...acronymMatches);

        return properNouns.map(pn => pn.trim()).filter(pn => pn.length > 0);
    }

    /**
     * Extract important numbers (amounts, dates)
     */
    private extractNumbers(text: string): string[] {
        const numbers: string[] = [];

        // Korean money amounts (1조, 100억, 5만원)
        const moneyPattern = /\d+(?:조|억|만)?원/g;
        const moneyMatches = text.match(moneyPattern) || [];
        numbers.push(...moneyMatches);

        // Dates (2025년, 1월15일)
        const datePattern = /\d{4}년|\d{1,2}월\d{1,2}일/g;
        const dateMatches = text.match(datePattern) || [];
        numbers.push(...dateMatches);

        // Large numbers with units (3,370만명, 100건)
        const largeNumPattern = /\d+(?:,\d{3})*(?:명|건|회|개)/g;
        const largeNumMatches = text.match(largeNumPattern) || [];
        numbers.push(...largeNumMatches);

        return numbers;
    }

    /**
     * Count keyword frequency
     */
    private countFrequency(keywords: string[]): KeywordCount {
        const freq: KeywordCount = {};

        for (const keyword of keywords) {
            freq[keyword] = (freq[keyword] || 0) + 1;
        }

        return freq;
    }

    /**
     * Get top N keywords by frequency
     */
    private getTopKeywords(freq: KeywordCount, topN: number): string[] {
        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([keyword]) => keyword)
            .slice(0, topN);

        return sorted;
    }
}
