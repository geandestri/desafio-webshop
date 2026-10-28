"""Mantem as cinco execucoes mais recentes; simula a limpeza por padrao."""
import argparse
import re
import shutil
from datetime import datetime
from pathlib import Path

RUNS_ROOT = Path(__file__).resolve().parents[1] / 'report' / 'execucoes'


def execution_date(name):
    # Pastas atuais: yyyy-MM-dd-HHmmss ou yyyy-MM-dd-1vu.
    match = re.match(r'^(\d{4}-\d{2}-\d{2})(?:-(\d{6})(?:-|$)|(?:-|$))', name)
    if not match:
        return None
    try:
        return datetime.strptime(match[1] + (match[2] or '000000'), '%Y-%m-%d%H%M%S')
    except ValueError:
        return None


def candidates(root, keep=5):
    root = root.resolve()
    runs = []
    protected = []
    for entry in root.iterdir():
        # Nao seguir junctions/symlinks nem excluir pastas de nome desconhecido.
        if entry.is_symlink() or getattr(entry, 'is_junction', lambda: False)():
            continue
        resolved = entry.resolve()
        if not entry.is_dir() or resolved.parent != root or resolved != entry.absolute():
            continue
        date = execution_date(entry.name)
        if date is None:
            continue
        if (entry / 'ENTREGA').exists():
            protected.append(entry)
        else:
            runs.append((date, entry.stat().st_mtime_ns, entry))
    runs.sort(key=lambda item: (item[0], item[1], item[2].name), reverse=True)
    return [item[2] for item in runs[keep:]], protected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Executa a exclusao; sem esta opcao apenas lista.')
    args = parser.parse_args()
    if not RUNS_ROOT.is_dir():
        print('Nenhuma pasta de execucoes encontrada.')
        return
    root = RUNS_ROOT.resolve()
    remove, protected = candidates(root)
    print(f'Retencao: 5 execucoes recentes + {len(protected)} entrega(s) protegida(s).')
    for path in remove:
        if args.apply:
            # Revalidar o caminho imediatamente antes da exclusao recursiva.
            resolved = path.resolve()
            if (resolved.parent != root or resolved != path.absolute()
                    or path.is_symlink() or (path / 'ENTREGA').exists()
                    or getattr(path, 'is_junction', lambda: False)()):
                raise SystemExit(f'Caminho alterado ou protegido; limpeza interrompida: {path}')
            shutil.rmtree(resolved)
            print(f'Removida: {path.name}')
        else:
            print(f'Seria removida: {path.name}')
    if not remove:
        print('Nenhuma execucao precisa ser removida.')
    elif not args.apply:
        print('Simulacao apenas. Use --apply para excluir as pastas listadas.')


if __name__ == '__main__':
    main()
