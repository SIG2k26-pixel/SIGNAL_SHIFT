/* ===== Signal Shift — Main Animations & Effects ===== */
(function () {
  'use strict';

  /* ---------- LOADER ---------- */
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('loader').classList.add('hidden');
    }, 2600);
  });

  /* ---------- VANTA NET BACKGROUND ---------- */
  let vantaEffect = null;
  function initVanta() {
    if (typeof VANTA === 'undefined') return;
    try {
      vantaEffect = VANTA.NET({
        el: '#vanta-bg',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x00b4d8,
        backgroundColor: 0x0a0a0f,
        points: 11,
        maxDistance: 20,
        spacing: 19,
        showDots: true
      });
    } catch (e) { console.warn('Vanta init failed:', e); }
  }
  initVanta();

  /* ---------- FLOATING PARTICLES ---------- */
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouseX = 0, mouseY = 0;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.hue = Math.random() > 0.5 ? 190 : 280; // cyan or purple
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      // Mouse repulsion
      const dx = this.x - mouseX;
      const dy = this.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        this.x += dx * 0.01;
        this.y += dy * 0.01;
      }
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 100%, 65%, ${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  /* ---------- CURSOR LIGHT ---------- */
  const cursorLight = document.getElementById('cursor-light');
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorLight.style.left = e.clientX + 'px';
    cursorLight.style.top = e.clientY + 'px';
  });

  /* ---------- HERO PARALLAX ---------- */
  const heroContent = document.getElementById('hero-content');
  document.addEventListener('mousemove', (e) => {
    if (!heroContent) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;
    heroContent.style.transform = `translate(${dx * 10}px, ${dy * 8}px) rotateY(${dx * 2}deg) rotateX(${-dy * 2}deg)`;
  });

  /* ---------- COUNTDOWN TIMER ---------- */
  const eventDate = new Date('2026-06-18T09:00:00+05:30').getTime();
  function updateCountdown() {
    const now = Date.now();
    const diff = Math.max(0, eventDate - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
    document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
    document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ---------- GSAP SCROLL ANIMATIONS ---------- */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // About cards
    gsap.utils.toArray('.about-card').forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' },
        opacity: 0, y: 60, duration: 0.8, delay: i * 0.15, ease: 'power3.out'
      });
    });

    // Form container
    gsap.from('.form-container', {
      scrollTrigger: { trigger: '.form-container', start: 'top 80%' },
      opacity: 0, y: 80, duration: 1, ease: 'power3.out'
    });

    // Section titles
    gsap.utils.toArray('.section-title').forEach(title => {
      gsap.from(title, {
        scrollTrigger: { trigger: title, start: 'top 85%' },
        opacity: 0, y: 40, duration: 0.8, ease: 'power3.out'
      });
    });
  }

  /* ---------- MUSIC TOGGLE ---------- */
  const musicBtn = document.getElementById('music-toggle');
  const bgMusic = document.getElementById('bg-music');
  let musicPlaying = false;
  musicBtn.addEventListener('click', () => {
    if (musicPlaying) {
      bgMusic.pause();
      musicBtn.textContent = '🔇';
    } else {
      bgMusic.volume = 0.3;
      bgMusic.play().catch(() => {});
      musicBtn.textContent = '🔊';
    }
    musicPlaying = !musicPlaying;
  });

  /* ---------- SMOOTH SCROLL ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

})();
