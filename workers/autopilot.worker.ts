// Web Worker that trains the autopilot model, so a long history of decisions never freezes the UI.

import { train, type TrainingRow } from '../services/autopilotModel.ts';

self.onmessage = (event: MessageEvent<{ id: number; rows: TrainingRow[]; ignored: Set<string> }>) => {
  const { id, rows, ignored } = event.data;
  try {
    self.postMessage({ id, ...train(rows, { ignored }) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
