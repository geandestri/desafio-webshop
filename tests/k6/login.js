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
    const authResponse = http.post(`${BASE_URL}/login`, payload, {
      // Captura o cookie na resposta original, antes do redirecionamento.
      redirects: 0,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/login`,
      },
    });

    const cookieName = 'NOPCOMMERCE.AUTH';
    const authCookie = (authResponse.cookies[cookieName] || [])[0];
    const extracted = check(authResponse, {
      'login redirects after authentication': (r) => r.status === 302,
      'authentication cookie extracted from response': () => !!authCookie && !!authCookie.value,
    });
    if (!extracted) fail('Login nao retornou o cookie de autenticacao esperado.');

    // Correlacao explicita: reinserir o valor extraido no jar deste VU.
    // Nunca registrar ou retornar o segredo nas evidencias.
    const jar = http.cookieJar();
    jar.set(BASE_URL, cookieName, authCookie.value, { path: '/', secure: true });
    const retained = jar.cookiesForURL(`${BASE_URL}/customer/info`)[cookieName] || [];
    if (!check(retained, {
      'extracted authentication cookie reused in session': (values) => values.includes(authCookie.value),
    })) fail('Cookie extraido nao foi correlacionado a sessao.');

    const loginResponse = http.get(`${BASE_URL}/customer/info`);

    const authenticated = !!loginResponse.body && loginResponse.html().find('a[href="/logout"]').size() > 0;
    const valid = check(loginResponse, {
      'login response status is 200': (r) => r.status === 200,
      'authenticated session confirmed': () => authenticated,
      'authenticated account matches credentials': (r) =>
        r.status === 200 && r.html().find('input[name="Email"]').attr('value') === email,
    });
    if (!valid) fail('Login falhou. Confira USER_EMAIL e USER_PASSWORD.');

    return { authCookieName: cookieName, sessionCorrelated: true };
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
    const auth = stage('5.1_login', () => loginUser(user.email, user.password));
    result.authCookieName = auth.authCookieName;
    result.sessionCorrelated = auth.sessionCorrelated;
    const cart = http.get(`${BASE_URL}/cart`);
    if (!check(cart, {
      'cart empty before purchase': (r) => r.status === 200 &&
        r.html().find('.cart-item-row').size() === 0 &&
        /Your Shopping Cart is empty!/i.test(r.body || ''),
    })) fail('Carrinho deve estar vazio antes da compra.');
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
