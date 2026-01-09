export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface KnowledgeExpanderSettings {
	aiProvider: AIProvider;
	openaiApiKey: string;
	openaiModel: string;
	openaiWebSearchModel: string;
	geminiApiKey: string;
	geminiModel: string;
	claudeApiKey: string;
	claudeModel: string;
	notePath: string;
	systemPrompt: string;
	templatePath: string;
}

export const DEFAULT_SETTINGS: KnowledgeExpanderSettings = {
	aiProvider: 'openai',
	openaiApiKey: '',
	openaiModel: 'gpt-4o',
	openaiWebSearchModel: 'gpt-4o-mini',
	geminiApiKey: '',
	geminiModel: 'gemini-1.5-flash',
	claudeApiKey: '',
	claudeModel: 'claude-3-5-sonnet-20241022',
	notePath: '',
	systemPrompt: `이 내용을 파악하기 위해 알아야 하는 배경지식과 추가적인 정보를 자세히 설명해주세요. 1000자 이내로 작성하고, md 파일의 마크다운 형태를 유지해주세요. 기본적인 소제목은 '##'를 사용하고, 최대 '###'까지만 사용합니다.`,
	templatePath: '',
};

export interface AIResponse {
	title: string;
	content: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCost: number;
}

export const PRICING_PER_MILLION_TOKENS = {
	openai: {
		'gpt-4o': { input: 2.50, output: 10.00 },
		'gpt-4o-mini': { input: 0.15, output: 0.60 },
		'gpt-4-turbo': { input: 10.00, output: 30.00 },
		'gpt-4': { input: 30.00, output: 60.00 },
		'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
		'o1': { input: 15.00, output: 60.00 },
		'o1-mini': { input: 3.00, output: 12.00 },
		'o1-preview': { input: 15.00, output: 60.00 },
	},
	gemini: {
		'gemini-1.5-flash': { input: 0.075, output: 0.30 },
		'gemini-1.5-pro': { input: 3.50, output: 10.50 },
		'gemini-2.0-flash': { input: 0.10, output: 0.40 },
	},
	claude: {
		'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
		'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
		'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
	},
} as const;
