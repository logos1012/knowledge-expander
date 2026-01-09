import { Editor, MarkdownView, Menu, Notice, Plugin, TFile } from 'obsidian';
import { AIService } from './ai-service';
import { KeywordExtractor } from './keyword-extractor';
import { KnowledgeExpanderSettingTab } from './settings';
import { DEFAULT_SETTINGS, KnowledgeExpanderSettings } from './types';

export default class KnowledgeExpanderPlugin extends Plugin {
	settings: KnowledgeExpanderSettings;
	aiService: AIService;
	keywordExtractor: KeywordExtractor;

	async onload() {
		await this.loadSettings();

		this.aiService = new AIService(this.settings);
		this.keywordExtractor = new KeywordExtractor(10);

		this.addRibbonIcon('lightbulb', 'Expand Knowledge', () => {
			this.expandSelectedText();
		});

		this.addCommand({
			id: 'expand-knowledge',
			name: 'Expand selected text',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.expandSelectedTextFromEditor(editor, view);
			},
		});

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection) {
					menu.addItem((item) => {
						item
							.setTitle('Expand Knowledge')
							.setIcon('lightbulb')
							.onClick(() => {
								this.expandSelectedTextFromEditor(editor, view);
							});
					});
				}
			})
		);

		this.addSettingTab(new KnowledgeExpanderSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.aiService) {
			this.aiService.updateSettings(this.settings);
		}
	}

	private async expandSelectedText() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active markdown view');
			return;
		}

		const editor = activeView.editor;
		await this.expandSelectedTextFromEditor(editor, activeView);
	}

	private async expandSelectedTextFromEditor(editor: Editor, view: MarkdownView) {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select some text to expand');
			return;
		}

		const context = this.getSurroundingContext(editor);

		new Notice('Expanding knowledge... Please wait.');

		try {
			const response = await this.aiService.expandKnowledge(selection, context);
			
			const now = new Date();
			const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
			const noteTitle = response.title || this.generateFallbackTitle(selection);
			const sanitizedTitle = this.sanitizeFileName(noteTitle);
			const fileName = `${dateStr}_${sanitizedTitle}`;

			const frontMatter = this.generateFrontMatter(selection, view.file?.basename || 'Unknown', response.content);

			let noteContent = await this.getTemplateContent();
			
			const aiContent = response.content;
			if (noteContent) {
				noteContent = noteContent.replace('{{content}}', aiContent);
			} else {
				noteContent = `${frontMatter}\n\n${aiContent}`;
			}

			const savePath = this.getNoteSavePath(fileName);

			const newFile = await this.app.vault.create(savePath, noteContent);

			const wikiLink = `[[${newFile.basename}|${selection}]]`;
			editor.replaceSelection(wikiLink);

			const costStr = response.estimatedCost.toFixed(6);
			new Notice(
				`✅ Knowledge expanded!\n` +
				`📝 Note created: ${newFile.basename}\n` +
				`💰 Estimated cost: $${costStr}\n` +
				`📊 Tokens: ${response.totalTokens}`,
				10000
			);

		} catch (error) {
			console.error('Knowledge expansion error:', error);
			new Notice(`❌ Error: ${error.message}`);
		}
	}

	private getSurroundingContext(editor: Editor): string {
		const cursor = editor.getCursor();
		const lineCount = editor.lineCount();
		const startLine = Math.max(0, cursor.line - 5);
		const endLine = Math.min(lineCount - 1, cursor.line + 5);
		
		let context = '';
		for (let i = startLine; i <= endLine; i++) {
			context += editor.getLine(i) + '\n';
		}
		return context;
	}

	private sanitizeFileName(title: string): string {
		const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
		const WHITESPACE = /\s+/g;

		return title
			.replace(INVALID_FILENAME_CHARS, '')
			.replace(WHITESPACE, ' ')
			.trim();
	}

	private generateFallbackTitle(selection: string): string {
		const MAX_TITLE_LENGTH = 50;
		const MIN_WORD_BOUNDARY = 30;

		let title = this.sanitizeFileName(selection);

		if (title.length > MAX_TITLE_LENGTH) {
			title = title.substring(0, MAX_TITLE_LENGTH).trim();
			const lastSpace = title.lastIndexOf(' ');
			if (lastSpace > MIN_WORD_BOUNDARY) {
				title = title.substring(0, lastSpace);
			}
		}

		return title || 'Expanded Knowledge';
	}

	private generateFrontMatter(selectedText: string, sourceNote: string, aiContent: string): string {
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10);
		const timeStr = now.toISOString().slice(11, 19);

		const combinedText = `${selectedText}\n${aiContent}`;
		const extractedTags = this.keywordExtractor.extractKeywords(combinedText, selectedText);
		
		const baseTags = ['knowledge-expansion', 'ai-generated'];
		const allTags = [...baseTags, ...extractedTags];
		const tagsYaml = allTags.map(t => `  - ${t}`).join('\n');

		return `---
type: knowledge-expansion
source: "[[${sourceNote}]]"
original_text: "${selectedText.replace(/"/g, '\\"').substring(0, 200)}"
created: ${dateStr}T${timeStr}
tags:
${tagsYaml}
aliases: []
related: []
---`;
	}

	private async getTemplateContent(): Promise<string | null> {
		if (!this.settings.templatePath) {
			return null;
		}

		const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templatePath);
		if (templateFile instanceof TFile) {
			return await this.app.vault.read(templateFile);
		}

		return null;
	}

	private getNoteSavePath(fileName: string): string {
		let basePath = this.settings.notePath;
		
		if (!basePath) {
			// @ts-ignore - accessing internal API for default new file location
			const defaultPath = this.app.vault.getConfig('newFileFolderPath') || '';
			basePath = defaultPath;
		}

		if (basePath && !basePath.endsWith('/')) {
			basePath += '/';
		}

		return `${basePath}${fileName}.md`;
	}
}
