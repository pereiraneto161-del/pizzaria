/* ============================================================
   BRIDGE · Seu Giuseppe  ↔  Bella Massa
   Canal único via localStorage + evento storage (cross-tab)
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'bridge_orders_v1';
  const EVT = 'bridge:change';

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };

  const write = (orders) => {
    localStorage.setItem(KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent(EVT, { detail: orders }));
  };

  const Bridge = {
    KEY, EVT,
    list: read,
    byStatus: (...s) => read().filter(o => s.includes(o.status)),

    push(order) {
      const orders = read();
      const novo = {
        id: Date.now(),
        origem: 'giuseppe',
        mesa: Number(order.mesa),
        nome: order.nome,
        sabor: order.sabor,
        valor: Number(order.valor),
        pago: !!order.pago,
        status: 'novo',
        obs: order.obs || '',
        items: order.items || [[order.sabor, 1, Number(order.valor)]],
        criado: Date.now(),
        atualizado: Date.now(),
      };
      orders.push(novo);
      write(orders);
      return novo;
    },

    update(id, patch) {
      const orders = read();
      const i = orders.findIndex(o => o.id === id);
      if (i === -1) return null;
      orders[i] = { ...orders[i], ...patch, atualizado: Date.now() };
      write(orders);
      return orders[i];
    },

    setStatus(id, status) { return Bridge.update(id, { status }); },

    remove(id) { write(read().filter(o => o.id !== id)); },

    clear() { write([]); },

    subscribe(cb) {
      const onLocal = (e) => cb(e.detail);
      const onStorage = (e) => {
        if (e.key === KEY && e.newValue) {
          try { cb(JSON.parse(e.newValue)); } catch {}
        }
      };
      window.addEventListener(EVT, onLocal);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(EVT, onLocal);
        window.removeEventListener('storage', onStorage);
      };
    },
  };

  global.Bridge = Bridge;
})(window);