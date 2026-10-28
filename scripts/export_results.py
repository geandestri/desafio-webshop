"""Converte registros do console k6 (formato raw) para JSON e CSV."""
import argparse
import csv
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', type=Path)
    parser.add_argument('--output-prefix', type=Path, default=Path(__file__).resolve().parents[1] / 'report' / 'json' / 'pedidos')
    parser.add_argument('--csv-prefix', type=Path, help='Prefixo separado para o CSV; por padrao acompanha --output-prefix.')
    args = parser.parse_args()
    records = []
    marker = 'RESULTADO_PEDIDO '
    for line_number, line in enumerate(args.log.read_text(encoding='utf-8-sig').splitlines(), 1):
        if not line.startswith(marker):
            continue
        try:
            record = json.loads(line[len(marker):])
            if not isinstance(record, dict) or not isinstance(record.get('stageDurationsMs'), dict):
                raise ValueError('registro sem tempos das etapas')
        except (ValueError, TypeError) as error:
            raise SystemExit(f'Registro invalido na linha {line_number}: {error}')
        records.append(record)
    if not records:
        raise SystemExit('Nenhum registro encontrado. Utilize --log-format raw no k6.')

    fields = [
        'vu', 'iteration', 'startedAt', 'finishedAt', 'success', 'productId',
        'orderId', 'status', 'statusHttp', 'queriedAt', 'lastStage', 'error',
        'totalDurationMs', 'statusRequestDurationMs', 'authCookieName', 'sessionCorrelated',
    ]
    stages = ['5.1_login', '5.2_products', '5.3_cart', '5.4_checkout', '5.5_order_status']
    json_path = Path(f'{args.output_prefix}.json')
    csv_path = Path(f'{args.csv_prefix or args.output_prefix}.csv')
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    with csv_path.open('w', encoding='utf-8-sig', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fields + [f'{stage}_ms' for stage in stages])
        writer.writeheader()
        for record in records:
            row = {field: record.get(field) for field in fields}
            row.update({f'{stage}_ms': record['stageDurationsMs'].get(stage) for stage in stages})
            writer.writerow(row)
    print(f'{len(records)} registro(s) exportado(s): {json_path} e {csv_path}')


if __name__ == '__main__':
    main()
