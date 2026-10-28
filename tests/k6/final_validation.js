import runFlow, { options as baseOptions } from './login.js';

const { vus, iterations, ...commonOptions } = baseOptions;
export const options = {
  ...commonOptions,
  scenarios: {
    final_validation: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 3,
      maxDuration: '5m',
    },
  },
};

export default runFlow;
