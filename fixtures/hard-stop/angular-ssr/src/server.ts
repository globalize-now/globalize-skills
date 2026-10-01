import { AngularNodeAppEngine, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use((req, res, next) => {
  angularApp.handle(req).then((response) => (response ? writeResponseToNodeResponse(response, res) : next())).catch(next);
});

export const reqHandler = createNodeRequestHandler(app);
