import { App, Modal, Setting } from 'obsidian';

export class InputPromptModal extends Modal {
    private userInput: string = '';
    private onSubmit: (input: string) => void;
    private title: string;
    private placeholder: string;
    private selectedText: string;

    constructor(
        app: App, 
        title: string,
        placeholder: string,
        selectedText: string,
        onSubmit: (input: string) => void
    ) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.selectedText = selectedText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: this.title });
        
        contentEl.createEl('p', { 
            text: `선택된 텍스트: "${this.selectedText.substring(0, 100)}${this.selectedText.length > 100 ? '...' : ''}"`,
            cls: 'selected-text-preview'
        });

        new Setting(contentEl)
            .setName('추가 질문 (선택사항)')
            .setDesc('이 텍스트에서 특별히 궁금한 점이 있다면 입력하세요. 비워두면 일반적인 설명을 제공합니다.')
            .addTextArea(text => {
                text
                    .setPlaceholder(this.placeholder)
                    .onChange(value => {
                        this.userInput = value;
                    });
                text.inputEl.rows = 4;
                text.inputEl.cols = 50;
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('확인')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.userInput);
                }))
            .addButton(btn => btn
                .setButtonText('취소')
                .onClick(() => {
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
