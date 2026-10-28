"""Cadastra contas de teste reais e valida um novo login antes de salvar a massa."""
import argparse
import http.cookiejar
import json
import secrets
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE_URL = 'https://demowebshop.tricentis.com'


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.hidden = {}
        self.inputs = set()
        self.links = set()
        self.text = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input' and attrs.get('name'):
            self.inputs.add(attrs['name'])
            if attrs.get('type', '').lower() == 'hidden':
                self.hidden[attrs['name']] = attrs.get('value', '')
        if tag == 'a':
            self.links.add(attrs.get('href', ''))

    def handle_data(self, data):
        self.text.append(data)


def session():
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(opener, path, payload=None):
    data = None if payload is None else urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(BASE_URL + path, data=data, headers={
        'User-Agent': 'DemoWebShop-TestData/1.0',
        'Referer': BASE_URL + path,
    })
    with opener.open(req, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f'HTTP inesperado: {response.status}')
        return Page(response.read().decode('utf-8'))


def register_and_verify(email, password, index):
    opener = session()
    form = request(opener, '/register')
    required = {'FirstName', 'LastName', 'Email', 'Password', 'ConfirmPassword'}
    if not required.issubset(form.inputs):
        raise RuntimeError('Formulario de cadastro nao encontrado.')
    result = request(opener, '/register', {
        **form.hidden, 'Gender': 'M', 'FirstName': 'Performance',
        'LastName': f'Teste{index}', 'Email': email, 'Password': password,
        'ConfirmPassword': password, 'register-button': 'Register',
    })
    if 'Your registration completed' not in ' '.join(result.text):
        raise RuntimeError('Cadastro nao confirmado pelo site; credencial nao salva.')

    # Uma sessao nova impede confundir o auto-login do cadastro com login valido.
    login_session = session()
    login_form = request(login_session, '/login')
    logged = request(login_session, '/login', {
        **login_form.hidden, 'Email': email, 'Password': password, 'RememberMe': 'false',
    })
    if '/logout' not in logged.links:
        raise RuntimeError('Conta cadastrada, mas novo login nao foi confirmado.')
    return {'email': email, 'password': password}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--count', type=int, default=2)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'users.json')
    args = parser.parse_args()
    if not 1 <= args.count <= 10:
        parser.error('--count deve estar entre 1 e 10 para preparacao de baixo volume.')
    # Nao sobrescrever uma massa existente. Persistir cada sucesso imediatamente.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        output = args.output.open('x', encoding='utf-8')
    except FileExistsError:
        parser.error('Arquivo de saida ja existe; escolha outro --output.')
    users = []
    run_id = f'{time.time_ns()}-{secrets.token_hex(4)}'
    with output:
        output.write('[]\n')
        output.flush()
        for index in range(1, args.count + 1):
            email = f'k6-{run_id}-{index}@example.com'
            password = f'Teste!{secrets.token_hex(12)}9a'
            try:
                user = register_and_verify(email, password, index)
            except Exception as error:
                raise SystemExit(f'Falha na conta {index}: {error}. '
                                 f'{len(users)} conta(s) valida(s) salva(s). Nao houve retry automatico.')
            users.append(user)
            output.seek(0)
            json.dump(users, output, ensure_ascii=False, indent=2)
            output.write('\n')
            output.truncate()
            output.flush()
            print(f'Conta {index}/{args.count}: cadastro e novo login confirmados.')
    print(f'Massa salva em {args.output}.')


if __name__ == '__main__':
    main()
