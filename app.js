/* ═══════════════════════════════════════════════════════════════
   AMIGO ONE — app.js
   Navegação, Chat IA (Claude), integração Jira
═══════════════════════════════════════════════════════════════ */

/* ── NAVEGAÇÃO ─────────────────────────────────────────────── */
function goTo(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  const navItem = document.querySelector(`[data-section="${sectionId}"]`);
  if (navItem) navItem.classList.add('active');
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const section = item.getAttribute('data-section');
    if (section) goTo(section);
  });
});

/* ── CHAT IA ───────────────────────────────────────────────── */

/* 
  CONFIGURAÇÃO DO CHAT
  ─────────────────────
  Para ativar o chat com IA real, você precisará de um backend
  simples (ex: Cloudflare Worker ou Vercel Function) que faça
  a chamada à API do Claude com sua chave de API.

  Por segurança, NUNCA coloque sua API key diretamente neste
  arquivo JS — ela ficaria pública no GitHub.

  Enquanto isso, o chat funciona em modo de demonstração.
*/

const CHAT_ENDPOINT = ''; // ex: 'https://meu-worker.meu-usuario.workers.dev/chat'

const DOC_CONTEXT = `
Você é o assistente interno do produto Amigo One.
O Amigo One é uma plataforma de gestão financeira e relacionamento com clientes.
Principais módulos: Pagamentos, Gestão de Usuários, Relatórios, Integrações via API REST.
Arquitetura: microsserviços, frontend React, backend Node.js, banco PostgreSQL.
Responda de forma objetiva e útil. Se não souber algo específico, diga que não tem essa informação na documentação atual.
Sempre responda em português brasileiro.
`;

const DEMO_RESPONSES = [
  "O módulo de pagamentos do Amigo One processa transações em tempo real com suporte a cartão de crédito, débito e PIX. Posso detalhar algum aspecto específico?",
  "A autenticação utiliza JWT com refresh tokens. O fluxo é: login → token de acesso (15min) → refresh token (7 dias). Precisa de mais detalhes sobre a implementação?",
  "Os relatórios podem ser exportados em CSV e, a partir da v2.5.0, também em PDF. A geração é assíncrona para relatórios acima de 1.000 linhas.",
  "A API REST do Amigo One segue o padrão RESTful com versionamento na URL (/api/v1/...). A documentação completa da API está disponível no módulo técnico.",
  "O controle de permissões usa RBAC (Role-Based Access Control) com os papéis: Admin, Gerente, Operador e Visualizador. Cada papel tem um conjunto de permissões configurável.",
];
let demoIndex = 0;

function toggleChat() {
  const box = document.getElementById('chatBox');
  const btn = document.getElementById('chatToggle');
  const isOpen = box.classList.toggle('open');
  btn.textContent = isOpen ? 'Fechar chat ✕' : 'Abrir chat ↗';
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendMsg(text, 'user');
  const loading = appendMsg('...', 'bot', true);

  try {
    let reply;

    if (CHAT_ENDPOINT) {
      // Chamada ao backend real
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: DOC_CONTEXT }),
      });
      const data = await res.json();
      reply = data.reply || data.content || 'Não consegui processar a resposta.';
    } else {
      // Modo demonstração
      await new Promise(r => setTimeout(r, 900));
      reply = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length];
      demoIndex++;
      if (!CHAT_ENDPOINT) {
        reply += '\n\n_[Modo demo — configure CHAT_ENDPOINT em app.js para ativar a IA real]_';
      }
    }

    loading.remove();
    appendMsg(reply, 'bot');
  } catch (err) {
    loading.remove();
    appendMsg('Erro ao conectar ao assistente. Tente novamente.', 'bot');
    console.error(err);
  }
}

function appendMsg(text, who, isLoading = false) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `msg ${who}${isLoading ? ' msg-loading' : ''}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  // Suporte simples a markdown-lite
  bubble.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

/* ── INTEGRAÇÃO JIRA ───────────────────────────────────────── */

/*
  COMO INTEGRAR COM O JIRA REAL
  ──────────────────────────────
  O Jira não permite chamadas diretas do frontend por questões
  de CORS e segurança de credenciais. O fluxo recomendado é:

  1. Criar um Cloudflare Worker ou Vercel Function
  2. Esse backend faz a chamada à API REST do Jira
  3. O site busca os dados desse endpoint intermediário

  Configuração necessária:
    - JIRA_BASE_URL: URL do seu Jira (ex: https://suaempresa.atlassian.net)
    - JIRA_PROJECT_KEY: Chave do projeto (ex: AO)
    - JIRA_API_TOKEN: Token gerado em id.atlassian.com
    - JIRA_EMAIL: Email da conta Atlassian

  Exemplo de chamada à API do Jira (no seu Worker/Function):
    GET {JIRA_BASE_URL}/rest/api/3/project/{PROJECT_KEY}/versions
    Authorization: Basic base64(email:token)

  Endpoint de versions retorna: name, releaseDate, released, description
  Endpoint de issues por version: /rest/api/3/search?jql=fixVersion="{VERSION}"
*/

const JIRA_ENDPOINT = ''; // ex: 'https://meu-worker.workers.dev/jira'

async function syncJira() {
  if (!JIRA_ENDPOINT) {
    console.info('Amigo One: JIRA_ENDPOINT não configurado. Usando dados de demonstração.');
    return;
  }

  try {
    const res = await fetch(`${JIRA_ENDPOINT}/versions`);
    const versions = await res.json();
    renderRoadmapFromJira(versions);
  } catch (err) {
    console.warn('Falha ao sincronizar com Jira:', err);
  }
}

function renderRoadmapFromJira(versions) {
  /* Quando o Jira estiver configurado, esta função substituirá
     os cards estáticos do roadmap pelos dados reais.
     Estrutura esperada de `versions`:
     [{ name, releaseDate, released, description, issueCount }]
  */
  console.log('Versões do Jira recebidas:', versions);
  // TODO: atualizar o DOM do roadmap com os dados reais
}

/* ── AGENTE DE ATUALIZAÇÃO DE DOCS ─────────────────────────── */

/*
  COMO FUNCIONA O AGENTE AUTOMÁTICO
  ───────────────────────────────────
  O agente roda via GitHub Actions e é ativado quando uma
  release é marcada como "Released" no Jira.

  Fluxo completo:
  1. Webhook do Jira → GitHub Actions (ou endpoint no seu Worker)
  2. O agente busca todas as issues da versão finalizada
  3. Chama a API do Claude para sumarizar e estruturar o conteúdo
  4. Cria um commit no repositório atualizando:
     - docs/[versao].md (nova documentação)
     - releases/[versao].json (release notes)
  5. O GitHub Pages publica automaticamente

  O arquivo .github/workflows/update-docs.yml (incluído)
  contém a configuração completa desse agente.
*/

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  syncJira();

  // Ativa seção via hash da URL
  const hash = window.location.hash.replace('#', '');
  if (hash) goTo(hash);

  // Atualiza hash ao navegar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.getAttribute('data-section');
      if (section) window.location.hash = section;
    });
  });
});
