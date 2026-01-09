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

	async expandKnowledge(selectedText: string, context: string): Promise<AIResponse> {
		const prompt = this.buildPrompt(selectedText, context);

		switch (this.settings.aiProvider) {
			case 'openai':
				return this.callOpenAI(prompt);
			case 'gemini':
				return this.callGemini(prompt);
			case 'claude':
				return this.callClaude(prompt);
			default:
				throw new Error(`Unknown AI provider: ${this.settings.aiProvider}`);
		}
	}

	private buildPrompt(selectedText: string, context: string): string {
		return `${this.settings.systemPrompt}

---
선택된 텍스트:
"${selectedText}"

주변 맥락:
${context}
---`;
	}

	private async callOpenAI(prompt: string): Promise<AIResponse> {
		if (!this.settings.openaiApiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const response = await requestUrl({
			url: 'https://api.openai.com/v1/chat/completions',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.openaiApiKey}`,
			},
			body: JSON.stringify({
				model: this.settings.openaiModel,
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
			content,
			inputTokens: usage.prompt_tokens,
			outputTokens: usage.completion_tokens,
			totalTokens: usage.total_tokens,
			estimatedCost: this.calculateCost('openai', this.settings.openaiModel, usage.prompt_tokens, usage.completion_tokens),
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
