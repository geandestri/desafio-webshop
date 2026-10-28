import http from 'k6/http';
import { check, fail, group } from 'k6';
import { parseHTML } from 'k6/html';
import { BASE_URL } from './config.js';

function requireCheck(value, name, predicate) {
  if (!check(value, { [name]: predicate })) fail(name);
}

function formValues(document, selector) {
  const data = {};
  const inputs = document.find(`${selector} input`);
  inputs.each((index) => {
    const input = inputs.eq(index);
    const name = input.attr('name');
    const type = input.attr('type');
    if (!name || input.attr('disabled') !== undefined) return;
    if ((type === 'checkbox' || type === 'radio') && input.attr('checked') === undefined) return;
    if (type !== 'submit' && type !== 'button') data[name] = input.attr('value') || '';
  });
  const selects = document.find(`${selector} select`);
  selects.each((index) => {
    const select = selects.eq(index);
    const selected = select.find('option[selected]').first();
    data[select.attr('name')] = selected.size() ? selected.attr('value') : select.find('option').first().attr('value') || '';
  });
  return data;
}

function selections(document, selector) {
  const items = document.find(selector);
  return Array.from({ length: items.size() }, (_, index) => items.eq(index));
}

function addressValues(document, kind, email) {
  const selector = `#co-${kind}-form`;
  const data = formValues(document, selector);
  const existing = selections(document, `#${kind}-address-select option`)
    .find((option) => /^[1-9]\d*$/.test(option.attr('value') || ''));
  if (existing) {
    data[`${kind}_address_id`] = existing.attr('value');
    return data;
  }

  const prefix = kind === 'billing' ? 'BillingNewAddress' : 'ShippingNewAddress';
  const countryName = __ENV.CHECKOUT_COUNTRY || 'Brazil';
  const country = selections(document, `select[name="${prefix}.CountryId"] option`)
    .find((option) => option.text().trim().toLowerCase() === countryName.toLowerCase());
  if (!country) fail(`Pais de checkout nao encontrado: ${countryName}`);
  Object.assign(data, {
    [`${kind}_address_id`]: '',
    [`${prefix}.FirstName`]: __ENV.CHECKOUT_FIRST_NAME || 'Performance',
    [`${prefix}.LastName`]: __ENV.CHECKOUT_LAST_NAME || 'Teste',
    [`${prefix}.Email`]: email,
    [`${prefix}.CountryId`]: country.attr('value'),
    [`${prefix}.City`]: __ENV.CHECKOUT_CITY || 'Sao Paulo',
    [`${prefix}.Address1`]: __ENV.CHECKOUT_ADDRESS || 'Rua de Teste, 100',
    [`${prefix}.ZipPostalCode`]: __ENV.CHECKOUT_ZIP || '01001000',
    [`${prefix}.PhoneNumber`]: __ENV.CHECKOUT_PHONE || '11999999999',
  });
  // Os IDs de estado dependem do pais; nao fixar IDs de outra sessao.
  const states = http.get(`${BASE_URL}/country/getstatesbycountryid?countryId=${country.attr('value')}&addEmptyStateIfRequired=true`);
  requireCheck(states, 'consulta de estados retornou HTTP 200', (r) => r.status === 200);
  let options;
  try { options = states.json(); } catch (_) { fail('Resposta de estados nao e JSON.'); }
  requireCheck(options, 'lista de estados valida', (items) => Array.isArray(items));
  const desired = __ENV.CHECKOUT_STATE;
  const state = desired
    ? options.find((item) => item.name.toLowerCase() === desired.toLowerCase())
    : options.find((item) => Number(item.id) > 0) || options[0];
  if (!state) fail('Estado de checkout nao encontrado.');
  data[`${prefix}.StateProvinceId`] = state.id;
  return data;
}

export function checkout(email) {
  return group('5.4 - Finalizacao da compra', () => {
    const page = http.get(`${BASE_URL}/onepagecheckout`);
    requireCheck(page, 'checkout autenticado carregado', (r) =>
      r.status === 200 && r.html().find('#co-billing-form').size() > 0);
    let document = page.html();
    let step = 'billing';
    const visited = new Set();
    const actions = {
      billing: ['OpcSaveBilling', '#co-billing-form'],
      shipping: ['OpcSaveShipping', '#co-shipping-form'],
      'shipping-method': ['OpcSaveShippingMethod', '#co-shipping-method-form'],
      'payment-method': ['OpcSavePaymentMethod', '#co-payment-method-form'],
      'payment-info': ['OpcSavePaymentInfo', '#co-payment-info-form'],
      'confirm-order': ['OpcConfirmOrder', '#co-confirm-order-form'],
    };

    while (step) {
      if (!actions[step] || visited.has(step)) fail(`Etapa inesperada no checkout: ${step}`);
      visited.add(step);
      const [action, selector] = actions[step];
      let data = formValues(document, selector);
      if (step === 'billing' || step === 'shipping') data = addressValues(document, step, email);
      if (step === 'shipping-method') {
        data.shippingoption = document.find('input[name="shippingoption"]').first().attr('value');
        if (!data.shippingoption) fail('Nenhum frete disponivel.');
      }
      if (step === 'payment-method') {
        // Metodo offline: nao exige cartao nem redirecionamento externo.
        const method = selections(document, 'input[name="paymentmethod"]')
          .find((input) => input.attr('value') === 'Payments.CashOnDelivery');
        if (!method) fail('Pagamento na entrega indisponivel para este carrinho.');
        data.paymentmethod = method.attr('value');
      }
      const response = http.post(`${BASE_URL}/checkout/${action}`, data, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE_URL}/onepagecheckout` },
        tags: { name: `POST /checkout/${action}` },
      });
      let result;
      try { result = response.json(); } catch (_) { fail(`Checkout ${step}: resposta nao e JSON.`); }
      requireCheck(response, `checkout ${step} aceito`, (r) => r.status === 200 && result && !result.error);
      if (step === 'confirm-order') {
        requireCheck(result, 'pedido confirmado pelo servidor', (r) => r.success === true || r.success === 1);
        const completed = http.get(`${BASE_URL}/checkout/completed/`);
        requireCheck(completed, 'pagina de pedido concluido carregada', (r) => r.status === 200);
        const details = completed.html().find('.order-completed');
        const match = details.text().match(/order\s*(?:number|#)\s*:?\s*(\d+)/i);
        const link = details.find('a[href*="/orderdetails/"]').first().attr('href') || '';
        const linkMatch = link.match(/\/orderdetails\/(\d+)/i);
        const orderId = linkMatch ? linkMatch[1] : match && match[1];
        requireCheck(orderId, 'ID do pedido extraido', (id) => /^[1-9]\d*$/.test(id || ''));
        console.log(`Pedido criado: id=${orderId}`);
        return { orderId, detailsUrl: `${BASE_URL}/orderdetails/${orderId}` };
      }
      if (result.update_section && result.update_section.html) {
        document = parseHTML(result.update_section.html);
      }
      if (result.redirect) fail(`Redirecionamento inesperado no checkout ${step}.`);
      if (!result.goto_section) fail(`Checkout ${step} nao informou a proxima etapa.`);
      step = String(result.goto_section).replace(/_/g, '-');
    }
    fail('Checkout terminou sem confirmar um pedido.');
  });
}
