// Transit SP - dados: SPTrans Olho Vivo (via proxy /api/olhovivo)

let map, markersLayer, paradasLayer;
let linhaSelecionada = null;   // linha escolhida na aba "Buscar Linhas"
let paradaAtual = null;        // ponto aberto no painel de previsões
let timerPrevisao = null;      // auto-atualização das previsões

document.addEventListener('DOMContentLoaded', () => {
    inicializarAbas();
    inicializarMapa();
    configurarEventos();
    restaurarFavorito();
});

// ---------- API ----------

// chama o proxy; lança erro se falhar (sem dados falsos)
async function api(path, params = {}) {
    const statusEl = document.getElementById('api-status');
    try {
        const r = await fetch(`/api/olhovivo?${new URLSearchParams({ path, ...params })}`);
        const dados = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status} - ${dados.erro || ''} ${dados.detalhe || ''}`);
        statusEl.textContent = '● API Conectada';
        statusEl.style.color = '';
        return dados;
    } catch (e) {
        statusEl.textContent = '● API Indisponível';
        statusEl.style.color = '#ffcdd2';
        throw e;
    }
}

// evita injetar HTML vindo da API
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// sl = 1: terminal principal -> secundário; sl = 2: o contrário
const sentido = l => (l.sl === 1 ? `${l.tp} ➔ ${l.ts}` : `${l.ts} ➔ ${l.tp}`);

// minutos entre a hora da consulta (hr) e a previsão (t), ambas "HH:MM"
function minutosAte(hr, t) {
    const [h1, m1] = hr.split(':').map(Number);
    const [h2, m2] = t.split(':').map(Number);
    let d = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (d < 0) d += 1440; // passou da meia-noite
    return d;
}

// ---------- Interface ----------

function abrirAba(id) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === id));
    if (id === 'tab-mapa' && map) map.invalidateSize(); // Leaflet precisa disso quando o mapa estava oculto
}

function inicializarAbas() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => abrirAba(btn.dataset.tab));
    });
}

function inicializarMapa() {
    map = L.map('map').setView([-23.5505, -46.6333], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Dados: SPTrans Olho Vivo'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map); // ônibus
    paradasLayer = L.layerGroup().addTo(map); // pontos
}

function configurarEventos() {
    const campoParada = document.getElementById('input-busca-parada');
    const campoLinha = document.getElementById('input-busca-linha');

    document.getElementById('btn-accessibility').addEventListener('click', () => {
        document.body.classList.toggle('accessible-mode');
    });

    document.getElementById('btn-buscar-parada').addEventListener('click', () => buscarParadas(campoParada.value.trim()));
    document.getElementById('btn-buscar-linha').addEventListener('click', () => buscarLinhas(campoLinha.value.trim()));

    // Enter também busca
    campoParada.addEventListener('keydown', e => { if (e.key === 'Enter') buscarParadas(campoParada.value.trim()); });
    campoLinha.addEventListener('keydown', e => { if (e.key === 'Enter') buscarLinhas(campoLinha.value.trim()); });

    document.getElementById('btn-ver-no-mapa').addEventListener('click', () => {
        if (!linhaSelecionada) return;
        abrirAba('tab-mapa');
        carregarPosicaoOnibus(linhaSelecionada.cl);
    });

    document.getElementById('btn-ver-paradas-linha').addEventListener('click', () => {
        if (linhaSelecionada) carregarParadasPorLinha(linhaSelecionada.cl);
    });
}

// ---------- Pontos de ônibus ----------

async function buscarParadas(termo) {
    if (!termo) return;
    const listaEl = document.getElementById('lista-paradas');
    listaEl.innerHTML = '<p>Buscando pontos...</p>';
    try {
        const paradas = await api('Parada/Buscar', { termosBusca: termo });
        exibirParadas(paradas, listaEl);
        plotarParadasNoMapa(paradas);
    } catch (e) {
        listaEl.innerHTML = `<p>Erro na API: ${esc(e.message)}</p>`;
    }
}

function exibirParadas(paradas, listaEl) {
    listaEl.innerHTML = '';
    if (!paradas.length) {
        listaEl.innerHTML = '<p>Nenhum ponto encontrado.</p>';
        return;
    }
    paradas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div>
                <strong>${esc(p.np)}</strong>
                <p style="font-size: 0.85rem; color: #666;">Endereço: ${esc(p.ed)}</p>
            </div>
            <button style="padding: 0.4rem 0.8rem; background: #3f51b5; color: white; border: none; border-radius: 4px; cursor: pointer;">Ver Previsões</button>`;
        item.addEventListener('click', () => abrirPonto(p.cp, p.np));
        listaEl.appendChild(item);
    });
}

