import { requestUrl } from 'obsidian';
import { AIProvider, AIResponse, KnowledgeExpanderSettings, PRICING_PER_MILLION_TOKENS } from './types';

export class AIService {
	private settings: KnowledgeExpanderSettings;

	constructor(settings: KnowledgeExpanderSettings) {
		this.settings = settings;
	}

	updateSettings(settings: KnowledgeExpanderSettings) {
		this.settings = settings;
	}

	async expandKnowledge(selectedText: string, context: string, userQuestion: string = ''): Promise<AIResponse> {
		const prompt = this.buildPrompt(selectedText, context, userQuestion);

		let response: AIResponse;
		switch (this.settings.aiProvider) {
			case 'openai':
				response = await this.callOpenAI(prompt);
				break;
			case 'gemini':
				response = await this.callGemini(prompt);
				break;
			case 'claude':
				response = await this.callClaude(prompt);
				break;
			default:
				throw new Error(`Unknown AI provider: ${this.settings.aiProvider}`);
		}

		const strippedContent = this.stripMarkdownCodeBlock(response.content);
		const parsed = this.parseResponse(strippedContent);
		
		response.title = parsed.title;
		response.content = parsed.content;
		
		return response;
	}

	async webSearch(selectedText: string, context: string, userQuestion: string = ''): Promise<AIResponse> {
		if (!this.settings.openaiApiKey) {
			throw new Error('OpenAI API key is required for web search');
		}

		const prompt = this.buildWebSearchPrompt(selectedText, context, userQuestion);
		const response = await this.callOpenAIWebSearch(prompt);

		const strippedContent = this.stripMarkdownCodeBlock(response.content);
		const parsed = this.parseResponse(strippedContent);
		
		response.title = parsed.title;
		response.content = parsed.content;
		
		return response;
	}

	private stripMarkdownCodeBlock(content: string): string {
		let result = content.trim();
		
		if (result.startsWith('```markdown')) {
			result = result.slice('```markdown'.length);
		} else if (result.startsWith('```md')) {
			result = result.slice('```md'.length);
		} else if (result.startsWith('```')) {
			result = result.slice(3);
		}
		
		if (result.endsWith('```')) {
			result = result.slice(0, -3);
		}
		
		return result.trim();
	}

	private buildPrompt(selectedText: string, context: string, userQuestion: string = ''): string {
		let questionSection = '';
		if (userQuestion.trim()) {
			questionSection = `\n\n사용자의 추가 질문:\n"${userQuestion}"`;
		}

		return `${this.settings.systemPrompt}

반드시 응답의 첫 줄에 이 내용을 요약하는 간결한 제목을 작성해주세요. 제목은 "제목: "으로 시작하고, 20자 이내로 작성합니다.

---
선택된 텍스트:
"${selectedText}"

주변 맥락:
${context}${questionSection}
---`;
	}

	private buildWebSearchPrompt(selectedText: string, context: string, userQuestion: string = ''): string {
		let questionSection = '';
		if (userQuestion.trim()) {
			questionSection = `\n\n사용자의 추가 질문:\n"${userQuestion}"`;
		}

		return `다음 텍스트에 대해 웹 검색을 통해 최신 정보와 관련 내용을 찾아 설명해주세요.

반드시 응답의 첫 줄에 이 내용을 요약하는 간결한 제목을 작성해주세요. 제목은 "제목: "으로 시작하고, 20자 이내로 작성합니다.

1000자 이내로 작성하고, md 파일의 마크다운 형태를 유지해주세요. 기본적인 소제목은 '##'를 사용하고, 최대 '###'까지만 사용합니다.

검색 결과의 출처가 있다면 문서 하단에 참고 자료로 링크를 포함해주세요.

---
선택된 텍스트:
"${selectedText}"

주변 맥락:
${context}${questionSection}
---`;
	}

	private parseResponse(rawContent: string): { title: string; content: string } {
		const lines = rawContent.trim().split('\n');
		let title = '';
		let contentStartIndex = 0;

		if (lines[0].startsWith('제목:') || lines[0].startsWith('제목 :')) {
			title = lines[0].replace(/^제목\s*:\s*/, '').trim();
			contentStartIndex = 1;
			
			while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === '') {
				contentStartIndex++;
			}
		}

		const content = lines.slice(contentStartIndex).join('\n').trim();
		
