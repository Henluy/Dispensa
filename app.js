// === Dépendance IndexedDB via Dexie.js (CDN dans index.html recommandé) ===
if (typeof Dexie === 'undefined') {
    throw new Error('Dexie.js non trovato! Aggiungi <script src="https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js"></script> dans index.html');
  }
  
  // === Variables pour le cloud ===
  // Variable pour savoir si connecté au cloud
  let isCloud = false;
  let currentUser = null;
  
  // Affiche ou masque les boutons selon le statut de connexion
  function updateAuthUI() {
    if (isCloud) {
      qs('#loginBtn').style.display = 'none';
      qs('#logoutBtn').style.display = '';
      qs('#syncBtn').style.display = '';
      toast('Sei collegato al cloud!', 'ok');
    } else {
      qs('#loginBtn').style.display = '';
      qs('#logoutBtn').style.display = 'none';
      qs('#syncBtn').style.display = 'none';
    }
  }
  
  // === Initialisation IndexedDB avec Dexie.js ===
  const db = new Dexie('stockristorante');
  db.version(1).stores({
    products: '++id, name, category_id, quantity, min_threshold, unit, updated_at',
    categories: 'id, name, icon, is_default'
  });
  
  // === Catégories par défaut (doivent aussi exister dans Supabase !) ===
  const DEFAULT_CATEGORIES = [
    { id: 'formaggi', name: 'Formaggi', icon: '🧀', is_default: true },
    { id: 'carne', name: 'Carne', icon: '🥩', is_default: true },
    { id: 'salumi', name: 'Salumi', icon: '🥓', is_default: true },
    { id: 'latticini', name: 'Latticini', icon: '🥛', is_default: true },
    { id: 'verdure', name: 'Verdure', icon: '🥦', is_default: true },
    { id: 'frutta', name: 'Frutta', icon: '🍎', is_default: true },
    { id: 'pane_focacce', name: 'Pane e Focacce', icon: '🍞', is_default: true },
    { id: 'pasta_riso', name: 'Pasta e Riso', icon: '🍝', is_default: true },
    { id: 'pesce', name: 'Pesce', icon: '🐟', is_default: true },
    { id: 'condimenti', name: 'Condimenti', icon: '🫒', is_default: true },
    { id: 'dolci', name: 'Dolci', icon: '🍰', is_default: true },
    { id: 'bevande', name: 'Bevande', icon: '🥤', is_default: true },
    { id: 'altri', name: 'Altri', icon: '📦', is_default: true }
  ];
  
  // === Initialisation : insère les catégories si base vide ===
  async function ensureDefaultCategories() {
    const count = await db.categories.count();
    if (count === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
  ensureDefaultCategories();
  
  // === Utilitaires UI ===
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  
  // === State courant ===
  let prodotti = [];
  let categorie = [];
  let filtroCategoria = null;
  let ricercaTermine = "";
  
  // === Chargement initial ===
  window.addEventListener('DOMContentLoaded', async () => {
    // Vérifie si l'utilisateur est déjà connecté au cloud
    const user = await cloudService.getUser();
    if (user) {
      isCloud = true;
      currentUser = user;
      updateAuthUI();

      // === Synchronisation intelligente ===
      const localProducts = await db.prodotti.toArray();
      const cloudProducts = await cloudService.fetchProducts();
      
      if (localProducts.length && cloudProducts.length === 0) {
        // Cloud vide, local rempli
        if (confirm("Vuoi caricare i dati locali nel cloud?")) {
          await cloudService.replaceAllCloudData({
            products: localProducts,
            categories: await db.categorie.toArray()
          });
          toast("Dati locali salvati nel cloud!", "success");
        }
      } else if (cloudProducts.length && localProducts.length === 0) {
        // Local vide, cloud rempli
        if (confirm("Vuoi scaricare i dati dal cloud sul dispositivo?")) {
          await db.prodotti.clear();
          await db.prodotti.bulkAdd(cloudProducts);
          const cloudCats = await cloudService.fetchCategories();
          await db.categorie.clear();
          await db.categorie.bulkAdd(cloudCats);
          toast("Dati cloud copiati in locale!", "success");
        }
      } else if (localProducts.length && cloudProducts.length) {
        // Les deux sont remplis → propose un choix
        const choix = prompt(
          "Hai dati sia in locale che nel cloud.\nDigita:\n1 per sostituire il cloud con il locale\n2 per sostituire il locale con il cloud\n3 per fonderli senza duplicati"
        );
        if (choix === '1') {
          await cloudService.replaceAllCloudData({
            products: localProducts,
            categories: await db.categorie.toArray()
          });
          toast("Dati locali copiati nel cloud!", "success");
        } else if (choix === '2') {
          await db.prodotti.clear();
          await db.prodotti.bulkAdd(cloudProducts);
          const cloudCats = await cloudService.fetchCategories();
          await db.categorie.clear();
          await db.categorie.bulkAdd(cloudCats);
          toast("Dati cloud copiati in locale!", "success");
        } else if (choix === '3') {
          // Fusion intelligente : pas de doublons (par name + catégorie)
          const mergedProducts = [];
          const seen = new Set();
          for (const p of [...localProducts, ...cloudProducts]) {
            const key = `${p.name.toLowerCase()}__${p.category_id}`;
            if (!seen.has(key)) {
              mergedProducts.push(p);
              seen.add(key);
            }
          }
          await cloudService.replaceAllCloudData({
            products: mergedProducts,
            categories: await db.categorie.toArray()
          });
          await db.prodotti.clear();
          await db.prodotti.bulkAdd(mergedProducts);
          toast("Sincronizzazione intelligente completata!", "success");
        }
      }
    } else {
      updateAuthUI();
    }
    
    await caricaCategorie();
    await caricaProdotti();
    renderCategorie();
    renderProdotti();
    setupEventListeners();
  });
  
  // === Chargement catégories ===
  async function caricaCategorie() {
    if (isCloud) {
      categorie = await cloudService.fetchCategories();
    } else {
      categorie = await db.categories.toArray();
    }
  }
  
  // === Chargement produits ===
  async function caricaProdotti() {
    if (isCloud) {
      prodotti = await cloudService.fetchProducts();
    } else {
      prodotti = await db.products.orderBy('name').toArray();
    }
  }
  
  // === Rendu UI des filtres catégories ===
  function renderCategorie() {
    const wrapper = qs('#categoryFilters');
    wrapper.innerHTML = "";
    const btnAll = document.createElement('button');
    btnAll.textContent = 'Tutto';
    btnAll.className = !filtroCategoria ? 'selected' : '';
    btnAll.onclick = () => { filtroCategoria = null; renderProdotti(); };
    wrapper.appendChild(btnAll);
  
    categorie.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = `${cat.icon || ''} ${cat.name}`;
      btn.className = filtroCategoria === cat.id ? 'selected' : '';
      btn.onclick = () => { filtroCategoria = cat.id; renderProdotti(); };
      wrapper.appendChild(btn);
    });
  }
  
  // === Rendu UI liste produits ===
  function renderProdotti() {
    let lista = prodotti.slice();
  
    if (filtroCategoria)
      lista = lista.filter(p => p.category_id === filtroCategoria);
    if (ricercaTermine.length > 1)
      lista = lista.filter(p => p.name.toLowerCase().includes(ricercaTermine.toLowerCase()));
  
    const listDiv = qs('#productsList');
    listDiv.innerHTML = lista.length
      ? lista.map(prodHTML).join("")
      : "<div style='padding:20px;text-align:center;color:#bbb'>Nessun prodotto trovato.</div>";
  }
  
  // === HTML d'un produit ===
  function prodHTML(p) {
    const cat = categorie.find(c => c.id === p.category_id) || {};
    return `
    <div class="product-card">
      <div class="product-info">
        <span class="product-name">${p.name}</span>
        <span class="product-category">${cat.icon || ''} ${cat.name || 'Altri'}</span>
        <div class="product-quantity-container">
          <span class="product-quantity">Quantità: ${p.quantity} ${p.unit || ''}</span>
          <div class="quantity-controls">
            <button class="quantity-btn minus-btn" onclick="modificaQuantita(${p.id}, -1)">-</button>
            <button class="quantity-btn plus-btn" onclick="modificaQuantita(${p.id}, 1)">+</button>
          </div>
        </div>
        ${p.min_threshold ? `<span class="product-alert" style="color:#ef4444;font-size:0.95em;">Soglia: ${p.min_threshold}</span>` : ""}
      </div>
      <div class="product-actions">
        <button class="edit-btn" onclick="apriModaleProdotto(${p.id})">Modifica</button>
        <button class="delete-btn" onclick="eliminaProdotto(${p.id})">Elimina</button>
      </div>
    </div>`;
  }
  
  // === Fonction pour modifier rapidement la quantité ===
  async function modificaQuantita(id, delta) {
    try {
      const prodotto = prodotti.find(p => p.id === id);
      if (!prodotto) return;
      
      const nuovaQuantita = Math.max(0, prodotto.quantity + delta);
      prodotto.quantity = nuovaQuantita;
      
      if (isCloud) {
        await cloudService.updateProduct(id, prodotto);
      } else {
        await db.prodotti.update(id, { quantity: nuovaQuantita });
      }
      
      renderProdotti();
      aggiornaStatistiche();
      toast(`Quantità aggiornata: ${prodotto.name}`, "success");
    } catch (error) {
      console.error('Errore durante l\'aggiornamento della quantità:', error);
      toast("Errore durante l'aggiornamento", "error");
    }
  }

  // === Écouteurs d'événements principaux ===
  function setupEventListeners() {
    qs('#addProductBtn').onclick = () => apriModaleProdotto();
    qs('#searchInput').oninput = e => {
      ricercaTermine = e.target.value;
      renderProdotti();
      renderSearchResults();
    };
    qs('#clearSearchBtn').onclick = () => {
      ricercaTermine = "";
      qs('#searchInput').value = "";
      renderProdotti();
      renderSearchResults();
    };
    
    // === Gestion Login/Logout Supabase ===
    qs('#loginBtn').onclick = async () => {
      const email = prompt("Inserisci la tua email per accedere:");
      if (!email) return;
      try {
        await cloudService.login(email);
        alert("Controlla la tua email per il link di accesso.");
      } catch (e) {
        toast("Errore durante il login", "error");
      }
    };
    
    qs('#logoutBtn').onclick = async () => {
      try {
        await cloudService.logout();
        isCloud = false;
        currentUser = null;
        updateAuthUI();
        location.reload();
      } catch (e) {
        toast("Errore durante il logout", "error");
      }
    };

    // === Gestion Synchronisation manuelle ===
    qs('#syncBtn').onclick = async () => {
      if (!isCloud) return toast('Non sei collegato al cloud!', 'error');
      try {
        // Force un push du local vers le cloud (fusion intelligente)
        const localProducts = await db.prodotti.toArray();
        const cloudProducts = await cloudService.fetchProducts();
        const mergedProducts = [];
        const seen = new Set();
        for (const p of [...localProducts, ...cloudProducts]) {
          const key = `${p.name.toLowerCase()}__${p.category_id}`;
          if (!seen.has(key)) {
            mergedProducts.push(p);
            seen.add(key);
          }
        }
        await cloudService.replaceAllCloudData({
          products: mergedProducts,
          categories: await db.categorie.toArray()
        });
        await db.prodotti.clear();
        await db.prodotti.bulkAdd(mergedProducts);
        
        // Recharge les données après synchronisation
        await caricaCategorie();
        await caricaProdotti();
        renderCategorie();
        renderProdotti();
        
        toast("Sincronizzazione forzata completata!", "success");
      } catch (e) {
        console.error('Errore durante la sincronizzazione:', e);
        toast("Errore durante la sincronizzazione", "error");
      }
    };
  }
  
  // === Recherche dynamique produits ===
  function renderSearchResults() {
    const box = qs('#searchResults');
    if (ricercaTermine.length < 2) return box.innerHTML = '';
    const trovati = prodotti.filter(p => p.name.toLowerCase().includes(ricercaTermine.toLowerCase()));
    if (!trovati.length) {
      box.innerHTML = "<div class='search-result-item'>Nessun prodotto trovato.</div>";
      return;
    }
    box.innerHTML = trovati.map(p => {
      const cat = categorie.find(c => c.id === p.category_id) || {};
      return `<div class="search-result-item" onclick="apriModaleProdotto(${p.id})">
        <span>${p.name}</span>
        <span style="font-size:1em;color:#6366f1">${cat.icon || ''} ${cat.name || ''}</span>
      </div>`;
    }).join("");
  }
  
  // === Ouvre le modal (ajout ou édition produit) ===
  window.apriModaleProdotto = async function(id = null) {
    const modal = qs('#productModal');
    const form = qs('#productForm');
    form.reset();
    form.dataset.editing = "";
    renderCategorieSelect();
  
    if (id) {
      let p;
      if (isCloud) {
        p = prodotti.find(prod => prod.id === id);
      } else {
        p = await db.products.get(id);
      }
      if (!p) return;
      qs('#modalTitle').textContent = 'Modifica prodotto';
      form.dataset.editing = id;
      qs('#productName').value = p.name;
      qs('#categorySelect').value = p.category_id || '';
      qs('#quantity').value = p.quantity || 0;
      qs('#unit').value = p.unit || '';
      qs('#minThreshold').value = p.min_threshold || 0;
    } else {
      qs('#modalTitle').textContent = 'Aggiungi prodotto';
    }
    modal.style.display = 'flex';
  
    form.onsubmit = async function(e) {
      e.preventDefault();
      const dati = {
        name: qs('#productName').value.trim(),
        category_id: qs('#categorySelect').value,
        quantity: Number(qs('#quantity').value) || 0,
        min_threshold: Number(qs('#minThreshold').value) || 0,
        unit: qs('#unit').value.trim(),
        updated_at: new Date().toISOString()
      };
      if (!dati.name) return toast('Nome prodotto obbligatorio', 'error');
      if (!dati.category_id) dati.category_id = 'altri';
  
      try {
        if (form.dataset.editing) {
          if (isCloud) {
            await cloudService.updateProduct(Number(form.dataset.editing), dati);
          } else {
            await db.products.update(Number(form.dataset.editing), dati);
          }
          toast('Prodotto modificato!', 'ok');
        } else {
          if (isCloud) {
            await cloudService.addProduct(dati);
          } else {
            await db.products.add(dati);
          }
          toast('Prodotto aggiunto!', 'ok');
        }
        await caricaProdotti();
        renderProdotti();
        modal.style.display = 'none';
        renderSearchResults();
      } catch (e) {
        toast('Errore durante il salvataggio!', 'error');
      }
    };
    qs('#cancelModalBtn').onclick = () => modal.style.display = 'none';
  };
  
  function renderCategorieSelect() {
    const select = qs('#categorySelect');
    select.innerHTML = categorie.map(c =>
      `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`
    ).join('');
  }
  
  // === Suppression produit ===
  window.eliminaProdotto = async function(id) {
    if (!confirm('Eliminare questo prodotto?')) return;
    try {
      if (isCloud) {
        await cloudService.deleteProduct(id);
      } else {
        await db.products.delete(id);
      }
      toast('Prodotto eliminato!', 'ok');
      await caricaProdotti();
      renderProdotti();
      renderSearchResults();
    } catch (e) {
      toast('Errore durante l\'eliminazione!', 'error');
    }
  };
  
  // === Toast (notifica rapide) ===
  function toast(msg, type='ok') {
    const box = qs('#toast');
    box.textContent = msg;
    box.style.display = 'flex';
    box.style.background = (type==='error') ? 'linear-gradient(90deg,#ef4444,#6366f1)' : '';
    setTimeout(() => { box.style.display = 'none'; }, 2100);
  }
  
  // === Rafraîchit header stats ===
  // (Tu peux ajouter somme totale, nombre articles…)
  function aggiornaHeaderStats() {
    qs('#headerStats').textContent = `Totale prodotti: ${prodotti.length}`;
  }
  setInterval(aggiornaHeaderStats, 1000);
  
  // === Plug-in future : synchro cloud ===
  // (Tu pourras remplacer chaque appel à db par cloudService plus tard)
  // (Prépare cloudService.js + login, etc.)
  
  // === Export/Import ===
  // === Export CSV ===
  function toCSV(rows, headers) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headerRow = headers.join(',');
    const dataRows = rows.map(row =>
      headers.map(h => esc(row[h])).join(',')
    );
    return [headerRow, ...dataRows].join('\r\n');
  }

  qs('#exportBtn').onclick = async () => {
    const prodotti = await db.products.toArray();
    const categorie = await db.categories.toArray();
    // Export JSON
    const data = { prodotti, categorie };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockristorante_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Export CSV (produits uniquement)
    const prodHeaders = ["name","category_id","quantity","min_threshold","unit"];
    const csv = toCSV(prodotti, prodHeaders);
    const blob2 = new Blob([csv], {type:'text/csv'});
    const url2 = URL.createObjectURL(blob2);
    const a2 = document.createElement('a');
    a2.href = url2;
    a2.download = `prodotti_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
    URL.revokeObjectURL(url2);
    toast('Esportazione JSON + CSV completata!', 'ok');
  };

  qs('#importBtn').onclick = () => {
    qs('#importFile').click();
  };

  // === Import CSV avec auto-matching catégorie ===
  qs('#importFile').onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
      // (Même code import JSON qu'avant)
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); }
      catch { return toast('Formato file non valido!', 'error'); }
      if (data.categorie && Array.isArray(data.categorie)) {
        await db.categories.clear();
        await db.categories.bulkAdd(data.categorie);
      }
      if (data.prodotti && Array.isArray(data.prodotti)) {
        await db.products.clear();
        await db.products.bulkAdd(data.prodotti);
      }
      await caricaCategorie(); await caricaProdotti();
      renderCategorie(); renderProdotti();
      toast('Importazione completata!', 'ok');
      this.value = "";
      return;
    }

    if (name.endsWith('.csv')) {
      const text = await file.text();
      // Parse CSV en objets produits
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const prodottiCSV = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        let obj = {};
        headers.forEach((h,i) => obj[h] = vals[i]);
        // Typage intelligent
        obj.quantity = Number(obj.quantity) || 0;
        obj.min_threshold = Number(obj.min_threshold) || 0;
        obj.name = obj.name ?? '';
        obj.category_id = obj.category_id ?? 'altri';
        obj.unit = obj.unit ?? '';
        return obj;
      });
      // Recherche catégories manquantes
      const catSet = new Set((await db.categories.toArray()).map(c => c.id));
      const toCreate = [];
      for (const p of prodottiCSV) {
        if (p.category_id && !catSet.has(p.category_id)) {
          toCreate.push({
            id: p.category_id,
            name: p.category_id.charAt(0).toUpperCase() + p.category_id.slice(1),
            icon: '📦',
            is_default: false
          });
          catSet.add(p.category_id);
        }
      }
      if (toCreate.length) await db.categories.bulkAdd(toCreate);

      await db.products.clear();
      await db.products.bulkAdd(prodottiCSV);

      await caricaCategorie(); await caricaProdotti();
      renderCategorie(); renderProdotti();
      toast('Importazione CSV completata!', 'ok');
      this.value = "";
      return;
    }

    toast('Formato file non supportato!', 'error');
    this.value = "";
  };

  // === Enregistrement du Service Worker ===
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  }
  