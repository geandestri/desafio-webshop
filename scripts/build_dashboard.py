"""Gera dashboard HTML offline, separando cada conjunto de evidencias."""
import argparse
import json
from pathlib import Path


def dataset(root, summary, orders):
    data = json.loads((root / 'json' / summary).read_text(encoding='utf-8'))
    records = json.loads((root / 'json' / orders).read_text(encoding='utf-8'))
    metrics = data['metrics']
    # summary-export legado: threshold=true significa falha.
    thresholds = []
    for name, metric in metrics.items():
        for expression, failed in metric.get('thresholds', {}).items():
            thresholds.append({'metric': name, 'expression': expression, 'ok': not failed})
    points = []
    raw = root / 'json' / summary.replace('resumo', 'metricas')
    if raw.exists():
        with raw.open(encoding='utf-8') as stream:
            for line in stream:
                point = json.loads(line)
                if point.get('type') == 'Point' and point.get('metric') == 'http_req_duration':
                    item = point['data']
                    points.append({'time': item['time'], 'value': item['value']})
    return {'label': 'Compra e consulta inicial' if 'final' in summary else
            'Reconsulta do mesmo pedido' if 'consulta' in summary else summary,
            'summary': summary, 'ordersFile': orders, 'records': records,
            'metrics': metrics, 'thresholds': thresholds, 'points': points}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path, help='Pasta da execucao contendo json/.')
    parser.add_argument('--summary', action='append', help='Nome de resumo em json/; repetir junto com --orders.')
    parser.add_argument('--orders', action='append', help='Nome do JSON de pedidos em json/.')
    args = parser.parse_args()
    if bool(args.summary) != bool(args.orders) or len(args.summary or []) != len(args.orders or []):
        parser.error('Informe um --orders para cada --summary.')
    summaries = args.summary or ['resumo.json']
    orders = args.orders or ['pedidos.json']
    datasets = [dataset(args.run, summary, order) for summary, order in zip(summaries, orders)]
    payload = json.dumps({'run': args.run.name, 'datasets': datasets}, ensure_ascii=False)
    payload = payload.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    target = args.run / 'html' / 'dashboard.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(TEMPLATE.replace('__DATA__', payload), encoding='utf-8')
    print(f'Dashboard gerado: {target}')


