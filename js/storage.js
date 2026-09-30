// storage.js — persistencia remota en Supabase
'use strict';

const Storage = {
  async load() {
    SupabaseAPI.restoreSession();
    if (!SupabaseAPI.session) return emptyRemoteState();
    try {
      return await SupabaseAPI.loadState();
    } catch (error) {
      console.error(error);
      throw new Error('No se pudo cargar la información de Supabase. Verifica el esquema y las políticas RLS.');
    }
  },

  async save(data) {
    try {
      await SupabaseAPI.persist(data);
      return true;
    } catch (error) {
      console.error('No se pudo sincronizar con Supabase.', error);
      showToast('No se pudo sincronizar el último cambio.', 'danger');
      return false;
    }
  },

  reset() {
    SupabaseAPI.signOut();
  },
};
