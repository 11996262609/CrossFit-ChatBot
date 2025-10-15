// ========== IMPORTS ==========
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js'); // mantém LocalAuth
const fs = require('fs');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const puppeteer = require('puppeteer');

// Logs globais
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]', e));

console.log('[BOOT] Node', process.version);

// ========== ESTADO ==========
let latestQR = null;
let latestQRAt = null;
let isReady = false;

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : '');

// ========== DONO / ALERTAS ==========
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '5511996262609').replace(/\D/g, ''); // seu número (só dígitos)
const OWNER_JID = `${OWNER_NUMBER}@c.us`; // JID do WhatsApp (ex.: 5511996262609@c.us)

// helper: extrai só os dígitos do JID do cliente para montar link clicável (wa.me)
const jidToNumber = (jid) => String(jid || '').replace('@c.us', '');

// ========== HTTP ==========
const app = express();
const PORT = Number(process.env.PORT) || 3000;
console.log('[HTTP] Vai ouvir na porta:', PORT);

const noCache = (res) => {
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  res.set('Surrogate-Control','no-store');
};

// ---- ROTAS BÁSICAS ----
app.get('/health', (_req, res) => res.status(200).send('ok'));

app.get('/status', (_req, res) => {
  res.json({ isReady, hasQR: Boolean(latestQR), latestQRAt, now: new Date() });
});

// raiz → QR fullscreen
app.get('/', (_req, res) => res.redirect(302, '/qr-plain'));

// QR fullscreen (auto-refresh)
app.get('/qr-plain', (_req, res) => {
  noCache(res);
  const refresh = '<meta http-equiv="refresh" content="2">';
  if (!latestQR) {
    return res.type('html').send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${refresh}<title>QR do WhatsApp</title>
<style>html,body{height:100%;margin:0;background:#fff}</style>`);
  }
  return res.type('html').send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${refresh}<title>QR do WhatsApp</title>
<style>
  html,body{height:100%;margin:0;background:#fff}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%}
  img{max-width:92vmin;max-height:92vmin;image-rendering:pixelated}
</style>
<div class="wrap"><img src="/qr.png" alt="QR WhatsApp"></div>`);
});

// QR em SVG
app.get('/qr.svg', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const svg = await QRCode.toString(latestQR, { type:'svg', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/svg+xml').send(svg);
  } catch {
    res.status(500).send('Falha ao gerar QR');
  }
});

// QR em PNG
app.get('/qr.png', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const buf = await QRCode.toBuffer(latestQR, { type:'png', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/png').send(buf);
  } catch {
    res.status(500).send('Falha ao gerar QR');
  }
});

// Proteção opcional por token
const QR_SECRET = process.env.QR_SECRET || '';
function checkQrAuth(req, res, next) {
  if (!QR_SECRET) return next();
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = req.query.token || req.headers['x-qr-token'] || bearer;
  if (token === QR_SECRET) return next();
  return res.status(401).send('Unauthorized');
}

app.get('/whatsapp-qr', checkQrAuth, async (_req, res) => {
  try {
    if (!latestQR) return res.status(404).send('Sem QR disponível (já conectado ou aguardando reinício).');
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.type('text/html; charset=utf-8').send(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>QR WhatsApp</title></head>
        <body style="font-family:system-ui, sans-serif; text-align:center; padding:24px">
          <h2>Escaneie no WhatsApp → Aparelhos conectados → Conectar um aparelho</h2>
          <p>Gerado em: ${latestQRAt?.toLocaleString('pt-BR') || '-'}</p>
          <img src="${dataUrl}" alt="QR WhatsApp" style="max-width:360px; width:100%; height:auto;"/>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('[QR_ROUTE_ERROR]', e);
    res.status(500).send('Falha ao gerar/exibir o QR.');
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Health-check na porta ${PORT}`));

// ========== WHATSAPP (FINAL LIMPO) ==========
const DATA_PATH = process.env.WWEBJS_DATA_PATH || './.wwebjs_auth';
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: DATA_PATH, clientId: 'default' }),
  puppeteer: {
    headless: true,                 // ou 'new' no Node 20+
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
      '--hide-scrollbars',
      '--mute-audio',
      '--window-size=800,600',
      '--remote-debugging-pipe',
      '--no-zygote'
    ],
  },
});

