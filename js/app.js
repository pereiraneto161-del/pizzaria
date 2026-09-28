/* ============================================================
   SEU GIUSEPPE · Cliente
   + integração com Bella Massa via Bridge
   ============================================================ */

const $ = s => document.querySelector(s);
const K = { p:'gp_pedidos', v:'gp_vendas', n:'gp_seq', m:'gp_meus', a:'gp_acesso', c:'gp_cliente', b:'gp_bridge_ids' };
const PIN = '1234';

const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const gr  = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); desenhar(); };
const R   = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
const min  = t => Math.floor((Date.now() - t) / 6e4);
const ha = t => {
  const m = min(t);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`;
};

const ST = { entregue:'Pedido entregue', preparo:'Em preparo', pronto:'Pronto' };
const U  = id => `https://images.unsplash.com/photo-${id}?w=480&h=320&fit=crop&auto=format`;

const PZ = [
  ['Margherita',        'Molho de tomate San Marzano, fior di latte, manjericão fresco e azeite extra virgem', 42, '1574071318508-1cdbab80d002', 'Clássica'],
  ['Pepperoni',         'Molho de tomate, mussarela artesanal, pepperoni defumado e orégano fresco',           52, '1628840042765-356cda07504e', 'Mais Pedida'],
  ['Quatro Queijos',    'Mussarela, gorgonzola, parmesão reggiano e provolone com fio de mel',                 58, '1513104890138-7c749659a591', 'Especial'],
  ['Calabresa',         'Molho de tomate, calabresa artesanal defumada, mussarela e cebola roxa',              48, '1565299624946-b28f40a0ae38', 'Tradicional'],
  ['Portuguesa',        'Molho de tomate, presunto, ovo caipira, cebola, azeitona preta e mussarela',          54, '1571407970349-bc81e7e96d47', 'Tradicional'],
  ['Frango & Catupiry', 'Frango caipira desfiado, catupiry original, milho verde e mussarela',                 56, '1604382354936-07c5d9983bd3', 'Favorita']
];

/* ===== Dados locais do Giuseppe ===== */
const P = () => ler(K.p, []);
const V = () => ler(K.v, []);

const up = (id, f) => gr(K.p, P().map(p => p.id === id ? { ...p, ...f } : p));
const rm = id => gr(K.p, P().filter(p => p.id !== id));
const st = (id, s) => up(id, { status: s, pronto: s === 'pronto' ? Date.now() : null });
const pagar = id => up(id, { pago: true });

/* 🔗 Mapeia status ponte ↔ Giuseppe */
const BRIDGE_TO_LOCAL = { novo:'entregue', em_preparo:'preparo', pronto:'pronto', entregue:'pronto', pago:'pronto' };

/* 🔗 Cria pedido local + publica na ponte */
function criar(o) {
  const id = ler(K.n, 0) + 1;
  localStorage.setItem(K.n, id);
  localStorage.setItem(K.m, JSON.stringify([id, ...ler(K.m, [])]));

  gr(K.p, [...P(), { id, ...o, status:'entregue', criado: Date.now(), pronto: null }]);

  if (window.Bridge) {
    const shared = window.Bridge.push({
      mesa: o.mesa, nome: o.nome, sabor: o.sabor,
      valor: o.valor, pago: o.pago, obs: o.obs || '',
    });
    const meus = ler(K.b, {});
    meus[id] = shared.id;
    localStorage.setItem(K.b, JSON.stringify(meus));
  }
}

function cancelar(id) {
  const p = P().find(x => x.id === id);
  if (p && p.status !== 'pronto' && confirm('Cancelar o pedido de ' + p.sabor + '?')) {
    // remove também da ponte
    if (window.Bridge) {
      const meus = ler(K.b, {});
      if (meus[id]) { window.Bridge.remove(meus[id]); delete meus[id]; localStorage.setItem(K.b, JSON.stringify(meus)); }
    }
    rm(id);
    toast('Pedido cancelado');
  }
}

function entregar(id) {
  const p = P().find(x => x.id === id);
  if (!p || p.status !== 'pronto' || !p.pago) return;
  localStorage.setItem(K.v, JSON.stringify([...V(), { ...p, entregue: Date.now() }]));
  rm(id);
  toast('Mesa ' + p.mesa + ' servida! Pedido concluído');
}

/* ===== Componentes ===== */
const acesso = () => ler(K.a, false);
const rota = () => {
  const r = location.hash.slice(1);
  return ['cozinha','garcom','caixa'].includes(r) ? r : 'cliente';
};
const cabec = (t, s) => `<h2 class="t">${t}</h2><p class="mu">${s}</p><div class="bar"><i></i><i></i><i></i></div>`;
const vazio = (e, t) => `<div class="vz"><div>${e}</div><p>${t}</p></div>`;

let sub = 'cardapio';
let tt;
function toast(m) {
  const t = $('#toast');
  t.textContent = m; t.className = 'on';
  clearTimeout(tt); tt = setTimeout(() => t.className = '', 3000);
}
const abrir  = h => $('#modal').innerHTML = `<div class="dlg">${h}</div>`;
const fechar = () => $('#modal').innerHTML = '';

/* ===== Tela do CLIENTE ===== */
function vCliente() {
  const m = ler(K.m, []);
  const n = m.filter(id => P().some(p => p.id === id)).length;
  const tab = (k, t) => `<button data-a="sub" data-s="${k}" class="${sub===k?'on':''}">${t}</button>`;
  const tabs = `<div class="tabs">${tab('cardapio','Cardápio')}${tab('pedidos','Meus pedidos'+(n?` (${n})`:''))}</div>`;

  if (sub === 'cardapio')
    return tabs + cabec('Nossas Pizzas','Massa artesanal, ingredientes selecionados · Escolha sua favorita') +
      `<div class="grid">${PZ.map((z, i) =>
        `<div class="card">
          <img src="${U(z[3])}" alt="${esc(z[0])}" onerror="this.style.visibility='hidden'">
          <div class="pad">
            <div class="lin"><h3>${esc(z[0])}</h3><b class="pr">${R(z[2])}</b></div>
            <span class="chip wa">${z[4]}</span>
            <p class="mu sm" style="flex:1;margin:0">${z[1]}</p>
            <button class="btn" data-a="pedir" data-id="${i}">Pedir esta pizza</button>
          </div>
        </div>`).join('')}</div>`;

  const msg = {
    entregue: 'Recebemos seu pedido! Ele está na fila da cozinha.',
    preparo:  'Sua pizza está no forno 🔥',
    pronto:   'Pronta! O garçom já vai levar até sua mesa.'
  };

  const l = m.map(id => {
    const p = P().find(x => x.id === id);
    if (p) return `
      <div class="card pad">
        <div class="lin"><h3>🍕 ${esc(p.sabor)}</h3><b class="pr">${R(p.valor)}</b></div>
        <p class="mu sm" style="margin:0">Pedido #${p.id} · Mesa ${p.mesa} · ${esc(p.nome)} · ${hora(p.criado)}</p>
        <div class="trk">${Object.keys(ST).map((s,i) =>
          `<span class="${i <= Object.keys(ST).indexOf(p.status) ? 'on' : ''}">${ST[s]}</span>`).join('')}</div>
        <p class="sm" style="margin:0">${msg[p.status] || ''}</p>
        <div class="lin">
          <span class="chip ${p.pago ? 'ok':'wa'}">${p.pago ? 'Pago':'A pagar'}</span>
          ${p.status !== 'pronto' ? `<button class="btn o" data-a="canc" data-id="${p.id}">Cancelar pedido</button>` : ''}
        </div>
      </div>`;
    const v = V().find(x => x.id === id);
    return v && min(v.entregue) < 30
      ? `<div class="card pad">
          <div class="lin"><h3>🍕 ${esc(v.sabor)}</h3><span class="chip ok">✓ Entregue</span></div>
          <p class="mu sm" style="margin:0">Bom apetite! · Pedido #${v.id} · ${R(v.valor)}</p>
        </div>` : '';
  }).join('');

  return tabs + cabec('Meus Pedidos','Acompanhe o status do seu pedido em tempo real') +
    (l ? `<div class="grid">${l}</div>` : vazio('🍕','Você ainda não tem pedidos ativos'));
}

function pedirModal(i) {
  const z = PZ[i];
  const c = ler(K.c, {});
  abrir(`
    <img src="${U(z[3])}" alt="" onerror="this.style.visibility='hidden'">
    <form id="fped" data-i="${i}" class="pad">
      <div class="lin"><h3>${esc(z[0])}</h3><b class="pr">${R(z[2])}</b></div>
      <p class="mu sm" style="margin:0">${z[1]}</p>
      <label>Número da mesa *<input name="mesa" type="number" min="1" required value="${c.mesa||''}" placeholder="Ex: 7"></label>
      <label>Seu nome *<input name="nome" required maxlength="40" value="${esc(c.nome||'')}" placeholder="Ex: Maria Silva"></label>
      <label class="rd"><input type="radio" name="pg" value="0" checked> Pagar depois (garçom ou caixa)</label>
      <label class="rd"><input type="radio" name="pg" value="1"> Pagar agora (Pix / cartão)</label>
      <div class="lin">
        <button type="button" class="btn o" data-a="fechar">Cancelar</button>
        <button class="btn">Enviar para Cozinha</button>
      </div>
    </form>`);
}

/* ===== Telas internas (não usadas pelo Giuseppe puro, mantidas p/ compatibilidade) ===== */
const seg = p => `<div class="seg">${Object.keys(ST).map(s =>
  `<button data-a="st" data-id="${p.id}" data-s="${s}" class="${p.status===s?'on '+s:''}">${ST[s]}</button>`).join('')}</div>`;

function vCozinha() {
  const f = P().filter(p => p.status !== 'pronto').sort((a,b) => a.criado - b.criado);
  const r = P().filter(p => p.status === 'pronto').sort((a,b) => a.pronto - b.pronto);
  const c = (p,i) => `<div class="card pad ${i===0?'prox':''}">
    <div class="lin">
      <span class="chip no">${i>=0?`${i+1}º · `:''}Mesa ${p.mesa}</span>
      <span class="sm ${i<0?'mu':min(p.criado)>=20?'r':min(p.criado)>=10?'a':'mu'}">
        ${i>=0?`#${p.id} · ${hora(p.criado)} · ${ha(p.criado)}`:'Pronta '+ha(p.pronto)}
      </span>
    </div>
    ${i===0?'<b class="sm r">▶ PRÓXIMO DA FILA</b>':''}
    <h3>🍕 ${esc(p.sabor)}</h3>
    <span class="mu sm">${esc(p.nome)}</span>
    ${seg(p)}
  </div>`;
  return cabec('Painel da Cozinha', `${f.length} pedido(s) na fila · faça sempre o mais antigo primeiro`) +
    `<div class="cols">
      <div><h3>Fila de preparo</h3><div class="lst">${f.map(c).join('') || vazio('🍕','Nenhum pedido na fila')}</div></div>
      <div><h3>Prontos (aguardando garçom)</h3><div class="lst">${r.map(p=>c(p,-1)).join('') || '<p class="mu">Nenhum</p>'}</div></div>
    </div>`;
}

function vGarcom() {
  const l = P().filter(p => p.status === 'pronto').sort((a,b) => a.pronto - b.pronto);
  return cabec('Painel do Garçom', `${l.length} pizza(s) pronta(s) para levar · ${P().length - l.length} ainda na cozinha`) +
    (l.length ? `<div class="grid">${l.map(p => `<div class="card pad">
      <div class="lin"><h3 class="mesa">Mesa ${p.mesa}</h3><span class="sm ${min(p.pronto)>=3?'r':'mu'}">Pronta ${ha(p.pronto)}</span></div>
      <b>🍕 ${esc(p.sabor)}</b>
      <span class="mu sm">${esc(p.nome)} · Pedido #${p.id}</span>
      <div class="lin"><b class="pr">${R(p.valor)}</b><span class="chip ${p.pago?'ok':'no'}">${p.pago?'PAGO':'NÃO PAGO'}</span></div>
      ${p.pago ? `<button class="btn g" data-a="ent" data-id="${p.id}">✓ Marcar como entregue</button>`
               : `<button class="btn y" data-a="pagar" data-id="${p.id}">💵 Receber ${R(p.valor)}</button>
                  <button class="btn" disabled>Entregar (receba antes)</button>`}
    </div>`).join('')}</div>` : vazio('🛎️','Nenhuma pizza pronta no momento'));
}

function vCaixa() {
  const ms = {};
  P().forEach(p => (ms[p.mesa] ??= []).push(p));
  const v = V();
  const tot = v.reduce((s,x) => s + x.valor, 0);
  const mesas = Object.keys(ms).sort((a,b) => a-b).map(m => {
    const l = ms[m];
    const dv = l.filter(p => !p.pago).reduce((s,p) => s + p.valor, 0);
    return `<div class="card pad">
      <div class="lin"><h3>Mesa ${m}</h3><span class="chip ${dv?'no':'ok'}">${dv?'A receber '+R(dv):'Tudo pago'}</span></div>
      ${l.map(p => `<div class="lin sm">
        <span>${esc(p.sabor)} · ${esc(p.nome)} <span class="mu">(${ST[p.status]})</span></span>
        <span>${R(p.valor)} ${p.pago?'✅':`<button class="btn y s" data-a="pagar" data-id="${p.id}">Receber</button>`}</span>
      </div>`).join('')}
      ${dv?`<button class="btn g" data-a="pagmesa" data-id="${m}">Receber tudo da mesa (${R(dv)})</button>`:''}
    </div>`;
  }).join('');
  return cabec('Caixa','Contas abertas por mesa e fechamento do dia') +
    `<div class="grid">
      <div class="card pad"><span class="mu sm">Servido e recebido hoje</span><b class="big">${R(tot)}</b></div>
      <div class="card pad"><span class="mu sm">Pizzas entregues</span><b class="big">${v.length}</b></div>
    </div>
    <h3 class="sec">Mesas abertas</h3>` +
    (mesas ? `<div class="grid">${mesas}</div>` : vazio('💰','Nenhuma mesa com pedidos em aberto')) +
    `<div class="lin sec"><h3>Entregues hoje</h3>${v.length?'<button class="btn o" data-a="dia">Fechar o dia</button>':''}</div>` +
    (v.length ? `<div class="card pad">${[...v].reverse().map(x =>
      `<div class="lin sm"><span>${hora(x.entregue)} · Mesa ${x.mesa} · ${esc(x.sabor)} · ${esc(x.nome)}</span><b>${R(x.valor)}</b></div>`
    ).join('')}</div>` : '<p class="mu">Nada entregue ainda.</p>');
}

/* ===== Navegação ===== */
function pin() {
  abrir(`<form id="fpin" class="pad">
    <h3>🔒 Área da equipe</h3>
    <p class="mu sm" style="margin:0">Digite o PIN para acessar. (Demo: <b>${PIN}</b>)</p>
    <input name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN">
    <p class="r sm" id="perr" style="margin:0"></p>
    <div class="lin">
      <button type="button" class="btn o" data-a="pincanc">Cancelar</button>
      <button class="btn">Entrar</button>
    </div>
  </form>`);
  setTimeout(() => $('#fpin input').focus());
}

function desenhar() {
  let r = rota();
  const ac = acesso();
  if (r !== 'cliente' && !ac) { r = 'cliente'; if (!$('#modal').innerHTML) pin(); }

  const cnt = {
    cozinha: P().filter(p => p.status !== 'pronto').length,
    garcom:  P().filter(p => p.status === 'pronto').length,
    caixa:   P().filter(p => !p.pago).length
  };

  $('#nav').innerHTML = [
    ['cliente','🍽️ Cliente'], ['cozinha','👨‍🍳 Cozinha'], ['garcom','🛎️ Garçom'], ['caixa','💰 Caixa']
  ].map(([k,t]) => `<a href="#${k}" class="${k===r?'on':''}">${t}${k!=='cliente'&&!ac?' 🔒':''}${ac&&cnt[k]?`<b>${cnt[k]}</b>`:''}</a>`).join('')
    + (ac ? '<a href="#cliente" data-a="sair">Sair da equipe</a>' : '');

  $('#app').innerHTML = { cliente:vCliente, cozinha:vCozinha, garcom:vGarcom, caixa:vCaixa }[r]();
}

/* ===== Eventos ===== */
document.addEventListener('click', e => {
  if (e.target.id === 'modal') { if ($('#fpin')) location.hash = 'cliente'; return fechar(); }
  const b = e.target.closest('[data-a]'); if (!b) return;
  const { a, id, s } = b.dataset, n = +id;
  const p = P().find(x => x.id === n);

  ({
    sub:    () => { sub = s; desenhar(); },
    pedir:  () => pedirModal(n),
    fechar,
    pincanc: () => { fechar(); location.hash = 'cliente'; },
    sair:   () => gr(K.a, false),
    st:     () => st(n, s),
    pagar:  () => { if (p && confirm('Confirmar o recebimento de ' + R(p.valor) + '?')) { pagar(n); toast('Pagamento registrado'); } },
    pagmesa:() => { if (confirm('Receber tudo da mesa ' + id + '?')) P().filter(x => String(x.mesa) === id).forEach(x => pagar(x.id)); },
    ent:    () => entregar(n),
    canc:   () => cancelar(n),
    dia:    () => { if (confirm('Fechar o dia? O total entregue será zerado.')) gr(K.v, []); }
  })[a]?.();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const d = Object.fromEntries(new FormData(f));

  if (f.id === 'fpin') {
    if (d.pin === PIN) { fechar(); gr(K.a, true); }
    else $('#perr').textContent = 'PIN incorreto.';
  }

  if (f.id === 'fped') {
    const z = PZ[f.dataset.i];
    const mesa = +d.mesa;
    const nome = d.nome.trim();
    if (!(mesa > 0) || !nome) return;
    localStorage.setItem(K.c, JSON.stringify({ mesa, nome }));
    fechar();
    sub = 'pedidos';
    criar({ mesa, nome, sabor: z[0], valor: z[2], pago: d.pg === '1' });
    toast('Pedido enviado para a cozinha! Mesa ' + mesa);
  }
});

/* ============================================================
   🔗 SINCRONIZAÇÃO Bella Massa → Giuseppe
   ============================================================ */
if (window.Bridge) {
  window.Bridge.subscribe((shared) => {
    const meus = ler(K.b, {});
    let mudou = false;
    const pedidos = P();

    shared.forEach(sp => {
      const localId = Object.keys(meus).find(k => meus[k] === sp.id);
      if (!localId) return;
      const p = pedidos.find(x => String(x.id) === String(localId));
      if (!p) return;

      const novoStatus = BRIDGE_TO_LOCAL[sp.status];
      if (novoStatus && p.status !== novoStatus) { p.status = novoStatus; mudou = true; }
      if (sp.pago && !p.pago) { p.pago = true; mudou = true; }
    });

    if (mudou) {
      localStorage.setItem(K.p, JSON.stringify(pedidos));
      desenhar();
    }
  });
}

addEventListener('hashchange', desenhar);
addEventListener('storage', desenhar);
setInterval(desenhar, 30000);
desenhar();