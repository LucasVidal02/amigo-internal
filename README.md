# Amigo One — Portal Interno

Site interno do produto Amigo One, hospedado no GitHub Pages.

## Estrutura de arquivos

```
amigo-one-site/
├── index.html          ← Página principal (todos os módulos)
├── style.css           ← Estilos
├── app.js              ← Lógica: navegação, chat IA, Jira
├── releases/           ← Release notes em JSON (geradas pelo agente)
├── docs/               ← Documentação em Markdown (gerada pelo agente)
├── scripts/
│   └── update-docs-agent.js  ← Agente de atualização automática
└── .github/
    └── workflows/
        └── update-docs.yml   ← GitHub Action do agente
```

---

## 1. Publicar no GitHub Pages (sem instalar nada)

1. Acesse [github.com](https://github.com) e faça login
2. Clique em **"New repository"**
3. Dê o nome `amigo-one-internal` e deixe **público**
4. Clique em **"Create repository"**
5. Na tela seguinte, clique em **"uploading an existing file"**
6. Arraste **todos os arquivos** desta pasta (index.html, style.css, app.js)
7. Clique em **"Commit changes"**
8. Vá em **Settings → Pages → Source: Deploy from branch → main / (root)**
9. Salve. Em ~1 minuto o site estará em: `https://seu-usuario.github.io/amigo-one-internal`

> ⚠️ **Atenção com a pasta `.github`:** O GitHub não permite fazer upload de pastas ocultas pela interface web. Para incluir o workflow do agente, você precisará fazer isso depois pelo terminal ou editar direto no GitHub (botão "Add file → Create new file" e digitar o caminho: `.github/workflows/update-docs.yml`).

---

## 2. Ativar o Chat com IA (opcional)

O chat funciona em modo demonstração por padrão. Para ativar a IA real:

### Opção A — Cloudflare Worker (gratuito, recomendado)

1. Crie uma conta em [cloudflare.com](https://cloudflare.com)
2. Vá em **Workers & Pages → Create Worker**
3. Cole o código abaixo:

```javascript
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const { message, context } = await request.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: context,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? 'Erro na resposta.';

    return new Response(JSON.stringify({ reply }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

4. Adicione a variável de ambiente `CLAUDE_API_KEY` com sua chave da Anthropic (em [console.anthropic.com](https://console.anthropic.com))
5. Copie a URL do Worker (ex: `https://meu-chat.meu-usuario.workers.dev`)
6. No arquivo `app.js`, atualize a linha:
   ```js
   const CHAT_ENDPOINT = 'https://meu-chat.meu-usuario.workers.dev';
   ```

---

## 3. Integrar com o Jira

### Passo 1 — Criar token de API do Jira
1. Acesse [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Clique em **"Create API token"**, dê um nome e copie o token

### Passo 2 — Adicionar Secrets no GitHub
No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e adicione:

| Secret              | Valor                                      |
|---------------------|--------------------------------------------|
| `JIRA_BASE_URL`     | `https://suaempresa.atlassian.net`         |
| `JIRA_EMAIL`        | Seu e-mail do Jira                         |
| `JIRA_API_TOKEN`    | Token gerado no passo anterior             |
| `JIRA_PROJECT_KEY`  | Ex: `AO`                                   |
| `CLAUDE_API_KEY`    | Sua chave da API do Claude                 |

### Passo 3 — Testar o agente
Vá em **Actions → Atualizar Docs e Release Notes → Run workflow** e informe a versão (ex: `v2.5.0`).

### Passo 4 — Configurar webhook automático no Jira (opcional)
Para que o agente rode automaticamente quando uma release for finalizada:
1. No Jira, vá em **Settings → System → Webhooks → Create webhook**
2. URL: `https://api.github.com/repos/SEU-USUARIO/amigo-one-internal/dispatches`
3. Header: `Authorization: token SEU_GITHUB_TOKEN`
4. Body: `{"event_type":"jira-release-finalized","client_payload":{"version":"{{version.name}}"}}`
5. Trigger: **Version released**

---

## Módulos do site

| Módulo         | O que faz                                                    |
|----------------|--------------------------------------------------------------|
| 🏠 Início      | Visão geral com acesso rápido aos módulos                    |
| 📄 Documentação| Docs do produto + chat com IA para tirar dúvidas             |
| 📅 Roadmap     | Versões planejadas e em andamento com % de conclusão         |
| ⚡ Releases     | Changelogs gerados automaticamente pelo agente               |
| 📊 Dashboard   | KPIs: velocidade, bugs, entregas e saúde do produto          |