// QR / status
client.on('qr', (qr) => {
  latestQR = qr;
  latestQRAt = new Date();
  isReady = false;
  console.log('[QR] Aguardando leitura…', PUBLIC_URL ? `(${PUBLIC_URL}/qr-plain)` : '');
  try { qrcodeTerminal.generate(qr, { small: true }); } catch {}
});

client.on('ready', () => {
  console.log('[READY] WhatsApp conectado');
  latestQR = null;
  isReady = true;
});

client.on('auth_failure', (m) => console.error('[AUTH_FAILURE]', m));
client.on('disconnected', (r) => { console.error('[DISCONNECTED]', r); isReady = false; });

// ===== Utils
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const typing = async (chat, ms = 1200) => { await chat.sendStateTyping(); await delay(ms); };
const firstName = v => (v ? String(v).trim().split(/\s+/)[0] : '');

// ===== Textos
const menuText = (nome = '') => 
`Olá ${firstName(nome)}! 👋

Seja bem-vindo(a) à família Madala CF! 💪

Com 10 anos de mercado, levamos a sério o compromisso que assumimos com você.
Sua saúde e seu bem-estar são nossa prioridade.

Escolha uma opção para descobrir mais sobre a Madala CF (envie o número):
1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judô todas as quartas às 21h
3 - 🌐 Redes sociais da Madala CF
4 - 🏆 Eventos da Madala CF
0 - ☎ Falar com o recepcionista 
`;

function cfPosMenu(nome = '') {
  const n = firstName(nome);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Mais*   → 📊 Planos e valores
• *Marcar* → 🗓️ Agendar sua aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}

function menu_rápido(nome = '') {
  const n = firstName(nome);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}

function menu_agendamento(nome = '') {
  const n = firstName(nome);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Marcar* → 🗓️ Agendar sua aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}

// helper p/ sequência dos cards
const RESPOSTAS = {
  comoFunciona: (nome = '') => {
    const n = firstName(nome);
    const titulo = `*COMO FUNCIONA O CROSSFIT${n ? `, ${n}` : ''}?*`;
    return `${titulo}

• Estamos abertos de seg. a sáb., das 6h às 21h.
• Treinos em grupo, com coach supervisionando a turma (todos os níveis).
• Escalas: Iniciante, Intermediário e Avançado.
• Aceitamos apenas pagamentos no cartão Débito/crédito, PIX.
• Não trabalhamos com Gynpass ou qualquer outro tipo de convênio.

📍 Localização: https://maps.app.goo.gl/nyDBAPzNLLBHYWMJ9

Bora fazer uma aula experimental? 💪
✅ Agende sua aula:
https://calendar.app.google/rePcx9VnTSRc1X9Z7`;
  },

  planos: (nome = '') => {
    const n = firstName(nome);
    const titulo = n
      ? `*Bora, ${n}, escolher seu plano?* (CrossFit Premium)`
      : `*Bora escolher seu plano?* (CrossFit Premium)`;

    return `${titulo}
💰 Trimestral: R$569,90/mês
💰 Semestral: R$489,90/mês
💰 Anual: R$399,99/mês

Formas de pagamento: cartão, PIX e boleto.`;
  },

  agendarCrossfit: (nome = '') => {
    const n = firstName(nome);
    return `🗓️ *Agende sua aula experimental de CrossFit*
${n ? `${n}, ` : ''}escolha seu melhor horário no link:
https://calendar.app.google/rePcx9VnTSRc1X9Z7`;
  },

  Modalidade_judo: (nome = '') => {
    const n = firstName(nome);
    return `*Judô* 🥋
Venha${n ? `, ${n},` : ''} aprender judô com o *Sensei Jeferson* na Madala CF! 👊
• Aulas às quartas, às 21h (duração: 1h).
• Instrutor: *Sensei Jeferson*.
• Mensalidade: R$200,00.
• Turmas para todos os níveis (iniciante ao avançado).

✅ Agende sua aula experimental:
https://calendar.google.com/calendar/u/0/r/month/2025/9/24`;
  },

  Eventos_madalacf: (nome = '') => {
    const n = firstName(nome);
    return `*Eventos*
Fique por dentro${n ? `, ${n},` : ''} do que rola na Madala CF:

• Torneios internos e abertos (CrossFit e Judô).
• Workshops e palestras com profissionais renomados.
• Aulas especiais temáticas.
• Encontros sociais e confraternizações.

Participe e fortaleça nossa comunidade! 🤝
📅 Mais detalhes e inscrições no link:
https://calendar.app.google/SEWQHDEavA3huYhYA`;
  },

  atendente: (nome = '') => {
    const n = firstName(nome);
    return `Este é o contato do *Tchê* (gerente-geral) 👨‍💼
${n ? `${n}, ` : ''}pronto para te ajudar com qualquer dúvida ou suporte.

WhatsApp: https://wa.me/qr/LI5TG3DW5XAZF1

Envie uma mensagem e aguarde um momento para o retorno.`;
  },

  // Redes sociais (link atualizado)
  site: `*REDES SOCIAIS MADALA CF* 📱
🌐 Site oficial
https://www.madalacf.com.br/`,
};

