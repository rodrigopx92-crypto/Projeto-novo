/* Efeitos visuais da Clínica Bem-Estar.
   Não substitui nem altera o script principal do sistema. */
(function () {
    'use strict';

    function ripple(x, y) {
        const el = document.createElement('span');
        el.className = 'clinic-ripple';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    document.addEventListener('click', function (event) {
        const alvo = event.target.closest('button, .sidebar nav a, .card-stat, .feature-card');
        if (!alvo) return;
        ripple(event.clientX, event.clientY);
    });

    function destacarTela() {
        const ativa = document.querySelector('.tela.ativa');
        if (!ativa) return;
        ativa.classList.remove('clinic-focus');
        void ativa.offsetWidth;
        ativa.classList.add('clinic-focus');
    }

    document.addEventListener('click', function (event) {
        const link = event.target.closest('#menu a[data-tela]');
        if (!link) return;
        setTimeout(destacarTela, 40);
    });

    // Entrada elegante dos cards do dashboard.
    function animarCards() {
        document.querySelectorAll('.tela.ativa .card-stat, .tela.ativa .card').forEach((card, i) => {
            card.style.setProperty('--clinic-delay', (i * 45) + 'ms');
            card.classList.add('clinic-card-in');
        });
    }

    const style = document.createElement('style');
    style.textContent = `
        .clinic-card-in { animation: clinicCardIn .42s cubic-bezier(.2,.75,.25,1) both; animation-delay: var(--clinic-delay); }
        @keyframes clinicCardIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    window.addEventListener('load', animarCards);
    document.addEventListener('click', function (event) {
        if (event.target.closest('#menu a[data-tela]')) setTimeout(animarCards, 80);
    });
})();
