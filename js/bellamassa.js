/* ============================================================
   BELLA MASSA · Sistema interno
   + integração com Seu Giuseppe via Bridge
   ============================================================ */

const img = id => `https://images.unsplash.com/photo-${id}?w=500&h=300&fit=crop&auto=format`;
const PRODS = [
  { id:'p1', name:'Pizza Calabresa',       desc:'Molho de tomate, mussarela e calabresa fatiada com orégano', price:45, cat:'pizza', photo:img('1574071318508-1cdbab80d002') },
  { id:'p2', name:'Pizza Margherita',      desc:'Molho de tomate, mussarela fresca e folhas de manjericão',   price:42, cat:'pizza', photo:img('1565299624946-b28f40a0ae38') },
  { id:'p3', name:'Pizza Portuguesa',      desc:'Presunto, ovo cozido, cebola, pimentão e azeitonas pretas',  price:48, cat:'pizza', photo:img('1513104890138-7c749659a591') },
  { id:'p4', name:'Pizza Quatro Queijos',  desc:'Mussarela, parmesão, provolone e gorgonzola cremoso',        price:52, cat:'pizza', photo:img('1571997478779-2adcbbe9ab2f') },
  { id:'p5', name:'Pizza Frango Catupiry', desc:'Frango desfiado com Catupiry cremoso e orégano',             price:50, cat:'pizza', photo:img('1604382354936-07c5d9983bd3') },
  { id:'b1', name:'Refrigerante Lata',     desc:'Coca-Cola, Guaraná ou Sprite — 350ml gelado',                price:7,  cat:'bebida', photo:img('1622483767028-3f66f32aef97') },
  { id:'b2', name:'Suco Natural 500ml',    desc:'Laranja, maracujá ou limão espremido na hora',               price:12, cat:'bebida', photo:img('1621506289937-a8e4df240d0b') },
  { id:'b3', name:'Cerveja Artesanal',     desc:'Pilsen ou IPA local, bem gelada — 500ml',                    price:18, cat:'bebida', photo:img('1608270586620-248524c67de9') },
  { id:'s1', name:'Tiramisù',              desc:'Clássico italiano com mascarpone, espresso e cacau em pó',   price:22, cat:'sobremesa', photo:img('1563729784474-d77dbb933a9e') },
  { id:'s2', name:'Petit Gâteau',          desc:'Bolinho de chocolate quente com sorvete de creme',           price:26, cat:'sobremesa', photo:img('1578985545062-69928b1d9587') },
];
const CATS = [['pizza','🍕','Pizzas'],['bebida','🥤','Bebidas'],['sobremesa','🍮','Sobremesas']];
const NAV  = [['pedidos','📋','Pedidos'],['cozinha','👨‍🍳','Cozinha'],['garcom','🛎️','Garçom'],['caixa','💰','Caixa']];
const PAYS = [['pix','⚡','PIX'],['cartao','💳','Cartão'],['dinheiro','💵','Dinheiro']];

const now = Date.now(), MIN = 60000;
const state = {
  screen:'pedidos', category:'pizza', table:7, cart:{}, obs:'', counter:104, selTable:null, pay:null,
  billReq:{}, paidLog:[], service:true, people:1, cash:'',
  orders:[
    { id:101, table:5, status:'em_preparo', at:now-15*MIN, items:[['Pizza Portuguesa',2,48],['Suco Natural 500ml',1,12]] },
    { id:102, table:7, status:'pronto',     at:now-22*MIN, items:[['Pizza Calabresa',1,45],['Pizza Margherita',2,42],['Refrigerante Lata',2,7]] },
    { id:103, table:3, status:'entregue',   at:now-45*MIN, items:[['Pizza Quatro Queijos',1,52],['Cerveja Artesanal',2,18]] },
  ],
};

const KEY = 'bellamassa_v1';
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) Object.assign(state, s); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ orders: state.orders, counter: state.counter, paidLog: state.paidLog, billReq: state.billReq })); } catch {} };