		return { title, content };
	}

	private isResponsesAPIModel(model: string): boolean {
		return model.startsWith('gpt-5') || model.startsWith('gpt-4.1') || model.startsWith('o3') || model.startsWith('o4');
	}

	private async callOpenAI(prompt: string): Promise<AIResponse> {
		if (!this.settings.openaiApiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const model = this.settings.openaiModel || 'gpt-4o-mini';
		console.log('OpenAI request - model:', model);

		if (this.isResponsesAPIModel(model)) {
			return this.callOpenAIResponses(prompt, model);
		} else {
			return this.callOpenAIChatCompletions(prompt, model);
		}
	}

	private async callOpenAIChatCompletions(prompt: string, model: string): Promise<AIResponse> {
		try {
			const response = await requestUrl({
				url: 'https://api.openai.com/v1/chat/completions',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.settings.openaiApiKey}`,
				},
				body: JSON.stringify({
					model: model,
					messages: [
						{ role: 'user', content: prompt }
					],
					temperature: 0.7,
					max_tokens: 2000,
				}),
			});

			const data = response.json;
			const content = data.choices[0].message.content;
			const usage = data.usage;

			return {
				title: '',
				content,
				inputTokens: usage.prompt_tokens,
				outputTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens,
				estimatedCost: this.calculateCost('openai', model, usage.prompt_tokens, usage.completion_tokens),
			};
		} catch (error) {
			console.error('OpenAI Chat Completions API error:', error);
			console.error('Model used:', model);
			throw error;
		}
	}

	private async callOpenAIResponses(prompt: string, model: string): Promise<AIResponse> {
		try {
			const response = await requestUrl({
				url: 'https://api.openai.com/v1/responses',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.settings.openaiApiKey}`,
				},
				body: JSON.stringify({
					model: model,
					input: prompt,
				}),
			});

			const data = response.json;
			
			let content = '';
			if (data.output && Array.isArray(data.output)) {
				for (const item of data.output) {
					if (item.type === 'message' && item.content) {
						for (const contentItem of item.content) {
							if (contentItem.type === 'output_text') {
								content += contentItem.text;
							}
						}
					}
				}
			}

			const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
			const inputTokens = usage.input_tokens || 0;
			const outputTokens = usage.output_tokens || 0;

			return {
				title: '',
				content,
				inputTokens,
				outputTokens,
				totalTokens: inputTokens + outputTokens,
				estimatedCost: this.calculateCost('openai', model, inputTokens, outputTokens),
			};
		} catch (error) {
			console.error('OpenAI Responses API error:', error);
			console.error('Model used:', model);
			throw error;
		}
	}

	private async callOpenAIWebSearch(prompt: string): Promise<AIResponse> {
		if (!this.settings.openaiApiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const response = await requestUrl({
			url: 'https://api.openai.com/v1/responses',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.openaiApiKey}`,
			},
			body: JSON.stringify({
				model: this.settings.openaiWebSearchModel,
				tools: [{ type: 'web_search_preview' }],
				input: prompt,
			}),
		});

		const data = response.json;
		
		let content = '';
		if (data.output && Array.isArray(data.output)) {
			for (const item of data.output) {
				if (item.type === 'message' && item.content) {
					for (const contentItem of item.content) {
						if (contentItem.type === 'output_text') {
							content += contentItem.text;
						}
					}
				}
			}
		}

		const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
		const inputTokens = usage.input_tokens || 0;
		const outputTokens = usage.output_tokens || 0;

		return {
			title: '',
			content,
			inputTokens,
			outputTokens,
			totalTokens: inputTokens + outputTokens,
			estimatedCost: this.calculateCost('openai', this.settings.openaiWebSearchModel, inputTokens, outputTokens),
		};
	}

	private async callGemini(prompt: string): Promise<AIResponse> {
		if (!this.settings.geminiApiKey) {
			throw new Error('Gemini API key is not configured');
		}

		const response = await requestUrl({
			url: `https://generativelanguage.googleapis.com/v1beta/models/${this.settings.geminiModel}:generateContent?key=${this.settings.geminiApiKey}`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [{
					parts: [{ text: prompt }]
				}],
				generationConfig: {
					temperature: 0.7,
					maxOutputTokens: 2000,
				},
			}),
		});

		const data = response.json;
		const content = data.candidates[0].content.parts[0].text;
		const metadata = data.usageMetadata;

		return {
			title: '',
			content,
			inputTokens: metadata.promptTokenCount,
			outputTokens: metadata.candidatesTokenCount,
			totalTokens: metadata.totalTokenCount,
			estimatedCost: this.calculateCost('gemini', this.settings.geminiModel, metadata.promptTokenCount, metadata.candidatesTokenCount),
		};
	}

	private async callClaude(prompt: string): Promise<AIResponse> {
		if (!this.settings.claudeApiKey) {
			throw new Error('Claude API key is not configured');
		}

		const response = await requestUrl({
			url: 'https://api.anthropic.com/v1/messages',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.settings.claudeApiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: this.settings.claudeModel,
				max_tokens: 2000,
				messages: [
					{ role: 'user', content: prompt }
				],
			}),
		});

		const data = response.json;
		const content = data.content[0].text;
		const usage = data.usage;

		return {
			title: '',
			content,
			inputTokens: usage.input_tokens,
			outputTokens: usage.output_tokens,
			totalTokens: usage.input_tokens + usage.output_tokens,
			estimatedCost: this.calculateCost('claude', this.settings.claudeModel, usage.input_tokens, usage.output_tokens),
		};
	}

	private calculateCost(provider: AIProvider, model: string, inputTokens: number, outputTokens: number): number {
		const providerPricing = PRICING_PER_MILLION_TOKENS[provider] as Record<string, { input: number; output: number }>;
		const modelPricing = providerPricing[model];
		
		if (!modelPricing) {
			return 0;
		}

		const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
		const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
		
		return inputCost + outputCost;
	}
}
