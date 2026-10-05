import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, output, ViewChild } from '@angular/core';

@Component({
  selector: 'td-dialog',
  templateUrl: './dialog.html',
  host: { class: 'contents' },
})
export class Dialog {
  @ViewChild('dialog') private dialog?: ElementRef<HTMLDialogElement>;
  readonly label = input.required<string>();
  readonly dismissible = input(true);
  readonly dismissed = output<void>();

  constructor() {
    afterNextRender(() => this.dialog?.nativeElement.showModal());
    inject(DestroyRef).onDestroy(() => this.dialog?.nativeElement.close());
  }

  cancel(event: Event): void {
    event.preventDefault();
    if (this.dismissible()) this.dismissed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      this.cancel(event);
    }
  }
}
