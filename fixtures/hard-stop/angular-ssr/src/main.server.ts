import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';

export default (context: BootstrapContext) => bootstrapApplication(App, {}, context);
