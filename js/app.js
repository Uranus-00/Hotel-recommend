/**
 * app.js —— 云宿 · 著名景点酒店推荐
 * 基于 Vue 3（全局构建版）。
 * 多页面结构：index.html / destinations.html / hotels.html / service.html
 * 每个页面通过 <body data-page="..."> 声明自身身份，共用同一套逻辑。
 * 依赖：js/data.js 中的 DESTINATIONS / HOTELS / FAQS
 */
(function () {
  'use strict';

  const { createApp } = Vue;
  const FAV_KEY = 'yunsu_favorites_v1';

  // 当前页面标识：home | destinations | hotels | service
  const PAGE = (document.body && document.body.getAttribute('data-page')) || 'home';

  createApp({
    /* ---------------- 数据 ---------------- */
    data() {
      return {
        page: PAGE,
        destinations: DESTINATIONS,
        hotels: HOTELS,
        faqs: typeof FAQS !== 'undefined' ? FAQS : [],
        heroImg: 'img/hero.jpg',

        // 筛选与搜索
        keyword: '',
        activeDest: 'all',
        priceRange: 'all',
        starFilter: 'all',
        sortBy: 'recommend',
        onlyFav: false,

        // 交互状态
        favorites: [],
        detail: null,
        toast: '',
        toastTimer: null,
        scrolled: false,
        menuOpen: false,
        faqOpen: 0,
        year: new Date().getFullYear()
      };
    },

    /* ---------------- 计算属性 ---------------- */
    computed: {
      filteredHotels() {
        let list = this.hotels.slice();

        if (this.onlyFav) list = list.filter(h => this.favorites.indexOf(h.id) > -1);
        if (this.activeDest !== 'all') list = list.filter(h => h.dest === this.activeDest);

        const kw = this.keyword.trim().toLowerCase();
        if (kw) {
          list = list.filter(h => {
            const hay = [h.name, this.destName(h.dest), this.regionOf(h.dest), h.tags.join(' ')]
              .join(' ').toLowerCase();
            return hay.indexOf(kw) > -1;
          });
        }

        if (this.priceRange !== 'all') {
          const p = this.priceRange.split('-');
          list = list.filter(h => h.price >= Number(p[0]) && h.price <= Number(p[1]));
        }
        if (this.starFilter !== 'all') list = list.filter(h => String(h.stars) === String(this.starFilter));

        const by = this.sortBy;
        list.sort((a, b) => {
          if (by === 'priceAsc') return a.price - b.price;
          if (by === 'priceDesc') return b.price - a.price;
          if (by === 'ratingDesc') return b.rating - a.rating || b.reviews - a.reviews;
          const fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0;
          return fb - fa || b.rating - a.rating || b.reviews - a.reviews;
        });
        return list;
      },

      // 首页「编辑精选」：优先推荐位，取前三
      featuredHotels() {
        return this.hotels
          .slice()
          .sort((a, b) => {
            const fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0;
            return fb - fa || b.rating - a.rating;
          })
          .slice(0, 3);
      },

      avgRating() {
        if (!this.hotels.length) return '0.0';
        const sum = this.hotels.reduce((s, h) => s + h.rating, 0);
        return (sum / this.hotels.length).toFixed(1);
      },

      hasFilter() {
        return this.activeDest !== 'all' || this.priceRange !== 'all' ||
          this.starFilter !== 'all' || this.sortBy !== 'recommend' ||
          this.keyword !== '' || this.onlyFav;
      }
    },

    /* ---------------- 方法 ---------------- */
    methods: {
      /* --- 查询辅助 --- */
      destName(id) { const d = this.destinations.find(x => x.id === id); return d ? d.name : ''; },
      regionOf(id) { const d = this.destinations.find(x => x.id === id); return d ? d.region : ''; },
      countByDest(id) { return this.hotels.filter(h => h.dest === id).length; },
      hotelsOfDest(id) { return this.hotels.filter(h => h.dest === id); },

      /* --- 页面切换 --- */
      // 直接跳转到目标页面
      navTo(e, url) {
        if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // 尊重新标签页打开
        if (e) e.preventDefault();
        window.location.href = url;
      },

      // 跳转到酒店页并带上筛选条件
      goHotels(e, destId) {
        this.navTo(e, destId ? 'hotels.html?dest=' + destId : 'hotels.html');
      },

      // 页内锚点滚动
      goSection(e, id) {
        if (e) e.preventDefault();
        this.menuOpen = false;
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.pageYOffset - 72;
        window.scrollTo({ top: top, behavior: 'smooth' });
      },
      toTop(e) {
        if (e) e.preventDefault();
        this.menuOpen = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },

      /* --- 搜索与筛选 --- */
      doSearch() {
        this.onlyFav = false;
        // 在非酒店页搜索时，直接带着关键词跳到酒店页
        if (this.page !== 'hotels') {
          const q = this.keyword ? '?q=' + encodeURIComponent(this.keyword) : '';
          this.navTo(null, 'hotels.html' + q);
          return;
        }
        this.goSection(null, 'hotel-list');
        if (this.keyword) this.showToast('正在为你搜索“' + this.keyword + '”');
      },
      pickDest(id) {
        this.activeDest = id;
        this.onlyFav = false;
        if (this.page !== 'hotels') { this.navTo(null, 'hotels.html?dest=' + id); return; }
        this.goSection(null, 'hotel-list');
      },
      resetFilters() {
        this.keyword = '';
        this.activeDest = 'all';
        this.priceRange = 'all';
        this.starFilter = 'all';
        this.sortBy = 'recommend';
        this.onlyFav = false;
      },
      resetAll(e) { this.resetFilters(); if (e) e.preventDefault(); },

      /* --- FAQ --- */
      toggleFaq(i) { this.faqOpen = this.faqOpen === i ? -1 : i; },

      /* --- 收藏 --- */
      isFav(id) { return this.favorites.indexOf(id) > -1; },
      toggleFav(hotel) {
        const i = this.favorites.indexOf(hotel.id);
        if (i > -1) { this.favorites.splice(i, 1); this.showToast('已取消收藏'); }
        else { this.favorites.push(hotel.id); this.showToast('已加入收藏：' + hotel.name); }
        this.persistFav();
      },
      toggleOnlyFav() {
        this.onlyFav = !this.onlyFav;
        if (this.onlyFav) {
          this.keyword = ''; this.activeDest = 'all';
          this.priceRange = 'all'; this.starFilter = 'all'; this.sortBy = 'recommend';
          this.onlyFav = true;
          if (this.page !== 'hotels') { this.navTo(null, 'hotels.html?fav=1'); return; }
          this.goSection(null, 'hotel-list');
          if (!this.favorites.length) this.showToast('你还没有收藏任何酒店');
        }
      },
      persistFav() { try { localStorage.setItem(FAV_KEY, JSON.stringify(this.favorites)); } catch (e) { } },
      loadFav() {
        try {
          const raw = localStorage.getItem(FAV_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          this.favorites = Array.isArray(arr) ? arr : [];
        } catch (e) { this.favorites = []; }
      },

      /* --- 详情与预订 --- */
      openDetail(hotel) { this.detail = hotel; document.body.classList.add('no-scroll'); },
      closeDetail() { this.detail = null; document.body.classList.remove('no-scroll'); },
      book(hotel) {
        this.showToast('已提交预订意向：' + hotel.name + '，客服将尽快与你联系');
        this.closeDetail();
      },

      /* --- 轻提示 --- */
      showToast(msg) {
        this.toast = msg;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toast = ''; }, 2200);
      },

      /* --- 从 URL 读取筛选条件（跨页传参） --- */
      initFromQuery() {
        let sp;
        try { sp = new URLSearchParams(window.location.search); } catch (e) { return; }
        const dest = sp.get('dest');
        const q = sp.get('q');
        const fav = sp.get('fav');
        if (dest && this.destinations.some(d => d.id === dest)) this.activeDest = dest;
        if (q) this.keyword = q;
        if (fav === '1') this.onlyFav = true;
      },

      /* --- 滚动显现动画 --- */
      setupReveal() {
        const els = document.querySelectorAll('.dest-card, .why-card, .svc-card, .dest-row, .flow-step, .entry-card, .section-head, .hero-stats');
        if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
        const io = new IntersectionObserver((entries) => {
          entries.forEach((en, i) => {
            if (en.isIntersecting) {
              en.target.style.transitionDelay = (Math.min(i, 6) * 60) + 'ms';
              en.target.classList.add('in');
              io.unobserve(en.target);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        els.forEach(el => io.observe(el));
      }
    },

    /* ---------------- 生命周期 ---------------- */
    mounted() {
      this.loadFav();
      this.initFromQuery();
      this.setupReveal();

      const onScroll = () => { this.scrolled = window.pageYOffset > 40; };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeDetail(); });
    }
  }).mount('#app');
})();
