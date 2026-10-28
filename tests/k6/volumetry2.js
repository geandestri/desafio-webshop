import runFlow, { options as baseOptions } from './login.js';

// Volumetria 2: 5.000 pedidos em 2 horas; referencia de 90 s por pedido.
// Taxa: 5000 / 2 = 2500 inicios por hora (um a cada 1,44 s).
// Concorrencia estimada (Lei de Little): (5000 / 7200) * 90 = 62,5 VUs.
// 63 VUs pre-alocados; limite de 95 oferece aproximadamente 50% de margem.
// A massa deve conter pelo menos 95 contas distintas para cobrir esse limite.
// Os 90 segundos sao referencia de dimensionamento, sem espera artificial.
// Cada iteracao tenta criar um pedido. Confirmar 5.000 pedidos depende de
// sucesso dos checkouts e ausencia de dropped_iterations.
const { vus, iterations, ...commonOptions } = baseOptions;

export const options = {
  ...commonOptions,
  scenarios: {
    volumetry_2: {
      executor: 'constant-arrival-rate',
      rate: 2500,
      timeUnit: '1h',
      duration: '2h',
      preAllocatedVUs: 63,
      maxVUs: 95,
      // Tempo adicional para concluir as ultimas iteracoes iniciadas.
      gracefulStop: '1m30s',
    },
  },
  thresholds: {
    ...commonOptions.thresholds,
    dropped_iterations: ['count==0'],
  },
};

export default runFlow;
