import { Component, ElementRef, input, output, ViewChild } from '@angular/core';
import { inputKeys } from './input-keys';

@Component({
  selector: 'td-typing-input',
  templateUrl: './typing-input.html',
  styleUrl: './typing-input.css',
  host: { class: 'block' },
})
export class TypingInputComponent {
  readonly enabled = input(true);
  readonly label = input.required<string>();
  readonly language = input('en');
  readonly keys = output<string[]>();
  readonly pasteBlocked = output<void>();
  @ViewChild('keyboard') private keyboard?: ElementRef<HTMLTextAreaElement>;
  private composing = false;

  focus(): void {
    const field = this.keyboard?.nativeElement;
    if (!field || !this.enabled()) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }

  onInput(event: Event): void {
    const input = event as InputEvent;
    if (this.composing || input.isComposing) return;
    this.commit(input.inputType, input.data);
  }

  compositionStart(): void { this.composing = true; }

  compositionEnd(): void {
    this.composing = false;
    // Some mobile keyboards emit a final input; others only compositionend.
    // Wait for that input before flushing, so accented characters are sent once.
    queueMicrotask(() => {
      if (this.keyboard?.nativeElement.value !== ' ') this.commit('insertCompositionText', null);
    });
  }

  blockPaste(event: Event): void {
    event.preventDefault();
    this.pasteBlocked.emit();
  }

  keydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') this.blockPaste(event);
  }

  private commit(type: string, data: string | null): void {
    const field = this.keyboard?.nativeElement;
    if (!field) return;
    const keys = inputKeys(type, data, field.value);
    field.value = ' ';
    field.setSelectionRange(1, 1);
    if (this.enabled() && keys.length) this.keys.emit(keys);
  }
}
