import http from 'k6/http';
import { check, fail, group } from 'k6';
import { BASE_URL } from './config.js';

// 5.3: o cookie jar do k6 preserva a sessao do login neste usuario virtual.
export function addToCart(product) {
  return group('5.3 - Adicao ao carrinho', () => {
    const response = http.post(product.addUrl, null, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE_URL}/books` },
      tags: { name: 'POST /addproducttocart/catalog/:productId/1/1' },
    });
    let result;
    try {
      result = response.json();
    } catch (_) {
      result = null;
    }
    if (!check(response, {
      'adicao retornou HTTP 200': (r) => r.status === 200,
      'API confirmou adicao': () => result !== null && result.success === true,
    })) {
      fail(`Falha ao adicionar o produto ${product.id}.`);
    }

    const cart = http.get(`${BASE_URL}/cart`);
    const expectedPath = `/cart`;
    const rows = cart.html().find('.cart-item-row');
    const found = Array.from({ length: rows.size() }, (_, index) => rows.eq(index)).some((row) => {
      return row.find('.product-name').text().trim() === product.name;
    });
    if (!check(cart, {
      'carrinho carregado': (r) => r.status === 200 && r.url.includes(expectedPath),
      'produto presente no carrinho': () => found,
    })) {
      fail(`Produto ${product.id} nao confirmado no carrinho.`);
    }
    console.log(`Produto adicionado: id=${product.id}, nome=${product.name}`);
    return product;
  });
}
