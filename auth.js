/* DL Portal authentication powered by Supabase Auth. */
(function () {
  if (!window.supabase) {
    console.error('Supabase JS failed to load.');
    return;
  }

  const url = window.DL_SUPABASE_URL;
  const key = window.DL_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT_REF') || key.includes('YOUR_SUPABASE')) {
    console.warn('Supabase is not configured yet. Edit supabase-config.js.');
  }

  window.dlSupabase = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  window.DLAuth = {
    async getSession() {
      const { data } = await dlSupabase.auth.getSession();
      return data.session;
    },
    async requireAuth() {
      const session = await this.getSession();
      if (!session) {
        const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'DL_Homepage.html');
        window.location.href = `index.html?next=${next}`;
        return null;
      }
      syncUser(session.user);
      return session.user;
    },
    async signOut() {
      await dlSupabase.auth.signOut();
      ['isLoggedIn','userName','userEmail'].forEach(k => localStorage.removeItem(k));
      window.location.href = 'index.html';
    }
  };

  function syncUser(user) {
    const email = user?.email || '';
    const name = user?.user_metadata?.full_name || email.split('@')[0] || 'Student';
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', name);
  }

  // Keep the legacy localStorage fields in sync for the existing portal pages.
  dlSupabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) syncUser(session.user);
    else if (event === 'SIGNED_OUT') ['isLoggedIn','userName','userEmail'].forEach(k => localStorage.removeItem(k));
  });
})();
