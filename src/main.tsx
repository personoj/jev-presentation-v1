import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './Presentation';
import {ReferencePresentation} from './reference/Deck';
import './styles.css';
import './layout.css';

// The core deck renders immediately. Older optional experiments progressively enhance
// their ink borders when the worklet is available; loading it must never delay the opening.
const worklet = (CSS as unknown as {paintWorklet?: {addModule(url: string): Promise<void>}}).paintWorklet;
document.documentElement.classList.add('no-paint');
if(worklet)void worklet.addModule('/worklets/ink.js').then(()=>document.documentElement.classList.remove('no-paint')).catch(()=>{});
createRoot(document.getElementById('root')!).render(<React.StrictMode>{new URLSearchParams(location.search).has('legacy')?<App/>:<ReferencePresentation/>}</React.StrictMode>);