/* ── Utilitários ── */
const $ = s => document.querySelector(s);
const fmt = n => 'R$ ' + n.toFixed(2).replace('.', ',');
const pad = n => String(n).padStart(2, '0');
const total = items => items.reduce((s, [, q, p]) => s + q * p, 0);
const mins = at => Math.floor((Date.now() - at) / MIN);
const elapsed = at => mins(at) < 1 ? 'agora mesmo' : mins(at) + ' min';
const byStatus = (...s) => state.orders.filter(o => s.includes(o.status));
const cartList = () => Object.values(state.cart);
const chip = (t, c) => `<span class="chip" style="color:${c};border-color:${c}">${t}</span>`;

/* 🔗 MAPA DE STATUS entre ponte e Bella Massa (são iguais aqui) */
const LOCAL_TO_BRIDGE = { novo:'novo', em_preparo:'em_preparo', pronto:'pronto', entregue:'entregue', pago:'pago' };

/* Propaga status local para a ponte */
function pushLocalToBridge(order) {
  if (!window.Bridge || !order._bridgeId) return;
  window.Bridge.update(order._bridgeId, {
    status: LOCAL_TO_BRIDGE[order.status] || order.status,
    pago: order.status === 'pago' || order._pago === true,
  });
}

/* Atualiza status + propaga */
const setStatus = (id, status) => {
  const o = state.orders.find(o => o.id === id);
  if (!o) return;
  o.status = status;
  if (status === 'pago') o._pago = true;
  pushLocalToBridge(o);
  render();
};

/* 🔗 Sincroniza pedidos vindos da ponte (Giuseppe) */
function syncFromBridge() {
  if (!window.Bridge) return;
  const shared = window.Bridge.list();
  let mudou = false;

  shared.forEach(sp => {
    let local = state.orders.find(o => o._bridgeId === sp.id);

    if (!local) {
      // novo pedido vindo do Giuseppe
      state.orders.push({
        id: sp.id,
        _bridgeId: sp.id,
        _origem: sp.origem,
        _pago: sp.pago,
        table: sp.mesa,
        status: sp.status,             // 'novo' | 'em_preparo' | ...
        at: sp.criado,
        obs: sp.obs,
        items: sp.items.map(([n, q, p]) => [n, q, p]),
      });
      mudou = true;
    } else {
      // pedido existente → atualiza status/itens/pago
      if (local.status !== sp.status) { local.status = sp.status; mudou = true; }
      if (sp.pago && !local._pago) { local._pago = true; mudou = true; }
    }
  });

  if (mudou) render();
}

/* ── NAV ── */
function renderNav() {
  const badges = {
    cozinha: byStatus('novo').length,
    garcom:  byStatus('pronto').length,
    caixa:   new Set(state.orders.filter(o => o.status !== 'pago').map(o => o.table)).size,
  };
  $('#tabs').innerHTML = NAV.map(([id, ic, label]) =>
    `<button class="tab ${state.screen === id ? 'on' : ''}" data-go="${id}">${ic} ${label}${badges[id] ? `<span class="badge">${badges[id]}</span>` : ''}</button>`).join('');
  $('#crumbs').innerHTML = NAV.map(([id, , label], i) =>
    `<span class="${state.screen === id ? 'on' : ''}">${label}</span>${i < 3 ? '<i>—</i>' : ''}`).join('');
}

