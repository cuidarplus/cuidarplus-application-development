const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';
let tokenSalvo = '';
let map = null;
let markersLayer = null;
let linhaSelecionadaGlobal = null;

document.addEventListener('DOMContentLoaded', () => {
    inicializarAbas();
    inicializarMapa();
    configurarEventos();
});

function inicializarAbas() {
    const botoes = document.querySelectorAll('.tab-btn');
    botoes.forEach(btn => {
        btn.addEventListener('click', () => {
            botoes.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');

            if (target === 'tab-mapa' && map) {
                map.invalidateSize();
            }
        });
    });
}

function inicializarMapa() {
    map = L.map('map').setView([-23.5505, -46.6333], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
}

function configurarEventos() {
    document.getElementById('btn-accessibility').addEventListener('click', () => {
        document.body.classList.toggle('accessible-mode');
    });

    document.getElementById('btn-autenticar').addEventListener('click', async () => {
        const tokenInput = document.getElementById('api-token').value.trim();
        if (!tokenInput) {
            alert('Por favor, insira o token da API Olho Vivo.');
            return;
        }
        tokenSalvo = tokenInput;
        await autenticarAPI(tokenSalvo);
    });

    document.getElementById('btn-buscar-parada').addEventListener('click', async () => {
        const termo = document.getElementById('input-busca-parada').value.trim();
        if (!termo) return;
        await buscarParadas(termo);
    });

    document.getElementById('btn-buscar-linha').addEventListener('click', async () => {
        const termo = document.getElementById('input-busca-linha').value.trim();
        if (!termo) return;
        await buscarLinhas(termo);
    });

    document.getElementById('btn-ver-no-mapa').addEventListener('click', () => {
        if (!linhaSelecionadaGlobal) return;
        carregarPosicaoOnibus(linhaSelecionadaGlobal.cl);
        document.querySelector('[data-tab="tab-mapa"]').click();
    });

    document.getElementById('btn-ver-paradas-linha').addEventListener('click', () => {
        if (!linhaSelecionadaGlobal) return;
        carregarParadasPorLinha(linhaSelecionadaGlobal.cl);
    });
}

async function autenticarAPI(token) {
    const statusEl = document.getElementById('auth-status');
    try {
        const response = await fetch(`${BASE_URL}/Login/Autenticar?token=${token}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            statusEl.textContent = 'Conectado com Sucesso!';
            statusEl.className = 'status-connected';
            alert('Autenticado com sucesso na API Olho Vivo da SPTrans!');
        } else {
            throw new Error('Falha na autenticação.');
        }
    } catch (error) {
        console.error('Erro de autenticação:', error);
        statusEl.textContent = 'Modo Simulado / Conectado';
        statusEl.className = 'status-connected';
    }
}

async function buscarParadas(termo) {
    const listaEl = document.getElementById('lista-paradas');
    listaEl.innerHTML = '<p>Buscando pontos...</p>';
    try {
        const response = await fetch(`${BASE_URL}/Parada/Buscar?termosBusca=${encodeURIComponent(termo)}`);
        const paradas = await response.json();
        
        listaEl.innerHTML = '';
        if (!paradas || paradas.length === 0) {
            listaEl.innerHTML = '<p>Nenhum ponto encontrado.</p>';
            return;
        }

        paradas.forEach(parada => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div>
                    <strong>${parada.np}</strong>
                    <p style="font-size: 0.85rem; color: #666;">Endereço: ${parada.ed}</p>
                </div>
                <button style="padding: 0.4rem 0.8rem; background: #3f51b5; color: white; border: none; border-radius: 4px; cursor: pointer;">Ver Previsões</button>
            `;
            item.addEventListener('click', () => carregarPrevisoesParada(parada.cp, parada.np));
            listaEl.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        listaEl.innerHTML = '<p style="color: red;">Erro ao buscar paradas.</p>';
    }
}

async function carregarPrevisoesParada(codigoParada, nomeParada) {
    const painel = document.getElementById('painel-previsoes');
    const titulo = document.getElementById('titulo-ponto-selecionado');
    const conteudo = document.getElementById('conteudo-previsoes');
    
    painel.style.display = 'block';
    titulo.textContent = `Próximos Ônibus - ${nomeParada}`;
    conteudo.innerHTML = '<p>Carregando previsões...</p>';

    try {
        const response = await fetch(`${BASE_URL}/Previsao/Parada?codigoParada=${codigoParada}`);
        const dados = await response.json();
        
        conteudo.innerHTML = '';
        if (!dados || !dados.p || !dados.p.l || dados.p.l.length === 0) {
            conteudo.innerHTML = '<p>Não há previsões de chegada no momento para este ponto.</p>';
            return;
        }

        dados.p.l.forEach(linha => {
            linha.vs.forEach(veiculo => {
                const cardItem = document.createElement('div');
                cardItem.className = 'prediction-card-item';
                cardItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span class="bus-badge">${linha.c}</span>
                        <strong>Chegada: ${veiculo.t}</strong>
                    </div>
                    <p style="font-size: 0.9rem; color: #555;">Destino: ${linha.lt0} - ${linha.lt1}</p>
                    <p style="font-size: 0.85rem; margin-top: 0.4rem;">
                        Veículo: ${veiculo.p} 
                        ${veiculo.a ? '<span class="accessible-tag">♿ Acessível</span>' : ''}
                    </p>
                `;
                conteudo.appendChild(cardItem);
            });
        });
    } catch (error) {
        console.error(error);
        conteudo.innerHTML = '<p style="color: red;">Erro ao carregar previsões.</p>';
    }
}

async function buscarLinhas(termo) {
    const listaEl = document.getElementById('lista-linhas');
    listaEl.innerHTML = '<p>Buscando linhas...</p>';
    try {
        const response = await fetch(`${BASE_URL}/Linha/Buscar?termosBusca=${encodeURIComponent(termo)}`);
        const linhas = await response.json();
        
        listaEl.innerHTML = '';
        if (!linhas || linhas.length === 0) {
            listaEl.innerHTML = '<p>Nenhuma linha encontrada.</p>';
            return;
        }

        linhas.forEach(linha => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div>
                    <span class="bus-badge">${linha.lc}</span>
                    <strong style="margin-left: 0.5rem;">${linha.lt0} ➔ ${linha.lt1}</strong>
                </div>
            `;
            item.addEventListener('click', () => {
                linhaSelecionadaGlobal = linha;
                document.getElementById('detalhes-linha').style.display = 'block';
                document.getElementById('titulo-linha-detalhe').textContent = `Linha Selecionada: ${linha.lc} (${linha.lt0} ➔ ${linha.lt1})`;
                alert(`Linha ${linha.lc} selecionada com sucesso! Escolha uma ação abaixo.`);
            });
            listaEl.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        listaEl.innerHTML = '<p style="color: red;">Erro ao buscar linhas.</p>';
    }
}

async function carregarPosicaoOnibus(codigoLinha) {
    markersLayer.clearLayers();
    try {
        const response = await fetch(`${BASE_URL}/Posicao/Linha?codigoLinha=${codigoLinha}`);
        const dados = await response.json();

        if (!dados || !dados.vs || dados.vs.length === 0) {
            alert('Nenhum veículo desta linha operando no momento.');
            return;
        }

        const bounds = [];
        dados.vs.forEach(veiculo => {
            const lat = veiculo.py;
            const lng = veiculo.px;
            bounds.push([lat, lng]);

            const marker = L.marker([lat, lng]).bindPopup(`
                <b>Ônibus: ${veiculo.p}</b><br>
                Acessível: ${veiculo.a ? 'Sim' : 'Não'}<br>
                Última atualização: ${veiculo.ta}
            `);
            markersLayer.addLayer(marker);
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds);
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao buscar posições dos ônibus.');
    }
}

async function carregarParadasPorLinha(codigoLinha) {
    const conteudoParadas = document.getElementById('conteudo-paradas-linha');
    conteudoParadas.innerHTML = '<p>Carregando paradas da linha...</p>';
    try {
        const response = await fetch(`${BASE_URL}/Parada/BuscarParadasPorLinha?codigoLinha=${codigoLinha}`);
        const paradas = await response.json();

        conteudoParadas.innerHTML = '';
        if (!paradas || paradas.length === 0) {
            conteudoParadas.innerHTML = '<p>Nenhuma parada encontrada para esta linha.</p>';
            return;
        }

        paradas.forEach(parada => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div>
                    <strong>${parada.np}</strong>
                    <p style="font-size: 0.85rem; color: #666;">${parada.ed}</p>
                </div>
            `;
            conteudoParadas.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        conteudoParadas.innerHTML = '<p style="color: red;">Erro ao carregar paradas da linha.</p>';
    }
}