// mostra os pontos encontrados no mapa
function plotarParadasNoMapa(paradas) {
    paradasLayer.clearLayers();
    paradas.forEach(p => {
        L.circleMarker([p.py, p.px], { radius: 6 })
            .bindPopup(`<b>${esc(p.np)}</b><br>${esc(p.ed)}`)
            .on('click', () => abrirPonto(p.cp, p.np))
            .addTo(paradasLayer);
    });
}

// abre o painel e atualiza as previsões a cada 30s
function abrirPonto(codigo, nome) {
    paradaAtual = { cp: codigo, np: nome };
    document.getElementById('painel-previsoes').style.display = 'block';
    document.getElementById('titulo-ponto-selecionado').textContent = `Próximos Ônibus - ${nome}`;
    atualizarBotaoFavorito();
    abrirAba('tab-paradas');
    carregarPrevisoes();
    clearInterval(timerPrevisao);
    timerPrevisao = setInterval(carregarPrevisoes, 30000);
}

async function carregarPrevisoes() {
    if (!paradaAtual) return;
    const conteudo = document.getElementById('conteudo-previsoes');
    try {
        const dados = await api('Previsao/Parada', { codigoParada: paradaAtual.cp });
        renderizarPrevisoes(dados, conteudo);
    } catch (e) {
        conteudo.innerHTML = `<p>Erro na API: ${esc(e.message)}</p>`;
    }
}