TEMPLATE = '''<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Web Shop · Performance</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0b1120;color:#e6edf9}*{box-sizing:border-box}body{margin:0}main{max-width:1200px;margin:auto;padding:40px 24px}header{display:flex;justify-content:space-between;gap:24px;align-items:center}h1{font-size:32px;margin:8px 0}h2{font-size:18px;margin:0 0 20px}.eyebrow{color:#6ee7ce;font-size:12px;letter-spacing:2px}p,small{color:#9faec7;line-height:1.6}select{padding:12px;background:#172239;color:inherit;border:1px solid #34445f;border-radius:10px;max-width:100%}.notice{border-left:3px solid #f9bf60;padding:12px 18px;background:#1d2230;margin:24px 0;color:#e2c797}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card,.panel{background:#121d30;border:1px solid #25344c;border-radius:16px;padding:22px}.card span{color:#9faec7;font-size:13px}.number{font-size:30px;font-weight:650;margin-top:10px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}.panel{min-width:0}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:13px 8px;border-bottom:1px solid #28364b}th{color:#9faec7} .scroll{overflow:auto}.good{color:#6ee7b7}.bad{color:#fca5a5}.bar-row{margin:15px 0;font-size:13px}.bar-title{display:flex;justify-content:space-between;margin-bottom:8px}.track{height:9px;background:#25344c;border-radius:8px}.fill{height:100%;background:linear-gradient(90deg,#38bdf8,#5eead4);border-radius:8px}svg{width:100%;height:190px}button{cursor:pointer}footer{margin-top:26px}a{color:#7dd3fc}@media(max-width:760px){header{display:block}.grid{grid-template-columns:1fr 1fr}.panels{grid-template-columns:1fr}h1{font-size:25px}}
</style><main>
<header><div><div class="eyebrow">DEMO WEB SHOP / K6</div><h1>Indicadores de execução</h1><small id="run"></small></div><select id="selector" aria-label="Conjunto de evidências"></select></header>
<div class="notice">Cada opção representa uma execução separada. Uma reconsulta aprovada não altera o resultado da compra original. Amostra pequena: estes dados não demonstram capacidade sob carga.</div>
<div class="grid" id="cards"></div>
<div class="panels"><section class="panel"><h2>Tempo por etapa</h2><small>Média das etapas executadas · inclui processamento local</small><div id="bars"></div></section><section class="panel"><h2>Tempos HTTP</h2><div id="latency"></div><svg id="chart" viewBox="0 0 500 190" role="group" aria-label="Tempos das requisições em sequência"></svg><div id="chart-detail" role="status" aria-live="polite" style="min-height:70px;padding:12px;background:#0b1120;border:1px solid #34445f;border-radius:10px;margin-bottom:10px"></div><small>Cada ponto é uma requisição em ordem de coleta; escala vertical em ms. Mova o mouse sobre o gráfico, toque ou use Tab nos pontos para ver os detalhes abaixo.</small></section></div>
<section class="panel"><h2>Tentativas e pedidos</h2><div class="scroll"><table><thead><tr><th>VU / iteração</th><th>Pedido</th><th>Status</th><th>Resultado</th><th>Total</th><th>Última etapa / erro</th></tr></thead><tbody id="orders"></tbody></table></div></section>
<div class="panels"><section class="panel"><h2>Critérios de aprovação</h2><div id="thresholds"></div></section><section class="panel"><h2>Rastreabilidade</h2><p id="sources"></p><p>Tempos totais excluem a pausa final e a emissão do registro. Etapas ausentes não são tratadas como zero. Pedidos confirmados contam IDs distintos, inclusive em tentativas com falha posterior.</p><p>Horários das amostras seguem o fuso informado nos arquivos originais. Dados carregados localmente, sem serviços externos.</p></section></div><footer><small>Relatório offline · Gerado a partir de evidências preservadas · Sem credenciais</small></footer>
</main><script type="application/json" id="data">__DATA__</script><script>
const data=JSON.parse(document.getElementById('data').textContent), $=id=>document.getElementById(id);
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>typeof v==='number'?v.toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
const ms=v=>fmt(v)+' ms';
$('run').textContent=data.run;
data.datasets.forEach((d,i)=>{let o=document.createElement('option');o.value=i;o.textContent=d.label;$('selector').append(o)});
function render(){const d=data.datasets[+$('selector').value],m=d.metrics,r=d.records,n=r.length,ok=r.filter(x=>x.success).length,checks=m.checks||{},lat=m.http_req_duration||{};
const cards=[['Tentativas',n],['Fluxos aprovados',fmt(n?ok/n*100:0)+'%'],['Pedidos com ID',new Set(r.filter(x=>x.orderId).map(x=>x.orderId)).size],['Checks aprovados',fmt((checks.value??0)*100)+'%']];
$('cards').innerHTML=cards.map(([k,v])=>`<div class="card"><span>${esc(k)}</span><div class="number">${esc(v)}</div></div>`).join('');
let times={};r.forEach(x=>Object.entries(x.stageDurationsMs||{}).forEach(([k,v])=>(times[k]??=[]).push(v)));
const rows=Object.entries(times).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]);const max=Math.max(1,...rows.map(x=>x[1]));
$('bars').innerHTML=rows.map(([k,v])=>`<div class="bar-row"><div class="bar-title"><span>${esc(k)}</span><b>${ms(v)}</b></div><div class="track"><div class="fill" style="width:${v/max*100}%"></div></div></div>`).join('');
$('latency').innerHTML=`<table><tr><th>Média</th><th>p95</th><th>Máximo</th></tr><tr><td>${ms(lat.avg)}</td><td>${ms(lat['p(95)'])}</td><td>${ms(lat.max)}</td></tr></table><p>${fmt(m.http_reqs?.count)} requisições · ${fmt((m.http_req_failed?.value??0)*100)}% de falhas HTTP</p>`;
const pts=d.points,top=Math.max(1,...pts.map(p=>p.value));let coords=pts.map((p,i)=>[35+i*450/Math.max(1,pts.length-1),160-p.value/top*135]);
$('chart').innerHTML=`<text x="0" y="15" fill="#9faec7" font-size="11">${fmt(top)} ms</text><line x1="35" y1="160" x2="490" y2="160" stroke="#34445f"/><polyline points="${coords.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#38bdf8" stroke-width="2"/>`+coords.map(([x,y],i)=>`<circle data-point="${i}" tabindex="0" role="button" aria-label="Requisição ${i+1}: ${ms(pts[i].value)}" cx="${x}" cy="${y}" r="5" fill="#5eead4" style="cursor:pointer;outline-offset:3px"/>`).join('');
const chart=$('chart'), detail=$('chart-detail'), circles=Array.from(chart.querySelectorAll('[data-point]'));
detail.textContent=pts.length?'Passe sobre o gráfico ou selecione um ponto para consultar duração e horário.':'Sem amostras HTTP disponíveis nesta execução.';
function showPoint(index){const p=pts[index];if(!p)return;circles.forEach((c,i)=>{c.setAttribute('r',i===index?'8':'5');c.setAttribute('fill',i===index?'#f9bf60':'#5eead4')});detail.innerHTML=`<strong>Requisição ${index+1} de ${pts.length} · ${ms(p.value)}</strong><br><small>${esc(p.time)}</small>`;}
function nearestPoint(event){if(!circles.length)return;let nearest=0,distance=Infinity;circles.forEach((circle,index)=>{const rect=circle.getBoundingClientRect(),delta=Math.abs(event.clientX-(rect.left+rect.width/2));if(delta<distance){distance=delta;nearest=index}});showPoint(nearest);}
chart.onpointermove=nearestPoint;
chart.onclick=nearestPoint;
chart.onfocusin=event=>{if(event.target.hasAttribute('data-point'))showPoint(Number(event.target.dataset.point));};
chart.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&event.target.hasAttribute('data-point')){event.preventDefault();showPoint(Number(event.target.dataset.point));}};
$('orders').innerHTML=r.map(x=>`<tr><td>${esc(x.vu)} / ${esc(x.iteration)}</td><td>${esc(x.orderId)}</td><td>${esc(x.status)}</td><td class="${x.success?'good':'bad'}">${x.success?'Aprovado':'Falhou'}</td><td>${ms(x.totalDurationMs)}</td><td>${esc(x.lastStage)}<br><small>${esc(x.error||'')}</small></td></tr>`).join('');
$('thresholds').innerHTML=d.thresholds.map(t=>`<p><span class="${t.ok?'good':'bad'}">${t.ok?'✓':'✕'}</span> ${esc(t.metric)} <small>${esc(t.expression)}</small></p>`).join('')||'<p>Sem thresholds no resumo.</p>';
$('sources').innerHTML=`Resumo: ${esc(d.summary)}<br>Pedidos: ${esc(d.ordersFile)}<br>Checks: ${fmt(checks.passes)} aprovados / ${fmt(checks.fails)} reprovados`;
}
$('selector').addEventListener('change',render);render();
</script></html>'''


if __name__ == '__main__':
    main()
