export function createModalManager(doc = document) {
  const stack = [];
  const savedInert = new Map();
  let overflow;
  const focusable = (root) => [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
    .filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length);
  const focus = (entry) => (focusable(entry.panel)[0] || entry.panel).focus();
  function sync() {
    savedInert.forEach((value, el) => { el.inert = value; });
    savedInert.clear();
    const top = stack.at(-1);
    if (top) {
      top.root.inert = false;
      let branch = top.root;
      while (branch && branch !== doc.body) {
        for (const sibling of branch.parentElement.children) {
          if (sibling !== branch && !(top.root.id === 'cart-drawer' && sibling.id === 'drawer-backdrop')) {
            savedInert.set(sibling, sibling.inert);
            sibling.inert = true;
          }
        }
        branch = branch.parentElement;
      }
    }
    stack.forEach((entry, i) => { entry.root.style.zIndex = String(10000 + i * 2); });
    const backdrop = doc.getElementById?.('drawer-backdrop');
    if (backdrop) backdrop.style.zIndex = stack.some((entry) => entry.root.id === 'cart-drawer') ? '9999' : '';
  }
  function open(root, onClose, { initialFocus } = {}) {
    if (!root || stack.some((entry) => entry.root === root)) return;
    const panel = root.matches('[role="dialog"]') ? root : root.querySelector('[role="dialog"]') || root.firstElementChild;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    const entry = { root, panel, onClose, returnFocus: doc.activeElement, zIndex: root.style.zIndex };
    if (!stack.length) {
      overflow = doc.body.style.overflow;
      doc.body.style.overflow = 'hidden';
    }
    root.inert = false;
    root.classList.add('open');
    stack.push(entry);
    sync();
    if (initialFocus) initialFocus.focus();
    else focus(entry);
  }
  function close(root) {
    const index = stack.findIndex((entry) => entry.root === root);
    if (index < 0) return;
    const wasTop = index === stack.length - 1;
    const [entry] = stack.splice(index, 1);
    stack.forEach((child) => {
      if (root.contains(child.returnFocus)) child.returnFocus = entry.returnFocus;
    });
    root.classList.remove('open');
    root.style.zIndex = entry.zIndex;
    sync();
    root.inert = true;
    if (savedInert.has(root)) savedInert.set(root, true);
    if (!stack.length) doc.body.style.overflow = overflow;
    if (wasTop) {
      const target = entry.returnFocus;
      if (target?.isConnected && !target.closest('[inert]') && target.getClientRects().length) target.focus();
      else if (stack.length) focus(stack.at(-1));
      else doc.querySelector('main')?.focus();
    }
  }
  doc.addEventListener('keydown', (event) => {
    const top = stack.at(-1);
    if (!top) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      top.onClose();
    } else if (event.key === 'Tab') {
      const items = focusable(top.panel);
      const current = items.indexOf(doc.activeElement);
      if (!items.length || current < 0 || (event.shiftKey ? current === 0 : current === items.length - 1)) {
        event.preventDefault();
        (items[event.shiftKey ? items.length - 1 : 0] || top.panel).focus();
      }
    }
  }, true);
  doc.addEventListener('focusin', (event) => {
    const top = stack.at(-1);
    if (top && !top.panel.contains(event.target)) focus(top);
  });
  return { open, close };
}

export function createDialogService(manager, doc = document) {
  let queue = Promise.resolve();
  return function showDialog(message, { kind = 'alert', value = '', readOnly = false } = {}) {
    const run = () => new Promise((resolve) => {
      const root = doc.createElement('div');
      root.className = 'modal-backdrop';
      root.innerHTML = `<form class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
        <h2 id="app-dialog-title"></h2><p id="app-dialog-message"></p>
        <label for="app-dialog-input">Teks</label><textarea id="app-dialog-input" rows="4"></textarea>
        <div class="app-dialog-actions"><button type="button" class="btn-secondary">Batal</button><button type="submit" class="btn-primary">OK</button></div>
      </form>`;
      const form = root.firstElementChild;
      const input = root.querySelector('textarea');
      const cancel = root.querySelector('button');
      root.querySelector('h2').textContent = kind === 'confirm' ? 'Konfirmasi tindakan' : kind === 'prompt' ? 'Masukkan teks' : 'Informasi';
      root.querySelector('p').textContent = message;
      input.value = value;
      input.readOnly = readOnly;
      input.hidden = kind !== 'prompt';
      root.querySelector('label').hidden = input.hidden;
      cancel.hidden = kind === 'alert';
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        manager.close(root);
        root.remove();
        resolve(result);
      };
      const dismiss = () => finish(kind === 'prompt' ? null : false);
      cancel.addEventListener('click', dismiss);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        finish(kind === 'prompt' ? input.value : true);
      });
      doc.body.append(root);
      manager.open(root, dismiss, { initialFocus: kind === 'prompt' ? input : kind === 'confirm' ? cancel : root.querySelector('[type="submit"]') });
      if (readOnly) input.select();
    });
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  };
}

export function bindTabs(container, { filter = false } = {}) {
  if (!container) return;
  const tabs = [...container.querySelectorAll('button')];
  container.setAttribute('role', filter ? 'group' : 'tablist');
  container.setAttribute('aria-label', filter ? 'Kategori produk' : 'Metode pembayaran');
  function update() {
    tabs.forEach((tab, i) => {
      const selected = tab.classList.contains('active');
      tab.setAttribute('role', filter ? 'button' : 'tab');
      tab.setAttribute(filter ? 'aria-pressed' : 'aria-selected', String(selected));
      tab.tabIndex = filter || selected ? 0 : -1;
      if (!filter) {
        tab.id ||= `payment-tab-${i}`;
        tab.setAttribute('aria-controls', tab.dataset.target);
        const panel = container.ownerDocument.getElementById(tab.dataset.target);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
        panel.hidden = !selected;
      }
    });
  }
  container.addEventListener('click', update);
  if (!filter) container.addEventListener('keydown', (event) => {
    const i = tabs.indexOf(event.target);
    if (i < 0) return;
    const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  });
  update();
}