import runFlow, { options as baseOptions } from './login.js';

// Volumetria 3: 100.000 pedidos em 4 horas; referencia de 120 s por pedido.
// Taxa: 100000 / 4 = 25000 inicios por hora (um a cada 144 ms).
// Concorrencia estimada (Lei de Little): (100000 / 14400) * 120 = 833,33 VUs.
// 834 VUs pre-alocados; limite de 1251 oferece 50% de margem.
// A massa deve conter pelo menos 1251 contas distintas para cobrir o limite.
// Os 120 segundos sao referencia de dimensionamento, sem espera artificial.
// Cada iteracao tenta criar um pedido. Confirmar 100.000 pedidos depende de
// sucesso dos checkouts e ausencia de dropped_iterations.
const { vus, iterations, ...commonOptions } = baseOptions;

export const options = {
  ...commonOptions,
  scenarios: {
    volumetry_3: {
      executor: 'constant-arrival-rate',
      rate: 25000,
      timeUnit: '1h',
      duration: '4h',
      preAllocatedVUs: 834,
      maxVUs: 1251,
      // Tempo adicional para concluir as ultimas iteracoes iniciadas.
      gracefulStop: '2m',
    },
  },
  thresholds: {
    ...commonOptions.thresholds,
    dropped_iterations: ['count==0'],
  },
};

export default runFlow;
