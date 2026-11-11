import { useSyncExternalStore } from 'react';
import { getAutopilotState, subscribeAutopilot, type AutopilotState } from '../services/autopilot.ts';

/** What the autopilot has learned so far, updated after each retraining. */
export const useAutopilot = (): AutopilotState => useSyncExternalStore(subscribeAutopilot, getAutopilotState);
