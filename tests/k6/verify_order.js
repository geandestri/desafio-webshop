// Revalida um pedido existente sem adicionar produtos ou confirmar outra compra.
import { check } from 'k6';
import { loginUser } from './login.js';
import { getOrderStatus } from './orders.js';
import { measureStage, writeResult } from './results.js';

const users = JSON.parse(open(__ENV.USERS_FILE));
export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'], flow_success: ['rate==1'] } };

export default function () {
  const start = Date.now();
  const result = { vu: __VU, iteration: __ITER, startedAt: new Date(start).toISOString(),
    orderId: __ENV.ORDER_ID, success: false, stageDurationsMs: {}, mode: 'existing_order' };
  try {
    measureStage(result, '5.1_login', () => loginUser(users[0].email, users[0].password));
    const order = measureStage(result, '5.5_order_status', () => getOrderStatus({ orderId: result.orderId }));
    Object.assign(result, order, { success: true });
  } catch (error) {
    result.error = String(error.message || error);
    check(false, { 'revalidacao do pedido concluida': (value) => value });
    throw error;
  } finally {
    result.finishedAt = new Date().toISOString();
    result.totalDurationMs = Date.now() - start;
    writeResult(result);
  }
}
