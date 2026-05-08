/**
 * AGENTE DE ATUALIZAÇÃO DE DOCS — Amigo One
 * ──────────────────────────────────────────
 * Roda via GitHub Actions quando uma release é finalizada no Jira.
 * Busca as issues da versão, usa Claude para sumarizar e grava
 * os arquivos de documentação e release notes.
 */

const fs = require('fs');
const path = require('path');

const {
  JIRA_BASE_URL,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_PROJECT_KEY,
  CLAUDE_API_KEY,
  VERSION,
} = process.env;

if (!VERSION) {
  console.error('❌ Variável VERSION não definida.');
  process.exit(1);
}

/* ── HELPERS ─────────────────────────────────────────────── */

function jiraHeaders() {
  const token = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return {
    'Authorization': `Basic ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

async function jiraFetch(path) {
  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3${path}`, {
    headers: jiraHeaders(),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function claudeAsk(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

/* ── MAIN ──────────────────────────────────────────────────── */

async function run() {
  console.log(`\n🤖 Agente iniciado para a versão: ${VERSION}\n`);

  // 1. Buscar issues da versão no Jira
  console.log('📋 Buscando issues no Jira...');
  const jql = encodeURIComponent(`project = "${JIRA_PROJECT_KEY}" AND fixVersion = "${VERSION}" ORDER BY issuetype ASC`);
  const searchResult = await jiraFetch(`/search?jql=${jql}&fields=summary,issuetype,status,description&maxResults=100`);
  const issues = searchResult.issues || [];
  console.log(`   Encontradas ${issues.length} issues.`);

  if (issues.length === 0) {
    console.warn('⚠️ Nenhuma issue encontrada para essa versão. Abortando.');
    process.exit(0);
  }

  // 2. Classificar issues por tipo
  const byType = {};
  for (const issue of issues) {
    const type = issue.fields.issuetype.name;
    if (!byType[type]) byType[type] = [];
    byType[type].push({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
    });
  }

  // 3. Pedir ao Claude para gerar o changelog
  console.log('\n✨ Gerando release notes com Claude...');
  const issuesList = Object.entries(byType)
    .map(([type, items]) => `**${type}:**\n${items.map(i => `- [${i.key}] ${i.summary}`).join('\n')}`)
    .join('\n\n');

  const releaseNotesPrompt = `
Você é um assistente técnico do produto "Amigo One".
Com base nas issues do Jira abaixo, escreva unas release notes claras e profissionais em português brasileiro para a versão ${VERSION}.

Issues:
${issuesList}

Gere um JSON com a seguinte estrutura:
{
  "version": "${VERSION}",
  "date": "${new Date().toLocaleDateString('pt-BR')}",
  "summary": "resumo geral em 1 frase",
  "sections": {
    "Novidades": ["item 1", "item 2"],
    "Correções": ["item 1"],
    "Melhorias": ["item 1"]
  }
}

Responda APENAS com o JSON, sem texto adicional.
`;

  const releaseNotesRaw = await claudeAsk(releaseNotesPrompt);
  let releaseNotes;
  try {
    releaseNotes = JSON.parse(releaseNotesRaw.replace(/```json|```/g, '').trim());
  } catch {
    console.error('❌ Erro ao parsear JSON do Claude:', releaseNotesRaw);
    process.exit(1);
  }

  // 4. Pedir ao Claude para gerar documentação atualizada
  console.log('📝 Gerando documentação com Claude...');
  const docsPrompt = `
Você é um assistente técnico do produto "Amigo One".
Com base nas issues abaixo da versão ${VERSION}, escreva em português brasileiro uma seção de documentação
descrevendo o que foi adicionado/alterado nessa versão. Use headers markdown (##, ###).

Issues:
${issuesList}

Foque nas funcionalidades do ponto de vista do usuário, sem detalhes de implementação.
Seja conciso (máximo 400 palavras).
`;

  const docsContent = await claudeAsk(docsPrompt);

  // 5. Gravar os arquivos
  console.log('\n💾 Gravando arquivos...');

  // releases/[versao].json
  const releasesDir = path.join(process.cwd(), 'releases');
  if (!fs.existsSync(releasesDir)) fs.mkdirSync(releasesDir, { recursive: true });
  const releaseFile = path.join(releasesDir, `${VERSION}.json`);
  fs.writeFileSync(releaseFile, JSON.stringify(releaseNotes, null, 2), 'utf8');
  console.log(`   ✅ ${releaseFile}`);

  // docs/[versao].md
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  const docsFile = path.join(docsDir, `${VERSION}.md`);
  const docsMarkdown = `# ${VERSION} — ${releaseNotes.date}\n\n${releaseNotes.summary}\n\n${docsContent}`;
  fs.writeFileSync(docsFile, docsMarkdown, 'utf8');
  console.log(`   ✅ ${docsFile}`);

  // Atualizar índice de releases (releases/index.json)
  const indexFile = path.join(releasesDir, 'index.json');
  let index = [];
  if (fs.existsSync(indexFile)) {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  }
  // Adiciona no topo se ainda não existir
  if (!index.find(r => r.version === VERSION)) {
    index.unshift({ version: VERSION, date: releaseNotes.date, summary: releaseNotes.summary });
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf8');
    console.log(`   ✅ releases/index.json atualizado`);
  }

  console.log('\n🎉 Agente concluído com sucesso!\n');
}

run().catch(err => {
  console.error('❌ Erro no agente:', err);
  process.exit(1);
});