/* ── PEDIDOS ── */
function screenPedidos() {
  const items = cartList(), count = items.reduce((s, i) => s + i.qty, 0);
  const sum = items.reduce((s, i) => s + i.qty * i.p.price, 0);
  const prods = PRODS.filter(p => p.cat === state.category).map(p => {
    const c = state.cart[p.id];
    return `<article class="card prod">
      <div class="ph"><img src="${p.photo}" alt="${p.name}" loading="lazy"><span class="price">${fmt(p.price)}</span></div>
      <div class="body"><h3>${p.name}</h3><p>${p.desc}</p>
      ${c ? `<div class="qty"><button data-dec="${p.id}" aria-label="Remover um">−</button><b>${c.qty}</b><button class="plus" data-inc="${p.id}" aria-label="Adicionar mais um">+</button><span class="sum">${fmt(p.price * c.qty)}</span></div>`
          : `<button class="btn full" data-inc="${p.id}">+ Adicionar</button>`}
      </div></article>`;
  }).join('');
  const cart = items.length ? items.map(({ p, qty }) => `
    <div class="ci"><img src="${p.photo}" alt=""><div class="t"><div class="n">${p.name}</div><div class="p">${fmt(p.price * qty)}</div></div>
    <div class="qty"><button data-dec="${p.id}" aria-label="Remover um">−</button><b>${qty}</b><button class="plus" data-inc="${p.id}" aria-label="Adicionar mais um">+</button></div></div>`).join('')
    : `<div class="empty"><div class="big">🍕</div>Nenhum item no carrinho<small>Adicione itens do menu</small></div>`;
  return `<div class="split">
    <section class="main">
      <div class="head"><div><p class="sub">Cardápio digital</p><h2>Mesa <span style="color:var(--red)">${pad(state.table)}</span></h2></div>
        <label class="mesa-box"><small>MESA</small><select id="mesa" aria-label="Mesa">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.table === i + 1 ? 'selected' : ''}>${pad(i + 1)}</option>`).join('')}</select></label></div>
      <div class="cats">${CATS.map(([id, ic, l]) => `<button class="cat ${state.category === id ? 'on' : ''}" data-cat="${id}">${ic} ${l}</button>`).join('')}</div>
      <div class="grid">${prods}</div>
    </section>
    <aside class="cart">
      <div class="cart-h"><h3>🛒 Carrinho</h3>${count ? `<span class="cnt">${count}</span>` : ''}</div>
      <div class="cart-list">${cart}</div>
      <div class="obs"><label for="obs">📝 Observações</label><textarea id="obs" rows="2" placeholder="Ex: sem cebola, bem assada...">${state.obs}</textarea></div>
      <div class="total-row"><span>Total do pedido</span><b>${fmt(sum)}</b></div>
      <button class="send" data-send ${items.length ? '' : 'disabled'}>Enviar Pedido →</button>
    </aside></div>`;
}

/* ── COZINHA ── */
function orderCard(o, action, kind) {
  const m = mins(o.at), cls = m > 25 ? 'late' : m > 15 ? 'warn' : '';
  const tag = m > 25 ? '🔴 Urgente' : m > 15 ? '🟡 Atenção' : '';
  const color = m > 20 ? 'var(--red)' : m > 10 ? 'var(--amber)' : 'var(--gray)';
  return `<div class="card order ${cls}">
    <div class="o-top"><div><b>Pedido #${o.id}</b><div class="sub">Mesa ${pad(o.table)}${o._origem === 'giuseppe' ? ' · 🌐 Giuseppe' : ''}</div></div>
      <div class="r" style="color:${color}">⏱ ${elapsed(o.at)}<div style="font-size:11px">${tag}</div></div></div>
    <div class="items">${o.items.map(([n, q]) => `<div><em>${q}×</em>${n}</div>`).join('')}${o.obs ? `<div class="note">📝 ${o.obs}</div>` : ''}</div>
    ${action ? `<button class="btn full ${kind}" data-status="${o.id}:${action[1]}">${action[0]}</button>` : `<div class="wait">🔔 Aguardando garçom — Mesa ${pad(o.table)}</div>`}
    ${o.status === 'novo' ? `<button class="btn full sec" style="margin-top:8px" data-cancel="${o.id}">Cancelar pedido</button>` : ''}
  </div>`;
}
function screenCozinha() {
  const cols = [
    ['Novos','🔔','var(--amber-t)','var(--amber-a)','var(--amber)', byStatus('novo'), ['Iniciar Preparo','em_preparo'], ''],
    ['Em Preparo','👨‍🍳','var(--blue-t)','var(--blue-a)','var(--blue)', byStatus('em_preparo'), ['Marcar Pronto','pronto'], 'ok'],
    ['Prontos','✅','var(--green-t)','var(--green-a)','var(--green)', byStatus('pronto'), null, ''],
  ];
  const active = cols.reduce((s, c) => s + c[5].length, 0);
  return `<div class="page"><div class="head" style="display:block"><h2>Cozinha</h2><p class="sub">Fila de pedidos em tempo real · ${active} ativos</p></div>
    <div class="cols">${cols.map(([l, ic, col, bg, bd, list, act, kind]) => `<div>
      <div class="col-h" style="background:${bg};border-color:${bd};color:${col}">${ic} ${l}<span class="n" style="background:${col}">${list.length}</span></div>
      <div class="stack">${list.length ? list.map(o => orderCard(o, act, kind)).join('') : '<div class="none">Nenhum pedido</div>'}</div></div>`).join('')}</div></div>`;
}

/* ── GARÇOM ── */
function screenGarcom() {
  const stats = [['Novos Pedidos','🔔',byStatus('novo').length,'var(--amber-t)','var(--amber-a)'],['Em Preparo','🍕',byStatus('em_preparo').length,'var(--blue-t)','var(--blue-a)'],
    ['Prontos','✅',byStatus('pronto').length,'var(--green-t)','var(--green-a)'],['Entregues','🛎️',byStatus('entregue').length,'var(--gray)','var(--surface)']];
  const ready = byStatus('pronto'), done = byStatus('entregue');
  return `<div class="page"><div class="head" style="display:block"><h2>Atendimento</h2><p class="sub">Acompanhe e entregue os pedidos das mesas</p></div>
    <div class="stats">${stats.map(([l, ic, v, c, bg]) => `<div class="stat" style="background:${bg}"><span>${ic}</span><b style="color:${c}">${v}</b><span>${l}</span></div>`).join('')}</div>
    <h3 class="sect">Prontos para entregar</h3>
    <div class="stack">${ready.length ? ready.map(o => `<div class="card row"><div><b>Pedido #${o.id} · Mesa ${pad(o.table)}</b>
      <div class="sub">${o.items.map(([n, q]) => q + '× ' + n).join(', ')}</div></div>
      <button class="btn ok" data-status="${o.id}:entregue">Marcar entregue</button></div>`).join('') : '<div class="none">Nenhum pedido pronto no momento</div>'}</div>
    <h3 class="sect">Entregues</h3>
    <div class="stack">${done.length ? done.map(o => `<div class="card row"><div><b>Pedido #${o.id} · Mesa ${pad(o.table)}</b><div class="sub">${o.items.map(([n, q]) => q + '× ' + n).join(', ')}</div></div>${state.billReq[o.table] ? chip('🔔 Conta solicitada', 'var(--red)') : `<button class="btn" data-bill="${o.table}">💰 Enviar ao caixa</button>`}</div>`).join('') : '<div class="none">Nada entregue ainda</div>'}</div></div>`;
}

/* ── CAIXA ── */
const STATUS = { novo:['Novo','var(--amber-t)'], em_preparo:['Em preparo','var(--blue-t)'], pronto:['Pronto','var(--green-t)'], entregue:['Entregue','var(--gray)'] };
const num = v => parseFloat(String(v).replace(',', '.')) || 0;
const trocoTxt = (c, tot) => c >= tot && c > 0 ? 'Troco: ' + fmt(c - tot) : c ? 'Faltam ' + fmt(tot - c) : '';
function billTotals() {
  const tOrders = state.orders.filter(o => o.status !== 'pago' && o.table === state.selTable);
  const items = tOrders.flatMap(o => o.items), sub = total(items), svc = state.service ? sub * .1 : 0;
  return { tOrders, items, sub, svc, tot: sub + svc };
}
function screenCaixa() {
  const open = state.orders.filter(o => o.status !== 'pago');
  const tables = [...new Set(open.map(o => o.table))].sort((a, b) => (!!state.billReq[b] - !!state.billReq[a]) || a - b);
  const t = state.selTable, { tOrders, sub, svc, tot } = billTotals();
  const pending = tOrders.filter(o => o.status !== 'entregue');
  const received = state.paidLog.reduce((s, p) => s + p.total, 0), nPaid = state.paidLog.length;
  const canPay = state.pay && (state.pay !== 'dinheiro' || num(state.cash) >= tot);
  const tag = n => state.billReq[n] ? chip('🔔 Conta solicitada', 'var(--red)')
    : open.some(o => o.table === n && o.status !== 'entregue') ? chip('Em atendimento', 'var(--amber-t)') : chip('Tudo entregue', 'var(--green-t)');
  const detail = !tOrders.length
    ? `<div class="empty card" style="padding:80px 0"><div class="big">💰</div><p style="font-size:16px">Selecione uma mesa</p><small>Escolha uma mesa na lista ao lado para ver a conta</small></div>`
    : `<div class="card bill"><div class="bill-h"><div><h2>Mesa ${pad(t)} — Conta</h2><p class="sub">${tOrders.length} pedido(s)${state.billReq[t] ? ' · conta solicitada pelo garçom' : ''}</p></div><div class="v">${fmt(tot)}</div></div>
      ${pending.length ? `<div class="warnbox">⚠️ Ainda não entregue: ${pending.map(o => '#' + o.id).join(', ')}</div>` : ''}
      ${tOrders.map(o => `<div class="ord-h">Pedido #${o.id} ${chip(...STATUS[o.status])}</div>` +
        o.items.map(([n, q, p]) => `<div class="line"><span>${q}×</span><span>${n}</span><span class="sub">${fmt(p)}</span><span>${fmt(p * q)}</span></div>`).join('')).join('')}
      <div class="line"><span></span><span>Subtotal</span><span></span><span>${fmt(sub)}</span></div>
      <div class="line"><span></span><span>Serviço (10%) <button class="link" data-svc>${state.service ? 'remover' : 'incluir'}</button></span><span></span><span>${fmt(svc)}</span></div>
      <div class="line tot"><span></span><span>Total</span><span></span><span>${fmt(tot)}</span></div>
      <div class="ppl">Dividir entre <button class="btn sec" data-ppl="-1" aria-label="Menos uma pessoa">−</button><b>${state.people}</b><button class="btn sec" data-ppl="1" aria-label="Mais uma pessoa">+</button>${state.people > 1 ? `<span>${fmt(tot / state.people)} por pessoa</span>` : ''}</div>
      <div class="pays">${PAYS.map(([id, ic, l]) => `<button class="pay ${state.pay === id ? 'on' : ''}" data-pay="${id}"><span class="ic">${ic}</span>${l}</button>`).join('')}</div>
      ${state.pay === 'dinheiro' ? `<div class="cash"><label>Valor recebido <input id="cash" inputmode="decimal" placeholder="0,00" value="${state.cash}"></label><b id="troco">${trocoTxt(num(state.cash), tot)}</b></div>` : ''}
      <button id="fin" class="btn full fin" data-finish ${canPay ? '' : 'disabled'}>✓ Finalizar Conta — ${fmt(tot)}</button></div>`;
  const byM = PAYS.map(([id, , l]) => `${l} ${fmt(state.paidLog.filter(p => p.method === id).reduce((s, p) => s + p.total, 0))}`).join(' · ');
  return `<div class="page"><div class="head"><div><h2>Caixa</h2><p class="sub">Contas chegam aqui quando o garçom envia ao caixa</p></div><button class="btn sec" data-reset>Reiniciar dados</button></div>
    <div class="stats">${[['Contas abertas', tables.length], ['Contas pagas', nPaid], ['Total recebido', fmt(received)], ['Ticket médio', fmt(nPaid ? received / nPaid : 0)]]
      .map(([l, v]) => `<div class="stat" style="background:var(--surface)"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="caixa"><div><h3 class="sect" style="margin-top:0">Mesas abertas</h3>
      ${tables.length ? tables.map(n => `<button class="tbl ${t === n ? 'on' : ''}" data-table="${n}"><div><b>Mesa ${pad(n)}</b><span>${fmt(total(open.filter(o => o.table === n).flatMap(o => o.items)))}</span></div>${tag(n)}</button>`).join('') : '<div class="none">Nenhuma mesa aberta</div>'}
      <h3 class="sect">Pagamentos recentes</h3><p class="sub" style="margin-bottom:8px">${byM}</p>
      ${state.paidLog.slice(-5).reverse().map(p => `<div class="hist"><span>Mesa ${pad(p.table)} · ${PAYS.find(x => x[0] === p.method)[2]}</span><b>${fmt(p.total)}</b></div>`).join('') || '<div class="none">Nenhum pagamento ainda</div>'}</div>
      ${detail}</div></div>`;
}
function finishBill() {
  const { tOrders, items, sub, svc, tot } = billTotals(); if (!tOrders.length || !state.pay) return;
  const r = { id: Date.now(), table: state.selTable, method: state.pay, total: tot, sub, svc, at: Date.now(), items, people: state.people };
  state.paidLog.push(r);
  tOrders.forEach(o => {
    o.status = 'pago';
    o._pago = true;
    pushLocalToBridge(o);          // 🔗 avisa Giuseppe
  });
  delete state.billReq[r.table];
  state.selTable = null; state.pay = null; state.cash = ''; state.people = 1; render();
  const o = $('#overlay');
  o.innerHTML = `<div class="modal"><div class="big">🧾</div><h2>Pagamento concluído</h2>
    <p class="sub">Mesa ${pad(r.table)} · ${PAYS.find(x => x[0] === r.method)[2]} · ${new Date(r.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
    <div class="rc">${r.items.map(([n, q, p]) => `<div><span>${q}× ${n}</span><span>${fmt(q * p)}</span></div>`).join('')}
      <div><span>Serviço</span><span>${fmt(r.svc)}</span></div><div class="t"><span>Total</span><span>${fmt(r.total)}</span></div>
      ${r.people > 1 ? `<div><span>Por pessoa (${r.people})</span><span>${fmt(r.total / r.people)}</span></div>` : ''}</div>
    <div class="acts"><button class="btn sec" data-print>🖨️ Imprimir</button><button class="btn" data-close>Fechar</button></div></div>`;
  o.hidden = false;
}

/* ── RENDER + eventos ── */
function render() {
  save();
  const s = { pedidos:screenPedidos, cozinha:screenCozinha, garcom:screenGarcom, caixa:screenCaixa }[state.screen];
  renderNav(); $('#app').innerHTML = s();
}
function sendOrder() {
  const items = cartList(); if (!items.length) return;
  state.orders.push({ id: state.counter++, table: state.table, status:'novo', at: Date.now(), obs: state.obs.trim() || undefined,
    items: items.map(({ p, qty }) => [p.name, qty, p.price]) });
  state.cart = {}; state.obs = ''; render();
  const o = $('#overlay');
  o.innerHTML = `<div class="modal"><div class="big">✅</div><h2>Pedido enviado!</h2><p class="sub">Pedido da Mesa ${pad(state.table)} enviado para a cozinha</p></div>`;
  o.hidden = false; setTimeout(() => o.hidden = true, 2200);
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.go) { state.screen = d.go; }
  else if (d.cat) state.category = d.cat;
  else if (d.inc) { const p = PRODS.find(x => x.id === d.inc); (state.cart[p.id] ||= { p, qty: 0 }).qty++; }
  else if (d.dec) { const c = state.cart[d.dec]; if (c && --c.qty <= 0) delete state.cart[d.dec]; }
  else if (d.status !== undefined) { const [id, st] = d.status.split(':'); return setStatus(+id, st); }
  else if (d.table) { state.selTable = +d.table; state.pay = null; state.cash = ''; state.people = 1; }
  else if (d.cancel) {
    const o = state.orders.find(x => x.id === +d.cancel);
    state.orders = state.orders.filter(o => o.id !== +d.cancel);
    if (o && o._bridgeId && window.Bridge) window.Bridge.remove(o._bridgeId);
  }
  else if (d.bill) state.billReq[+d.bill] = true;
  else if (d.svc !== undefined) state.service = !state.service;
  else if (d.ppl) state.people = Math.max(1, state.people + +d.ppl);
  else if (d.close !== undefined) { $('#overlay').hidden = true; return; }
  else if (d.print !== undefined) return window.print();
  else if (d.reset !== undefined) {
    if (confirm('Apagar todos os pedidos e pagamentos?')) {
      localStorage.removeItem(KEY);
      if (window.Bridge) window.Bridge.clear();
      location.reload();
    }
    return;
  }
  else if (d.pay) state.pay = d.pay;
  else if (d.finish !== undefined) return finishBill();
  else if (d.send !== undefined) return sendOrder();
  else return;
  render();
});
document.addEventListener('input', e => {
  if (e.target.id === 'obs') state.obs = e.target.value;
  if (e.target.id === 'cash') {
    state.cash = e.target.value; const tot = billTotals().tot, c = num(state.cash);
    $('#troco').textContent = trocoTxt(c, tot); $('#fin').disabled = c < tot;
  }
});
document.addEventListener('change', e => { if (e.target.id === 'mesa') { state.table = +e.target.value; render(); } });
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { Object.assign(state, JSON.parse(e.newValue)); } catch { return; }
  state.screen === 'pedidos' ? renderNav() : render();
});
setInterval(() => { if (['cozinha'].includes(state.screen)) render(); }, 30000);

/* 🔗 Assina a ponte no boot */
if (window.Bridge) {
  window.Bridge.subscribe(() => syncFromBridge());
  syncFromBridge();
}

render();