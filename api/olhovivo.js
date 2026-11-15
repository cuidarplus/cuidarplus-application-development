// api/olhovivo.js - proxy da Olho Vivo (roda no Vercel e no server.js local)
const BASES = ['https://api.olhovivo.sptrans.com.br/v2.1', 'http://api.olhovivo.sptrans.com.br/v2.1'];
const TOKEN = process.env.OLHOVIVO_TOKEN || '98a51abe3570278087cfd5c4a7fc0da17a5a838fb64bde2cebf706617db6fc38';

// só deixa passar os endpoints que o app usa
const PERMITIDOS = [
  'Linha/Buscar',
  'Parada/Buscar',
  'Parada/BuscarParadasPorLinha',
  'Posicao/Linha',
  'Previsao/Parada',
  'Previsao',
];

// tenta autenticar em cada base (https, depois http); devolve a base e o cookie que funcionou
async function autenticar() {
  for (const base of BASES) {
    try {
      const login = await fetch(`${base}/Login/Autenticar?token=${TOKEN}`, { method: 'POST' });
      const texto = (await login.text()).trim();
      console.log('login Olho Vivo:', base.split(':')[0], login.status, texto.slice(0, 60));
      if (texto === 'true') return { base, cookie: (login.headers.get('set-cookie') || '').split(';')[0] };
    } catch (e) {
      console.log('login falhou em', base.split(':')[0], String(e.cause || e));
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  const { path, ...params } = req.query;
  if (!PERMITIDOS.includes(path)) return res.status(400).json({ erro: 'endpoint não permitido' });

  try {
    const sessao = await autenticar();
    if (!sessao) return res.status(401).json({ erro: 'token recusado pela SPTrans' });

    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${sessao.base}/${path}?${qs}`, { headers: { Cookie: sessao.cookie } });
    res.status(r.status).json(await r.json());
  } catch (e) {
    console.log('erro:', e, e.cause);
    res.status(502).json({ erro: 'falha ao acessar a Olho Vivo', detalhe: String(e.cause || e) });
  }
};