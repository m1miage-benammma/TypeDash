import { Component, inject } from '@angular/core';
import { PreferencesService } from '../../../core/services/preferences.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'td-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
})
export class HomePage {
  readonly preferences = inject(PreferencesService);
}
