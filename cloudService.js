// cloudService.js

// Configuration Supabase (REMPLACE AVEC TES VALEURS)
const supabaseUrl = 'https://bkdiihytoitqwkgjhosh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGlpaHl0b2l0cXdrZ2pob3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyODMwNjYsImV4cCI6MjA2NTg1OTA2Nn0.2D14K6kmgdyt4kDdbYZdijNPL10_u1Def-VruodX7zQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ============ AUTHENTIFICATION ============

// Connexion par email (magic link)
async function login(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
  // L'utilisateur reçoit un lien par email pour se connecter
  return true;
}

// Déconnexion
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}

// Récupérer l'utilisateur connecté
async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

// ============ CRUD CATEGORIES ============

// Récupérer toutes les catégories
async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data;
}

// Ajouter une catégorie
async function addCategory(category) {
  const { error } = await supabase.from('categories').insert([category]);
  if (error) throw error;
}

// Modifier une catégorie
async function updateCategory(id, updates) {
  const { error } = await supabase.from('categories').update(updates).eq('id', id);
  if (error) throw error;
}

// Supprimer une catégorie
async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ============ CRUD PRODUITS ============

// Récupérer tous les produits
async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw error;
  return data;
}

// Ajouter un produit
async function addProduct(prod) {
  const { error } = await supabase.from('products').insert([prod]);
  if (error) throw error;
}

// Modifier un produit
async function updateProduct(id, updates) {
  const { error } = await supabase.from('products').update(updates).eq('id', id);
  if (error) throw error;
}

// Supprimer un produit
async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ============ SYNCHRONISATION (pour étape suivante) ============

// Récupérer toutes les données (produits + catégories)
async function fetchAllData() {
  const categories = await fetchCategories();
  const products = await fetchProducts();
  return { categories, products };
}

// Remplacer tout le stock cloud (purge et reload)
async function replaceAllCloudData({ categories, products }) {
  // Purge puis ajout (attention : opération destructive !)
  await supabase.from('products').delete().neq('id', 0);
  await supabase.from('categories').delete().neq('id', '');
  if (Array.isArray(categories) && categories.length)
    await supabase.from('categories').insert(categories);
  if (Array.isArray(products) && products.length)
    await supabase.from('products').insert(products);
}

// ============ EXPORT DES FONCTIONS POUR app.js ============

window.cloudService = {
  login,
  logout,
  getUser,
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  fetchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  fetchAllData,
  replaceAllCloudData
};
