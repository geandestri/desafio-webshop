import http from 'k6/http';
import { check, fail, group } from 'k6';
import { BASE_URL } from './config.js';

// 5.5: consulta o pedido criado na mesma iteracao, mantendo a sessao do VU.
export function getOrderStatus(order) {
  return group('5.5 - Consulta do status do pedido', () => {
    const orderId = String(order && order.orderId || '');
    if (!/^[1-9]\d*$/.test(orderId)) fail('ID de pedido ausente ou invalido para consulta.');

    const response = http.get(`${BASE_URL}/orderdetails/${orderId}`, {
      redirects: 0,
      tags: { name: 'GET /orderdetails/:orderId' },
    });
    if (!check(response, {
      'consulta do pedido retornou HTTP 200': (r) => r.status === 200,
    })) fail(`Nao foi possivel consultar o pedido ${orderId}.`);

    const document = response.html();
    const details = document.find('.order-details-page');
    const number = details.find('.order-number').text().match(/\b(\d+)\b/);
    const statusText = details.find('.order-status').text() ||
      (details.text().match(/Order\s+Status\s*:\s*(Pending|Processing|Complete|Cancelled)\b/i) || [])[0] || '';
    const status = statusText.replace(/^\s*Order\s+status\s*:\s*/i, '').trim();
    const knownStatuses = ['Pending', 'Processing', 'Complete', 'Cancelled'];
    const expected = __ENV.EXPECTED_ORDER_STATUS;
    const valid = check(response, {
      'pagina de detalhes do pedido encontrada': () => details.size() > 0,
      'ID consultado corresponde ao pedido criado': () => number !== null && number[1] === orderId,
      'status do pedido reconhecido': () => knownStatuses.includes(status),
      'status corresponde ao esperado quando configurado': () => !expected || status === expected,
    });
    if (!valid) fail(`Falha na validacao do pedido ${orderId}; status extraido: ${status || 'ausente'}.`);

    console.log(`Pedido consultado: id=${orderId}, status=${status}`);
    return {
      ...order,
      orderId,
      status,
      statusHttp: response.status,
      statusRequestDurationMs: response.timings.duration,
      queriedAt: new Date().toISOString(),
    };
  });
}
