import { App, PluginSettingTab, Setting } from 'obsidian';
import KnowledgeExpanderPlugin from './main';

export class KnowledgeExpanderSettingTab extends PluginSettingTab {
	plugin: KnowledgeExpanderPlugin;

	constructor(app: App, plugin: KnowledgeExpanderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Knowledge Finder Settings' });

		new Setting(containerEl)
			.setName('AI Provider')
			.setDesc('Select the AI provider to use for knowledge expansion')
			.addDropdown(dropdown => dropdown
				.addOption('openai', 'OpenAI (ChatGPT)')
				.addOption('gemini', 'Google Gemini')
				.addOption('claude', 'Anthropic Claude')
				.setValue(this.plugin.settings.aiProvider)
				.onChange(async (value: 'openai' | 'gemini' | 'claude') => {
					this.plugin.settings.aiProvider = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.aiProvider === 'openai') {
			containerEl.createEl('h3', { text: 'OpenAI Settings' });
			
			new Setting(containerEl)
				.setName('OpenAI API Key')
				.setDesc('Your OpenAI API key')
				.addText(text => text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('OpenAI Model')
				.setDesc('Select the OpenAI model to use')
				.addDropdown(dropdown => dropdown
					.addOption('gpt-5.2', 'GPT-5.2')
					.addOption('gpt-5.2-pro', 'GPT-5.2 Pro')
					.addOption('gpt-5-mini', 'GPT-5 Mini')
					.addOption('gpt-4.1', 'GPT-4.1')
					.addOption('gpt-4.1-mini', 'GPT-4.1 Mini')
					.addOption('gpt-4.1-nano', 'GPT-4.1 Nano')
					.addOption('gpt-4o', 'GPT-4o')
					.addOption('gpt-4o-mini', 'GPT-4o Mini')
					.setValue(this.plugin.settings.openaiModel)
					.onChange(async (value) => {
						this.plugin.settings.openaiModel = value;
						await this.plugin.saveSettings();
					}));
		}

		if (this.plugin.settings.aiProvider === 'gemini') {
			containerEl.createEl('h3', { text: 'Google Gemini Settings' });
			
			new Setting(containerEl)
				.setName('Gemini API Key')
				.setDesc('Your Google Gemini API key')
				.addText(text => text
					.setPlaceholder('API key')
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.geminiApiKey = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Gemini Model')
				.setDesc('Select the Gemini model to use')
				.addDropdown(dropdown => dropdown
					.addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
					.addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
					.addOption('gemini-2.0-flash', 'Gemini 2.0 Flash')
					.setValue(this.plugin.settings.geminiModel)
					.onChange(async (value) => {
						this.plugin.settings.geminiModel = value;
						await this.plugin.saveSettings();
					}));
		}

		if (this.plugin.settings.aiProvider === 'claude') {
			containerEl.createEl('h3', { text: 'Anthropic Claude Settings' });
			
			new Setting(containerEl)
				.setName('Claude API Key')
				.setDesc('Your Anthropic Claude API key')
				.addText(text => text
					.setPlaceholder('sk-ant-...')
					.setValue(this.plugin.settings.claudeApiKey)
					.onChange(async (value) => {
						this.plugin.settings.claudeApiKey = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Claude Model')
				.setDesc('Select the Claude model to use')
				.addDropdown(dropdown => dropdown
					.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
					.addOption('claude-3-opus-20240229', 'Claude 3 Opus')
					.addOption('claude-3-haiku-20240307', 'Claude 3 Haiku')
					.setValue(this.plugin.settings.claudeModel)
					.onChange(async (value) => {
						this.plugin.settings.claudeModel = value;
						await this.plugin.saveSettings();
					}));
		}

		containerEl.createEl('h3', { text: 'Note Settings' });

		new Setting(containerEl)
			.setName('Note Folder Path')
			.setDesc('Folder path where expanded knowledge notes will be saved. Leave empty to use the default new note location.')
			.addText(text => text
				.setPlaceholder('folder/subfolder')
				.setValue(this.plugin.settings.notePath)
				.onChange(async (value) => {
					this.plugin.settings.notePath = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Prompt Settings' });

		new Setting(containerEl)
			.setName('System Prompt')
			.setDesc('The prompt used to generate knowledge expansion. Use this to customize the AI\'s response style.')
			.addTextArea(text => {
				text
					.setPlaceholder('Enter your system prompt...')
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 8;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName('Output Template Path')
			.setDesc('Path to a template file for the generated notes. The template can include {{content}} placeholder for AI response.')
			.addText(text => text
				.setPlaceholder('templates/knowledge-template.md')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
