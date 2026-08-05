import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlayerCardSandbox } from '../src/components/react/PlayerCardSandbox';
import '../src/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlayerCardSandbox />
  </React.StrictMode>
);
