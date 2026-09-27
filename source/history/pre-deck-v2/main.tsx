import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
import './layout.css';

// The ink and paper edges are painted by a CSS worklet. Wait briefly for it so the first frame
// already has its lines; without worklets (e.g. plain http from another machine) use plain rules.
const worklet = (CSS as unknown as {paintWorklet?: {addModule(url: string): Promise<void>}}).paintWorklet;
const ready = worklet
 ? Promise.race([worklet.addModule('/worklets/ink.js'), new Promise(resolve => setTimeout(resolve, 1200))]).catch(() => document.documentElement.classList.add('no-paint'))
 : Promise.resolve(document.documentElement.classList.add('no-paint'));
void ready.then(() => createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>));
