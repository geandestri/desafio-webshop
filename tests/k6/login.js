import http from 'k6/http';
import { check, fail, group } from 'k6';
import { BASE_URL } from './config.js';
import { findProduct } from './products.js';
import { addToCart } from './cart.js';
import { checkout } from './checkout.js';
import { getOrderStatus } from './orders.js';
import { measureStage, writeResult } from './results.js';
import { SharedArray } from 'k6/data';

const USER_EMAIL = __ENV.USER_EMAIL || 'SEU_EMAIL_DE_TESTE@example.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || 'SUA_SENHA_DE_TESTE';
const users = new SharedArray('usuarios de teste', () => {
  if (!__ENV.USERS_FILE) return [];
  const data = JSON.parse(open(__ENV.USERS_FILE));
  if (!Array.isArray(data) || !data.length || data.some((user) => !user.email || !user.password)) {
    throw new Error('Massa invalida: esperado array com email e password.');
  }
  return data;
});

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate==1'],
    flow_success: ['rate==1'],
  },
};

export function loginUser(email, password) {
  group('Open login page', () => {
    const loginPage = http.get(`${BASE_URL}/login`);

    const loaded = check(loginPage, {
      'login page loaded successfully': (r) => r.status === 200,
      'login form is available': (r) => /<input[^>]+name="Email"/i.test(r.body || ''),
    });
    if (!loaded) fail('Pagina de login indisponivel.');
  });

  const payload = {
    Email: email,
    Password: password,
    RememberMe: 'false',
  };

  return group('Submit login form', () => {
    const loginResponse = http.post(`${BASE_URL}/login`, payload, {
      redirects: 3,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/login`,
      },
    });

    const loginFailed = /login was unsuccessful|no customer account found|please correct the errors/i.test(
      loginResponse.body || ''
    );

    const authenticated = !!loginResponse.body && loginResponse.html().find('a[href="/logout"]').size() > 0;
    const valid = check(loginResponse, {
      'login response status is 200': (r) => r.status === 200,
      'login did not fail with invalid credentials': (r) => !loginFailed,
      'authenticated session confirmed': () => authenticated,
    });
    if (!valid) fail('Login falhou. Confira USER_EMAIL e USER_PASSWORD.');

    return loginResponse;
  });
}

export default function () {
  if (__ENV.USERS_FILE && __VU > users.length) {
    fail('Massa insuficiente: forneca uma conta diferente para cada VU.');
  }
  const user = __ENV.USERS_FILE ? users[__VU - 1] : { email: USER_EMAIL, password: USER_PASSWORD };
  const start = Date.now();
  const result = {
    vu: __VU,
    iteration: __ITER,
    startedAt: new Date(start).toISOString(),
    success: false,
    productId: null,
    orderId: null,
    status: null,
    stageDurationsMs: {},
  };
  const stage = (name, action) => measureStage(result, name, action);
  try {
    stage('5.1_login', () => loginUser(user.email, user.password));
    const product = stage('5.2_products', () => findProduct());
    result.productId = product.id;
    stage('5.3_cart', () => addToCart(product));
    const order = stage('5.4_checkout', () => checkout(user.email));
    result.orderId = order.orderId;
    const queried = stage('5.5_order_status', () => getOrderStatus(order));
    result.status = queried.status;
    result.statusHttp = queried.statusHttp;
    result.statusRequestDurationMs = queried.statusRequestDurationMs;
    result.queriedAt = queried.queriedAt;
    result.success = true;
  } catch (error) {
    result.error = String(error.message || error);
    throw error;
  } finally {
    result.finishedAt = new Date().toISOString();
    result.totalDurationMs = Date.now() - start;
    writeResult(result);
  }
}