// ===== Estado simples por chat =====
const estado = {}; // { [chatId]: 'MAIN' | 'CF_MENU' | 'AWAIT_HUMAN' }
const STATES = { MAIN: 'MAIN', CF_MENU: 'CF_MENU', AWAIT_HUMAN: 'AWAIT_HUMAN' };

// ===== Regex de saudações (asciiText já vem sem acentos) =====
const SAUDACOES_RE = /\b(menu|oi|ola|oie|hey|eai|bom dia|boa tarde|boa noite|hello|hi|alo|aloo|opa|e ae|e aew|eae|fala|falae|salve|yo|blz|beleza|tudo bem|como vai|iniciar|inicio|start|comecar|ajuda|help|suporte|atendimento|quero falar|quero atendimento|preciso de ajuda)\b/i;

// ===== Menu em texto (sem List) =====
async function enviarMenu(msg, _chat, nome) {
  await client.sendMessage(msg.from, menuText(nome));
}

// ===== Router principal (UM ÚNICO listener) =====
client.on('message', async (msg) => {
  try {
    // Ignora grupos/status
    if (!msg.from.endsWith('@c.us')) return;

    // evita loop ao enviar alerta para você mesmo
    if (msg.fromMe || msg.from === OWNER_JID) return;

    const chat    = await msg.getChat();
    const contact = await msg.getContact();
    const nome    = contact.pushname || contact.name || contact.shortName || contact.number || '';
    const chatId  = msg.from;

    // Estado atual
    const current = estado[chatId] || STATES.MAIN;

    // ===== ETAPA 2 DO HANDOFF: aguardando descrição =====
    if (current === STATES.AWAIT_HUMAN) {
      const assunto = (msg.body || '').trim() || '[sem texto]';
      const numeroCliente = jidToNumber(msg.from);

      // 1) Notifica você (no mesmo número) — SOMENTE a mensagem de texto
      const alerta = [
        '🔔 *Novo cliente aguardando atendimento*',
        `• *Nome:* ${nome || '-'}`,
        `• *Número:* https://wa.me/${numeroCliente}`,
        `• *Assunto informado:* "${assunto}"`,
        `• *Quando:* ${new Date().toLocaleString('pt-BR')}`,
      ].join('\n');

      try {
        await client.sendMessage(OWNER_JID, alerta);
      } catch (e) {
        console.error('[HANDOFF] Falha ao alertar o owner:', e);
      }

      // 2) Confirma para o cliente
      await client.sendMessage(chatId, 'Aguarde, estamos direcionando seu atendimento.');
      estado[chatId] = STATES.MAIN;
      return;
    }

    // ⬇️ ANEXOS PRIMEIRO (fora do fluxo de handoff)
    if (msg.hasMedia || msg.type === 'image' || msg.type === 'document') {
      await msg.reply('Obrigado! Estamos anexando documento no sistema.');
      return;
    }

    // Normalização
    const rawText   = (msg.body || '').toString().trim();
    const lowerText = rawText.toLowerCase();
    let   asciiText = lowerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se mandou comprovante por texto (sem anexo), não abre menu
    const looksLikeReceipt =
      /(comprovante|pagamento|paguei|pix|boleto|nota|nf|recibo)/i.test(rawText);
    if (looksLikeReceipt) {
      await msg.reply('Obrigado! Estamos anexando documento no sistema.');
      return;
    }

    // ===== INTENTS PRIORITÁRIAS (antes de saudação) =====
    const wantsPrice = /\b(preco|preço|valor|valores|tabela|quanto|mensal|mensalidade|plano|planos?)\b/i.test(asciiText);
    const wantsSchedule = /\b(agendar|agendamento|marcar|agenda|horario|horarios|disponibilidade|aula experimental|trial|drop[ -]?in)\b/i.test(asciiText);

    if (wantsPrice) {
      await typing(chat);
      const planosMsg = (typeof RESPOSTAS?.planos === 'function') ? RESPOSTAS.planos(nome) : RESPOSTAS.planos;
      if (planosMsg) await client.sendMessage(chatId, planosMsg);
      await client.sendMessage(chatId, 'Posso agendar sua aula experimental ou voltar ao menu. Digite *marcar* ou *menu*.');
      return;
    }

    if (wantsSchedule) {
      await typing(chat);
      const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
      if (agendaMsg) await client.sendMessage(chatId, agendaMsg);
      await client.sendMessage(chatId, 'Se quiser, digite *mais* para ver planos e valores ou *menu* para voltar.');
      return;
    }

    // ===== Gatilho de saudação/menu (vem DEPOIS dos intents) =====
    const ehSaudacao = SAUDACOES_RE.test(asciiText);
    if (ehSaudacao) {
      estado[chatId] = STATES.MAIN;
      await enviarMenu(msg, chat, nome);
      return;
    }

    const st = estado[chatId] || STATES.MAIN;

    // ===== MAIN (menu principal) =====
    if (st === STATES.MAIN) {
      // 0) Atendente (inicia handoff → pede descrição)
      if (asciiText === '0' || lowerText.startsWith('0 - ☎')) {
        await typing(chat);
        await client.sendMessage(
          chatId,
          'Certo! Para direcionarmos seu atendimento, por favor descreva *em uma única mensagem* o assunto/dúvida (ex.: "cancelamento de plano", "erro no pagamento", "ajuda no agendamento").'
        );
        estado[chatId] = STATES.AWAIT_HUMAN;
        return;
      }

      // atalhos texto
      if (/^\s*mais\b/.test(lowerText)) {
        await typing(chat);
        const planosMsg = (typeof RESPOSTAS?.planos === 'function') ? RESPOSTAS.planos(nome) : RESPOSTAS.planos;
        if (planosMsg) await client.sendMessage(chatId, planosMsg);

        await typing(chat);
        const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
        if (agendaMsg) await client.sendMessage(chatId, agendaMsg);
        return;
      } else if (/^\s*marcar\b/.test(lowerText)) {
        await typing(chat);
        const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
        if (agendaMsg) await client.sendMessage(chatId, agendaMsg);
        return;
      } else if (/^\s*menu\b/.test(lowerText)) {
        await typing(chat);
        await client.sendMessage(chatId, menu_rápido(nome));
        return;
      } else if (/^\s*sair\b/.test(lowerText)) {
        await typing(chat);
        await client.sendMessage(chatId, 'Ok! Conversa encerrada. 👋');
        return;
      }

      // 1) CrossFit - Como funciona
      if (asciiText === '1' || lowerText.startsWith('1 - 🏋️') || /\bcomo funciona\b/.test(lowerText)) {
        await typing(chat);
        const msgComoFunciona = (typeof RESPOSTAS?.comoFunciona === 'function') ? RESPOSTAS.comoFunciona(nome) : RESPOSTAS.comoFunciona;
        if (msgComoFunciona) await client.sendMessage(chatId, msgComoFunciona);

        await typing(chat);
        await client.sendMessage(chatId, cfPosMenu(nome));
        return;
      }

      // 2) Judô
      if (asciiText === '2' || lowerText.startsWith('2 - 🥋')) {
        await typing(chat);
        const judoMsg = (typeof RESPOSTAS?.Modalidade_judo === 'function') ? RESPOSTAS.Modalidade_judo(nome) : RESPOSTAS.Modalidade_judo;
        if (judoMsg) await client.sendMessage(chatId, judoMsg);

        await typing(chat);
        await client.sendMessage(chatId, menu_rápido(nome));
        return;
      }

      // 3) Redes sociais — envia card único (site)
      if (asciiText === '3' || lowerText.startsWith('3 - 🌐')) {
        await typing(chat);
        const texto = RESPOSTAS.site;
        if (texto) await client.sendMessage(chatId, texto);
        await typing(chat);
        await client.sendMessage(chatId, menu_rápido(nome));
        return;
      }

      // 4) Eventos
      if (asciiText === '4' || lowerText.startsWith('4 - 🏆')) {
        await typing(chat);
        const eventosMsg = (typeof RESPOSTAS?.Eventos_madalacf === 'function') ? RESPOSTAS.Eventos_madalacf(nome) : RESPOSTAS.Eventos_madalacf;
        if (eventosMsg) await client.sendMessage(chatId, eventosMsg);

        await typing(chat);
        await client.sendMessage(chatId, menu_rápido(nome));
        return;
      }

      // Fallback no MAIN
      await typing(chat);
      await client.sendMessage(chatId, 'Não entendi. Toque em "Ver opções" ou digite *menu* para abrir o menu.');
      await enviarMenu(msg, chat, nome);
      return;
    }

    // ===== CF_MENU (pós-menu do CrossFit) =====
    if (st === STATES.CF_MENU) {
      // "mais" → planos
      if ([
        'mais', 'planos', 'plano', 'valores', 'valor',
        'preco', 'precos', 'mensalidade', 'mensalidades',
        'pacote', 'pacotes', 'tabela preco', 'tabela de preco', 'tabela de precos',
        'quanto custa', 'quanto e', 'quanto fica', 'quanto sai',
        'por mes', 'quanto por mes', 'preco crossfit', 'preco da mensalidade',
        'investimento', 'mensal', 'trimestral', 'semestral', 'anual',
        'promocao', 'desconto', 'matricula', 'taxa'
      ].includes(asciiText)) {
        await typing(chat);
        const planosMsg = (typeof RESPOSTAS?.planos === 'function') ? RESPOSTAS.planos(nome) : RESPOSTAS.planos;
        await client.sendMessage(chatId, planosMsg);
        await client.sendMessage(chatId, cfPosMenu(nome));
        return;
      }

      // "marcar" → agendamento
      if ([
        'marcar', 'agendar', 'agendamento',
        'reservar', 'reserva', 'bookar', 'booking',
        'agenda', 'horario', 'horarios',
        'disponibilidade', 'disponivel',
        'vaga', 'vagas', 'encaixe', 'encaixar',
        'inscricao', 'inscrever', 'matricula', 'matricular',
        'aula experimental', 'aula teste', 'aula avulsa', 'trial',
        'drop in', 'drop-in', 'dropin'
      ].includes(asciiText)) {
        await typing(chat);
        const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
        await client.sendMessage(chatId, agendaMsg);
        await client.sendMessage(chatId, cfPosMenu(nome));
        return;
      }

      // "menu"/"inicio" → volta ao menu inicial
      if ([
        'menu', 'menu inicial', 'menu principal',
        'inicio', 'tela inicial', 'pagina inicial', 'home',
        'voltar ao menu', 'voltar pro menu', 'voltar p menu', 'voltar p/ menu', 'voltar menu',
        'retornar ao menu', 'retornar pro menu',
        'voltar ao inicio', 'voltar pro inicio', 'voltar p/ inicio', 'voltar p inicio',
        'ir para o menu', 'ir ao menu', 'menu por favor',
        '/menu', '/start', 'start', 'back'
      ].includes(asciiText)) {
        estado[chatId] = STATES.MAIN;
        await enviarMenu(msg, chat, nome);
        return;
      }

      // "sair" → encerra (reseta estado)
      if (asciiText === 'sair') {
        await client.sendMessage(chatId, 'Até logo! 👋');
        estado[chatId] = STATES.MAIN;
        return;
      }

      // Inválido no CF_MENU → reexibe instruções
      await client.sendMessage(chatId, cfPosMenu(nome));
      return;
    }

  } catch (err) {
    console.error('Erro no processamento da mensagem:', err);
  }
});

// Inicializa por último (melhor prática)
client.initialize();

// ===== Encerramento gracioso (Koyeb/containers) =====
process.on('SIGTERM', async () => {
  try {
    console.log('[SHUTDOWN] encerrando…');
    await client.destroy();
  } catch (e) {
    console.error('[SHUTDOWN] erro', e);
  } finally {
    process.exit(0);
  }
});