function renderizarPrevisoes(dados, conteudo) {
    conteudo.innerHTML = '';
    // a API devolve p = null quando não há previsão
    if (!dados.p || !dados.p.l || !dados.p.l.length) {
        conteudo.innerHTML = '<p>Não há previsões de chegada no momento para este ponto.</p>';
        return;
    }
    dados.p.l.forEach(linha => {
        linha.vs.forEach(v => {
            const card = document.createElement('div');
            card.className = 'prediction-card-item';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span class="bus-badge">${esc(linha.c)}</span>
                    <strong>${esc(v.t)} (${minutosAte(dados.hr, v.t)} min)</strong>
                </div>
                <p style="font-size: 0.9rem; color: #555;">Destino: ${esc(linha.lt1)}</p>
                <p style="font-size: 0.85rem; margin-top: 0.4rem;">
                    Veículo: ${esc(v.p)}
                    ${v.a ? '<span class="accessible-tag">♿ Acessível</span>' : ''}
                </p>`;
            conteudo.appendChild(card);
        });
    });
}

// ---------- Ponto favorito (localStorage) ----------

function lerFavorito() {
    try { return JSON.parse(localStorage.getItem('pontoFavorito')); } catch { return null; }
}

function atualizarBotaoFavorito() {
    const painel = document.getElementById('painel-previsoes');
    let btn = document.getElementById('btn-favorito');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-favorito';
        btn.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem 1rem; border: none; border-radius: 4px; background: #3f51b5; color: white; font-weight: 600; cursor: pointer;';
        painel.insertBefore(btn, document.getElementById('conteudo-previsoes'));
        btn.addEventListener('click', () => {
            const fav = lerFavorito();
            if (fav && fav.cp === paradaAtual.cp) localStorage.removeItem('pontoFavorito');
            else localStorage.setItem('pontoFavorito', JSON.stringify(paradaAtual));
            atualizarBotaoFavorito();
        });
    }
    const fav = lerFavorito();
    btn.textContent = fav && fav.cp === paradaAtual.cp ? '★ Remover dos favoritos' : '☆ Favoritar este ponto';
}

// ao abrir o app, já mostra o "Meu ponto"
function restaurarFavorito() {
    const fav = lerFavorito();
    if (fav) abrirPonto(fav.cp, fav.np);
}

// ---------- Linhas ----------

async function buscarLinhas(termo) {
    if (!termo) return;
    const listaEl = document.getElementById('lista-linhas');
    listaEl.innerHTML = '<p>Buscando linhas...</p>';
    try {
        const linhas = await api('Linha/Buscar', { termosBusca: termo });
        exibirLinhas(linhas, listaEl);
    } catch (e) {
        listaEl.innerHTML = `<p>Erro na API: ${esc(e.message)}</p>`;
    }
}

function exibirLinhas(linhas, listaEl) {
    listaEl.innerHTML = '';
    if (!linhas.length) {
        listaEl.innerHTML = '<p>Nenhuma linha encontrada.</p>';
        return;
    }
    linhas.forEach(linha => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div>
                <span class="bus-badge">${esc(linha.lt)}-${esc(linha.tl)}</span>
                <strong style="margin-left: 0.5rem;">${esc(sentido(linha))}</strong>
            </div>`;
        item.addEventListener('click', () => {
            linhaSelecionada = linha;
            document.getElementById('detalhes-linha').style.display = 'block';
            document.getElementById('titulo-linha-detalhe').textContent = `Linha selecionada: ${linha.lt}-${linha.tl} (${sentido(linha)})`;
            document.getElementById('conteudo-paradas-linha').innerHTML = '';
            // destaca o item escolhido (no lugar do alert)
            listaEl.querySelectorAll('.result-item').forEach(i => i.style.outline = '');
            item.style.outline = '2px solid #0288d1';
        });
        listaEl.appendChild(item);
    });
}

async function carregarParadasPorLinha(codigoLinha) {
    const conteudo = document.getElementById('conteudo-paradas-linha');
    conteudo.innerHTML = '<p>Carregando paradas da linha...</p>';
    try {
        const paradas = await api('Parada/BuscarParadasPorLinha', { codigoLinha });
        exibirParadasLinha(paradas, conteudo);
        plotarParadasNoMapa(paradas);
    } catch (e) {
        conteudo.innerHTML = `<p>Erro na API: ${esc(e.message)}</p>`;
    }
}

function exibirParadasLinha(paradas, conteudo) {
    conteudo.innerHTML = '';
    if (!paradas.length) {
        conteudo.innerHTML = '<p>Nenhuma parada encontrada para esta linha.</p>';
        return;
    }
    paradas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div>
                <strong>${esc(p.np)}</strong>
                <p style="font-size: 0.85rem; color: #666;">${esc(p.ed)}</p>
            </div>`;
        item.addEventListener('click', () => abrirPonto(p.cp, p.np));
        conteudo.appendChild(item);
    });
}

// ---------- Mapa em tempo real ----------

async function carregarPosicaoOnibus(codigoLinha) {
    markersLayer.clearLayers();
    try {
        const dados = await api('Posicao/Linha', { codigoLinha });
        if (!dados.vs || !dados.vs.length) {
            alert('Nenhum veículo desta linha operando no momento.');
            return;
        }
        const bounds = [];
        dados.vs.forEach(v => {
            bounds.push([v.py, v.px]);
            L.marker([v.py, v.px]).bindPopup(`
                <b>Linha: ${esc(linhaSelecionada.lt)}-${esc(linhaSelecionada.tl)}</b><br>
                Veículo: ${esc(v.p)}<br>
                Acessível: ${v.a ? 'Sim ♿' : 'Não'}<br>
                Atualização: ${esc(v.ta)}`).addTo(markersLayer);
        });
        map.fitBounds(bounds);
    } catch (e) {
        alert('Erro na API: ' + e.message);
    }
}
