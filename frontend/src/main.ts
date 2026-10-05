import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { showStartupError } from './app/core/startup/show-startup-error';

bootstrapApplication(AppComponent, appConfig).catch(() => showStartupError());
