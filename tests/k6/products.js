import http from 'k6/http';
import { check, fail, group } from 'k6';
import { BASE_URL } from './config.js';

// 5.2: extrai os produtos e a URL de compra presentes na listagem.
export function findProduct() {
  return group('5.2 - Busca de produtos', () => {
    const response = http.get(`${BASE_URL}/books`);
    if (!check(response, { 'listagem carregada': (r) => r.status === 200 })) {
      fail('Nao foi possivel carregar os produtos.');
    }

    const products = [];
    const items = response.html().find('.product-item');
    items.each((index) => {
      const item = items.eq(index);
      const id = item.attr('data-productid');
      const onclick = item.find('.product-box-add-to-cart-button').attr('onclick') || '';
      const match = onclick.match(/addproducttocart_catalog\(['"]([^'"]+)['"]/i);
      if (id && match) {
        const path = match[1].trim();
        // Apenas produtos com compra direta, sem atributos obrigatorios.
        if (path === `/addproducttocart/catalog/${id}/1/1`) {
          products.push({ id, name: item.find('.product-title').text().trim(), addUrl: `${BASE_URL}${path}` });
        }
      }
    });

    if (!check(products, { 'IDs de produtos extraidos': (items) => items.length > 0 })) {
      fail('Nenhum produto com compra direta foi encontrado.');
    }
    return products[Math.floor(Math.random() * products.length)];
  });
}
