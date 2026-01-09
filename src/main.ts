import { Editor, EditorPosition, MarkdownView, Menu, Notice, Plugin, TFile } from 'obsidian';
import { AIService } from './ai-service';
import { InputPromptModal } from './input-modal';
import { KeywordExtractor } from './keyword-extractor';
import { KnowledgeExpanderSettingTab } from './settings';
import { DEFAULT_SETTINGS, KnowledgeExpanderSettings } from './types';

interface SelectionContext {
	filePath: string;
	from: EditorPosition;
	to: EditorPosition;
	selectedText: string;
	surroundingContext: string;
	sourceNoteName: string;
}

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
				this.showExpandPrompt(editor, view);
			},
		});

		this.addCommand({
			id: 'web-search',
			name: 'Web search for selected text',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.showWebSearchPrompt(editor, view);
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
								this.showExpandPrompt(editor, view);
							});
					});
					menu.addItem((item) => {
						item
							.setTitle('Web Search')
							.setIcon('search')
							.onClick(() => {
								this.showWebSearchPrompt(editor, view);
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
		this.showExpandPrompt(editor, activeView);
	}

	private showExpandPrompt(editor: Editor, view: MarkdownView) {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select some text to expand');
			return;
		}

		new InputPromptModal(
			this.app,
			'Expand Knowledge',
			'예: 이 개념의 역사적 배경이 궁금해요 / 실제 사례를 알고 싶어요',
			selection,
			(userQuestion) => {
				this.expandSelectedTextFromEditor(editor, view, userQuestion);
			}
		).open();
	}

	private showWebSearchPrompt(editor: Editor, view: MarkdownView) {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select some text to search');
			return;
		}

		new InputPromptModal(
			this.app,
			'Web Search',
			'예: 최신 동향이 궁금해요 / 관련 뉴스를 찾아줘',
			selection,
			(userQuestion) => {
				this.webSearchFromEditor(editor, view, userQuestion);
			}
		).open();
	}

	private async expandSelectedTextFromEditor(editor: Editor, view: MarkdownView, userQuestion: string = '') {
		const selectionCtx = this.captureSelectionContext(editor, view);
		if (!selectionCtx) {
			new Notice('Please select some text to expand');
			return;
		}

		new Notice('Expanding knowledge... Please wait.');

		try {
			const response = await this.aiService.expandKnowledge(
				selectionCtx.selectedText,
				selectionCtx.surroundingContext,
				userQuestion
			);
			
			const now = new Date();
			const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
			const noteTitle = response.title || this.generateFallbackTitle(selectionCtx.selectedText);
			const sanitizedTitle = this.sanitizeFileName(noteTitle);
			const fileName = `${dateStr}_${sanitizedTitle}`;

			const frontMatter = this.generateFrontMatter(
				selectionCtx.selectedText,
				selectionCtx.sourceNoteName,
				response.content
			);

			let noteContent = await this.getTemplateContent();
			
			const aiContent = response.content;
			if (noteContent) {
				noteContent = noteContent.replace('{{content}}', aiContent);
			} else {
				noteContent = `${frontMatter}\n\n${aiContent}`;
			}

			const savePath = this.getNoteSavePath(fileName);

			const newFile = await this.app.vault.create(savePath, noteContent);

			const wikiLink = `[[${newFile.basename}|${selectionCtx.selectedText}]]`;
			await this.replaceTextAtContext(selectionCtx, wikiLink);

			const costStr = response.estimatedCost.toFixed(6);
			this.showClickableNotice(
				`✅ Knowledge expanded!\n` +
				`📝 Note created: ${newFile.basename}\n` +
				`💰 Estimated cost: $${costStr}\n` +
				`📊 Tokens: ${response.totalTokens}\n` +
				`👆 Click to open note`,
				newFile
			);

		} catch (error) {
			console.error('Knowledge expansion error:', error);
			new Notice(`❌ Error: ${error.message}`);
		}
	}

	private showClickableNotice(message: string, file: TFile): void {
		const notice = new Notice(message, 10000);
		notice.noticeEl.style.cursor = 'pointer';
		notice.noticeEl.addEventListener('click', () => {
			this.app.workspace.getLeaf().openFile(file);
			notice.hide();
		});
	}

	private async webSearchFromEditor(editor: Editor, view: MarkdownView, userQuestion: string = '') {
		const selectionCtx = this.captureSelectionContext(editor, view);
		if (!selectionCtx) {
			new Notice('Please select some text to search');
			return;
		}

		new Notice('🔍 Searching the web... Please wait.');

		try {
			const response = await this.aiService.webSearch(
				selectionCtx.selectedText,
				selectionCtx.surroundingContext,
				userQuestion
			);
			
			const now = new Date();
			const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
			const noteTitle = response.title || this.generateFallbackTitle(selectionCtx.selectedText);
			const sanitizedTitle = this.sanitizeFileName(noteTitle);
			const fileName = `${dateStr}_${sanitizedTitle}`;

			const frontMatter = this.generateFrontMatter(
				selectionCtx.selectedText,
				selectionCtx.sourceNoteName,
				response.content
			);

			let noteContent = await this.getTemplateContent();
			
			const aiContent = response.content;
			if (noteContent) {
				noteContent = noteContent.replace('{{content}}', aiContent);
			} else {
				noteContent = `${frontMatter}\n\n${aiContent}`;
			}

			const savePath = this.getNoteSavePath(fileName);

			const newFile = await this.app.vault.create(savePath, noteContent);

			const wikiLink = `[[${newFile.basename}|${selectionCtx.selectedText}]]`;
			await this.replaceTextAtContext(selectionCtx, wikiLink);

			const costStr = response.estimatedCost.toFixed(6);
			this.showClickableNotice(
				`✅ Web search complete!\n` +
				`📝 Note created: ${newFile.basename}\n` +
				`💰 Estimated cost: $${costStr}\n` +
				`📊 Tokens: ${response.totalTokens}\n` +
				`👆 Click to open note`,
				newFile
			);

		} catch (error) {
			console.error('Web search error:', error);
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

	private captureSelectionContext(editor: Editor, view: MarkdownView): SelectionContext | null {
		const selection = editor.getSelection();
		if (!selection || !view.file) {
			return null;
		}

		return {
			filePath: view.file.path,
			from: editor.getCursor('from'),
			to: editor.getCursor('to'),
			selectedText: selection,
			surroundingContext: this.getSurroundingContext(editor),
			sourceNoteName: view.file.basename,
		};
	}

	private async replaceTextAtContext(ctx: SelectionContext, newText: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(ctx.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`❌ Original file not found: ${ctx.filePath}`);
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		let charIndex = 0;
		for (let i = 0; i < ctx.from.line; i++) {
			charIndex += lines[i].length + 1;
		}
		const fromIndex = charIndex + ctx.from.ch;

		charIndex = 0;
		for (let i = 0; i < ctx.to.line; i++) {
			charIndex += lines[i].length + 1;
		}
		const toIndex = charIndex + ctx.to.ch;

		const currentSelectedText = content.substring(fromIndex, toIndex);
		if (currentSelectedText !== ctx.selectedText) {
			new Notice(`⚠️ Original text was modified. Inserting at end of file instead.`);
			const appendedContent = content + '\n\n' + newText;
			await this.app.vault.modify(file, appendedContent);
			return;
		}

		const newContent = content.substring(0, fromIndex) + newText + content.substring(toIndex);
		await this.app.vault.modify(file, newContent);
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
		
		const tagsYaml = extractedTags.map(t => `  - ${t}`).join('\n');

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
