import runFlow, { options as baseOptions } from './login.js';

// Volumetria 1: 1.000 pedidos em 1 hora; referencia de 60 s por pedido.
// Concorrencia estimada (Lei de Little): (1000 / 3600) * 60 = 16,67 VUs.
// 17 VUs pre-alocados; limite de 25 oferece margem para variacao de duracao.
// A massa deve conter pelo menos 25 contas distintas para cobrir esse limite.
// O minuto e referencia de dimensionamento, sem adicionar espera artificial.
// Cada iteracao tenta criar um pedido; 1.000 pedidos confirmados dependem de
// ausencia de dropped_iterations e de sucesso em todos os checkouts.
const { vus, iterations, ...commonOptions } = baseOptions;

export const options = {
  ...commonOptions,
  scenarios: {
    volumetry_1: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1h',
      duration: '1h',
      preAllocatedVUs: 17,
      maxVUs: 25,
      // Permite concluir iteracoes iniciadas perto do fim da janela.
      gracefulStop: '1m',
    },
  },
  thresholds: {
    ...commonOptions.thresholds,
    dropped_iterations: ['count==0'],
  },
};

export default runFlow;
