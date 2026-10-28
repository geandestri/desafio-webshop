import runFlow, { options as baseOptions } from './login.js';

const { vus, iterations, ...commonOptions } = baseOptions;
export const options = {
  ...commonOptions,
  scenarios: {
    two_users: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 1,
      maxDuration: '2m',
    },
  },
};

export default runFlow;
