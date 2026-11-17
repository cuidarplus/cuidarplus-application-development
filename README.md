# Transit SP

Aplicação web para consultar informações do transporte público por ônibus na cidade de São Paulo usando a API Olho Vivo da SPTrans. O usuário pode localizar pontos, consultar previsões de chegada, pesquisar linhas e visualizar veículos e paradas em um mapa.

O projeto foi desenvolvido para a Global Solution 2026.2 do curso de Ciência da Computação da FIAP.

## Funcionalidades

- **Pontos e previsões:** busca pontos por nome ou endereço; ao selecionar um ponto, exibe as previsões de chegada e atualiza os dados a cada 30 segundos.
- **Ponto favorito:** permite salvar um ponto no `localStorage` do navegador. Ao reabrir a aplicação no mesmo navegador, o ponto salvo é carregado automaticamente.
- **Busca de linhas:** pesquisa linhas por código ou termo, permite selecionar uma linha, consultar suas paradas e abrir a posição de seus veículos.
- **Mapa:** usa Leaflet e OpenStreetMap para mostrar pontos encontrados e veículos localizados pela API.
- **Acessibilidade:** oferece um modo de alto contraste, ativado pelo botão no cabeçalho.
- **Estado da API:** indica se a última comunicação com o proxy foi bem-sucedida.

## Tecnologias e arquitetura

A aplicação é composta por uma interface sem framework, um proxy HTTP para a API da SPTrans e um servidor local para desenvolvimento:

```text
Navegador
  ├── index.html, style.css e script.js
  ├── Leaflet (biblioteca de mapas via CDN)
  └── /api/olhovivo
        └── api/olhovivo.js
              └── API Olho Vivo SPTrans
```

- **Frontend:** HTML, CSS e JavaScript nativo. `script.js` controla as abas, as buscas, o mapa, a renderização dos resultados e o favorito.
- **Mapas:** Leaflet 1.9.4 e tiles do OpenStreetMap, carregados externamente pelo navegador.
- **Proxy da API:** `api/olhovivo.js` autentica com a SPTrans e encaminha somente os endpoints permitidos. Isso evita que o navegador acesse diretamente a API.
- **Servidor local:** `dev-server.js` serve os arquivos estáticos e adapta a rota `/api/olhovivo` ao formato de requisição/resposta usado pelo handler da API.
- **Implantação:** a estrutura da pasta `api/` é compatível com funções serverless da Vercel. `.vercelignore` exclui `dev-server.js` da implantação.

Não há banco de dados: o estado persistente da aplicação limita-se ao ponto favorito no armazenamento local do navegador.

## Estrutura do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da página, abas, campos de busca e áreas de resultado. |
| `style.css` | Estilos, layout responsivo básico, cores e modo de alto contraste. |
| `script.js` | Lógica da interface, chamadas ao proxy, resultados, previsões, favorito e mapa. |
| `api/olhovivo.js` | Proxy e autenticação para a API Olho Vivo da SPTrans. |
| `dev-server.js` | Servidor HTTP local para servir a aplicação e encaminhar chamadas ao proxy. |
| `package.json` | Metadados do projeto e comando de desenvolvimento. |
| `PARTICIPANTES.txt` | Participantes do projeto. |
| `.vercelignore` | Arquivos excluídos da implantação na Vercel. |

## Requisitos

- Node.js 18 ou superior (o servidor local usa `fetch` nativo).
- Acesso à internet para consultar a SPTrans e carregar a biblioteca e os mapas externos.
- Token válido da API Olho Vivo da SPTrans.

## Executar localmente

Na raiz do repositório:

```bash
npm run dev
```

O servidor inicia em `http://localhost:3000`. Para usar outra porta, defina a variável de ambiente `PORT` antes de iniciar. Por exemplo, no PowerShell:

```powershell
$env:PORT = "3001"
npm run dev
```

O projeto não declara dependências npm: o frontend usa JavaScript nativo e o Leaflet é carregado por CDN.

## Configuração da API

O proxy lê o token da variável de ambiente `OLHOVIVO_TOKEN`. Configure-a no ambiente local ou nas variáveis do projeto na plataforma de implantação. O arquivo `api/olhovivo.js` também contém atualmente um valor alternativo definido no próprio código; para uso público, substitua essa configuração por um segredo fornecido exclusivamente pelo ambiente e não publique tokens no repositório.

O proxy permite as seguintes operações da API:

| Endpoint encaminhado | Uso na aplicação |
| --- | --- |
| `Linha/Buscar` | Pesquisa de linhas. |
| `Parada/Buscar` | Pesquisa de pontos por termo. |
| `Parada/BuscarParadasPorLinha` | Lista de paradas associadas à linha selecionada. |
| `Posicao/Linha` | Posição dos veículos de uma linha. |
| `Previsao/Parada` | Previsões de chegada para o ponto selecionado. |
| `Previsao` | Endpoint adicional permitido pelo proxy. |

As chamadas do frontend passam pela rota `/api/olhovivo`, que recebe o endpoint em `path` e os respectivos parâmetros de consulta. O proxy tenta autenticar usando HTTPS e, em seguida, HTTP como alternativa. Falhas de autenticação ou comunicação são retornadas como erros HTTP e apresentadas na interface.

## Fluxos principais

### Consultar um ponto

1. Pesquise um nome ou endereço na aba **Próximos Pontos**.
2. Selecione um resultado na lista ou no mapa.
3. A aplicação consulta `Previsao/Parada`, exibe as chegadas e inicia a atualização periódica.
4. Opcionalmente, favorite o ponto para restaurá-lo na próxima visita.

### Acompanhar uma linha

1. Pesquise uma linha na aba **Buscar Linhas** e selecione o resultado.
2. Escolha **Ver Ônibus no Mapa** para consultar as posições e ajustar o mapa aos veículos encontrados.
3. Escolha **Ver Paradas do Trajeto** para listar os pontos associados à linha; selecionar um ponto abre suas previsões.

## Participantes

Consulte [`PARTICIPANTES.txt`](PARTICIPANTES.txt) para a relação de participantes e RMs.

## Link Vercel

https://cuidarplus-application-development-ten.vercel.app/
