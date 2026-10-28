// O k6 nao permite escrita arbitraria em arquivos durante as iteracoes.
// O console e persistido pelo --console-output e convertido apos a execucao.
import { Rate } from 'k6/metrics';
const flowSuccess = new Rate('flow_success');

export function measureStage(result, name, action) {
  const start = Date.now();
  result.lastStage = name;
  try {
    return action();
  } finally {
    result.stageDurationsMs[name] = Date.now() - start;
  }
}

export function writeResult(result) {
  flowSuccess.add(result.success);
  console.log(`RESULTADO_PEDIDO ${JSON.stringify(result)}`);
}
